import math

import pytest

from structural_engine.sectional_properties import (
    AngleGeometry,
    CalculationOptions,
    ChannelGeometry,
    CircleGeometry,
    CircularHollowGeometry,
    DoubleAngleGeometry,
    ISectionGeometry,
    RectangleGeometry,
    RectangularHollowGeometry,
    TeeGeometry,
    calculate,
)


def all_geometries():
    return [
        RectangleGeometry(type="rectangle", width=200, height=400),
        CircleGeometry(type="circle", diameter=100),
        ISectionGeometry(type="i_section", geometry_variant="sharp_corner", depth=400, top_flange_width=200, bottom_flange_width=250, web_thickness=8, top_flange_thickness=12, bottom_flange_thickness=16),
        RectangularHollowGeometry(type="rectangular_hollow", geometry_variant="sharp_corner", width=100, height=200, thickness=5),
        CircularHollowGeometry(type="circular_hollow", geometry_variant="uniform_wall", diameter=100, thickness=5),
        ChannelGeometry(type="channel", geometry_variant="sharp_corner", depth=200, width=75, web_thickness=8, flange_thickness=10),
        TeeGeometry(type="tee", geometry_variant="sharp_corner", depth=200, width=100, web_thickness=8, flange_thickness=12),
        AngleGeometry(type="angle", geometry_variant="sharp_corner", depth=200, width=100, thickness=10),
        DoubleAngleGeometry(type="double_angle", geometry_variant="back_to_back", depth=200, width=100, thickness=10, distance=40),
    ]


@pytest.mark.parametrize("geometry", all_geometries(), ids=lambda geometry: geometry.type)
def test_all_nine_geometry_models_compute_every_advanced_property(geometry):
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    advanced = result.advanced
    assert advanced.torsion_constant_j.status == "computed"
    assert advanced.torsion_constant_j.value > 0
    assert advanced.warping_constant_cw.status == "computed"
    assert advanced.warping_constant_cw.value >= 0
    assert advanced.shear_center.status == "computed"
    assert advanced.effective_shear_area.status == "computed"
    assert advanced.effective_shear_area.value.x > 0
    assert advanced.effective_shear_area.value.y > 0
    assert "solver_not_implemented" not in result.model_dump_json()


@pytest.mark.parametrize(
    "property_name",
    ["torsion_constant_j", "warping_constant_cw", "shear_center", "effective_shear_area"],
)
@pytest.mark.parametrize("geometry", all_geometries(), ids=lambda geometry: geometry.type)
def test_each_advanced_property_can_be_requested_independently(geometry, property_name):
    result = calculate(geometry, CalculationOptions(required_properties=(property_name,)))
    assert getattr(result.advanced, property_name).status == "computed"
    for other in {"torsion_constant_j", "warping_constant_cw", "shear_center", "effective_shear_area"} - {property_name}:
        assert getattr(result.advanced, other).reason == "not_requested"


def test_solid_rectangle_warping_fourier_result_has_direct_tail_bound_and_known_square_value():
    result = calculate(RectangleGeometry(type="rectangle", width=1, height=1), CalculationOptions(include_advanced=True))
    cw = result.advanced.warping_constant_cw.value
    diagnostic = result.diagnostics["advanced_model"]["warping"]
    reference = 0.0001344023455736
    assert diagnostic["converged"] is True
    assert diagnostic["terms_per_axis"] == 128
    assert abs(cw - reference) <= diagnostic["absolute_tail_bound"] + diagnostic["floating_point_abs_error_estimate"]
    assert cw == pytest.approx(reference, rel=2e-11)


def test_chs_polar_torsion_and_median_radius_shear_area_are_independent_closed_forms():
    diameter, thickness = 100.0, 5.0
    geometry = CircularHollowGeometry(type="circular_hollow", geometry_variant="uniform_wall", diameter=diameter, thickness=thickness)
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    assert result.advanced.torsion_constant_j.value == pytest.approx(2 * result.properties.elastic.ix, rel=1e-14)
    expected_area = math.pi * (diameter - thickness) / 2 * thickness
    assert result.advanced.effective_shear_area.value.x == pytest.approx(expected_area, rel=1e-14)
    assert result.advanced.effective_shear_area.value.y == pytest.approx(expected_area, rel=1e-14)
    assert result.advanced.warping_constant_cw.value == 0


