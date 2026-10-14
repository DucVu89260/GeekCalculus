"""Analytical sectional properties; no HTTP, database, material or FEM imports."""

from dataclasses import dataclass
from decimal import Decimal, localcontext
import hashlib
import json
import math

from pydantic import ValidationError

from .errors import CalculationError, ConvergenceError, UnsupportedPropertyError
from .models import AngleGeometry, CalculationOptions, ChannelGeometry, CircleGeometry, CircularHollowGeometry, Geometry, ISectionGeometry, RectangleGeometry, RectangularHollowGeometry, TeeGeometry, geometry_definition, geometry_hash, validate_geometry
from .results import AdvancedProperties, AdvancedProperty, CalculationResult, EffectiveShearAreaProperty, EffectiveShearAreaValue, ElasticProperties, GeometricProperties, PlasticProperties, PrincipalProperties, Properties, ShearCenterProperty, ShearCenterValue, SolverIdentity
from .torsion import rectangle_torsion

SOLVER_VERSION = "1.2.0"


@dataclass(frozen=True)
class RectangleComponent:
    width: float
    height: float
    x: float
    y: float

    @property
    def area(self) -> float:
        return self.width * self.height


def i_components(geometry: ISectionGeometry) -> tuple[RectangleComponent, ...]:
    """Bottom flange, clear web, top flange: no overlaps, centered in X."""
    width = max(geometry.top_flange_width, geometry.bottom_flange_width)
    web_height = geometry.depth - geometry.top_flange_thickness - geometry.bottom_flange_thickness
    return (
        RectangleComponent(geometry.bottom_flange_width, geometry.bottom_flange_thickness, (width - geometry.bottom_flange_width) / 2, 0.0),
        RectangleComponent(geometry.web_thickness, web_height, (width - geometry.web_thickness) / 2, geometry.bottom_flange_thickness),
        RectangleComponent(geometry.top_flange_width, geometry.top_flange_thickness, (width - geometry.top_flange_width) / 2, geometry.depth - geometry.top_flange_thickness),
    )


def composite_components(geometry: Geometry) -> tuple[RectangleComponent, ...]:
    """Non-overlapping rectangles for sharp-corner composite sections."""
    if isinstance(geometry, ISectionGeometry):
        return i_components(geometry)
    if isinstance(geometry, RectangularHollowGeometry):
        inner_height = geometry.height - 2 * geometry.thickness
        return (
            RectangleComponent(geometry.width, geometry.thickness, 0.0, 0.0),
            RectangleComponent(geometry.width, geometry.thickness, 0.0, geometry.height - geometry.thickness),
            RectangleComponent(geometry.thickness, inner_height, 0.0, geometry.thickness),
            RectangleComponent(geometry.thickness, inner_height, geometry.width - geometry.thickness, geometry.thickness),
        )
    if isinstance(geometry, ChannelGeometry):
        clear_depth = geometry.depth - 2 * geometry.flange_thickness
        return (
            RectangleComponent(geometry.width, geometry.flange_thickness, 0.0, 0.0),
            RectangleComponent(geometry.web_thickness, clear_depth, 0.0, geometry.flange_thickness),
            RectangleComponent(geometry.width, geometry.flange_thickness, 0.0, geometry.depth - geometry.flange_thickness),
        )
    if isinstance(geometry, TeeGeometry):
        clear_depth = geometry.depth - geometry.flange_thickness
        return (
            RectangleComponent(geometry.web_thickness, clear_depth, (geometry.width - geometry.web_thickness) / 2, 0.0),
            RectangleComponent(geometry.width, geometry.flange_thickness, 0.0, geometry.depth - geometry.flange_thickness),
        )
    if isinstance(geometry, AngleGeometry):
        clear_depth = geometry.depth - geometry.thickness
        return (
            RectangleComponent(geometry.width, geometry.thickness, 0.0, 0.0),
            RectangleComponent(geometry.thickness, clear_depth, 0.0, geometry.thickness),
        )
    raise TypeError("geometry is not a composite rectangle section")


