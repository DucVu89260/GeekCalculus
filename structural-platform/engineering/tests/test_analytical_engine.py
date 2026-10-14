import math

import mpmath as mp
import pytest
from pydantic import ValidationError

from structural_engine.sectional_properties import CalculationError, CalculationOptions, CircleGeometry, ConvergenceError, ISectionGeometry, RectangleGeometry, UnsupportedPropertyError, calculate, geometry_hash, solver_config_hash
from structural_engine.sectional_properties.results import AdvancedProperty, CalculationResult
from references import independent_i_reference, independent_i_sectorial_pole_reference, independent_i_thin_wall_reference, independent_rectangle_j, independent_square_j_from_prandtl_pde


def i_section(**overrides):
    return ISectionGeometry(type="i_section", geometry_variant="sharp_corner", **({"depth": 400, "top_flange_width": 200, "bottom_flange_width": 250, "web_thickness": 8, "top_flange_thickness": 12, "bottom_flange_thickness": 16} | overrides))


def test_tc001_rectangle_200_by_400():
    result = calculate(RectangleGeometry(type="rectangle", width=200, height=400))
    g, e, p = result.properties.geometric, result.properties.elastic, result.properties.plastic
    assert g.area == 80000
    assert g.perimeter == 1200
    assert (g.centroid_x, g.centroid_y) == (100, 200)
    assert e.ix == pytest.approx(200 * 400**3 / 12, rel=1e-12)
    assert e.iy == pytest.approx(400 * 200**3 / 12, rel=1e-12)
    assert e.sx_positive == e.sx_negative == pytest.approx(e.ix / 200)
    assert e.sy_positive == e.sy_negative == pytest.approx(e.iy / 100)
    assert p.zx == 8000000
    assert p.zy == 4000000
    assert (p.pna_x, p.pna_y) == (100, 200)
    assert e.rx == pytest.approx(math.sqrt(e.ix / 80000))
    assert e.ry == pytest.approx(math.sqrt(e.iy / 80000))


def test_tc002_solid_circle_d200():
    result = calculate(CircleGeometry(type="circle", diameter=200), CalculationOptions(include_advanced=True))
    g, e, p = result.properties.geometric, result.properties.elastic, result.properties.plastic
    assert g.area == pytest.approx(math.pi * 100**2, rel=1e-12)
    assert g.perimeter == pytest.approx(200 * math.pi)
    assert (g.centroid_x, g.centroid_y) == (100, 100)
    assert e.ix == e.iy == pytest.approx(math.pi * 200**4 / 64, rel=1e-12)
    assert result.advanced.torsion_constant_j.value == pytest.approx(math.pi * 200**4 / 32, rel=1e-12)
    assert p.zx == p.zy == pytest.approx(200**3 / 6)
    assert result.properties.principal.orientation_status == "indeterminate"
    assert result.properties.principal.major_axis_angle_degrees is None


def test_tc003_independent_i_flanges_and_all_reference_values():
    result = calculate(i_section(), CalculationOptions(include_advanced=True))
    g, e, p = result.properties.geometric, result.properties.elastic, result.properties.plastic
    assert g.area == 9376
    assert g.perimeter == 1684
    assert g.centroid_x == 125
    assert g.centroid_y == pytest.approx(168.38225255972696, rel=1e-12)
    assert e.ix == pytest.approx(262854651.34015927, rel=1e-12)
    assert e.iy == pytest.approx(28849205.33333333, rel=1e-12)
    assert e.ixy == 0
    assert e.sx_positive == pytest.approx(1134864.03457896, rel=1e-12)
    assert e.sx_negative == pytest.approx(1561059.12199341, rel=1e-12)
    assert e.sy_positive == e.sy_negative == pytest.approx(230793.64266666667, rel=1e-12)
    assert e.rx == pytest.approx(167.43607464775033)
    assert e.ry == pytest.approx(55.46999516901058)
    assert p.pna_y == 102
    assert p.pna_x == 125
    assert p.zx == 1433568
    assert p.zy == 375952
    assert result.diagnostics["intermediate"] == {"web_clear_depth": 372, "bottom_flange_area": 4000, "web_area": 2976, "top_flange_area": 2400, "pna_x": 125, "pna_y": 102}
    assert result.diagnostics["plastic"]["area_below"] == 4688
    assert result.advanced.torsion_constant_j.model_dump() == {"status": "not_computed", "value": None, "reason": "solver_not_implemented", "method": None}
    thinwall = independent_i_thin_wall_reference(i_section().model_dump())
    assert result.advanced.warping_constant_cw.value == pytest.approx(thinwall["warping_constant_cw"], rel=1e-12)
    assert result.advanced.shear_center.value.x == pytest.approx(125)
    assert result.advanced.shear_center.value.y == pytest.approx(thinwall["shear_center_y"], rel=1e-12)
    assert result.advanced.shear_center.value.offset_y == pytest.approx(thinwall["shear_center_y"] - g.centroid_y, rel=1e-12)
    assert result.advanced.effective_shear_area.value.x == pytest.approx(thinwall["effective_shear_area_x"], rel=1e-12)
    assert result.advanced.effective_shear_area.value.y == pytest.approx(thinwall["effective_shear_area_y"], rel=1e-12)
    assert result.advanced.warping_constant_cw.method == "vlasov_thin_wall_i_section"
    assert result.advanced.effective_shear_area.method == "thin_wall_shear_energy_i_section"
    assert result.units.warping_constant == "mm6"
    assert result.units.shear_center == "mm"
    assert result.units.effective_shear_area == "mm2"
    assert result.diagnostics["i_section_advanced"]["model"] == "sharp_corner_centerline_thin_wall"
    # Review independently via raw coordinate integration at 60-digit precision.
    reference = independent_i_reference(i_section().model_dump())
    for field in ["area", "centroid_x", "centroid_y"]:
        assert getattr(g, field) == pytest.approx(reference[field], rel=1e-12)
    for field in ["ix", "iy", "ixy"]:
        assert getattr(e, field) == pytest.approx(reference[field], rel=1e-12, abs=1e-15)
    assert p.zx == pytest.approx(reference["zx"], rel=1e-12)


