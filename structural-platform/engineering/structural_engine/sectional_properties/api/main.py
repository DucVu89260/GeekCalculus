"""FastAPI adapter for the stateless sectional-properties engine."""

from __future__ import annotations

from typing import Any

from fastapi import Body, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .. import CalculationError, CalculationOptions, calculate, validate_geometry_definition
from ..models import CircleGeometry, ISectionGeometry, RectangleGeometry


app = FastAPI(title="Sectional Properties API", version="1.0.0")


def _error(
    status_code: int,
    code: str,
    message: str,
    *,
    errors: list[dict[str, str]] | None = None,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {"status": "error", "code": code, "message": message}
    if errors:
        payload["errors"] = errors
    if details:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


def _validation_errors(error: ValidationError, prefix: str = "") -> list[dict[str, str]]:
    normalized = []
    for item in error.errors(include_input=False, include_context=False, include_url=False):
        parts = [str(part) for part in item["loc"]]
        path = ".".join(([prefix] if prefix else []) + parts)
        normalized.append({"path": path, "type": str(item["type"]), "message": str(item["msg"])})
    return normalized


def _validation_code(errors: list[dict[str, str]]) -> str:
    paths = [item["path"] for item in errors]
    types = [item["type"] for item in errors]
    if any(path.endswith("geometry_variant") and error_type == "literal_error" for path, error_type in zip(paths, types)):
        return "UNSUPPORTED_VARIANT"
    if any(path == "units" for path in paths):
        return "UNSUPPORTED_UNITS"
    if any("required_properties" in path for path in paths):
        return "UNSUPPORTED_PROPERTY"
    if any("dimensions" in path and error_type != "missing" for path, error_type in zip(paths, types)):
        return "INVALID_DIMENSION"
    if any(error_type in {"invalid_geometry", "union_tag_invalid", "union_tag_not_found", "extra_forbidden"} for error_type in types):
        return "INVALID_GEOMETRY"
    if any("dimensions" in path or path.startswith("geometry.") for path in paths):
        return "INVALID_DIMENSION"
    if any(path.startswith("geometry") for path in paths):
        return "INVALID_GEOMETRY"
    return "INVALID_OPTIONS"


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(_: Request, error: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "path": ".".join(str(part) for part in item["loc"] if part != "body"),
            "type": str(item["type"]),
            "message": str(item["msg"]),
        }
        for item in error.errors()
    ]
    return _error(422, "INVALID_GEOMETRY", "Input validation failed.", errors=errors)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sectional-properties"}


def _dimension_input_schema(
    model: type[BaseModel],
    section_type: str,
    variant: str,
    fields: tuple[str, ...],
) -> dict[str, Any]:
    model_schema = model.model_json_schema()
    properties = model_schema["properties"]
    dimension_properties = {name: properties[name] for name in fields}
    return {
        "type": "object",
        "properties": {
            "type": {"const": section_type},
            "geometry_variant": {"const": variant},
            "geometry_model_version": {"const": "1.0.0"},
            "dimensions": {
                "type": "object",
                "properties": dimension_properties,
                "required": list(fields),
                "additionalProperties": False,
            },
        },
        "required": ["type", "geometry_variant", "dimensions"],
        "additionalProperties": False,
    }


@app.get("/v1/section-types")
def section_types() -> dict[str, list[dict[str, Any]]]:
    """Return v1 type identifiers and JSON Schemas for the geometry envelope."""

    types = [
        {
            "type": "rectangle",
            "name": "Rectangle",
            "geometry_variant": "solid",
            "input_schema": _dimension_input_schema(RectangleGeometry, "rectangle", "solid", ("width", "height")),
        },
        {
            "type": "circle",
            "name": "Circle",
            "geometry_variant": "solid",
            "input_schema": _dimension_input_schema(CircleGeometry, "circle", "solid", ("diameter",)),
        },
        {
            "type": "i_section",
            "name": "I-section",
            "geometry_variant": "sharp_corner",
            "input_schema": _dimension_input_schema(
                ISectionGeometry,
                "i_section",
                "sharp_corner",
                (
                    "depth",
                    "top_flange_width",
                    "bottom_flange_width",
                    "web_thickness",
                    "top_flange_thickness",
                    "bottom_flange_thickness",
                ),
            ),
        },
    ]
    return {"data": types}


class _CalculationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    geometry: dict[str, Any]
    units: str = "mm"
    options: dict[str, Any] = Field(default_factory=dict)


@app.post("/v1/sections/calculate")
def calculate_section(payload: dict[str, Any] = Body(...)) -> JSONResponse:
    """Validate a unit-explicit geometry envelope and return engine output."""

    try:
        request = _CalculationRequest.model_validate(payload)
    except ValidationError as error:
        errors = _validation_errors(error)
        return _error(422, _validation_code(errors), "Input validation failed.", errors=errors)

    if request.units != "mm":
        errors = [{"path": "units", "type": "literal_error", "message": "Only millimetres (mm) are supported."}]
        return _error(422, "UNSUPPORTED_UNITS", "Input validation failed.", errors=errors)

    try:
        geometry = validate_geometry_definition(request.geometry)
    except ValidationError as error:
        errors = _validation_errors(error, "geometry")
        return _error(422, _validation_code(errors), "Input validation failed.", errors=errors)

    try:
        options = CalculationOptions.model_validate(request.options)
    except ValidationError as error:
        errors = _validation_errors(error, "options")
        return _error(422, _validation_code(errors), "Input validation failed.", errors=errors)

    try:
        result = calculate(geometry, options)
    except CalculationError as error:
        return _error(422, error.code, str(error), details=error.details)
    except Exception:
        # Keep unexpected implementation details and tracebacks out of the API contract.
        return _error(500, "INTERNAL_ERROR", "Calculation failed unexpectedly.")

    return JSONResponse(content=result.model_dump(mode="json"))
