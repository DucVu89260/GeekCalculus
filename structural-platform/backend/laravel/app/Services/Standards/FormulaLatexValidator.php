<?php

namespace App\Services\Standards;

use RuntimeException;

/** Conservative server preflight. Source comparison and browser KaTeX parsing are also required. */
final class FormulaLatexValidator
{
    public static function assertUsable(string $latex): void
    {
        if (trim($latex) === '' || strlen($latex) > 20000 || !preg_match('/\S\s*=\s*\S/s', $latex)) {
            throw new RuntimeException('An equation must contain a nonempty mathematical equality.');
        }
        if (preg_match('/\\\\(?:href|url|html\w*|includegraphics|def|gdef|newcommand|renewcommand|input|write|require)\b/i', $latex)) {
            throw new RuntimeException('Active content and macro definitions are not allowed in reviewed equations.');
        }
        preg_match_all('/\\\\([a-zA-Z]+)/', $latex, $commands);
        $allowed = explode(' ', 'frac dfrac tfrac sqrt left right begin end text textrm textnormal mathrm mathbf mathit mathcal mathsf operatorname overline underline bar hat vec tilde widetilde dot ddot pi phi varphi Phi omega Omega alpha beta gamma Gamma delta Delta epsilon varepsilon theta Theta lambda Lambda mu nu rho sigma Sigma tau eta zeta chi psi Psi kappa xi Xi upsilon Upsilon partial nabla infty times cdot div pm mp le leq ge geq neq approx equiv sim simeq propto in notin subset forall exists min max sin cos tan ln log exp sum prod int iint lim limits nolimits displaystyle textstyle scriptscriptstyle scriptstyle quad qquad hspace vphantom phantom big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr lbrace rbrace lvert rvert lVert rVert vert Vert mid angle circ degree percent lfloor rfloor lceil rceil ldots cdots vdots ddots to rightarrow Rightarrow mapsto underbrace overbrace substack overset underset');
        if (array_diff($commands[1], $allowed) !== []) {
            throw new RuntimeException('Unsupported LaTeX command: use the supported mathematical notation and render the draft before approval.');
        }
        $depth = 0;
        $plain = preg_replace('/\\\\[{}]/', '', $latex);
        foreach (str_split($plain) as $char) {
            if ($char === '{') { $depth++; }
            if ($char === '}') { $depth--; }
            if ($depth < 0) { break; }
        }
        if ($depth !== 0 || preg_match('/(?:\^\^|__|\\\\(?:frac|dfrac|tfrac)\s*$)/', $latex)) {
            throw new RuntimeException('The equation contains incomplete LaTeX.');
        }
    }
}
