<?php

namespace App\Services\Seismic;

final class SiteClassificationService
{
    public function calculate(array $p): array
    {
        $mode = $p['site_method'] ?? 'manual';
        Rules::require(trim($p['hazard_source'] ?? '') !== '', 'Ss/S1 authoritative source is required');
        Rules::require(trim($p['site_source'] ?? '') !== '', 'Geotechnical/site-class source is required');
        $class = $p['site_class'] ?? '';
        $average = null;
        if ($mode !== 'manual') {
            Rules::require(in_array($mode, ['N', 'Vs']), 'Site method must be manual, N or Vs');
            Rules::require(($p['profile_screened'] ?? false) === true, 'Geotechnical F and soft-clay E screening must be confirmed');
            $depth = 0;
            $denominator = 0;
            foreach ($p['layers'] ?? [] as $layer) {
                $top = Rules::number($layer['top'] ?? null, 'Layer top');
                $bottom = Rules::number($layer['bottom'] ?? null, 'Layer bottom');
                Rules::require(abs($top - $depth) < 0.0001 && $bottom > $top && $bottom <= 30.0001, 'Profile must be continuous from 0 to exactly 30m without gaps/overlaps');
                $value = Rules::number($layer['value'] ?? null, $mode, 0, true);
                // ASCE 7-10 20.4.2: field ASTM D1586 N, capped at 100; no energy/overburden correction.
                if ($mode === 'N') {
                    $value = min(100, $value);
                }
                $denominator += ($bottom - $top) / $value;
                $depth = $bottom;
            }
            Rules::require(abs($depth - 30) < 0.0001, 'A complete 30m profile is required');
            $average = 30 / $denominator;
            $class = $mode === 'N' ? ($average > 50 ? 'C' : ($average >= 15 ? 'D' : 'E')) : ($average > 1524 ? 'A' : ($average > 762 ? 'B' : ($average > 365.76 ? 'C' : ($average >= 182.88 ? 'D' : 'E'))));
            if (in_array($class, ['A', 'B'])) {
                Rules::require(($p['rock_confirmed'] ?? false) === true, 'Rock A/B requires geotechnical confirmation, soil-cover and continuity checks (20.1/20.3.4–5)');
            }
        }
        Rules::require(in_array($class, ['A', 'B', 'C', 'D', 'E', 'F']), 'Unknown site class');
        if (($p['site_f'] ?? false) === true) {
            $class = 'F';
        } elseif (($p['soft_clay_e'] ?? false) === true) {
            $class = 'E';
        }

        return ['class' => $class, 'method' => $mode, 'average' => $average, 'depth_m' => $mode === 'manual' ? null : 30, 'review_required' => $class === 'F' || ($p['site_specific'] ?? false), 'reference' => '§20.1–20.4; Table 20.3-1', 'provenance' => ['hazard' => $p['hazard_source'], 'site' => $p['site_source']]];
    }
}
