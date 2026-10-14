from fastapi.testclient import TestClient

from structural_engine.sectional_properties.api.main import app


client = TestClient(app)


def test_health_and_section_type_schemas_are_available():
    assert client.get("/health").json() == {"status": "ok", "service": "sectional-properties"}

    response = client.get("/v1/section-types")
    assert response.status_code == 200
    types = response.json()["data"]
    assert [item["type"] for item in types] == ["rectangle", "circle", "i_section", "rectangular_hollow", "circular_hollow", "channel", "tee", "angle", "double_angle"]
    rectangle = types[0]["input_schema"]
    assert rectangle["properties"]["dimensions"]["required"] == ["width", "height"]
    circular_hollow = next(item for item in types if item["type"] == "circular_hollow")
    assert circular_hollow["geometry_variant"] == "uniform_wall"
    assert circular_hollow["input_schema"]["properties"]["dimensions"]["required"] == ["diameter", "thickness"]
    double_angle = next(item for item in types if item["type"] == "double_angle")
    assert double_angle["geometry_variant"] == "back_to_back"
    assert double_angle["input_schema"]["properties"]["dimensions"]["required"] == ["depth", "width", "thickness", "distance"]


def test_calculate_returns_the_engine_result_directly():
    response = client.post(
        "/v1/sections/calculate",
        json={
            "geometry": {
                "type": "rectangle",
                "geometry_variant": "solid",
                "dimensions": {"width": 200, "height": 400},
            },
            "units": "mm",
            "options": {"include_advanced": True},
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "success"
    assert result["geometry_type"] == "rectangle"
    assert result["properties"]["geometric"]["area"] == 80_000
    assert result["normalized_input"]["units"] == "mm"


def test_dimension_validation_has_a_stable_error_code():
    response = client.post(
        "/v1/sections/calculate",
        json={
            "geometry": {
                "type": "rectangle",
                "geometry_variant": "solid",
                "dimensions": {"width": 0, "height": 400},
            }
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_DIMENSION"


def test_variant_units_and_required_property_errors_are_classified():
    base = {
        "geometry": {
            "type": "rectangle",
            "geometry_variant": "hollow",
            "dimensions": {"width": 200, "height": 400},
        }
    }
    assert client.post("/v1/sections/calculate", json=base).json()["code"] == "UNSUPPORTED_VARIANT"

    unsupported_units = {**base, "geometry": {**base["geometry"], "geometry_variant": "solid"}, "units": "inch"}
    assert client.post("/v1/sections/calculate", json=unsupported_units).json()["code"] == "UNSUPPORTED_UNITS"

    unsupported_property = {
        **unsupported_units,
        "units": "mm",
        "options": {"required_properties": ["not_a_property"]},
    }
    response = client.post("/v1/sections/calculate", json=unsupported_property)
    assert response.status_code == 422
    assert response.json()["code"] == "UNSUPPORTED_PROPERTY"


def test_unexpected_calculation_errors_are_sanitized(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("private implementation details")

    monkeypatch.setattr("structural_engine.sectional_properties.api.main.calculate_canonical", fail)
    response = client.post(
        "/v1/sections/calculate",
        json={
            "geometry": {
                "type": "circle",
                "geometry_variant": "solid",
                "dimensions": {"diameter": 100},
            }
        },
    )

    assert response.status_code == 500
    assert response.json() == {
        "status": "error",
        "code": "INTERNAL_ERROR",
        "message": "Calculation failed unexpectedly.",
    }
    assert "private implementation details" not in response.text
