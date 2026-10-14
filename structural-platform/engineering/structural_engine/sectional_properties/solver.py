"""Analytical sectional properties; no HTTP, database, material or FEM imports."""

from dataclasses import dataclass
from decimal import Decimal, localcontext
import hashlib
import json
import math

from pydantic import ValidationError

from .errors import CalculationError, ConvergenceError, UnsupportedPropertyError
from .models import AngleGeometry, CalculationOptions, ChannelGeometry, CircleGeometry, CircularHollowGeometry, DoubleAngleGeometry, Geometry, ISectionGeometry, RectangleGeometry, RectangularHollowGeometry, TeeGeometry, geometry_definition, geometry_hash, validate_geometry
from .results import AdvancedProperties, AdvancedProperty, CalculationResult, EffectiveShearAreaProperty, EffectiveShearAreaValue, ElasticProperties, GeometricProperties, PlasticProperties, PrincipalProperties, Properties, ShearCenterProperty, ShearCenterValue, SolverIdentity
from .torsion import rectangle_torsion

SOLVER_VERSION = "1.3.0"


@dataclass(frozen=True)
class RectangleComponent:
    width: float
    height: float
    x: float
    y: float

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass(frozen=True)
class WallSegment:
    """Straight median-line wall; thickness zero marks an ideal kinematic link."""

    x0: float
    y0: float
    x1: float
    y1: float
    thickness: float
    label: str = "wall"

    @property
    def length(self) -> float:
        return math.hypot(self.x1 - self.x0, self.y1 - self.y0)

    @property
    def ux(self) -> float:
        return (self.x1 - self.x0) / self.length

    @property
    def uy(self) -> float:
        return (self.y1 - self.y0) / self.length


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
    if isinstance(geometry, DoubleAngleGeometry):
        h, b, t, gap = geometry.depth, geometry.width, geometry.thickness, geometry.distance
        clear_depth = h - t
        return (
            RectangleComponent(b, t, 0.0, 0.0),
            RectangleComponent(t, clear_depth, b - t, t),
            RectangleComponent(b, t, b + gap, 0.0),
            RectangleComponent(t, clear_depth, b + gap, t),
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


def _wall_segments(geometry: Geometry, scale: float) -> tuple[WallSegment, ...]:
    """Build median-line walls in normalized coordinates; zero t is a rigid link."""
    n = lambda value: value / scale
    if isinstance(geometry, ISectionGeometry):
        h, bt, bb = n(geometry.depth), n(geometry.top_flange_width), n(geometry.bottom_flange_width)
        tt, tb, tw = n(geometry.top_flange_thickness), n(geometry.bottom_flange_thickness), n(geometry.web_thickness)
        width, xc = max(bt, bb), max(bt, bb) / 2
        yb, yt = tb / 2, h - tt / 2
        return (
            WallSegment(xc - bb / 2, yb, xc, yb, tb, "bottom_flange_left"),
            WallSegment(xc, yb, xc, yt, tw, "web"),
            WallSegment(xc, yb, xc + bb / 2, yb, tb, "bottom_flange_right"),
            WallSegment(xc - bt / 2, yt, xc, yt, tt, "top_flange_left"),
            WallSegment(xc, yt, xc + bt / 2, yt, tt, "top_flange_right"),
        )
    if isinstance(geometry, ChannelGeometry):
        h, w, tw, tf = map(n, (geometry.depth, geometry.width, geometry.web_thickness, geometry.flange_thickness))
        xw, yb, yt = tw / 2, tf / 2, h - tf / 2
        return (
            WallSegment(xw, yb, w, yb, tf, "bottom_flange"),
            WallSegment(xw, yb, xw, yt, tw, "web"),
            WallSegment(xw, yt, w, yt, tf, "top_flange"),
        )
    if isinstance(geometry, TeeGeometry):
        h, w, tw, tf = map(n, (geometry.depth, geometry.width, geometry.web_thickness, geometry.flange_thickness))
        xw, yf = w / 2, h - tf / 2
        return (
            WallSegment(xw, 0.0, xw, yf, tw, "web"),
            WallSegment(0.0, yf, xw, yf, tf, "flange_left"),
            WallSegment(xw, yf, w, yf, tf, "flange_right"),
        )
    if isinstance(geometry, AngleGeometry):
        h, w, t = map(n, (geometry.depth, geometry.width, geometry.thickness))
        heel = (t / 2, t / 2)
        return (
            WallSegment(heel[0], heel[1], heel[0], h, t, "vertical_leg"),
            WallSegment(heel[0], heel[1], w, heel[1], t, "horizontal_leg"),
        )
    if isinstance(geometry, DoubleAngleGeometry):
        h, b, t, gap = map(n, (geometry.depth, geometry.width, geometry.thickness, geometry.distance))
        left_heel, right_heel = b - t / 2, b + gap + t / 2
        overall_width = 2 * b + gap
        yheel = t / 2
        return (
            WallSegment(0.0, yheel, left_heel, yheel, t, "left_toe"),
            WallSegment(left_heel, yheel, left_heel, h, t, "left_web"),
            WallSegment(left_heel, yheel, right_heel, yheel, 0.0, "ideal_rigid_heel_link"),
            WallSegment(right_heel, yheel, right_heel, h, t, "right_web"),
            WallSegment(right_heel, yheel, overall_width, yheel, t, "right_toe"),
        )
    raise TypeError("open thin-wall model does not apply to this geometry")


def _rhs_segments(geometry: RectangularHollowGeometry, scale: float) -> tuple[WallSegment, ...]:
    w, h, t = (value / scale for value in (geometry.width, geometry.height, geometry.thickness))
    left, right, bottom, top = t / 2, w - t / 2, t / 2, h - t / 2
    return (
        WallSegment(left, bottom, right, bottom, t, "bottom_wall"),
        WallSegment(right, bottom, right, top, t, "right_wall"),
        WallSegment(right, top, left, top, t, "top_wall"),
        WallSegment(left, top, left, bottom, t, "left_wall"),
    )


def _seg_length(segment: WallSegment) -> float:
    return math.hypot(segment.x1 - segment.x0, segment.y1 - segment.y0)


def _line_properties(segments: tuple[WallSegment, ...]) -> tuple[float, float, float, float, float, float]:
    material = [segment for segment in segments if segment.thickness > 0]
    line_area = math.fsum(segment.thickness * _seg_length(segment) for segment in material)
    if not math.isfinite(line_area) or line_area <= 0:
        raise ArithmeticError("thin-wall line area is outside the numerical range")
    cx = math.fsum(segment.thickness * _seg_length(segment) * (segment.x0 + segment.x1) / 2 for segment in material) / line_area
    cy = math.fsum(segment.thickness * _seg_length(segment) * (segment.y0 + segment.y1) / 2 for segment in material) / line_area
    ix = math.fsum(segment.thickness * _seg_length(segment) * (((segment.y0 + segment.y1) / 2 - cy)**2 + (segment.y1 - segment.y0)**2 / 12) for segment in material)
    iy = math.fsum(segment.thickness * _seg_length(segment) * (((segment.x0 + segment.x1) / 2 - cx)**2 + (segment.x1 - segment.x0)**2 / 12) for segment in material)
    ixy = math.fsum(segment.thickness * _seg_length(segment) * (((segment.x0 + segment.x1) / 2 - cx) * ((segment.y0 + segment.y1) / 2 - cy) + (segment.x1 - segment.x0) * (segment.y1 - segment.y0) / 12) for segment in material)
    return line_area, cx, cy, ix, iy, ixy


def _oriented_tree(segments: tuple[WallSegment, ...]) -> tuple[WallSegment, ...]:
    """Orient an open, connected tree from a free edge for flow/warping integration."""
    adjacency: dict[tuple[float, float], list[tuple[int, tuple[float, float]]]] = {}
    for index, segment in enumerate(segments):
        start, end = (segment.x0, segment.y0), (segment.x1, segment.y1)
        adjacency.setdefault(start, []).append((index, end))
        adjacency.setdefault(end, []).append((index, start))
    roots = [node for node, linked in adjacency.items() if len(linked) == 1]
    if len(roots) < 2:
        raise ArithmeticError("open thin-wall graph is not a tree")
    root = roots[0]
    ordered: list[WallSegment] = []
    seen: set[int] = set()
    stack: list[tuple[tuple[float, float], tuple[float, float], int]] = [(root, child, edge) for edge, child in adjacency[root]]
    while stack:
        parent, child, edge_index = stack.pop()
        if edge_index in seen:
            continue
        seen.add(edge_index)
        original = segments[edge_index]
        if (original.x0, original.y0) == parent:
            oriented = original
        else:
            oriented = WallSegment(original.x1, original.y1, original.x0, original.y0, original.thickness, original.label)
        ordered.append(oriented)
        for next_edge, next_node in adjacency[child]:
            if next_edge not in seen:
                stack.append((child, next_node, next_edge))
    if len(seen) != len(segments):
        raise ArithmeticError("open thin-wall graph is disconnected")
    # DFS order is needed so a child edge is always visited after its parent.
    # Rebuild a deterministic preorder; the stack above only established connectivity.
    ordered_by_pair = {(s.x0, s.y0, s.x1, s.y1, s.label): s for s in ordered}
    result: list[WallSegment] = []
    visited_nodes = {root}
    todo = [root]
    while todo:
        node = todo.pop()
        for edge_index, child in adjacency[node]:
            if child in visited_nodes:
                continue
            original = segments[edge_index]
            oriented = original if (original.x0, original.y0) == node else WallSegment(original.x1, original.y1, original.x0, original.y0, original.thickness, original.label)
            result.append(oriented)
            visited_nodes.add(child)
            todo.append(child)
    if len(result) != len(segments):
        raise ArithmeticError("open thin-wall graph has an invalid traversal")
    return tuple(result)


def _flow_coefficients(
    segment: WallSegment,
    centroid_x: float,
    centroid_y: float,
    ix: float,
    iy: float,
    ixy: float,
    determinant: float,
    axis: str,
) -> tuple[float, float, float]:
    length = _seg_length(segment)
    ux, uy = (segment.x1 - segment.x0) / length, (segment.y1 - segment.y0) / length

    def derivative(s: float) -> float:
        x = segment.x0 + ux * s - centroid_x
        y = segment.y0 + uy * s - centroid_y
        if axis == "x":
            return -segment.thickness * (ix * x - ixy * y) / determinant
        return -segment.thickness * (iy * y - ixy * x) / determinant

    start, end = derivative(0.0), derivative(length)
    slope = (end - start) / length
    return start, slope, length


def _flow_polynomials(
    segments: tuple[WallSegment, ...],
    centroid_x: float,
    centroid_y: float,
    ix: float,
    iy: float,
    ixy: float,
    axis: str,
    *,
    closed: bool = False,
) -> tuple[tuple[WallSegment, float, float, float], ...]:
    determinant = ix * iy - ixy * ixy
    if not math.isfinite(determinant) or determinant <= 0:
        raise ArithmeticError("thin-wall line inertia matrix is singular")
    ordered = segments if closed else _oriented_tree(segments)
    coefficients = [_flow_coefficients(seg, centroid_x, centroid_y, ix, iy, ixy, determinant, axis) for seg in ordered]
    sources = [a * length + slope * length**2 / 2 for a, slope, length in coefficients]
    starts = [0.0] * len(ordered)
    if not closed:
        # Orient the tree from a free endpoint. Back-substitution enforces
        # zero flow at every free end and conservation at each junction.
        start_children: dict[tuple[float, float], list[int]] = {}
        for index, segment in enumerate(ordered):
            start_children.setdefault((segment.x0, segment.y0), []).append(index)
        for index in range(len(ordered) - 1, -1, -1):
            segment = ordered[index]
            children = [child for child in start_children.get((segment.x1, segment.y1), []) if child > index]
            end_flow = math.fsum(starts[child] for child in children)
            starts[index] = end_flow - sources[index]
        end_nodes = {(segment.x1, segment.y1) for segment in ordered}
        roots = {(segment.x0, segment.y0) for segment in ordered} - end_nodes
        if len(roots) != 1:
            raise ArithmeticError("open thin-wall traversal has no unique root")
        root = next(iter(roots))
        root_flow = math.fsum(starts[index] for index, seg in enumerate(ordered) if (seg.x0, seg.y0) == root)
        scale = max(1.0, math.fsum(abs(value) for value in sources))
        if abs(root_flow) > 2e-10 * scale:
            # Root is a free edge selected by the traversal; its outward flow
            # must also vanish when the centroidal source has zero total.
            raise ArithmeticError("thin-wall shear flow does not balance at the tree root")
        return tuple((seg, starts[index], coefficients[index][0], coefficients[index][1]) for index, seg in enumerate(ordered))
    # For a single closed cell, first integrate an open flow from the chosen
    # cut, then add the constant flow that enforces zero twist compatibility.
    for index in range(1, len(ordered)):
        starts[index] = starts[index - 1] + sources[index - 1]
    if abs(starts[-1] + sources[-1]) > 2e-10:
        raise ArithmeticError("closed-cell shear flow is not periodic")
    compatibility = math.fsum(
        (starts[index] * coefficients[index][2]
         + coefficients[index][0] * coefficients[index][2]**2 / 2
         + coefficients[index][1] * coefficients[index][2]**3 / 6) / seg.thickness
        for index, seg in enumerate(ordered)
    )
    compliance = math.fsum(coefficients[index][2] / seg.thickness for index, seg in enumerate(ordered))
    constant = -compatibility / compliance
    return tuple((seg, starts[index] + constant, coefficients[index][0], coefficients[index][1]) for index, seg in enumerate(ordered))


def _polynomial_integrals(q0: float, a: float, b: float, length: float) -> tuple[float, float]:
    """Return integral(q ds), integral(q² ds) for q=q0+a*s+b*s²/2."""
    q_integral = q0 * length + a * length**2 / 2 + b * length**3 / 6
    terms = []
    coeffs = (q0, a, b / 2)
    for i, left in enumerate(coeffs):
        for j, right in enumerate(coeffs):
            terms.append(left * right * length ** (i + j + 1) / (i + j + 1))
    return q_integral, math.fsum(terms)


def _flow_response(
    flow: tuple[tuple[WallSegment, float, float, float], ...],
    centroid_x: float,
    centroid_y: float,
) -> tuple[float, float, float, float]:
    force_x, force_y, torque, energy = [], [], [], []
    for segment, q0, a, b in flow:
        length = _seg_length(segment)
        ux, uy = (segment.x1 - segment.x0) / length, (segment.y1 - segment.y0) / length
        q_integral, q2_integral = _polynomial_integrals(q0, a, b, length)
        force_x.append(q_integral * ux)
        force_y.append(q_integral * uy)
        # x*dy-y*dx is constant along a straight segment. A virtual link
        # carries reaction and torque but has no material shear energy.
        x0, y0 = segment.x0 - centroid_x, segment.y0 - centroid_y
        torque.append((x0 * uy - y0 * ux) * q_integral)
        if segment.thickness > 0:
            energy.append(q2_integral / segment.thickness)
    return math.fsum(force_x), math.fsum(force_y), math.fsum(torque), math.fsum(energy)


def _sectorial_properties(
    segments: tuple[WallSegment, ...],
    centroid_x: float,
    centroid_y: float,
    shear_center_x: float,
    shear_center_y: float,
    ix: float,
    iy: float,
    *,
    closed: bool = False,
) -> tuple[float, dict[str, float | None]]:
    if closed:
        # The RHS loop is ordered counter-clockwise. Sectorial omega has a
        # closure jump 2*A_m; subtract its constant slope before normalizing.
        ordered = segments
        length = math.fsum(_seg_length(seg) for seg in ordered)
        twice_area = abs(math.fsum(seg.x0 * seg.y1 - seg.x1 * seg.y0 for seg in ordered))
        closure_slope = twice_area / length
        cumulative = 0.0
        raw: list[tuple[WallSegment, float, float, float]] = []
        for segment in ordered:
            seg_length = _seg_length(segment)
            ux, uy = (segment.x1 - segment.x0) / seg_length, (segment.y1 - segment.y0) / seg_length
            derivative = (segment.x0 - shear_center_x) * uy - (segment.y0 - shear_center_y) * ux - closure_slope
            raw.append((segment, cumulative, derivative, seg_length))
            cumulative += derivative * seg_length
        area = math.fsum(seg.thickness * _seg_length(seg) for seg in ordered)
        mean = math.fsum(
            seg.thickness * (start * length + derivative * length**2 / 2)
            for seg, start, derivative, length in raw
        ) / area
        cw = math.fsum(
            seg.thickness * length * ((start - mean + derivative * length / 2)**2 + (derivative * length)**2 / 12)
            for seg, start, derivative, length in raw
        )
        return cw, {"closure_slope": closure_slope, "mean_sectorial_coordinate": mean, "orthogonality_x": 0.0, "orthogonality_y": 0.0}

    ordered = _oriented_tree(segments)
    start_omega: list[float] = []
    derivatives: list[float] = []
    node_omega: dict[tuple[float, float], float] = {}
    for segment in ordered:
        start = (segment.x0, segment.y0)
        end = (segment.x1, segment.y1)
        length = _seg_length(segment)
        ux, uy = (segment.x1 - segment.x0) / length, (segment.y1 - segment.y0) / length
        omega_start = node_omega.get(start, 0.0)
        derivative = (segment.x0 - shear_center_x) * uy - (segment.y0 - shear_center_y) * ux
        start_omega.append(omega_start)
        derivatives.append(derivative)
        node_omega[end] = omega_start + derivative * length
    line_area = math.fsum(seg.thickness * _seg_length(seg) for seg in ordered)
    mean = math.fsum(
        seg.thickness * (start * _seg_length(seg) + derivative * _seg_length(seg)**2 / 2)
        for seg, start, derivative in zip(ordered, start_omega, derivatives)
    ) / line_area
    cw_terms, orth_x_terms, orth_y_terms = [], [], []
    for segment, omega_start, derivative in zip(ordered, start_omega, derivatives):
        length = _seg_length(segment)
        ux, uy = (segment.x1 - segment.x0) / length, (segment.y1 - segment.y0) / length
        base = omega_start - mean
        cw_terms.append(segment.thickness * length * ((base + derivative * length / 2)**2 + (derivative * length)**2 / 12))
        xbase, ybase = segment.x0 - centroid_x, segment.y0 - centroid_y
        # Integrals of (base + derivative*s)*(coordinate_base + tangent*s).
        orth_x_terms.append(segment.thickness * (base * xbase * length + (base * ux + derivative * xbase) * length**2 / 2 + derivative * ux * length**3 / 3))
        orth_y_terms.append(segment.thickness * (base * ybase * length + (base * uy + derivative * ybase) * length**2 / 2 + derivative * uy * length**3 / 3))
    cw = math.fsum(cw_terms)
    orth_x, orth_y = math.fsum(orth_x_terms), math.fsum(orth_y_terms)
    if cw == 0:
        return cw, {"mean_sectorial_coordinate": mean, "orthogonality_x": None, "orthogonality_y": None}
    return cw, {
        "mean_sectorial_coordinate": mean,
        "orthogonality_x": orth_x / max(math.sqrt(abs(cw * iy)), 1e-300),
        "orthogonality_y": orth_y / max(math.sqrt(abs(cw * ix)), 1e-300),
    }


def _rectangle_warping_constant(width: float, height: float) -> tuple[float | None, dict[str, object]]:
    """Dimensionless Saint-Venant warping norm with a direct absolute tail bound."""
    a, b = max(width, height) / 2, min(width, height) / 2
    method = "solid_rectangle_fourier_warping_norm"

    def stable_factor(z: float) -> float:
        # tanh(z) - z*sech²(z) is O(z³); direct subtraction loses its
        # significant digits for shallow aspect ratios and large mode counts.
        if z < 1e-3:
            z2 = z * z
            return z * z2 * (2 / 3 + z2 * (-8 / 15 + z2 * (34 / 105)))
        if z > 350:
            return 1.0
        c = math.cosh(z)
        return math.tanh(z) - z / (c * c)

    value = 0.0
    absolute_tail_bound = math.inf
    roundoff_estimate = math.inf
    used = 0
    for terms in (16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536):
        try:
            ks = [(n + 0.5) * math.pi / b for n in range(terms)]
            ls = [(m + 0.5) * math.pi / a for m in range(terms)]
            u_terms = [4 / b * stable_factor(k * a) / k**7 for k in ks]
            v_terms = [4 / a * stable_factor(l * b) / l**7 for l in ls]
            def sech_squared(z: float) -> float:
                if z > 350:
                    return 0.0
                c = math.cosh(z)
                return 1 / (c * c)

            # Sum the m-series analytically for each retained k. This is the
            # partial-fraction identity for the half-integer l_m spectrum;
            # it avoids an O(N²) cross sum while leaving a simple k-tail bound.
            cross_terms = [
                -32 / (a * b) * (
                    a*a / (4 * k**6) * (2 + sech_squared(a*k))
                    - 3 * a * math.tanh(a*k) / (4 * k**7)
                )
                for k in ks
            ]
            u, v, cross = math.fsum(u_terms), math.fsum(v_terms), math.fsum(cross_terms)
            value = math.fsum((u, v, cross))
            # For omitted n>=terms, use the integral test for the diagonal
            # n^-7 tails and sum_m(l_m^-2)=a²/2 for the analytically summed
            # cross tail. The first omitted half-index is terms+1/2; the
            # decreasing integral begins at terms-1/2.
            denominator = max(terms - 0.5, 0.5)
            u_tail = 4 * b**6 / (6 * math.pi**7 * denominator**6)
            v_tail = 4 * a**6 / (6 * math.pi**7 * denominator**6)
            cross_tail = 16 * a / b * (b / math.pi) ** 6 / (5 * denominator**5)
            absolute_tail_bound = math.fsum((u_tail, v_tail, cross_tail))
            roundoff_estimate = 64 * math.ulp(1.0) * math.fsum((abs(u), abs(v), abs(cross)))
        except (OverflowError, ZeroDivisionError, ValueError):
            return None, {"method": method, "terms": terms, "status": "numerical_range"}
        used = terms
        if not math.isfinite(value) or value <= 0 or not math.isfinite(absolute_tail_bound):
            return None, {"method": method, "terms": terms, "status": "numerical_range"}
        relative_bound = (absolute_tail_bound + roundoff_estimate) / value
        if relative_bound <= 1e-10:
            return value, {
                "method": method,
                "terms_per_axis": terms,
                "absolute_tail_bound": absolute_tail_bound,
                "floating_point_abs_error_estimate": roundoff_estimate,
                "relative_error_bound_with_roundoff_estimate": relative_bound,
                "relative_tolerance": 1e-10,
                "converged": True,
            }
    relative_bound = (absolute_tail_bound + roundoff_estimate) / value if value > 0 else math.inf
    return None, {
        "method": method,
        "terms_per_axis": used,
        "absolute_tail_bound": absolute_tail_bound,
        "floating_point_abs_error_estimate": roundoff_estimate,
        "relative_error_bound_with_roundoff_estimate": relative_bound,
        "relative_tolerance": 1e-10,
        "converged": False,
    }


def _rescale_dimensionless(value: float, scale: float, power: int, *, allow_zero: bool = False) -> float | None:
    if not math.isfinite(value) or value < 0 or (value == 0 and not allow_zero):
        return None
    try:
        result = float(Decimal(str(value)) * Decimal(str(scale)) ** power)
    except (OverflowError, ArithmeticError):
        return None
    if not math.isfinite(result) or (value != 0 and result == 0):
        return None
    return result


def _advanced_model(
    geometry: Geometry,
    width: float,
    height: float,
    centroid_x: float,
    centroid_y: float,
    options: CalculationOptions,
) -> tuple[dict[str, object], dict[str, object]]:
    """Calculate advanced properties using exact circular or declared line models."""
    scale = max(width, height)
    wn, hn = width / scale, height / scale
    props: dict[str, object] = {}
    range_failures: list[str] = []
    needed = set(options.required_properties)
    if options.include_advanced:
        needed.update({"torsion_constant_j", "warping_constant_cw", "shear_center", "effective_shear_area"})
    if not needed:
        return {}, {"status": "not_requested", "model": "advanced_properties_not_requested", "assumptions": []}

    # Geometry-only special cases with exact or explicitly chosen elementary
    # shear-area conventions.
    if isinstance(geometry, RectangleGeometry):
        segments = ()
        cxn, cyn = wn / 2, hn / 2
        scx, scy = cxn, cyn
        j_dimless = None
        if "torsion_constant_j" in needed:
            torsion = rectangle_torsion(wn, hn, relative_tolerance=options.rectangle_j_relative_tolerance, max_terms=options.rectangle_j_max_terms)
            diagnostics_torsion: dict[str, object] = dict(torsion.diagnostics)
            # The series is evaluated in normalized coordinates to avoid
            # overflowing its intermediate powers. Public absolute error
            # bounds, however, describe the returned mm⁴ value.
            for bound in ("truncation_abs_error_bound", "floating_point_abs_error_estimate"):
                if bound in diagnostics_torsion:
                    diagnostics_torsion[bound] = _rescale_dimensionless(float(diagnostics_torsion[bound]), scale, 4)
            j_dimless = torsion.value if torsion.converged else None
            if not torsion.converged and "torsion_constant_j" in options.required_properties:
                raise ConvergenceError("Required rectangle torsion did not meet the requested tolerance.", details={"property": "torsion_constant_j", "reason": torsion.reason, **torsion.diagnostics})
            torsion_reason = torsion.reason or "numerical_range"
        else:
            diagnostics_torsion = {"method": "solid_rectangle_saint_venant_odd_series", "status": "not_requested"}
            torsion_reason = "not_requested"
        if "torsion_constant_j" in needed:
            value = None if j_dimless is None else _rescale_dimensionless(j_dimless, scale, 4)
            if value is None:
                props["torsion_constant_j"] = _unavailable(torsion_reason if not torsion.converged else "numerical_range")
                range_failures.append("torsion_constant_j")
            else:
                props["torsion_constant_j"] = AdvancedProperty(status="computed", value=value, method="solid_rectangle_saint_venant_odd_series")
        if "warping_constant_cw" in needed:
            cw_dimless, cw_diag = _rectangle_warping_constant(wn, hn)
            value = None if cw_dimless is None else _rescale_dimensionless(cw_dimless, scale, 6)
            if value is None:
                props["warping_constant_cw"] = _unavailable("convergence_not_achieved" if not cw_diag.get("converged", True) else "numerical_range")
                range_failures.append("warping_constant_cw")
            else:
                props["warping_constant_cw"] = AdvancedProperty(status="computed", value=value, method="solid_rectangle_saint_venant_fourier")
        if "shear_center" in needed:
            props["shear_center"] = _center_property(scx * scale, scy * scale, centroid_x, centroid_y, "geometric_symmetry")
        if "effective_shear_area" in needed:
            area = _rescale_dimensionless(wn * hn * 5 / 6, scale, 2)
            if area is None:
                props["effective_shear_area"] = _unavailable_effective_shear_area("numerical_range")
                range_failures.append("effective_shear_area")
            else:
                props["effective_shear_area"] = EffectiveShearAreaProperty(status="computed", value=EffectiveShearAreaValue(x=area, y=area), method="jourawski_rectangle_five_sixths_area")
        diag = {"model": "solid_rectangle", "torsion": diagnostics_torsion}
        if "warping_constant_cw" in needed:
            diag["warping"] = cw_diag
        assumptions = ["homogeneous_isotropic_geometry_only", "rectangle_shear_area_uses_jourawski_five_sixths_convention"]
    elif isinstance(geometry, CircleGeometry):
        d = geometry.diameter / scale
        if "torsion_constant_j" in needed:
            j = _rescale_dimensionless(math.pi * d**4 / 32, scale, 4)
            _set_scalar(props, range_failures, "torsion_constant_j", j, "solid_circle_closed_form")
        if "warping_constant_cw" in needed:
            props["warping_constant_cw"] = AdvancedProperty(status="computed", value=0.0, method="axisymmetric_zero_warping")
        if "shear_center" in needed:
            props["shear_center"] = _center_property(width / 2, height / 2, centroid_x, centroid_y, "axisymmetric_centroid")
        if "effective_shear_area" in needed:
            area = _rescale_dimensionless(math.pi * d*d / 4 * 0.9, scale, 2)
            _set_shear_area(props, range_failures, area, area, "solid_circle_geometric_nine_tenths_area")
        diag = {"model": "solid_circle", "warping": {"method": "axisymmetric_zero_warping"}}
        assumptions = ["homogeneous_isotropic_geometry_only", "solid_circle_effective_shear_area_uses_geometric_nine_tenths_area_convention"]
    elif isinstance(geometry, CircularHollowGeometry):
        d = geometry.diameter / scale
        t = geometry.thickness / scale
        dm = d - t
        area_dimless = math.pi * t * dm
        if "torsion_constant_j" in needed:
            jdim = math.pi * t * (d - t) * (d*d + (d - 2*t)**2) / 8
            j = _rescale_dimensionless(jdim, scale, 4)
            _set_scalar(props, range_failures, "torsion_constant_j", j, "circular_hollow_exact_polar_moment")
        if "warping_constant_cw" in needed:
            props["warping_constant_cw"] = AdvancedProperty(status="computed", value=0.0, method="axisymmetric_zero_warping")
        if "shear_center" in needed:
            props["shear_center"] = _center_property(width / 2, height / 2, centroid_x, centroid_y, "axisymmetric_centroid")
        if "effective_shear_area" in needed:
            # Median-radius thin-wall shear flow gives As = pi*Rm*t.
            area = _rescale_dimensionless(math.pi * (d - t) / 2 * t, scale, 2)
            _set_shear_area(props, range_failures, area, area, "circular_hollow_thin_wall_shear_flow")
        diag = {"model": "uniform_wall_circular", "warping": {"method": "axisymmetric_zero_warping"}, "effective_shear_area": {"formula": "pi*R_m*t"}}
        assumptions = ["circular_closed_form_geometry", "thin_wall_shear_energy_uses_median_radius"]
    elif isinstance(geometry, RectangularHollowGeometry):
        t = geometry.thickness / scale
        segments = _rhs_segments(geometry, scale)
        bw, bh = wn - t, hn - t
        median_area = bw * bh
        perimeter_median = 2 * (bw + bh)
        line_area, cxline, cyline, ixline, iyline, ixyline = _line_properties(segments)
        jdim = 4 * median_area**2 / (perimeter_median / t)
        if "torsion_constant_j" in needed:
            j = _rescale_dimensionless(jdim, scale, 4)
            _set_scalar(props, range_failures, "torsion_constant_j", j, "single_cell_bredt_thin_wall")
        if "shear_center" in needed:
            props["shear_center"] = _center_property(width / 2, height / 2, centroid_x, centroid_y, "closed_cell_shear_flow_symmetry")
        if "warping_constant_cw" in needed:
            cw_dim, cw_residuals = _sectorial_properties(segments, wn / 2, hn / 2, wn / 2, hn / 2, 1.0, 1.0, closed=True)
            if geometry.width == geometry.height:
                cw_dim = 0.0
            cw = _rescale_dimensionless(max(cw_dim, 0.0), scale, 6, allow_zero=True)
            _set_scalar(props, range_failures, "warping_constant_cw", cw, "closed_section_sectorial_thin_wall")
        else:
            cw_residuals = {}
        if "effective_shear_area" in needed:
            fx = _flow_response(_flow_polynomials(segments, cxline, cyline, ixline, iyline, ixyline, "x", closed=True), cxline, cyline)
            fy = _flow_response(_flow_polynomials(segments, cxline, cyline, ixline, iyline, ixyline, "y", closed=True), cxline, cyline)
            ax = _rescale_dimensionless(1 / fx[3], scale, 2)
            ay = _rescale_dimensionless(1 / fy[3], scale, 2)
            _set_shear_area(props, range_failures, ax, ay, "closed_cell_thin_wall_shear_energy")
            closed_flow_responses = {"x": {"force_x": fx[0], "force_y": fx[1], "torque": fx[2], "energy": fx[3]}, "y": {"force_x": fy[0], "force_y": fy[1], "torque": fy[2], "energy": fy[3]}}
        else:
            closed_flow_responses = {}
        diag = {"model": "sharp_corner_closed_cell_centerline_thin_wall", "median_cell_area": median_area, "median_perimeter": perimeter_median, "line_area": line_area, "line_centroid": {"x": cxline, "y": cyline}, "line_inertias": {"ix": ixline, "iy": iyline, "ixy": ixyline}, "sectorial": cw_residuals}
        if closed_flow_responses:
            diag["unit_shear_responses"] = closed_flow_responses
        assumptions = ["sharp_corner_uniform_thickness_median_line", "single_cell_bredt_torsion", "closed_cell_shear_flow_uses_zero_twist_compatibility", "no_corner_radii_or_thick_wall_elasticity"]
    else:
        segments = _wall_segments(geometry, scale)
        ordered = _oriented_tree(segments)
        line_area, cxline, cyline, ixline, iyline, ixyline = _line_properties(ordered)
        if not all(math.isfinite(v) and v > 0 for v in (line_area, ixline, iyline)):
            raise ArithmeticError("open thin-wall line properties are outside the numerical range")
        needs_flow = bool(needed.intersection({"warping_constant_cw", "shear_center", "effective_shear_area"}))
        if needs_flow:
            response_x = _flow_response(_flow_polynomials(ordered, cxline, cyline, ixline, iyline, ixyline, "x"), cxline, cyline)
            response_y = _flow_response(_flow_polynomials(ordered, cxline, cyline, ixline, iyline, ixyline, "y"), cxline, cyline)
            flow_scx = cxline + response_y[2]
            flow_scy = cyline - response_x[2]
        if "torsion_constant_j" in needed:
            jdim = math.fsum(_seg_length(seg) * seg.thickness**3 / 3 for seg in ordered if seg.thickness > 0)
            j = _rescale_dimensionless(jdim, scale, 4)
            _set_scalar(props, range_failures, "torsion_constant_j", j, "open_section_thin_wall_j")
        if "shear_center" in needed:
            if isinstance(geometry, ISectionGeometry):
                scx, scy, offset_y = _i_section_shear_center(geometry)
                props["shear_center"] = _center_property_with_offsets(scx, scy, 0.0, offset_y, "open_section_shear_flow")
            elif isinstance(geometry, ChannelGeometry):
                props["shear_center"] = _center_property_with_offsets(flow_scx * scale, height / 2, flow_scx * scale - centroid_x, 0.0, "open_section_shear_flow")
            elif isinstance(geometry, (TeeGeometry, DoubleAngleGeometry)):
                props["shear_center"] = _center_property_with_offsets(width / 2, flow_scy * scale, 0.0, flow_scy * scale - centroid_y, "open_section_shear_flow")
            else:
                props["shear_center"] = _center_property(flow_scx * scale, flow_scy * scale, centroid_x, centroid_y, "open_section_shear_flow")
        if "effective_shear_area" in needed:
            ax = _rescale_dimensionless(1 / response_x[3], scale, 2)
            ay = _rescale_dimensionless(1 / response_y[3], scale, 2)
            _set_shear_area(props, range_failures, ax, ay, "open_section_thin_wall_shear_energy")
        if "warping_constant_cw" in needed:
            cw_dim, orthogonality = _sectorial_properties(ordered, cxline, cyline, flow_scx, flow_scy, ixline, iyline)
            if isinstance(geometry, (TeeGeometry, AngleGeometry)):
                cw_dim = 0.0
                orthogonality = {
                    "mean_sectorial_coordinate": orthogonality["mean_sectorial_coordinate"],
                    "orthogonality_x": None,
                    "orthogonality_y": None,
                }
            cw = _rescale_dimensionless(cw_dim, scale, 6, allow_zero=True)
            _set_scalar(props, range_failures, "warping_constant_cw", cw, "open_section_sectorial_thin_wall")
        else:
            orthogonality = {}
        diag = {
            "model": "centerline_open_thin_wall",
            "line_area": line_area,
            "line_centroid": {"x": cxline, "y": cyline},
            "line_inertias": {"ix": ixline, "iy": iyline, "ixy": ixyline},
        }
        if needs_flow:
            diag["unit_shear_responses"] = {"x": {"force_x": response_x[0], "force_y": response_x[1], "torque": response_x[2], "energy": response_x[3]}, "y": {"force_x": response_y[0], "force_y": response_y[1], "torque": response_y[2], "energy": response_y[3]}}
        if "warping_constant_cw" in needed:
            diag["sectorial_orthogonality"] = orthogonality
        assumptions = ["open_section_centerline_thin_wall", "uniform_thickness_on_each_wall", "ideal_rigid_link_has_no_area_j_or_shear_energy"] if isinstance(geometry, DoubleAngleGeometry) else ["open_section_centerline_thin_wall", "uniform_thickness_on_each_wall", "no_fillet_or_finite_wall_elasticity"]
        if isinstance(geometry, DoubleAngleGeometry):
            assumptions.extend(["two_mirrored_angles_share_equal_twist", "rigid_heel_link_transfers_reaction_flow_without_area_or_energy", "zero_clear_gap_does_not_create_a_continuous_welded_web"])

    # Required-property failures are surfaced after independent calculations,
    # allowing optional out-of-range properties to coexist with gross results.
    for name in options.required_properties:
        prop = props.get(name)
        if prop is not None and prop.status != "computed":
            raise CalculationError("A required advanced property is outside the numerical range.", details={"property": name, "reason": prop.reason or "numerical_range"})
    diagnostics: dict[str, object] = {
        "status": "partial" if range_failures else "computed",
        "model": diag["model"],
        "assumptions": assumptions,
        "range_failures": range_failures,
        "normalization_length_mm": scale,
        "normalized_geometry_diagnostics": True,
        **{key: value for key, value in diag.items() if key != "model"},
    }
    if "torsion_constant_j" in props:
        diagnostics["torsion_method"] = props["torsion_constant_j"].method
    if "warping_constant_cw" in props:
        diagnostics["warping_method"] = props["warping_constant_cw"].method
    if "shear_center" in props:
        diagnostics["shear_center_method"] = props["shear_center"].method
    if "effective_shear_area" in props:
        diagnostics["effective_shear_area_method"] = props["effective_shear_area"].method
    return props, diagnostics


def _center_property(x: float, y: float, centroid_x: float, centroid_y: float, method: str) -> ShearCenterProperty:
    values = (x, y, x - centroid_x, y - centroid_y)
    if not all(math.isfinite(value) for value in values):
        return _unavailable_shear_center("numerical_range")
    return ShearCenterProperty(status="computed", value=ShearCenterValue(x=x, y=y, offset_x=x-centroid_x, offset_y=y-centroid_y), method=method)


def _center_property_with_offsets(x: float, y: float, offset_x: float, offset_y: float, method: str) -> ShearCenterProperty:
    values = (x, y, offset_x, offset_y)
    if not all(math.isfinite(value) for value in values):
        return _unavailable_shear_center("numerical_range")
    return ShearCenterProperty(status="computed", value=ShearCenterValue(x=x, y=y, offset_x=offset_x, offset_y=offset_y), method=method)


def _i_section_shear_center(geometry: ISectionGeometry) -> tuple[float, float, float]:
    """Exact centerline pole and centroid offsets, evaluated before float subtraction."""
    with localcontext() as context:
        context.prec = 80
        dec = lambda value: Decimal(str(value))
        h, bt, bb = dec(geometry.depth), dec(geometry.top_flange_width), dec(geometry.bottom_flange_width)
        tw, tt, tb = dec(geometry.web_thickness), dec(geometry.top_flange_thickness), dec(geometry.bottom_flange_thickness)
        web_height = h - tt - tb
        yb, yt = tb / 2, h - tt / 2
        bottom_area, web_area, top_area = bb * tb, tw * web_height, bt * tt
        gross_area = bottom_area + web_area + top_area
        gross_y = (bottom_area * yb + web_area * (tb + web_height / 2) + top_area * yt) / gross_area
        iy_bottom, iy_top = tb * bb**3 / 12, tt * bt**3 / 12
        center_y = (iy_bottom * yb + iy_top * yt) / (iy_bottom + iy_top)
        x = max(bt, bb) / 2
        offset_y = center_y - gross_y
        return float(x), float(center_y), float(offset_y)


def _set_scalar(props: dict[str, object], failures: list[str], name: str, value: float | None, method: str) -> None:
    if value is None:
        props[name] = _unavailable("numerical_range")
        failures.append(name)
    else:
        props[name] = AdvancedProperty(status="computed", value=value, method=method)


def _set_shear_area(props: dict[str, object], failures: list[str], x: float | None, y: float | None, method: str) -> None:
    if x is None or y is None:
        props["effective_shear_area"] = _unavailable_effective_shear_area("numerical_range")
        failures.append("effective_shear_area")
    else:
        props["effective_shear_area"] = EffectiveShearAreaProperty(status="computed", value=EffectiveShearAreaValue(x=x, y=y), method=method)


def calculate(geometry: Geometry, options: CalculationOptions | None = None) -> CalculationResult:
    """Compute from a validated geometry model, rechecking invariants at entry.

    Raw JSON belongs to validate_geometry/validate_geometry_definition first.
    A quick calculation returns a value only; nothing is persisted or mutated.
    """
    if not isinstance(geometry, (RectangleGeometry, CircleGeometry, ISectionGeometry, RectangularHollowGeometry, CircularHollowGeometry, ChannelGeometry, TeeGeometry, AngleGeometry, DoubleAngleGeometry)):
        raise TypeError("calculate requires a validated geometry model, not raw JSON")
    geometry = validate_geometry(geometry.model_dump())
    options = CalculationOptions() if options is None else CalculationOptions.model_validate(options)
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
        diagnostics["components"] = [
            {"width": part.width, "height": part.height, "x": part.x, "y": part.y, "area": part.area}
            for part in parts
        ]
        if isinstance(geometry, ISectionGeometry):
            width, height = max(geometry.top_flange_width, geometry.bottom_flange_width), geometry.depth
        elif isinstance(geometry, RectangularHollowGeometry):
            width, height = geometry.width, geometry.height
        elif isinstance(geometry, DoubleAngleGeometry):
            width, height = 2 * geometry.width + geometry.distance, geometry.depth
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
        elif isinstance(geometry, DoubleAngleGeometry):
            perimeter = 4 * (geometry.width + geometry.depth) - (2 * geometry.depth if geometry.distance == 0 else 0)
            intermediates = {
                "overall_width": width,
                "clear_distance": geometry.distance,
                "clear_vertical_leg_depth": parts[1].height,
                "horizontal_leg_area_each": parts[0].area,
                "vertical_leg_area_each": parts[1].area,
            }
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
    advanced_properties, advanced_diagnostics = _advanced_model(geometry, width, height, centroid_x, centroid_y, options)
    diagnostics["advanced_model"] = advanced_diagnostics
    if isinstance(advanced_diagnostics.get("torsion"), dict) and advanced_diagnostics["torsion"].get("status") != "not_requested":
        diagnostics["torsion"] = advanced_diagnostics["torsion"]
    j = advanced_properties.get("torsion_constant_j", _unavailable("not_requested"))
    cw = advanced_properties.get("warping_constant_cw", _unavailable("not_requested"))
    shear_center = advanced_properties.get("shear_center", _unavailable_shear_center("not_requested"))
    effective_shear = advanced_properties.get("effective_shear_area", _unavailable_effective_shear_area("not_requested"))
    advanced = AdvancedProperties(torsion_constant_j=j, warping_constant_cw=cw, shear_center=shear_center, effective_shear_area=effective_shear)
    diagnostics["intermediate"] = intermediates
    diagnostics["bounding_box"] = {"x_min": 0.0, "y_min": 0.0, "x_max": width, "y_max": height}
    diagnostics["assumptions"] = ["dimensions_in_mm", "xy_plane_x_right_y_up", "bbox_origin_bottom_left", "centroidal_unrotated_inertias", "positive_coordinate_product_ixy", "sharp_corners", "homogeneous_geometric_plastic_properties"]
    return CalculationResult(geometry_type=geometry.type, geometry_hash=geometry_hash(geometry), solver=SolverIdentity(version=SOLVER_VERSION, config_hash=solver_config_hash(options)), normalized_input={"geometry": geometry_definition(geometry), "units": "mm", "options": options.model_dump(mode="json")}, properties=Properties(geometric=geometric, elastic=elastic, plastic=plastic, principal=principal), advanced=advanced, diagnostics=diagnostics)