def _plastic_axis(parts: tuple[RectangleComponent, ...], *, axis: str) -> tuple[float, float, dict]:
    """Find one half-area cut and absolute first moment from exact rectangle bands."""
    with localcontext() as context:
        context.prec = 80
        if axis == "y":
            blocks = [(Decimal(str(part.width)), Decimal(str(part.y)), Decimal(str(part.y + part.height))) for part in parts]
        else:
            blocks = [(Decimal(str(part.height)), Decimal(str(part.x)), Decimal(str(part.x + part.width))) for part in parts]
        total_area = sum((span * (end - start) for span, start, end in blocks), Decimal(0))
        if total_area <= 0:
            raise ArithmeticError("section area is outside the numerical range")
        target = total_area / 2

        def area_below(cut: Decimal) -> Decimal:
            return sum((span * max(Decimal(0), min(end - start, cut - start)) for span, start, end in blocks), Decimal(0))

        low = min(start for _, start, _ in blocks)
        high = max(end for _, _, end in blocks)
        for iteration in range(1, 257):
            cut = (low + high) / 2
            below = area_below(cut)
            if abs(2 * below - total_area) / total_area <= Decimal("1e-24"):
                break
            if below < target:
                if low == cut:
                    break
                low = cut
            else:
                if high == cut:
                    break
                high = cut
        slope = sum((span for span, start, end in blocks if start <= cut < end), Decimal(0))
        if slope:
            cut += (target - area_below(cut)) / slope
        exported_cut = float(cut)
        actual_cut = Decimal(str(exported_cut))
        below = area_below(actual_cut)
        balance = abs(2 * below - total_area) / total_area
        if not math.isfinite(exported_cut) or not float(min(start for _, start, _ in blocks)) < exported_cut < float(max(end for _, _, end in blocks)) or balance > Decimal("1e-10"):
            raise ConvergenceError("Plastic neutral axis did not meet the area-balance tolerance.", details={"axis": axis, "relative_area_imbalance": float(balance)})
        moments = []
        for span, start, end in blocks:
            if actual_cut <= start:
                moment = span * (end - start) * ((start + end) / 2 - actual_cut)
            elif actual_cut >= end:
                moment = span * (end - start) * (actual_cut - (start + end) / 2)
            else:
                moment = span * ((actual_cut - start) ** 2 + (end - actual_cut) ** 2) / 2
            moments.append(moment)
        return exported_cut, float(sum(moments, Decimal(0))), {
            "method": "component_area_bisection_with_piecewise_linear_refinement",
            "arithmetic": "decimal_80_then_float64",
            "iterations": iteration,
            "relative_area_imbalance": float(balance),
        }


def _principal_properties(ix: float, iy: float, ixy: float) -> PrincipalProperties:
    if ix == iy and ixy == 0:
        return PrincipalProperties(i_major=ix, i_minor=ix, major_axis_angle_degrees=None, orientation_status="indeterminate")
    scale = max(abs(ix), abs(iy), abs(ixy))
    mean = (ix / scale + iy / scale) / 2
    radius = math.hypot((ix / scale - iy / scale) / 2, ixy / scale)
    major = scale * (mean + radius)
    with localcontext() as context:
        context.prec = 80
        determinant = Decimal(str(ix)) * Decimal(str(iy)) - Decimal(str(ixy)) ** 2
        minor = float(determinant / Decimal(str(major))) if major > 0 else 0.0
    if not math.isfinite(major) or not math.isfinite(minor) or major <= 0 or minor <= 0:
        raise ArithmeticError("principal inertias are outside the numerical range")
    angle = math.degrees(0.5 * math.atan2(-2 * ixy, ix - iy)) % 180.0
    if angle >= 180.0 - 1e-12:
        angle = 0.0
    return PrincipalProperties(i_major=major, i_minor=minor, major_axis_angle_degrees=angle, orientation_status="determinate")


