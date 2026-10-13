"""Convergent Saint-Venant series for a solid sharp-corner rectangle.

For a >= b (full side lengths):
J = a*b**3/3 * (1 - 192*b/(pi**5*a) * sum_odd(tanh(n*pi*a/(2*b))/n**5)).
The positive omitted sum is bounded by 1/(8*(2*N-1)**4) after N terms.
This follows from tanh <= 1 and the decreasing-function integral test on
the odd-integer grid. J is NOT the polar second moment of area.
"""

from dataclasses import dataclass
import math
import sys


@dataclass(frozen=True)
class RectangleTorsionResult:
    value: float | None
    converged: bool
    reason: str | None
    diagnostics: dict


def rectangle_torsion(width: float, height: float, *, relative_tolerance: float, max_terms: int) -> RectangleTorsionResult:
    if not all(math.isfinite(value) and value > 0 for value in (width, height, relative_tolerance)):
        raise ValueError("dimensions and relative tolerance must be positive and finite")
    if isinstance(max_terms, bool) or not isinstance(max_terms, int) or max_terms < 1:
        raise ValueError("max_terms must be a positive integer")
    a, b = max(width, height), min(width, height)
    base = a * b**3 / 3
    coefficient = 192 * b / (math.pi**5 * a)
    if not math.isfinite(base) or base <= 0:
        raise ArithmeticError("torsion result exceeds the floating-point range")
    total = compensation = 0.0
    diagnostics = {}
    for count in range(1, max_terms + 1):
        n = 2 * count - 1
        term = math.tanh(n * math.pi * (a / b) / 2) / n**5
        # Compensated summation limits accumulation error independently of N.
        corrected = term - compensation
        updated = total + corrected
        compensation = (updated - total) - corrected
        total = updated
        scaled_value = 1 - coefficient * total
        estimate = base * scaled_value
        scaled_tail_bound = coefficient / (8 * n**4)
        # Floating-point estimate is reported separately from the rigorous
        # mathematical tail bound; it is not interval-arithmetic certification.
        scaled_roundoff_estimate = 32 * sys.float_info.epsilon * (1 + abs(coefficient * total)) + 2 * math.ulp(base) / base
        # Compare in normalized coordinates: absolute error products can
        # underflow for subnormal J and must never imply exact convergence.
        lower = scaled_value - scaled_tail_bound - scaled_roundoff_estimate
        relative_bound = (scaled_tail_bound + scaled_roundoff_estimate) / lower if lower > 0 else None
        truncation_bound = math.nextafter(base * scaled_tail_bound, math.inf)
        rounding_estimate = math.nextafter(base * scaled_roundoff_estimate, math.inf)
        diagnostics = {
            "method": "saint_venant_odd_series",
            "terms": count,
            "requested_relative_tolerance": relative_tolerance,
            "truncation_abs_error_bound": truncation_bound,
            "floating_point_abs_error_estimate": rounding_estimate,
            "relative_error_bound_with_roundoff_estimate": relative_bound,
            "scaled_tail_bound": scaled_tail_bound,
            "scaled_roundoff_estimate": scaled_roundoff_estimate,
            "converged": bool(relative_bound is not None and relative_bound <= relative_tolerance),
        }
        if diagnostics["converged"]:
            return RectangleTorsionResult(estimate, True, None, diagnostics)
        if scaled_value > 0 and scaled_roundoff_estimate / scaled_value >= relative_tolerance:
            return RectangleTorsionResult(None, False, "numerical_precision_limit", diagnostics)
    return RectangleTorsionResult(None, False, "convergence_not_achieved", diagnostics)