def test_rhs_bredt_torsion_exact_square_identity_and_near_square_cw_stability():
    square = calculate(RectangularHollowGeometry(type="rectangular_hollow", geometry_variant="sharp_corner", width=200, height=200, thickness=5), CalculationOptions(include_advanced=True))
    median_area = (200 - 5) ** 2
    median_perimeter = 4 * (200 - 5)
    assert square.advanced.torsion_constant_j.value == pytest.approx(4 * median_area**2 / (median_perimeter / 5), rel=1e-14)
    assert square.advanced.warping_constant_cw.value == 0

    near = calculate(RectangularHollowGeometry(type="rectangular_hollow", geometry_variant="sharp_corner", width=200, height=200.000001, thickness=5), CalculationOptions(include_advanced=True))
    assert near.advanced.warping_constant_cw.status == "computed"
    assert near.advanced.warping_constant_cw.value > 0
    larger = calculate(RectangularHollowGeometry(type="rectangular_hollow", geometry_variant="sharp_corner", width=400, height=400.000002, thickness=10), CalculationOptions(include_advanced=True))
    assert larger.advanced.warping_constant_cw.value / near.advanced.warping_constant_cw.value == pytest.approx(2**6, rel=2e-8)


@pytest.mark.parametrize("geometry", all_geometries()[2:4] + all_geometries()[5:], ids=lambda geometry: geometry.type)
def test_centerline_shear_flow_has_unit_resultants_and_shear_center_matches_torque(geometry):
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    diag = result.diagnostics["advanced_model"]
    responses = diag["unit_shear_responses"]
    scale = max(result.diagnostics["bounding_box"]["x_max"], result.diagnostics["bounding_box"]["y_max"])
    cx = diag["line_centroid"]["x"]
    cy = diag["line_centroid"]["y"]
    assert responses["x"]["force_x"] == pytest.approx(1, abs=3e-12)
    assert responses["x"]["force_y"] == pytest.approx(0, abs=3e-12)
    assert responses["y"]["force_x"] == pytest.approx(0, abs=3e-12)
    assert responses["y"]["force_y"] == pytest.approx(1, abs=3e-12)
    center = result.advanced.shear_center.value
    assert center.x / scale == pytest.approx(cx + responses["y"]["torque"], abs=3e-12)
    assert center.y / scale == pytest.approx(cy - responses["x"]["torque"], abs=3e-12)
    assert result.advanced.effective_shear_area.value.x / scale**2 == pytest.approx(1 / responses["x"]["energy"], rel=2e-12)
    assert result.advanced.effective_shear_area.value.y / scale**2 == pytest.approx(1 / responses["y"]["energy"], rel=2e-12)
    if result.advanced.warping_constant_cw.value > 0:
        orthogonality = diag.get("sectorial_orthogonality")
        if orthogonality:
            assert abs(orthogonality["orthogonality_x"]) <= 2e-12
            assert abs(orthogonality["orthogonality_y"]) <= 2e-12


def test_double_angle_ideal_link_preserves_plate_j_and_zero_gap_uses_union_perimeter():
    h, b, t = 200.0, 100.0, 10.0
    j_one_angle = t**3 * ((h - t / 2) + (b - t / 2)) / 3
    separated = calculate(DoubleAngleGeometry(type="double_angle", geometry_variant="back_to_back", depth=h, width=b, thickness=t, distance=40), CalculationOptions(include_advanced=True))
    touching = calculate(DoubleAngleGeometry(type="double_angle", geometry_variant="back_to_back", depth=h, width=b, thickness=t, distance=0), CalculationOptions(include_advanced=True))
    assert separated.advanced.torsion_constant_j.value == pytest.approx(2 * j_one_angle, rel=1e-14)
    assert touching.advanced.torsion_constant_j.value == pytest.approx(2 * j_one_angle, rel=1e-14)
    assert separated.properties.geometric.perimeter == 4 * (b + h)
    assert touching.properties.geometric.perimeter == 4 * (b + h) - 2 * h
    assert separated.diagnostics["advanced_model"]["assumptions"][-1] == "zero_clear_gap_does_not_create_a_continuous_welded_web"


def test_optional_advanced_warping_range_failure_keeps_valid_gross_and_other_advanced_values():
    geometry = ISectionGeometry(type="i_section", geometry_variant="sharp_corner", depth=400e52, top_flange_width=200e52, bottom_flange_width=250e52, web_thickness=8e52, top_flange_thickness=12e52, bottom_flange_thickness=16e52)
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    assert result.properties.geometric.area > 0
    assert result.properties.elastic.ix > 0
    assert result.advanced.warping_constant_cw.reason == "numerical_range"
    assert result.advanced.torsion_constant_j.status == "computed"
    assert result.advanced.shear_center.status == "computed"
    assert result.advanced.effective_shear_area.status == "computed"