def _plastic_x(geometry: ISectionGeometry) -> tuple[float, float, dict]:
    # Bisection and area moments use canonical decimal dimensions, avoiding
    # cancellation between nearly equal flange areas and a very thin web.
    # Only the final result is converted to the public float64 data contract.
    with localcontext() as context:
        context.prec = 80
        h, bt, bb, tw, tt, tb = [Decimal(str(getattr(geometry, key))) for key in (
            "depth", "top_flange_width", "bottom_flange_width", "web_thickness",
            "top_flange_thickness", "bottom_flange_thickness")]
        blocks = [(bb, Decimal(0), tb), (tw, tb, h - tt), (bt, h - tt, h)]
        area = sum((width * (end - start) for width, start, end in blocks), Decimal(0))
        target = area / 2

        def below(cut):
            return sum((width * max(Decimal(0), min(end - start, cut - start)) for width, start, end in blocks), Decimal(0))

        low, high = Decimal(0), h
        for iteration in range(1, 257):
            cut = (low + high) / 2
            current_area = below(cut)
            if abs(2 * current_area - area) / area <= Decimal("1e-24"):
                break
            if current_area < target:
                if low == cut:
                    break
                low = cut
            else:
                if high == cut:
                    break
                high = cut
        slope = sum((width for width, start, end in blocks if start <= cut < end), Decimal(0))
        if slope:
            cut += (target - below(cut)) / slope
        pna = float(cut)
        # Verify the actual coordinate exported to consumers, not only the
        # extended-precision coordinate held during the calculation.
        actual_cut = Decimal(str(pna))
        actual_below = below(actual_cut)
        balance = abs(2 * actual_below - area) / area
        if not 0 < actual_cut < h or balance > Decimal("1e-10"):
            raise ConvergenceError("Plastic neutral axis did not meet the area-balance tolerance.", details={"relative_area_imbalance": float(balance)})
        moments = []
        for width, start, end in blocks:
            if actual_cut <= start:
                moment = width * (end - start) * ((start + end) / 2 - actual_cut)
            elif actual_cut >= end:
                moment = width * (end - start) * (actual_cut - (start + end) / 2)
            else:
                moment = width * ((actual_cut - start)**2 + (end - actual_cut)**2) / 2
            moments.append(moment)
        return pna, float(sum(moments, Decimal(0))), {
            "method": "area_bisection_with_piecewise_linear_refinement",
            "arithmetic": "decimal_80_then_float64",
            "iterations": iteration,
            "area_below": float(actual_below),
            "area_above": float(area - actual_below),
            "relative_area_imbalance": float(balance),
        }


def solver_config_hash(options: CalculationOptions) -> str:
    encoded = json.dumps(options.model_dump(mode="json"), sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode()).hexdigest()


def _unavailable(reason: str) -> AdvancedProperty:
    return AdvancedProperty(status="not_computed", value=None, reason=reason)


def _unavailable_shear_center(reason: str) -> ShearCenterProperty:
    return ShearCenterProperty(status="not_computed", value=None, reason=reason)


def _unavailable_effective_shear_area(reason: str) -> EffectiveShearAreaProperty:
    return EffectiveShearAreaProperty(status="not_computed", value=None, reason=reason)


