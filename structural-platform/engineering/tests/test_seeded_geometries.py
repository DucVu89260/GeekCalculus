import math

import pytest
from pydantic import ValidationError

from references import independent_polygon_section
from structural_engine.sectional_properties import (
    AngleGeometry,
    CalculationError,
    CalculationOptions,
    ChannelGeometry,
    CircularHollowGeometry,
    RectangleGeometry,
    RectangularHollowGeometry,
    TeeGeometry,
    calculate,
    validate_geometry,
    validate_geometry_definition,
)


RECTANGULAR_HOLLOW = {
    "type": "rectangular_hollow",
    "geometry_variant": "sharp_corner",
    "dimensions": {"width": 100, "height": 200, "thickness": 5},
}
CIRCULAR_HOLLOW = {
    "type": "circular_hollow",
    "geometry_variant": "uniform_wall",
    "dimensions": {"diameter": 100, "thickness": 5},
}
CHANNEL = {
    "type": "channel",
    "geometry_variant": "sharp_corner",
    "dimensions": {"depth": 200, "width": 75, "web_thickness": 8, "flange_thickness": 10},
}
TEE = {
    "type": "tee",
    "geometry_variant": "sharp_corner",
    "dimensions": {"depth": 200, "width": 100, "web_thickness": 8, "flange_thickness": 12},
}
ANGLE = {
    "type": "angle",
    "geometry_variant": "sharp_corner",
    "dimensions": {"depth": 200, "width": 100, "thickness": 10},
}


def polygon_loops(shape):
    d = shape["dimensions"]
    if shape["type"] == "rectangular_hollow":
        w, h, t = d["width"], d["height"], d["thickness"]
        return [
            [(0, 0), (w, 0), (w, h), (0, h)],
            [(t, t), (t, h - t), (w - t, h - t), (w - t, t)],
        ]
    if shape["type"] == "channel":
        h, w, tw, tf = d["depth"], d["width"], d["web_thickness"], d["flange_thickness"]
        return [[(0, 0), (w, 0), (w, tf), (tw, tf), (tw, h - tf), (w, h - tf), (w, h), (0, h)]]
    if shape["type"] == "tee":
        h, w, tw, tf = d["depth"], d["width"], d["web_thickness"], d["flange_thickness"]
        left, right = (w - tw) / 2, (w + tw) / 2
        return [[(left, 0), (right, 0), (right, h - tf), (w, h - tf), (w, h), (0, h), (0, h - tf), (left, h - tf)]]
    h, w, t = d["depth"], d["width"], d["thickness"]
    return [[(0, 0), (w, 0), (w, t), (t, t), (t, h), (0, h)]]


@pytest.mark.parametrize("shape", [RECTANGULAR_HOLLOW, CHANNEL, TEE, ANGLE])
def test_composite_section_properties_match_independent_polygon_integrals_and_clipped_area_bisection(shape):
    geometry = validate_geometry_definition(shape)
    result = calculate(geometry)
    expected = independent_polygon_section(polygon_loops(shape))
    actual = {
        "area": result.properties.geometric.area,
        "perimeter": result.properties.geometric.perimeter,
        "centroid_x": result.properties.geometric.centroid_x,
        "centroid_y": result.properties.geometric.centroid_y,
        "ix": result.properties.elastic.ix,
        "iy": result.properties.elastic.iy,
        "ixy": result.properties.elastic.ixy,
        "pna_x": result.properties.plastic.pna_x,
        "pna_y": result.properties.plastic.pna_y,
        "zx": result.properties.plastic.zx,
        "zy": result.properties.plastic.zy,
    }
    for key, value in expected.items():
        assert actual[key] == pytest.approx(value, rel=3e-12, abs=1e-9), f"{shape['type']} {key}"
    elastic = result.properties.elastic
    principal = result.properties.principal
    expected_major = (expected["ix"] + expected["iy"]) / 2 + math.hypot((expected["ix"] - expected["iy"]) / 2, expected["ixy"])
    expected_minor = (expected["ix"] * expected["iy"] - expected["ixy"] ** 2) / expected_major
    expected_angle = math.degrees(0.5 * math.atan2(-2 * expected["ixy"], expected["ix"] - expected["iy"])) % 180
    if expected_angle >= 180 - 1e-12:
        expected_angle = 0
    assert principal.i_major == pytest.approx(expected_major, rel=3e-12)
    assert principal.i_minor == pytest.approx(expected_minor, rel=3e-12)
    assert principal.major_axis_angle_degrees == pytest.approx(expected_angle, abs=2e-12)
    assert elastic.sx_positive == pytest.approx(elastic.ix / (result.diagnostics["bounding_box"]["y_max"] - expected["centroid_y"]))
    assert elastic.sx_negative == pytest.approx(elastic.ix / expected["centroid_y"])
    assert elastic.sy_positive == pytest.approx(elastic.iy / (result.diagnostics["bounding_box"]["x_max"] - expected["centroid_x"]))
    assert elastic.sy_negative == pytest.approx(elastic.iy / expected["centroid_x"])
    assert elastic.rx == pytest.approx(math.sqrt(expected["ix"] / expected["area"]))
    assert elastic.ry == pytest.approx(math.sqrt(expected["iy"] / expected["area"]))


