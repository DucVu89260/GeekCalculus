"""Independent test references, never imported by the production engine.

Polygon moments below integrate monomials over rectangle bounds in Decimal,
then shift the raw moments to the centroid (not the solver's parallel-axis
component formula). PNA is obtained by exact piecewise area inversion, not
production bisection. Rectangle torsion uses the full odd zeta sum minus an
exponentially converging correction at 70 decimal digits.
"""

from decimal import Decimal, localcontext

import mpmath as mp


def independent_i_reference(dimensions: dict) -> dict:
    with localcontext() as context:
        context.prec = 60
        h, bt, bb, tw, tt, tb = [Decimal(str(dimensions[key])) for key in ("depth", "top_flange_width", "bottom_flange_width", "web_thickness", "top_flange_thickness", "bottom_flange_thickness")]
        width = max(bt, bb)
        bounds = [((width - bb) / 2, (width + bb) / 2, Decimal(0), tb), ((width - tw) / 2, (width + tw) / 2, tb, h - tt), ((width - bt) / 2, (width + bt) / 2, h - tt, h)]
        area = first_x = first_y = raw_x = raw_y = raw_xy = Decimal(0)
        for x0, x1, y0, y1 in bounds:
            area += (x1 - x0) * (y1 - y0)
            first_x += (x1**2 - x0**2) * (y1 - y0) / 2
            first_y += (y1**2 - y0**2) * (x1 - x0) / 2
            raw_x += (x1 - x0) * (y1**3 - y0**3) / 3
            raw_y += (y1 - y0) * (x1**3 - x0**3) / 3
            raw_xy += (x1**2 - x0**2) * (y1**2 - y0**2) / 4
        xc, yc = first_x / area, first_y / area
        target = area / 2
        remaining = target
        yp = None
        for x0, x1, y0, y1 in bounds:
            block_area = (x1 - x0) * (y1 - y0)
            if remaining <= block_area:
                yp = y0 + remaining / (x1 - x0)
                break
            remaining -= block_area
        zx = Decimal(0)
        for x0, x1, y0, y1 in bounds:
            # Evaluate the absolute first moment by its antiderivative.
            primitive = lambda y: (y - yp) * abs(y - yp) / 2
            zx += (x1 - x0) * (primitive(y1) - primitive(y0))
        return {"area": float(area), "centroid_x": float(xc), "centroid_y": float(yc), "ix": float(raw_x - area * yc**2), "iy": float(raw_y - area * xc**2), "ixy": float(raw_xy - area * xc * yc), "pna_y": float(yp), "zx": float(zx)}


def independent_rectangle_j(width: float, height: float):
    with mp.workdps(70):
        a, b = sorted([mp.mpf(str(width)), mp.mpf(str(height))], reverse=True)
        ratio = mp.pi * a / (2 * b)
        correction = mp.fsum(2 / ((mp.exp(2 * n * ratio) + 1) * n**5) for n in range(1, 65, 2))
        full_sum = mp.mpf(31) / 32 * mp.zeta(5) - correction
        return a * b**3 / 3 * (1 - 192 * b / (mp.pi**5 * a) * full_sum)


def independent_square_j_from_prandtl_pde(terms: int = 160) -> float:
    # phi solves Laplacian(phi) = -2, phi=0 on the unit-square boundary.
    # Sine-series integration gives J=256/pi^6 * sum_odd_m,n
    # 1/(m^2*n^2*(m^2+n^2)). This is a separate derivation from the 1D series.
    import math
    series = math.fsum(1 / (m*m*n*n*(m*m+n*n)) for m in range(1, 2 * terms, 2) for n in range(1, 2 * terms, 2))
    return 256 * series / math.pi**6
