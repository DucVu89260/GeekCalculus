import math

from hypothesis import given, settings, strategies as st
import pytest

from structural_engine.sectional_properties import CalculationOptions, CircleGeometry, ISectionGeometry, RectangleGeometry, calculate, validate_geometry
from references import independent_i_reference

dimension = st.floats(min_value=0.5, max_value=5000, allow_nan=False, allow_infinity=False)


@st.composite
def i_geometries(draw):
    bt, bb = draw(dimension), draw(dimension)
    tt, tb = draw(st.floats(0.1, 100)), draw(st.floats(0.1, 100))
    hw = draw(st.floats(0.1, 5000))
    tw = draw(st.floats(0.1, min(bt, bb)))
    return ISectionGeometry(type="i_section", geometry_variant="sharp_corner", depth=hw + tt + tb, top_flange_width=bt, bottom_flange_width=bb, top_flange_thickness=tt, bottom_flange_thickness=tb, web_thickness=tw)


geometries = st.one_of(st.builds(RectangleGeometry, type=st.just("rectangle"), width=dimension, height=dimension), st.builds(CircleGeometry, type=st.just("circle"), diameter=dimension), i_geometries())
deterministic = settings(max_examples=120, deadline=None, derandomize=True)


@deterministic
@given(geometries, st.floats(min_value=0.1, max_value=10, allow_nan=False, allow_infinity=False))
def test_geometric_scaling_all_three_types(geometry, scale):
    data = geometry.model_dump()
    for key, value in data.items():
        if isinstance(value, float):
            data[key] = value * scale
    original, scaled = calculate(geometry), calculate(validate_geometry(data))
    for group, powers in [("geometric", {"area": 2, "perimeter": 1, "centroid_x": 1, "centroid_y": 1}), ("elastic", {"ix": 4, "iy": 4, "sx_positive": 3, "sx_negative": 3, "sy_positive": 3, "sy_negative": 3, "rx": 1, "ry": 1}), ("plastic", {"zx": 3, "zy": 3, "pna_x": 1, "pna_y": 1})]:
        for field, power in powers.items():
            assert getattr(getattr(scaled.properties, group), field) == pytest.approx(getattr(getattr(original.properties, group), field) * scale**power, rel=1e-10)


@deterministic
@given(dimension, dimension)
def test_rectangle_swapping_dimensions_swaps_inertias_and_moduli(width, height):
    first = calculate(RectangleGeometry(type="rectangle", width=width, height=height))
    swapped = calculate(RectangleGeometry(type="rectangle", width=height, height=width))
    assert first.properties.elastic.ix == pytest.approx(swapped.properties.elastic.iy, rel=1e-12)
    assert first.properties.plastic.zx == pytest.approx(swapped.properties.plastic.zy, rel=1e-12)


@deterministic
@given(dimension)
def test_circle_symmetries(diameter):
    result = calculate(CircleGeometry(type="circle", diameter=diameter), CalculationOptions(include_advanced=True))
    e, p = result.properties.elastic, result.properties.plastic
    assert e.ix == e.iy
    assert e.sx_positive == e.sx_negative == e.sy_positive == e.sy_negative
    assert p.zx == p.zy
    assert result.advanced.torsion_constant_j.value == pytest.approx(e.ix + e.iy, rel=1e-12)


@deterministic
@given(i_geometries())
def test_i_flange_mirroring_preserves_inertias_and_reverses_centroids(geometry):
    data = geometry.model_dump()
    data.update(top_flange_width=geometry.bottom_flange_width, bottom_flange_width=geometry.top_flange_width, top_flange_thickness=geometry.bottom_flange_thickness, bottom_flange_thickness=geometry.top_flange_thickness)
    original, mirrored = calculate(geometry), calculate(validate_geometry(data))
    assert mirrored.properties.geometric.centroid_y == pytest.approx(geometry.depth - original.properties.geometric.centroid_y, rel=1e-10)
    assert mirrored.properties.plastic.pna_y == pytest.approx(geometry.depth - original.properties.plastic.pna_y, rel=1e-10)
    for field in ["ix", "iy"]:
        assert getattr(original.properties.elastic, field) == pytest.approx(getattr(mirrored.properties.elastic, field), rel=1e-10)
    assert original.properties.elastic.sx_positive == pytest.approx(mirrored.properties.elastic.sx_negative, rel=1e-10)
    assert original.properties.plastic.zx == pytest.approx(mirrored.properties.plastic.zx, rel=1e-10)
    assert original.properties.geometric.perimeter == pytest.approx(mirrored.properties.geometric.perimeter, rel=1e-12)


@deterministic
@given(i_geometries())
def test_i_matches_independent_raw_coordinate_integrals_and_area_inversion(geometry):
    result = calculate(geometry)
    reference = independent_i_reference(geometry.model_dump())
    for field in ["area", "centroid_x", "centroid_y"]:
        assert getattr(result.properties.geometric, field) == pytest.approx(reference[field], rel=1e-10)
    for field in ["ix", "iy"]:
        assert getattr(result.properties.elastic, field) == pytest.approx(reference[field], rel=1e-10)
    assert result.properties.plastic.pna_y == pytest.approx(reference["pna_y"], rel=1e-10)
    assert result.properties.plastic.zx == pytest.approx(reference["zx"], rel=1e-10)


@deterministic
@given(geometries)
def test_positivity_bounding_symmetry_balance_and_determinism(geometry):
    result = calculate(geometry)
    g, e, p, principal = result.properties.geometric, result.properties.elastic, result.properties.plastic, result.properties.principal
    assert all(math.isfinite(value) and value > 0 for value in [g.area, g.perimeter, e.ix, e.iy, p.zx, p.zy, e.sx_positive, e.sx_negative, e.rx, e.ry])
    box = result.diagnostics["bounding_box"]
    assert 0 < g.centroid_x < box["x_max"]
    assert 0 < g.centroid_y < box["y_max"]
    assert 0 < p.pna_x < box["x_max"]
    assert 0 < p.pna_y < box["y_max"]
    assert e.ixy == 0
    assert principal.i_major + principal.i_minor == pytest.approx(e.ix + e.iy, rel=1e-12)
    assert e.sy_positive == e.sy_negative
    assert result.diagnostics["plastic"]["relative_area_imbalance"] <= 1e-10
    assert calculate(geometry).model_dump() == result.model_dump()


@settings(max_examples=25, deadline=None, derandomize=True)
@given(dimension, dimension, st.floats(0.1, 10))
def test_rectangle_j_swapping_and_fourth_power_scaling(width, height, scale):
    options = CalculationOptions(include_advanced=True)
    first = calculate(RectangleGeometry(type="rectangle", width=width, height=height), options)
    swapped = calculate(RectangleGeometry(type="rectangle", width=height, height=width), options)
    scaled = calculate(RectangleGeometry(type="rectangle", width=width * scale, height=height * scale), options)
    assert first.advanced.torsion_constant_j.value == swapped.advanced.torsion_constant_j.value
    assert scaled.advanced.torsion_constant_j.value == pytest.approx(first.advanced.torsion_constant_j.value * scale**4, rel=1e-10)