def test_tc004_symmetric_i_matches_outer_minus_voids_and_closed_form_z():
    g = i_section(bottom_flange_width=200, bottom_flange_thickness=12)
    result = calculate(g)
    e, p = result.properties.elastic, result.properties.plastic
    assert result.properties.geometric.area == 7808
    assert result.properties.geometric.centroid_y == 200
    assert e.ix == pytest.approx((200 * 400**3 - (200 - 8) * 376**3) / 12)
    assert e.iy == pytest.approx((24 * 200**3 + 376 * 8**3) / 12)
    assert p.zx == 1213952
    assert p.pna_y == 200
    assert e.sx_positive == e.sx_negative


def test_shear_center_is_the_sectorial_warping_pole_and_cw_integral_matches():
    geometry = i_section()
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    reference = independent_i_sectorial_pole_reference(geometry.model_dump())
    assert result.advanced.shear_center.value.y == pytest.approx(reference["shear_center_y"], rel=1e-12)
    assert abs(reference["omega_x_first_moment"]) <= 1e-60
    assert result.advanced.warping_constant_cw.value == pytest.approx(reference["warping_constant_cw"], rel=1e-12)


@pytest.mark.parametrize("mirror", [False, True])
def test_tc005_pna_inside_a_flange_not_only_the_web(mirror):
    dimensions = {"depth": 100, "top_flange_width": 40, "bottom_flange_width": 100, "web_thickness": 4, "top_flange_thickness": 4, "bottom_flange_thickness": 40}
    if mirror:
        dimensions.update(top_flange_width=100, bottom_flange_width=40, top_flange_thickness=40, bottom_flange_thickness=4)
    result = calculate(i_section(**dimensions))
    assert result.properties.plastic.pna_y == pytest.approx(78.08 if mirror else 21.92, rel=1e-12)
    assert result.properties.plastic.zx == pytest.approx(62863.36, rel=1e-12)
    assert result.properties.plastic.zy == 101824
    assert result.diagnostics["plastic"]["relative_area_imbalance"] <= 1e-10
    reference = independent_i_reference(dimensions)
    assert result.properties.plastic.zx == pytest.approx(reference["zx"], rel=1e-12)
    assert result.properties.plastic.pna_y == pytest.approx(reference["pna_y"], rel=1e-12)


def test_pna_exactly_on_the_flange_web_boundary():
    result = calculate(i_section(depth=100, top_flange_width=60, bottom_flange_width=100, web_thickness=5, top_flange_thickness=10, bottom_flange_thickness=10))
    assert result.properties.plastic.pna_y == pytest.approx(10, rel=1e-12)
    assert result.diagnostics["plastic"]["relative_area_imbalance"] <= 1e-10


def test_i_geometric_limit_of_full_width_web_matches_solid_rectangle():
    i = calculate(i_section(depth=100, top_flange_width=30, bottom_flange_width=30, web_thickness=30, top_flange_thickness=10, bottom_flange_thickness=20))
    r = calculate(RectangleGeometry(type="rectangle", width=30, height=100))
    assert i.properties.model_dump() == r.properties.model_dump()
    assert i.advanced.torsion_constant_j.status == "not_computed"


