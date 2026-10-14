import json
from pathlib import Path
import subprocess
import sys

import pytest

from structural_engine.sectional_properties import calculate, validate_geometry_definition, CalculationOptions


def cli(data):
    return subprocess.run([sys.executable, "-m", "structural_engine.sectional_properties"], input=json.dumps(data), text=True, capture_output=True, check=False)


@pytest.mark.parametrize("name", ["rectangle", "circle", "i-asymmetric"])
def test_examples_execute_without_http_or_database_and_match_core(name):
    data = json.loads((Path(__file__).parents[1] / "examples" / f"{name}.json").read_text())
    run = cli(data)
    assert run.returncode == 0
    assert run.stderr == ""
    result = json.loads(run.stdout)
    expected = calculate(validate_geometry_definition(data["geometry"]), CalculationOptions(**data["options"]))
    assert result == expected.model_dump(mode="json")


@pytest.mark.parametrize(
    "geometry",
    [
        {"type": "rectangular_hollow", "geometry_variant": "sharp_corner", "dimensions": {"width": 100, "height": 200, "thickness": 5}},
        {"type": "circular_hollow", "geometry_variant": "uniform_wall", "dimensions": {"diameter": 100, "thickness": 5}},
        {"type": "channel", "geometry_variant": "sharp_corner", "dimensions": {"depth": 200, "width": 75, "web_thickness": 8, "flange_thickness": 10}},
        {"type": "tee", "geometry_variant": "sharp_corner", "dimensions": {"depth": 200, "width": 100, "web_thickness": 8, "flange_thickness": 12}},
        {"type": "angle", "geometry_variant": "sharp_corner", "dimensions": {"depth": 200, "width": 100, "thickness": 10}},
    ],
)
def test_cli_calculates_every_added_seeded_geometry(geometry):
    run = cli({"geometry": geometry, "units": "mm", "options": {"include_advanced": True}})
    assert run.returncode == 0, run.stderr
    result = json.loads(run.stdout)
    assert result["status"] == "success"
    assert result["geometry_type"] == geometry["type"]
    assert result["properties"]["geometric"]["area"] > 0
    assert result["properties"]["elastic"]["ix"] > 0
    if geometry["type"] == "circular_hollow":
        assert result["advanced"]["torsion_constant_j"]["value"] == 2 * result["properties"]["elastic"]["ix"]


@pytest.mark.parametrize("change,expected", [({"units": "m"}, "UNSUPPORTED_UNITS"), ({"geometry": {"type": "circle", "geometry_variant": "solid", "dimensions": {"diameter": -1}}}, "INVALID_DIMENSION"), ({"geometry": {"type": "i_section", "geometry_variant": "fillet", "dimensions": {}}}, "UNSUPPORTED_VARIANT"), ({"options": {"required_properties": ["not_a_property"]}}, "UNSUPPORTED_PROPERTY")])
def test_cli_reports_stable_errors_without_tracebacks(change, expected):
    data = {"geometry": {"type": "rectangle", "geometry_variant": "solid", "dimensions": {"width": 20, "height": 40}}, "units": "mm", **change}
    run = cli(data)
    assert run.returncode == 2
    assert json.loads(run.stdout)["code"] == expected
    assert "Traceback" not in run.stderr + run.stdout
