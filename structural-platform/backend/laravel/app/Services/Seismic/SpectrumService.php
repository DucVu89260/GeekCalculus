<?php

namespace App\Services\Seismic;

final class SpectrumService
{
    public function calculate(array $p, array $site): array
    {
        $ss = Rules::number($p['Ss'] ?? null, 'Ss', 0, true);
        $s1 = Rules::number($p['S1'] ?? null, 'S1', 0, true);
        $tl = Rules::number($p['TL'] ?? null, 'TL', 0, true);
        Rules::require(trim($p['TL_source'] ?? '') !== '', 'TL source required');
        if ($site['review_required']) {
            return ['status' => 'REVIEW_REQUIRED', 'reason' => 'Site-specific Chapter 21 study required; generic spectrum disabled.', 'reference' => '§11.4.7; §20.3.1'];
        }
        $t = Rules::tables();
        $c = $site['class'];
        $fa = Rules::interpolate($ss, $t['Fa']['x'], $t['Fa'][$c]);
        $fv = Rules::interpolate($s1, $t['Fv']['x'], $t['Fv'][$c]);
        $tableFa = $fa;
        $tableFv = $fv;
        $override = false;
        if (isset($p['Fa_override']) || isset($p['Fv_override'])) {
            Rules::require(trim($p['coefficient_source'] ?? '') !== '' && trim($p['coefficient_reason'] ?? '') !== '', 'Coefficient override requires source and reason');
            if (isset($p['Fa_override'])) {
                $fa = Rules::number($p['Fa_override'], 'Fa override', 0, true);
            }
            if (isset($p['Fv_override'])) {
                $fv = Rules::number($p['Fv_override'], 'Fv override', 0, true);
            }
            $override = true;
        }
        $sms = $fa * $ss;
        $sm1 = $fv * $s1;
        $sds = 2 * $sms / 3;
        $sd1 = 2 * $sm1 / 3;
        $ts = $sd1 / $sds;
        $t0 = .2 * $ts;
        Rules::require($tl >= $ts, 'TL must be at least Ts; verify hazard/transition-period inputs');
        $risk = $p['risk'] ?? 'II';
        Rules::require(in_array($risk, ['I', 'II', 'III', 'IV']), 'Invalid Risk Category');
        $ie = ['I' => 1, 'II' => 1, 'III' => 1.25, 'IV' => 1.5][$risk];
        if (isset($p['Ie_override'])) {
            Rules::require(trim($p['Ie_reason'] ?? '') !== '', 'Ie override reason required');
            $ie = Rules::number($p['Ie_override'], 'Ie', 0, true);
        }
        $a = $sds < .167 ? 'A' : ($sds < .33 ? ($risk === 'IV' ? 'C' : 'B') : ($sds < .5 ? ($risk === 'IV' ? 'D' : 'C') : 'D'));
        $b = $sd1 < .067 ? 'A' : ($sd1 < .133 ? ($risk === 'IV' ? 'C' : 'B') : ($sd1 < .2 ? ($risk === 'IV' ? 'D' : 'C') : 'D'));
        $sdc = $s1 >= .75 ? ($risk === 'IV' ? 'F' : 'E') : max($a, $b);
        $curve = [];
        $periods = array_unique(array_merge([0, $t0, $ts, $tl], array_map(fn ($i) => $i * max(4, 1.2 * $tl) / 160, range(0, 160))));
        sort($periods);
        foreach ($periods as $period) {
            $curve[] = ['T' => $period, 'Sa' => $period < $t0 ? $sds * (.4 + .6 * $period / $t0) : ($period <= $ts ? $sds : ($period <= $tl ? $sd1 / $period : $sd1 * $tl / $period ** 2))];
        }

        return ['status' => 'calculated', 'Fa' => $fa, 'Fv' => $fv, 'table_Fa' => $tableFa, 'table_Fv' => $tableFv, 'override_review_required' => $override, 'coefficient_source' => $p['coefficient_source'] ?? null, 'SMS' => $sms, 'SM1' => $sm1, 'SDS' => $sds, 'SD1' => $sd1, 'T0' => $t0, 'Ts' => $ts, 'TL' => $tl, 'S1' => $s1, 'Ie' => $ie, 'SDC' => $sdc, 'curve' => $curve, 'reference' => 'Tables 11.4-1/2; Eqs 11.4-1…7; Tables 11.6-1/2; Table 1.5-2', 'formulas' => ['SMS=Fa·Ss', 'SM1=Fv·S1', 'SDS=⅔SMS', 'SD1=⅔SM1', 'T0=0.2SD1/SDS', 'Ts=SD1/SDS'], 'table_version' => $t['version']];
    }
}
