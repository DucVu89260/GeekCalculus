import hashlib
import json

import pytest
from pydantic import ValidationError

from structural_engine.sectional_properties.models import (
    CalculationOptions,
    CircleGeometry,
    ISectionGeometry,
    RectangleGeometry,
    geometry_definition,
    geometry_hash,
    validate_geometry,
    validate_geometry_definition,
)


def rectangle_data(**overrides):
    return {"type": "rectangle", "width": 80, "height": 160, **overrides}


def i_section_data(**overrides):
    return {
        "type": "i_section",
        "geometry_variant": "sharp_corner",
        "depth": 300,
        "top_flange_width": 150,
        "bottom_flange_width": 150,
        "web_thickness": 8,
        "top_flange_thickness": 12,
        "bottom_flange_thickness": 12,
        **overrides,
    }


DIMENSION_CASES = [
    (rectangle_data(), "width"),
    (rectangle_data(), "height"),
    ({"type": "circle", "diameter": 120}, "diameter"),
    (i_section_data(), "depth"),
    (i_section_data(), "top_flange_width"),
    (i_section_data(), "bottom_flange_width"),
    (i_section_data(), "web_thickness"),
    (i_section_data(), "top_flange_thickness"),
    (i_section_data(), "bottom_flange_thickness"),
]


@pytest.mark.parametrize(
    ("data", "expected_type"),
    [
        (rectangle_data(), RectangleGeometry),
        ({"type": "circle", "diameter": 120}, CircleGeometry),
        (i_section_data(), ISectionGeometry),
    ],
)
def test_validate_geometry_returns_frozen_discriminated_models(data, expected_type):
    model = validate_geometry(data)

    assert isinstance(model, expected_type)
    assert model.geometry_model_version == "1.0.0"
    with pytest.raises(ValidationError):
        model.geometry_model_version = "2.0.0"


@pytest.mark.parametrize("geometry,field", DIMENSION_CASES)
@pytest.mark.parametrize("value", [True, False, "10", "10.5", 0, -1, float("nan"), float("inf"), -float("inf")])
def test_all_dimension_fields_must_be_positive_finite_strict_numbers(geometry, field, value):
    data = {**geometry, field: value}
    with pytest.raises(ValidationError):
        validate_geometry(data)


def test_integer_dimension_inputs_are_accepted_and_normalized_to_float():
    model = validate_geometry(rectangle_data(width=80, height=160))

    assert model.width == 80.0
    assert isinstance(model.width, float)


@pytest.mark.parametrize(
    "data",
    [
        {"type": "rectangle", "height": 160},
        rectangle_data(extra_dimension=10),
        {"type": "circle"},
        {"type": "circle", "diameter": 100, "radius": 50},
        {"type": "rectangle", "width": 10, "height": 20, "geometry_variant": "hollow"},
        {**i_section_data(), "geometry_variant": "solid"},
        {key: value for key, value in i_section_data().items() if key != "geometry_variant"},
        rectangle_data(geometry_model_version="2.0.0"),
        {"type": "triangle", "width": 10, "height": 20},
    ],
)
def test_geometry_rejects_missing_unknown_or_unsupported_fields(data):
    with pytest.raises(ValidationError):
        validate_geometry(data)


@pytest.mark.parametrize(
    "overrides",
    [
        {"depth": 24},
        {"depth": 24.0, "top_flange_thickness": 12, "bottom_flange_thickness": 12},
        {"web_thickness": 151},
        {"web_thickness": 150.01, "bottom_flange_width": 150},
    ],
)
def test_i_section_rejects_impossible_proportions(overrides):
    with pytest.raises(ValidationError) as error:
        validate_geometry(i_section_data(**overrides))
    assert any(item["type"] == "invalid_geometry" for item in error.value.errors())


def test_invalid_constructed_geometry_instances_are_revalidated():
    invalid_rectangle = RectangleGeometry.model_construct(type="rectangle", width=0, height=20)
    invalid_circle = CircleGeometry.model_construct(type="circle", diameter=float("inf"))
    invalid_i_section = ISectionGeometry.model_construct(
        type="i_section",
        geometry_variant="sharp_corner",
        depth=20,
        top_flange_width=30,
        bottom_flange_width=30,
        web_thickness=5,
        top_flange_thickness=12,
        bottom_flange_thickness=12,
    )

    for model in (invalid_rectangle, invalid_circle, invalid_i_section):
        with pytest.raises(ValidationError):
            validate_geometry(model)

    with pytest.raises(ValidationError) as error:
        validate_geometry(invalid_i_section)
    assert any(item["type"] == "invalid_geometry" for item in error.value.errors())


