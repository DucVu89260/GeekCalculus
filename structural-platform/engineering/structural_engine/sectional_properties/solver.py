"""Analytical sectional properties; no HTTP, database, material or FEM imports."""

from dataclasses import dataclass
from decimal import Decimal, localcontext
import hashlib
import json
import math

from pydantic import ValidationError

from .errors import CalculationError, ConvergenceError, UnsupportedPropertyError
from .models import CalculationOptions, CircleGeometry, Geometry, ISectionGeometry, RectangleGeometry, geometry_definition, geometry_hash, validate_geometry
from .results import AdvancedProperties, AdvancedProperty, CalculationResult, ElasticProperties, GeometricProperties, PlasticProperties, PrincipalProperties, Properties, SolverIdentity
from .torsion import rectangle_torsion

SOLVER_VERSION = "1.0.0"


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


def calculate(geometry: Geometry, options: CalculationOptions | None = None) -> CalculationResult:
    """Compute from a validated geometry model, rechecking invariants at entry.

    Raw JSON belongs to validate_geometry/validate_geometry_definition first.
    A quick calculation returns a value only; nothing is persisted or mutated.
    """
    if not isinstance(geometry, (RectangleGeometry, CircleGeometry, ISectionGeometry)):
        raise TypeError("calculate requires a validated geometry model, not raw JSON")
    geometry = validate_geometry(geometry.model_dump())
    options = CalculationOptions() if options is None else CalculationOptions.model_validate(options)
    unsupported = set(options.required_properties) - {"torsion_constant_j"}
    if isinstance(geometry, ISectionGeometry) and "torsion_constant_j" in options.required_properties:
        unsupported.add("torsion_constant_j")
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
    else:
        parts = i_components(geometry)
        width, height = max(geometry.top_flange_width, geometry.bottom_flange_width), geometry.depth
        area = math.fsum(part.area for part in parts)
        if not math.isfinite(area) or area <= 0:
            raise ArithmeticError("section area is outside the numerical range")
        centroid_x = width / 2
        centroid_y = math.fsum(part.area * (part.y + part.height / 2) for part in parts) / area
        ix = math.fsum(part.width * part.height**3 / 12 + part.area * (part.y + part.height / 2 - centroid_y)**2 for part in parts)
        iy = math.fsum(part.height * part.width**3 / 12 for part in parts)
        perimeter = 2 * (geometry.top_flange_width + geometry.bottom_flange_width + height - geometry.web_thickness)
        intermediates = {"web_clear_depth": parts[1].height, "bottom_flange_area": parts[0].area, "web_area": parts[1].area, "top_flange_area": parts[2].area}
        if options.include_plastic:
            pna_y, zx, plastic_diagnostics = _plastic_x(geometry)
            zy = math.fsum(part.height * part.width**2 / 4 for part in parts)
            plastic = PlasticProperties(pna_x=centroid_x, pna_y=pna_y, zx=zx, zy=zy)
            intermediates.update(pna_x=centroid_x, pna_y=pna_y)
            diagnostics["plastic"] = {"status": "computed", **plastic_diagnostics}
    # Reject an invalid A/I before division, radii, and result serialization.
    if not all(math.isfinite(value) and value > 0 for value in (area, ix, iy)):
        raise ArithmeticError("section area or inertia is outside the numerical range")
    if not 0 < centroid_x < width or not 0 < centroid_y < height:
        raise ArithmeticError("centroid is outside the bounding box")
    geometric = GeometricProperties(area=area, perimeter=perimeter, centroid_x=centroid_x, centroid_y=centroid_y)
    elastic = ElasticProperties(ix=ix, iy=iy, ixy=0.0, sx_positive=ix / (height - centroid_y), sx_negative=ix / centroid_y, sy_positive=iy / (width - centroid_x), sy_negative=iy / centroid_x, rx=math.sqrt(ix / area), ry=math.sqrt(iy / area))
    principal = PrincipalProperties(i_major=max(ix, iy), i_minor=min(ix, iy), major_axis_angle_degrees=None if ix == iy else 0.0 if ix > iy else 90.0, orientation_status="indeterminate" if ix == iy else "determinate")
    want_j = options.include_advanced or "torsion_constant_j" in options.required_properties
    j = _unavailable("not_requested")
    if isinstance(geometry, ISectionGeometry):
        j = _unavailable("solver_not_implemented")
    elif want_j and isinstance(geometry, CircleGeometry):
        j = AdvancedProperty(status="computed", value=math.pi * geometry.diameter**4 / 32)
        diagnostics["torsion"] = {"method": "solid_circle_closed_form"}
    elif want_j:
        torsion = rectangle_torsion(width, height, relative_tolerance=options.rectangle_j_relative_tolerance, max_terms=options.rectangle_j_max_terms)
        diagnostics["torsion"] = torsion.diagnostics
        if torsion.converged:
            j = AdvancedProperty(status="computed", value=torsion.value)
        else:
            if "torsion_constant_j" in options.required_properties:
                raise ConvergenceError("Required rectangle torsion did not meet the requested tolerance.", details={"property": "torsion_constant_j", "reason": torsion.reason, **torsion.diagnostics})
            j = _unavailable(torsion.reason)
    advanced = AdvancedProperties(torsion_constant_j=j, warping_constant_cw=_unavailable("solver_not_implemented"), shear_center=_unavailable("solver_not_implemented"), effective_shear_area=_unavailable("solver_not_implemented"))
    diagnostics["intermediate"] = intermediates
    diagnostics["bounding_box"] = {"x_min": 0.0, "y_min": 0.0, "x_max": width, "y_max": height}
    diagnostics["assumptions"] = ["dimensions_in_mm", "xy_plane_x_right_y_up", "bbox_origin_bottom_left", "centroidal_unrotated_inertias", "positive_coordinate_product_ixy", "sharp_corners", "homogeneous_geometric_plastic_properties"]
    return CalculationResult(geometry_type=geometry.type, geometry_hash=geometry_hash(geometry), solver=SolverIdentity(version=SOLVER_VERSION, config_hash=solver_config_hash(options)), normalized_input={"geometry": geometry_definition(geometry), "units": "mm", "options": options.model_dump(mode="json")}, properties=Properties(geometric=geometric, elastic=elastic, plastic=plastic, principal=principal), advanced=advanced, diagnostics=diagnostics)