def test_angle_reports_signed_product_inertia_and_rotated_principal_axes():
    result = calculate(validate_geometry_definition(ANGLE))
    inertia = result.properties.elastic
    principal = result.properties.principal
    assert inertia.ixy < 0
    assert principal.orientation_status == "determinate"
    assert 0 < principal.major_axis_angle_degrees < 90
    assert principal.i_major > max(inertia.ix, inertia.iy)
    assert principal.i_minor < min(inertia.ix, inertia.iy)
    assert principal.i_major * principal.i_minor == pytest.approx(inertia.ix * inertia.iy - inertia.ixy**2, rel=1e-12)


def test_circular_hollow_closed_forms_include_both_perimeters_and_exact_polar_moment():
    geometry = validate_geometry_definition(CIRCULAR_HOLLOW)
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    d, t = 100.0, 5.0
    inner = d - 2 * t
    expected_area = math.pi * t * (d - t)
    expected_ix = expected_area * (d**2 + inner**2) / 16
    expected_z = 2 * t * (d**2 + d * inner + inner**2) / 6
    assert result.properties.geometric.area == pytest.approx(expected_area)
    assert result.properties.geometric.perimeter == pytest.approx(math.pi * (d + inner))
    assert result.properties.elastic.ix == pytest.approx(expected_ix)
    assert result.properties.elastic.iy == pytest.approx(expected_ix)
    assert result.properties.plastic.zx == pytest.approx(expected_z)
    assert result.properties.plastic.zy == pytest.approx(expected_z)
    assert result.advanced.torsion_constant_j.status == "computed"
    assert result.advanced.torsion_constant_j.value == 2 * result.properties.elastic.ix
    assert result.properties.principal.orientation_status == "indeterminate"
    assert result.properties.principal.major_axis_angle_degrees is None


def test_thin_circular_hollow_area_avoids_outer_minus_inner_cancellation():
    result = calculate(CircularHollowGeometry(type="circular_hollow", geometry_variant="uniform_wall", diameter=100, thickness=1e-12))
    assert result.properties.geometric.area == pytest.approx(math.pi * 1e-12 * (100 - 1e-12), rel=2e-15)
    assert result.properties.geometric.area > 0


@pytest.mark.parametrize("shape", [RECTANGULAR_HOLLOW, CHANNEL, TEE, ANGLE])
def test_advanced_properties_are_computed_for_all_seeded_composite_sections(shape):
    result = calculate(validate_geometry_definition(shape), CalculationOptions(include_advanced=True))
    assert result.advanced.torsion_constant_j.status == "computed"
    assert result.advanced.torsion_constant_j.value > 0
    assert result.advanced.warping_constant_cw.status == "computed"
    assert result.advanced.warping_constant_cw.value >= 0
    assert result.advanced.shear_center.status == "computed"
    assert result.advanced.effective_shear_area.status == "computed"
    assert result.advanced.effective_shear_area.value.x > 0
    assert result.advanced.effective_shear_area.value.y > 0
    required = calculate(validate_geometry_definition(shape), CalculationOptions(required_properties=("torsion_constant_j",)))
    assert required.advanced.torsion_constant_j.status == "computed"


@pytest.mark.parametrize(
    ("data", "model"),
    [
        ({"type": "rectangular_hollow", "geometry_variant": "sharp_corner", "width": 100, "height": 200, "thickness": 50}, RectangularHollowGeometry),
        ({"type": "circular_hollow", "geometry_variant": "uniform_wall", "diameter": 100, "thickness": 50}, CircularHollowGeometry),
        ({"type": "channel", "geometry_variant": "sharp_corner", "depth": 100, "width": 40, "web_thickness": 40, "flange_thickness": 10}, ChannelGeometry),
        ({"type": "tee", "geometry_variant": "sharp_corner", "depth": 100, "width": 40, "web_thickness": 40, "flange_thickness": 10}, TeeGeometry),
        ({"type": "angle", "geometry_variant": "sharp_corner", "depth": 100, "width": 40, "thickness": 40}, AngleGeometry),
    ],
)
def test_new_geometry_models_reject_impossible_wall_proportions(data, model):
    with pytest.raises(ValidationError):
        validate_geometry(data)


def test_asymmetric_channel_and_angle_principal_axes_are_scale_invariant():
    for shape in (CHANNEL, ANGLE):
        base = calculate(validate_geometry_definition(shape))
        d = shape["dimensions"]
        scaled = {key: value * 3 for key, value in d.items()}
        larger = calculate(validate_geometry_definition({**shape, "dimensions": scaled}))
        assert larger.properties.geometric.area / base.properties.geometric.area == pytest.approx(9)
        assert larger.properties.geometric.perimeter / base.properties.geometric.perimeter == pytest.approx(3)
        assert larger.properties.elastic.ix / base.properties.elastic.ix == pytest.approx(81)
        assert larger.properties.elastic.iy / base.properties.elastic.iy == pytest.approx(81)
        if base.properties.elastic.ixy:
            assert larger.properties.elastic.ixy / base.properties.elastic.ixy == pytest.approx(81)
        else:
            assert larger.properties.elastic.ixy == pytest.approx(0)
        assert larger.properties.plastic.zx / base.properties.plastic.zx == pytest.approx(27)
        assert larger.properties.plastic.zy / base.properties.plastic.zy == pytest.approx(27)
        assert larger.properties.principal.major_axis_angle_degrees == pytest.approx(base.properties.principal.major_axis_angle_degrees)
