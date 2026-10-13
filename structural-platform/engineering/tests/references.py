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


def independent_i_thin_wall_reference(dimensions: dict) -> dict:
    """High-precision Vlasov/energy reference, integrating web energy directly.

    This is an independent benchmark of the explicitly idealized centerline
    model, not a claim of exact thick-wall elasticity for an I-section.
    ``mp.quad`` integrates the quartic web shear-flow energy rather than using
    the production solver's three-point Gauss rule.
    """
    with mp.workdps(70):
        h, bt, bb, tw, tt, tb = [mp.mpf(str(dimensions[key])) for key in (
            "depth", "top_flange_width", "bottom_flange_width", "web_thickness",
            "top_flange_thickness", "bottom_flange_thickness",
        )]
        yb, yt = tb / 2, h - tt / 2
        h0 = yt - yb
        ib, it = tb * bb**3 / 12, tt * bt**3 / 12
        shear_y = (ib * yb + it * yt) / (ib + it)
        cw = h0**2 * ib * it / (ib + it)
        ax = (ib + it)**2 / (tb * bb**5 / 120 + tt * bt**5 / 120)

        area_bottom, area_web, area_top = bb * tb, tw * h0, bt * tt
        y_web = (yb + yt) / 2
        cy_line = (area_bottom * yb + area_web * y_web + area_top * yt) / (area_bottom + area_web + area_top)
        ix_line = (
            area_bottom * (yb - cy_line)**2
            + tw * (h0**3 / 12 + h0 * (y_web - cy_line)**2)
            + area_top * (yt - cy_line)**2
        )
        q = lambda y: area_top * (yt - cy_line) + tw / 2 * ((yt - cy_line)**2 - (y - cy_line)**2)
        web_energy = mp.quad(lambda y: q(y)**2 / tw, [yb, yt])
        flange_energy = ib * (yb - cy_line)**2 + it * (yt - cy_line)**2
        ay = ix_line**2 / (web_energy + flange_energy)
        return {
            "warping_constant_cw": float(cw),
            "shear_center_y": float(shear_y),
            "line_area_centroid_y": float(cy_line),
            "effective_shear_area_x": float(ax),
            "effective_shear_area_y": float(ay),
            "web_energy": float(web_energy),
            "flange_energy": float(flange_energy),
        }


def independent_i_sectorial_pole_reference(dimensions: dict) -> dict:
    """Check the warping pole using direct flange-sectorial integrals.

    Set sectorial coordinate omega=0 on the web. On a flange at y_f, moving
    horizontally from the web gives omega(x)=(y_s-y_f)*x, so its integrals use
    ∫x²dA=t_f*b_f³/12. The shear-center pole makes ∫omega*x dA vanish, and
    integrating omega² gives Cw.
    """
    with mp.workdps(70):
        h, bt, bb, tt, tb = [mp.mpf(str(dimensions[key])) for key in (
            "depth", "top_flange_width", "bottom_flange_width",
            "top_flange_thickness", "bottom_flange_thickness",
        )]
        yb, yt = tb / 2, h - tt / 2
        ib, it = tb * bb**3 / 12, tt * bt**3 / 12
        ys = (ib * yb + it * yt) / (ib + it)
        omega_x_first_moment = ib * (ys - yb) + it * (ys - yt)
        cw = ib * (ys - yb)**2 + it * (ys - yt)**2
        return {"shear_center_y": float(ys), "omega_x_first_moment": float(omega_x_first_moment), "warping_constant_cw": float(cw)}
