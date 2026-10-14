"""Execute the same Section Properties package used by the browser.

The Python analytical implementation is retained as an independent test oracle.
Production HTTP calculations have no fallback to a second numerical solver.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
from functools import lru_cache


class CoreUnavailableError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def section_registry() -> dict:
    source = Path(__file__).parents[3] / "section-properties" / "section-registry.json"
    packaged = Path(__file__).parent / "data" / "section-registry.json"
    return json.loads((source if source.is_file() else packaged).read_text(encoding="utf-8"))


def calculate_canonical(payload: dict) -> dict:
    core = Path(os.environ.get("SECTION_PROPERTIES_CORE", str(Path(__file__).parent / "data" / "section-core.mjs")))
    if not core.is_file():
        raise CoreUnavailableError("Build the shared Section Properties core before starting the API.")
    try:
        encoded = json.dumps(payload, allow_nan=False)
    except (ValueError, TypeError):
        return {"status": "error", "code": "INVALID_DIMENSION", "message": "Input dimensions must be finite JSON numbers."}
    try:
        completed = subprocess.run(
            [os.environ.get("SECTION_PROPERTIES_NODE", "node"), str(core)],
            input=encoded, capture_output=True, text=True,
            timeout=30, check=False,
        )
        result = json.loads(completed.stdout)
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        raise CoreUnavailableError("The shared Section Properties core could not complete the request.") from error
    if not isinstance(result, dict) or result.get("status") not in {"success", "error"}:
        raise CoreUnavailableError("The shared Section Properties core returned an invalid response.")
    return result
