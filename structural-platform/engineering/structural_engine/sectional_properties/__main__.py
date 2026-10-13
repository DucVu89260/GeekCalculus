"""JSON CLI for Packages 01–02; no web server or persistence side effects."""

import json
import sys
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from . import CalculationError, CalculationOptions, calculate, validate_geometry_definition


class CalculationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    geometry: dict
    units: Literal["mm"] = "mm"
    options: CalculationOptions = Field(default_factory=CalculationOptions)


def main() -> int:
    try:
        request = CalculationRequest.model_validate(json.load(sys.stdin))
        geometry = validate_geometry_definition(request.geometry)
        result = calculate(geometry, request.options)
        print(result.model_dump_json(indent=2))
        return 0
    except ValidationError as error:
        errors = [{"path": ".".join(map(str, item["loc"])), "type": item["type"], "message": item["msg"]} for item in error.errors(include_input=False, include_context=False, include_url=False)]
        code = "INVALID_DIMENSION"
        if any("geometry_variant" in item["path"] for item in errors):
            code = "UNSUPPORTED_VARIANT"
        elif any(item["type"] in ("invalid_geometry", "union_tag_invalid", "union_tag_not_found", "extra_forbidden") for item in errors):
            code = "INVALID_GEOMETRY"
        elif any(item["path"] == "units" for item in errors):
            code = "UNSUPPORTED_UNITS"
        print(json.dumps({"status": "error", "code": code, "message": "Input validation failed.", "errors": errors}, allow_nan=False))
        return 2
    except CalculationError as error:
        print(json.dumps({"status": "error", "code": error.code, "message": str(error), "details": error.details}, allow_nan=False))
        return 2
    except (json.JSONDecodeError, UnicodeDecodeError):
        print(json.dumps({"status": "error", "code": "INVALID_INPUT", "message": "Expected a JSON calculation request on stdin."}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
