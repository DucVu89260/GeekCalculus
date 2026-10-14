"""SectionalProperties v1: definitions → validation → analytical results."""

from .errors import CalculationError, ConvergenceError, UnsupportedPropertyError
from .models import AngleGeometry, CalculationOptions, ChannelGeometry, CircleGeometry, CircularHollowGeometry, ISectionGeometry, RectangleGeometry, RectangularHollowGeometry, TeeGeometry, geometry_definition, geometry_hash, validate_geometry, validate_geometry_definition
from .results import CalculationResult
from .solver import SOLVER_VERSION, calculate, solver_config_hash

__all__ = ["AngleGeometry", "CalculationError", "CalculationOptions", "CalculationResult", "ChannelGeometry", "CircleGeometry", "CircularHollowGeometry", "ConvergenceError", "ISectionGeometry", "RectangleGeometry", "RectangularHollowGeometry", "SOLVER_VERSION", "TeeGeometry", "UnsupportedPropertyError", "calculate", "geometry_definition", "geometry_hash", "solver_config_hash", "validate_geometry", "validate_geometry_definition"]
