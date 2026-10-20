<?php

namespace App\Services\Seismic;

final class BaseShearService
{
    public function calculate(array $s, array $axis, ?float $weight): array
    {
        $r = Rules::number($axis['R'], 'R', 0, true);
        $ie = Rules::number($s['Ie'], 'Ie', 0, true);
        $period = Rules::number($axis['Tused'], 'Tused', 0, true);
        $basic = $s['SDS'] * $ie / $r;
        $upper = $period <= $s['TL'] ? $s['SD1'] * $ie / ($period * $r) : $s['SD1'] * $s['TL'] * $ie / ($period ** 2 * $r);
        $minimum = max(.044 * $s['SDS'] * $ie, .01, $s['S1'] >= .6 ? .5 * $s['S1'] * $ie / $r : 0);
        $cs = max(min($basic, $upper), $minimum);

        return ['status' => $weight === null ? 'INPUT_REQUIRED' : 'calculated', 'Cs' => $cs, 'basic' => $basic, 'upper' => $upper, 'minimum' => $minimum, 'W_kN' => $weight, 'V_kN' => $weight === null ? null : $cs * Rules::number($weight, 'W', 0, true), 'reference' => '§12.8.1.1; Eqs 12.8-1…6', 'formulas' => ['Cs=max(min(SDS·Ie/R,upper),0.044·SDS·Ie,0.01,conditional 0.5·S1·Ie/R)', 'V=Cs·W'], 'warnings' => ['No SSI reduction or optional Ss cap applied. ELF analysis-method eligibility (§12.6) and mass scope (§12.7.2) require project review.']];
    }
}