@pytest.mark.parametrize("width,height", [(1, 1), (200, 400), (400, 200), (1, 100), (100, 1), (0.5, 0.7)])
def test_rectangle_j_series_matches_high_precision_independent_zeta_reference(width, height):
    result = calculate(RectangleGeometry(type="rectangle", width=width, height=height), CalculationOptions(include_advanced=True))
    estimate = result.advanced.torsion_constant_j.value
    diagnostic = result.diagnostics["torsion"]
    reference = independent_rectangle_j(width, height)
    with mp.workdps(70):
        error = abs(mp.mpf(estimate) - reference)
        allowed = diagnostic["truncation_abs_error_bound"] + diagnostic["floating_point_abs_error_estimate"]
        assert error <= allowed
        assert error / reference <= 1e-10
    assert estimate > 0
    assert diagnostic["converged"] is True
    assert diagnostic["relative_error_bound_with_roundoff_estimate"] <= 1e-10


def test_square_j_is_not_polar_moment_and_matches_independent_prandtl_pde():
    result = calculate(RectangleGeometry(type="rectangle", width=1, height=1), CalculationOptions(include_advanced=True))
    j = result.advanced.torsion_constant_j.value
    assert j == pytest.approx(0.1405770149551536, rel=1e-9)
    assert j != pytest.approx(result.properties.elastic.ix + result.properties.elastic.iy, rel=1e-3)
    assert j == pytest.approx(independent_square_j_from_prandtl_pde(), rel=1e-6)


def test_optional_nonconvergence_is_explicit_and_required_nonconvergence_raises():
    rectangle = RectangleGeometry(type="rectangle", width=10, height=10)
    result = calculate(rectangle, CalculationOptions(include_advanced=True, rectangle_j_max_terms=1))
    assert result.advanced.torsion_constant_j.value is None
    assert result.advanced.torsion_constant_j.reason == "convergence_not_achieved"
    assert result.properties.geometric.area == 100
    with pytest.raises(ConvergenceError) as caught:
        calculate(rectangle, CalculationOptions(required_properties=("torsion_constant_j",), rectangle_j_max_terms=1))
    assert caught.value.details["converged"] is False


def test_unachievable_float_precision_is_not_reported_as_converged():
    result = calculate(RectangleGeometry(type="rectangle", width=10, height=10), CalculationOptions(include_advanced=True, rectangle_j_relative_tolerance=1e-30))
    assert result.advanced.torsion_constant_j.value is None
    assert result.advanced.torsion_constant_j.reason == "numerical_precision_limit"


def test_subnormal_torsion_error_must_not_underflow_to_fake_convergence():
    result = calculate(RectangleGeometry(type="rectangle", width=1, height=1e-103), CalculationOptions(include_advanced=True, rectangle_j_relative_tolerance=1e-300))
    assert result.advanced.torsion_constant_j.status == "not_computed"
    assert result.advanced.torsion_constant_j.reason == "numerical_precision_limit"
    assert result.diagnostics["torsion"]["relative_error_bound_with_roundoff_estimate"] > 0


def test_thin_web_nearly_equal_flange_areas_preserve_the_pna_coordinate():
    geometry = i_section(depth=1000, top_flange_width=100, bottom_flange_width=100, web_thickness=1e-10, top_flange_thickness=9.999999999020002, bottom_flange_thickness=10)
    result = calculate(geometry)
    reference = independent_i_reference(geometry.model_dump())
    assert result.properties.plastic.pna_y == pytest.approx(reference["pna_y"], rel=1e-12)
    assert result.properties.plastic.zx == pytest.approx(reference["zx"], rel=1e-12)


@pytest.mark.parametrize("property", ["torsion_constant_j"])
def test_required_unimplemented_i_section_properties_raise_instead_of_zero(property):
    with pytest.raises(UnsupportedPropertyError) as caught:
        calculate(i_section(), CalculationOptions(required_properties=(property,)))
    assert caught.value.code == "UNSUPPORTED_PROPERTY"
    assert caught.value.details["properties"] == [property]


@pytest.mark.parametrize("property", ["warping_constant_cw", "shear_center", "effective_shear_area"])
def test_required_i_section_thin_wall_properties_are_computed_individually(property):
    result = calculate(i_section(), CalculationOptions(required_properties=(property,)))
    assert getattr(result.advanced, property).status == "computed"
    assert getattr(result.advanced, property).value is not None
    for other in {"warping_constant_cw", "shear_center", "effective_shear_area"} - {property}:
        assert getattr(result.advanced, other).status == "not_computed"
        assert getattr(result.advanced, other).reason == "not_requested"