def _i_section_advanced(geometry: ISectionGeometry, centroid_y: float) -> tuple[dict[str, object], dict[str, object]]:
    """Evaluate Vlasov/centerline thin-wall estimates for a sharp-corner I/H.

    Effective shear areas use the same idealized centerline section. The web
    shear-flow squared is quartic, so three-point Gauss-Legendre integration is
    exact for its energy integral. These estimates do not model thick-wall
    elasticity, fillets, restraint, or warping boundary conditions.
    """
    with localcontext() as context:
        context.prec = 80
        dec = lambda value: Decimal(str(value))
        h = dec(geometry.depth)
        bt, bb = dec(geometry.top_flange_width), dec(geometry.bottom_flange_width)
        tt, tb, tw = dec(geometry.top_flange_thickness), dec(geometry.bottom_flange_thickness), dec(geometry.web_thickness)
        yb, yt = tb / 2, h - tt / 2
        h0 = yt - yb
        iyb, iyt = tb * bb**3 / 12, tt * bt**3 / 12
        flange_i = iyb + iyt

        # The harmonic product is algebraically Ib*It/(Ib+It), with less
        # intermediate growth than multiplying both flange inertias first.
        low_i, high_i = min(iyb, iyt), max(iyb, iyt)
        cw = h0**2 * (low_i / (1 + low_i / high_i))
        shear_center_y = (iyb * yb + iyt * yt) / flange_i
        width = max(bt, bb)
        shear_center_x = width / 2
        shear_offset_y = shear_center_y - dec(centroid_y)

        # Thin-wall shear-energy estimate for horizontal (x) shear.
        ax_denominator = tb * bb**5 / 120 + tt * bt**5 / 120
        effective_ax = flange_i**2 / ax_denominator

        # For vertical shear, use the idealized line-area centroid and Ix,
        # web flow Q/Ix, and flange branch energy Iyf*(yf-cy)^2.
        area_bottom, area_web, area_top = bb * tb, tw * h0, bt * tt
        y_web = (yb + yt) / 2
        cy_line = (area_bottom * yb + area_web * y_web + area_top * yt) / (area_bottom + area_web + area_top)
        ix_line = (
            area_bottom * (yb - cy_line)**2
            + tw * (h0**3 / 12 + h0 * (y_web - cy_line)**2)
            + area_top * (yt - cy_line)**2
        )

        # Q(y) = At*(yt-cy) + tw/2*((yt-cy)^2-(y-cy)^2). Three-point
        # Gauss-Legendre integrates Q²/tw (a quartic) exactly.
        def web_first_moment(y: Decimal) -> Decimal:
            return area_top * (yt - cy_line) + tw / 2 * (yt - y) * (yt + y - 2 * cy_line)

        half_depth = h0 / 2
        mid = (yb + yt) / 2
        gauss_offset = half_depth * (Decimal(3) / 5).sqrt()
        q_lower = web_first_moment(mid - gauss_offset)
        q_mid = web_first_moment(mid)
        q_upper = web_first_moment(mid + gauss_offset)
        web_energy = half_depth / tw * (Decimal(5) / 9 * (q_lower**2 + q_upper**2) + Decimal(8) / 9 * q_mid**2)
        flange_energy = iyb * (yb - cy_line)**2 + iyt * (yt - cy_line)**2
        ay_denominator = web_energy + flange_energy
        effective_ay = ix_line**2 / ay_denominator

        def finite_value(value: Decimal, *, positive: bool = True) -> float | None:
            converted = float(value)
            if not math.isfinite(converted) or (positive and converted <= 0) or (value != 0 and converted == 0):
                return None
            return converted

        def diagnostic_value(value: Decimal) -> float | None:
            return finite_value(value, positive=False)

        cw_float = finite_value(cw)
        center_values = (
            finite_value(shear_center_x), finite_value(shear_center_y),
            finite_value(Decimal(0), positive=False), finite_value(shear_offset_y, positive=False),
        )
        ax_float, ay_float = finite_value(effective_ax), finite_value(effective_ay)
        props: dict[str, object] = {}
        range_failures: list[str] = []
        if cw_float is None:
            props["warping_constant_cw"] = _unavailable("numerical_range")
            range_failures.append("warping_constant_cw")
        else:
            props["warping_constant_cw"] = AdvancedProperty(status="computed", value=cw_float, method="vlasov_thin_wall_i_section")
        if any(value is None for value in center_values):
            props["shear_center"] = _unavailable_shear_center("numerical_range")
            range_failures.append("shear_center")
        else:
            props["shear_center"] = ShearCenterProperty(
                status="computed",
                value=ShearCenterValue(x=center_values[0], y=center_values[1], offset_x=center_values[2], offset_y=center_values[3]),
                method="vlasov_thin_wall_i_section",
            )
        if ax_float is None or ay_float is None:
            props["effective_shear_area"] = _unavailable_effective_shear_area("numerical_range")
            range_failures.append("effective_shear_area")
        else:
            props["effective_shear_area"] = EffectiveShearAreaProperty(
                status="computed", value=EffectiveShearAreaValue(x=ax_float, y=ay_float),
                method="thin_wall_shear_energy_i_section",
            )
        d = {key: diagnostic_value(value) for key, value in {
            "centerline_depth": h0,
            "iy_bottom_flange": iyb,
            "iy_top_flange": iyt,
            "line_area_centroid_y": cy_line,
            "line_area_second_moment_ix": ix_line,
            "effective_shear_area_x_denominator": ax_denominator,
            "effective_shear_area_y_web_denominator": web_energy,
            "effective_shear_area_y_flange_denominator": flange_energy,
            "effective_shear_area_y_total_denominator": ay_denominator,
        }.items()}
    diagnostics: dict[str, object] = {
        "status": "partial" if range_failures else "computed",
        "model": "sharp_corner_centerline_thin_wall",
        "assumptions": [
            "uniform_homogeneous_material",
            "flanges_reduced_to_centerlines_for_warping_and_shear_flow",
            "web_retains_uniform_thickness_over_centerline_depth",
            "no_fillets_or_local_thick_wall_elasticity",
            "shear_center_offsets_from_gross_geometric_centroid",
            "effective_shear_area_is_an_energy_equivalent_thin_wall_estimate",
        ],
        "range_failures": range_failures,
        "centerline_depth": d["centerline_depth"],
        "flange_centroidal_inertias_about_y": {"bottom": d["iy_bottom_flange"], "top": d["iy_top_flange"]},
        "line_area_centroid_y": d["line_area_centroid_y"],
        "line_area_second_moment_ix": d["line_area_second_moment_ix"],
        "effective_shear_area_energy": {
            "x_flange_denominator": d["effective_shear_area_x_denominator"],
            "y_web_denominator": d["effective_shear_area_y_web_denominator"],
            "y_flange_denominator": d["effective_shear_area_y_flange_denominator"],
            "y_total_denominator": d["effective_shear_area_y_total_denominator"],
            "web_quadrature": "three_point_gauss_legendre_exact_for_quartic",
        },
    }
    return props, diagnostics


