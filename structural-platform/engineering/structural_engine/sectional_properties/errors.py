"""Domain errors; HTTP adapters can map these without exposing tracebacks."""


class CalculationError(Exception):
    code = "CALCULATION_ERROR"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.details = details or {}


class UnsupportedPropertyError(CalculationError):
    code = "UNSUPPORTED_PROPERTY"


class ConvergenceError(CalculationError):
    """A requested property could not meet its numerical tolerance."""