def test_i_section_allows_web_equal_to_narrowest_flange_width():
    model = validate_geometry(i_section_data(web_thickness=120, top_flange_width=120, bottom_flange_width=140))

    assert model.web_thickness == 120


def test_geometry_definition_round_trips_and_contains_only_dimension_fields():
    original = validate_geometry(i_section_data())
    definition = geometry_definition(original)

    assert definition == {
        "type": "i_section",
        "geometry_variant": "sharp_corner",
        "geometry_model_version": "1.0.0",
        "dimensions": {
            "depth": 300.0,
            "top_flange_width": 150.0,
            "bottom_flange_width": 150.0,
            "web_thickness": 8.0,
            "top_flange_thickness": 12.0,
            "bottom_flange_thickness": 12.0,
        },
    }
    assert validate_geometry_definition(definition) == original


@pytest.mark.parametrize(
    "definition",
    [
        {"type": "rectangle", "geometry_variant": "solid", "dimensions": {"width": 80, "height": 160}, "extra": 1},
        {"type": "rectangle", "geometry_variant": "solid", "dimensions": {"width": 80}},
        {"type": "rectangle", "geometry_variant": "solid", "dimensions": {"width": 80, "height": 160, "depth": 20}},
        {"type": "rectangle", "geometry_variant": "solid", "geometry_model_version": "2.0.0", "dimensions": {"width": 80, "height": 160}},
        {"type": "circle", "geometry_variant": "sharp_corner", "dimensions": {"diameter": 100}},
    ],
)
def test_geometry_definition_rejects_unknown_fields_or_invalid_envelopes(definition):
    with pytest.raises(ValidationError):
        validate_geometry_definition(definition)


def test_geometry_definition_rejects_envelope_keys_inside_dimensions():
    definition = {
        "type": "rectangle",
        "geometry_variant": "solid",
        "dimensions": {"width": 80, "height": 160, "type": "circle"},
    }

    with pytest.raises(ValidationError) as error:
        validate_geometry_definition(definition)
    assert any(item["type"] == "invalid_geometry" for item in error.value.errors())


def test_geometry_hash_is_stable_for_equivalent_integer_and_float_inputs():
    integer_geometry = validate_geometry(rectangle_data(width=80, height=160))
    float_geometry = validate_geometry(rectangle_data(width=80.0, height=160.0))

    assert geometry_definition(integer_geometry) == geometry_definition(float_geometry)
    assert geometry_hash(integer_geometry) == geometry_hash(float_geometry)
    assert len(geometry_hash(integer_geometry)) == hashlib.sha256().digest_size * 2


def test_geometry_hash_includes_units_and_geometry_definition_fields():
    model = validate_geometry(rectangle_data())
    canonical = {"units": "mm", **geometry_definition(model)}
    expected = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False).encode("utf-8")
    ).hexdigest()

    assert geometry_hash(model) == expected


def test_calculation_options_defaults_and_validations():
    options = CalculationOptions()

    assert options.solver == "analytical"
    assert options.include_plastic is True
    assert options.include_advanced is False
    assert options.rectangle_j_relative_tolerance == 1e-10
    assert options.rectangle_j_max_terms == 10_000
    assert options.required_properties == ()
    assert CalculationOptions(required_properties=("torsion_constant_j",)).required_properties == ("torsion_constant_j",)
    with pytest.raises(ValidationError):
        options.include_advanced = True


@pytest.mark.parametrize(
    "data",
    [
        {"solver": "numerical"},
        {"include_plastic": 1},
        {"include_advanced": "false"},
        {"rectangle_j_relative_tolerance": 0},
        {"rectangle_j_relative_tolerance": "1e-8"},
        {"rectangle_j_relative_tolerance": True},
        {"rectangle_j_relative_tolerance": 0.0100001},
        {"rectangle_j_relative_tolerance": float("inf")},
        {"rectangle_j_max_terms": 0},
        {"rectangle_j_max_terms": 100_001},
        {"rectangle_j_max_terms": 2.5},
        {"rectangle_j_max_terms": True},
        {"required_properties": ("unknown_property",)},
        {"unsupported": 1},
    ],
)
def test_calculation_options_reject_invalid_inputs(data):
    with pytest.raises(ValidationError):
        CalculationOptions(**data)