def calculate(geometry: Geometry, options: CalculationOptions | None = None) -> CalculationResult:
    """Compute from a validated geometry model, rechecking invariants at entry.

    Raw JSON belongs to validate_geometry/validate_geometry_definition first.
    A quick calculation returns a value only; nothing is persisted or mutated.
    """
    if not isinstance(geometry, (RectangleGeometry, CircleGeometry, ISectionGeometry, RectangularHollowGeometry, CircularHollowGeometry, ChannelGeometry, TeeGeometry, AngleGeometry)):
        raise TypeError("calculate requires a validated geometry model, not raw JSON")
    geometry = validate_geometry(geometry.model_dump())
    options = CalculationOptions() if options is None else CalculationOptions.model_validate(options)
    if isinstance(geometry, ISectionGeometry):
        supported = {"warping_constant_cw", "shear_center", "effective_shear_area"}
    elif isinstance(geometry, (RectangleGeometry, CircleGeometry, CircularHollowGeometry)):
        supported = {"torsion_constant_j"}
    else:
        supported = set()
    unsupported = set(options.required_properties) - supported
    if unsupported:
        raise UnsupportedPropertyError("A required advanced property has no v1 solver.", details={"properties": sorted(unsupported), "reason": "solver_not_implemented"})
    try:
        return _calculate_validated(geometry, options)
    except CalculationError:
        raise
    except (ArithmeticError, ValidationError) as error:
        raise CalculationError("Calculation cannot produce finite, positive properties at this numerical scale.", details={"reason": "floating_point_range"}) from error