@pytest.mark.parametrize("scale", [1e52, 1e-60])
def test_optional_i_section_advanced_range_failure_preserves_gross_properties(scale):
    dimensions = {
        "depth": 400, "top_flange_width": 200, "bottom_flange_width": 250,
        "web_thickness": 8, "top_flange_thickness": 12, "bottom_flange_thickness": 16,
    }
    geometry = i_section(**{key: value * scale for key, value in dimensions.items()})
    result = calculate(geometry, CalculationOptions(include_advanced=True))
    assert result.properties.geometric.area > 0
    assert result.properties.elastic.ix > 0
    assert result.properties.elastic.iy > 0
    assert result.advanced.warping_constant_cw.status == "not_computed"
    assert result.advanced.warping_constant_cw.reason == "numerical_range"
    assert result.diagnostics["i_section_advanced"]["range_failures"] == ["warping_constant_cw"]
    assert result.advanced.shear_center.status == "computed"
    assert result.advanced.effective_shear_area.status == "computed"


@pytest.mark.parametrize("scale", [1e52, 1e-60])
def test_required_i_section_out_of_range_advanced_value_raises_calculation_error(scale):
    dims = {"depth": 400, "top_flange_width": 200, "bottom_flange_width": 250, "web_thickness": 8, "top_flange_thickness": 12, "bottom_flange_thickness": 16}
    geometry = i_section(**{key: value * scale for key, value in dims.items()})
    with pytest.raises(CalculationError) as caught:
        calculate(geometry, CalculationOptions(required_properties=("warping_constant_cw",)))
    assert caught.value.details == {"property": "warping_constant_cw", "reason": "numerical_range"}


@pytest.mark.parametrize("property", ["warping_constant_cw", "shear_center", "effective_shear_area"])
@pytest.mark.parametrize("geometry", [RectangleGeometry(type="rectangle", width=30, height=60), CircleGeometry(type="circle", diameter=30)])
def test_thin_wall_properties_remain_unsupported_for_solid_shapes(property, geometry):
    with pytest.raises(UnsupportedPropertyError) as caught:
        calculate(geometry, CalculationOptions(required_properties=(property,)))
    assert caught.value.details["properties"] == [property]


def test_omitted_plastic_and_advanced_properties_are_explicit():
    result = calculate(RectangleGeometry(type="rectangle", width=10, height=20), CalculationOptions(include_plastic=False))
    assert result.properties.plastic is None
    assert result.diagnostics["plastic"]["reason"] == "not_requested"
    assert result.advanced.torsion_constant_j.value is None
    assert result.advanced.torsion_constant_j.reason == "not_requested"
    for property in [result.advanced.warping_constant_cw, result.advanced.shear_center, result.advanced.effective_shear_area]:
        assert property.model_dump() == {"status": "not_computed", "value": None, "reason": "solver_not_implemented", "method": None}


def test_core_is_deterministic_versioned_serializable_and_does_not_mutate_input():
    geometry = i_section()
    before = geometry.model_dump()
    first, second = calculate(geometry), calculate(geometry)
    assert first.model_dump() == second.model_dump()
    assert geometry.model_dump() == before
    assert first.geometry_hash == geometry_hash(geometry)
    assert first.schema_version == "1.0"
    assert first.solver.version == "1.2.0"
    assert first.geometry_model_version == "1.0.0"
    assert first.units.length == "mm"
    assert first.units.section_modulus == "mm3"
    assert CalculationResult.model_validate_json(first.model_dump_json()) == first
    assert solver_config_hash(CalculationOptions()) != solver_config_hash(CalculationOptions(include_advanced=True))
    assert solver_config_hash(CalculationOptions()) != solver_config_hash(CalculationOptions(rectangle_j_relative_tolerance=1e-8))


def test_invalid_unchecked_model_is_rejected_before_calculation():
    with pytest.raises(ValidationError):
        calculate(RectangleGeometry.model_construct(type="rectangle", width=0, height=20))
    with pytest.raises(TypeError):
        calculate({"type": "rectangle", "width": 10, "height": 20})


@pytest.mark.parametrize("dimension", [1e-200, 1e200])
def test_unrepresentable_derived_values_fail_instead_of_emitting_nan_or_zero(dimension):
    with pytest.raises(CalculationError):
        calculate(RectangleGeometry(type="rectangle", width=dimension, height=dimension))


@pytest.mark.parametrize("data", [{"status": "not_computed", "value": 0, "reason": "solver_not_implemented"}, {"status": "computed", "value": None}, {"status": "computed", "value": 0}])
def test_advanced_result_schema_forbids_fake_available_values(data):
    with pytest.raises(ValidationError):
        AdvancedProperty(**data)
