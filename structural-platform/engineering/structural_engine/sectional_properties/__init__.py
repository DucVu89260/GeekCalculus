"""SectionalProperties v1: definitions → validation → analytical results."""

from .errors import CalculationError, ConvergenceError, UnsupportedPropertyError
from .models import CalculationOptions, CircleGeometry, ISectionGeometry, RectangleGeometry, geometry_definition, geometry_hash, validate_geometry, validate_geometry_definition
from .results import CalculationResult
from .solver import SOLVER_VERSION, calculate, solver_config_hash

__all__ = ["CalculationError", "CalculationOptions", "CalculationResult", "CircleGeometry", "ConvergenceError", "ISectionGeometry", "RectangleGeometry", "SOLVER_VERSION", "UnsupportedPropertyError", "calculate", "geometry_definition", "geometry_hash", "solver_config_hash", "validate_geometry", "validate_geometry_definition"]