def _calculate_validated(geometry: Geometry, options: CalculationOptions) -> CalculationResult:
    intermediates = {}
    diagnostics = {"plastic": {"status": "not_computed", "reason": "not_requested"}}
    plastic = None
    ixy = 0.0
    if isinstance(geometry, RectangleGeometry):
        width, height = geometry.width, geometry.height
        area = width * height
        centroid_x, centroid_y = width / 2, height / 2
        perimeter = 2 * (width + height)
        ix, iy = width * height**3 / 12, height * width**3 / 12
        if options.include_plastic:
            plastic = PlasticProperties(pna_x=centroid_x, pna_y=centroid_y, zx=width * height**2 / 4, zy=height * width**2 / 4)
            diagnostics["plastic"] = {"status": "computed", "method": "symmetric_closed_form", "relative_area_imbalance": 0.0}
    elif isinstance(geometry, CircleGeometry):
        width = height = geometry.diameter
        area = math.pi * width**2 / 4
        centroid_x = centroid_y = width / 2
        perimeter = math.pi * width
        ix = iy = math.pi * width**4 / 64
        if options.include_plastic:
            plastic = PlasticProperties(pna_x=centroid_x, pna_y=centroid_y, zx=width**3 / 6, zy=width**3 / 6)
            diagnostics["plastic"] = {"status": "computed", "method": "symmetric_closed_form", "relative_area_imbalance": 0.0}
    elif isinstance(geometry, CircularHollowGeometry):
        width = height = geometry.diameter
        inner_diameter = width - 2 * geometry.thickness
        area = math.pi * geometry.thickness * (width - geometry.thickness)
        centroid_x = centroid_y = width / 2
        perimeter = math.pi * (width + inner_diameter)
        ix = iy = area * (width**2 + inner_diameter**2) / 16
        if options.include_plastic:
            plastic_z = 2 * geometry.thickness * (width**2 + width * inner_diameter + inner_diameter**2) / 6
            plastic = PlasticProperties(pna_x=centroid_x, pna_y=centroid_y, zx=plastic_z, zy=plastic_z)
            diagnostics["plastic"] = {"status": "computed", "method": "annulus_symmetric_closed_form", "relative_area_imbalance": 0.0}
    else:
        parts = composite_components(geometry)
        if isinstance(geometry, ISectionGeometry):
            width, height = max(geometry.top_flange_width, geometry.bottom_flange_width), geometry.depth
        elif isinstance(geometry, RectangularHollowGeometry):
            width, height = geometry.width, geometry.height
        else:
            width, height = geometry.width, geometry.depth
        area = math.fsum(part.area for part in parts)
        if not math.isfinite(area) or area <= 0:
            raise ArithmeticError("section area is outside the numerical range")
        centroid_x = width / 2 if isinstance(geometry, ISectionGeometry) else math.fsum(part.area * (part.x + part.width / 2) for part in parts) / area
        centroid_y = math.fsum(part.area * (part.y + part.height / 2) for part in parts) / area
        ix = math.fsum(part.width * part.height**3 / 12 + part.area * (part.y + part.height / 2 - centroid_y)**2 for part in parts)
        iy = math.fsum(part.height * part.width**3 / 12 + part.area * (part.x + part.width / 2 - centroid_x)**2 for part in parts)
        ixy = math.fsum(part.area * (part.x + part.width / 2 - centroid_x) * (part.y + part.height / 2 - centroid_y) for part in parts)
        if not isinstance(geometry, AngleGeometry):
            # The supported non-angle composite definitions are symmetric
            # about at least one global axis, so their exact product inertia is zero.
            ixy = 0.0
        if isinstance(geometry, ISectionGeometry):
            perimeter = 2 * (geometry.top_flange_width + geometry.bottom_flange_width + height - geometry.web_thickness)
            intermediates = {"web_clear_depth": parts[1].height, "bottom_flange_area": parts[0].area, "web_area": parts[1].area, "top_flange_area": parts[2].area}
        elif isinstance(geometry, RectangularHollowGeometry):
            inner_width = width - 2 * geometry.thickness
            inner_height = height - 2 * geometry.thickness
            perimeter = 2 * (width + height) + 2 * (inner_width + inner_height)
            intermediates = {"inner_width": inner_width, "inner_height": inner_height, "wall_thickness": geometry.thickness}
        elif isinstance(geometry, ChannelGeometry):
            perimeter = 2 * height + 4 * width - 2 * geometry.web_thickness
            intermediates = {"clear_web_depth": parts[1].height, "web_area": parts[1].area, "flange_area_each": parts[0].area}
        elif isinstance(geometry, TeeGeometry):
            perimeter = 2 * (width + height)
            intermediates = {"clear_web_depth": parts[0].height, "web_area": parts[0].area, "flange_area": parts[1].area}
        else:
            perimeter = 2 * (width + height)
            intermediates = {"clear_vertical_leg_depth": parts[1].height, "horizontal_leg_area": parts[0].area, "vertical_leg_area": parts[1].area}
        if options.include_plastic:
            if isinstance(geometry, ISectionGeometry):
                pna_y, zx, plastic_diagnostics = _plastic_x(geometry)
                pna_x = width / 2
                zy = math.fsum(part.height * part.width**2 / 4 for part in parts)
                intermediates.update(pna_x=pna_x, pna_y=pna_y)
                diagnostics["plastic"] = {"status": "computed", **plastic_diagnostics}
            else:
                pna_x, zy, plastic_x_diagnostics = _plastic_axis(parts, axis="x")
                pna_y, zx, plastic_y_diagnostics = _plastic_axis(parts, axis="y")
                intermediates.update(pna_x=pna_x, pna_y=pna_y)
                diagnostics["plastic"] = {
                    "status": "computed",
                    "method": "component_area_bisection_with_piecewise_linear_refinement",
                    "x_axis": plastic_x_diagnostics,
                    "y_axis": plastic_y_diagnostics,
                }
            plastic = PlasticProperties(pna_x=pna_x, pna_y=pna_y, zx=zx, zy=zy)
    # Reject an invalid A/I before division, radii, and result serialization.
    if not all(math.isfinite(value) and value > 0 for value in (area, ix, iy)):
        raise ArithmeticError("section area or inertia is outside the numerical range")
    if not 0 < centroid_x < width or not 0 < centroid_y < height:
        raise ArithmeticError("centroid is outside the bounding box")
    if not math.isfinite(perimeter) or perimeter <= 0:
        raise ArithmeticError("section perimeter is outside the numerical range")
    geometric = GeometricProperties(area=area, perimeter=perimeter, centroid_x=centroid_x, centroid_y=centroid_y)
    elastic = ElasticProperties(ix=ix, iy=iy, ixy=ixy, sx_positive=ix / (height - centroid_y), sx_negative=ix / centroid_y, sy_positive=iy / (width - centroid_x), sy_negative=iy / centroid_x, rx=math.sqrt(ix / area), ry=math.sqrt(iy / area))
    principal = _principal_properties(ix, iy, ixy)
    want_j = options.include_advanced or "torsion_constant_j" in options.required_properties
    j = _unavailable("not_requested")
    if isinstance(geometry, ISectionGeometry):
        j = _unavailable("solver_not_implemented")
    elif want_j and isinstance(geometry, CircleGeometry):
        j = AdvancedProperty(status="computed", value=math.pi * geometry.diameter**4 / 32, method="solid_circle_closed_form")
        diagnostics["torsion"] = {"method": "solid_circle_closed_form"}
    elif want_j and isinstance(geometry, CircularHollowGeometry):
        j = AdvancedProperty(status="computed", value=2 * ix, method="circular_hollow_exact_polar_moment")
        diagnostics["torsion"] = {"method": "circular_hollow_exact_polar_moment"}
    elif want_j and isinstance(geometry, RectangleGeometry):
        torsion = rectangle_torsion(width, height, relative_tolerance=options.rectangle_j_relative_tolerance, max_terms=options.rectangle_j_max_terms)
        diagnostics["torsion"] = torsion.diagnostics
        if torsion.converged:
            j = AdvancedProperty(status="computed", value=torsion.value)
        else:
            if "torsion_constant_j" in options.required_properties:
                raise ConvergenceError("Required rectangle torsion did not meet the requested tolerance.", details={"property": "torsion_constant_j", "reason": torsion.reason, **torsion.diagnostics})
            j = _unavailable(torsion.reason)
    if isinstance(geometry, ISectionGeometry):
        wants_cw = options.include_advanced or "warping_constant_cw" in options.required_properties
        wants_shear_center = options.include_advanced or "shear_center" in options.required_properties
        wants_effective_shear = options.include_advanced or "effective_shear_area" in options.required_properties
        if wants_cw or wants_shear_center or wants_effective_shear:
            thin_wall_properties, thin_wall_diagnostics = _i_section_advanced(geometry, centroid_y)
            diagnostics["i_section_advanced"] = thin_wall_diagnostics
            for name in options.required_properties:
                if name in thin_wall_properties and thin_wall_properties[name].status != "computed":
                    raise CalculationError(
                        "A required advanced property is outside the numerical range.",
                        details={"property": name, "reason": "numerical_range"},
                    )
        else:
            thin_wall_properties = {}
        cw = thin_wall_properties.get("warping_constant_cw", _unavailable("not_requested")) if wants_cw else _unavailable("not_requested")
        shear_center = thin_wall_properties.get("shear_center", _unavailable_shear_center("not_requested")) if wants_shear_center else _unavailable_shear_center("not_requested")
        effective_shear = thin_wall_properties.get("effective_shear_area", _unavailable_effective_shear_area("not_requested")) if wants_effective_shear else _unavailable_effective_shear_area("not_requested")
    else:
        cw = _unavailable("solver_not_implemented")
        shear_center = _unavailable_shear_center("solver_not_implemented")
        effective_shear = _unavailable_effective_shear_area("solver_not_implemented")
        if not isinstance(geometry, (RectangleGeometry, CircleGeometry, CircularHollowGeometry)):
            j = _unavailable("solver_not_implemented")
    advanced = AdvancedProperties(torsion_constant_j=j, warping_constant_cw=cw, shear_center=shear_center, effective_shear_area=effective_shear)
    diagnostics["intermediate"] = intermediates
    diagnostics["bounding_box"] = {"x_min": 0.0, "y_min": 0.0, "x_max": width, "y_max": height}
    diagnostics["assumptions"] = ["dimensions_in_mm", "xy_plane_x_right_y_up", "bbox_origin_bottom_left", "centroidal_unrotated_inertias", "positive_coordinate_product_ixy", "sharp_corners", "homogeneous_geometric_plastic_properties"]
    return CalculationResult(geometry_type=geometry.type, geometry_hash=geometry_hash(geometry), solver=SolverIdentity(version=SOLVER_VERSION, config_hash=solver_config_hash(options)), normalized_input={"geometry": geometry_definition(geometry), "units": "mm", "options": options.model_dump(mode="json")}, properties=Properties(geometric=geometric, elastic=elastic, plastic=plastic, principal=principal), advanced=advanced, diagnostics=diagnostics)
