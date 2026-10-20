<?php

namespace App\Services\Seismic;

final class SeismicSystemService
{
    public function calculate(array $p, array $s, array $axis): array
    {
        $t = Rules::tables();
        $found = array_values(array_filter($t['systems'], fn ($row) => $row['id'] === ($axis['system'] ?? '')));
        Rules::require(count($found) === 1, 'Choose a verified Table 12.2-1 system');
        $row = $found[0];
        $height = Rules::number($p['height'] ?? null, 'Building height', 0, true) * (($p['units'] ?? 'SI') === 'US' ? 1 : 1 / 0.3048);
        $limit = $row['limits'][$s['SDC']] ?? null;
        $allowed = $limit !== false && ($limit === null || $height <= $limit);
        $period = $row['period'];
        if (str_contains($period, 'moment') && ! ($axis['moment_eligible'] ?? false)) {
            $period = 'other';
        }
        $ct = $t['periods'][$period]['Ct'];
        $x = $t['periods'][$period]['x'];
        $ta = $ct * $height ** $x;
        $cu = Rules::interpolate($s['SD1'], $t['Cu']['x'], $t['Cu']['values']);
        $modal = isset($axis['Tmodal']) ? Rules::number($axis['Tmodal'], 'Tmodal', 0, true) : null;
        $used = $modal === null ? $ta : min($modal, $cu * $ta);

        return array_merge($row, ['status' => $allowed ? 'calculated' : 'REVIEW_REQUIRED', 'reason' => $allowed ? null : 'System prohibited or exceeds tabulated height; exceptions require separate review.', 'Ct' => $ct, 'x' => $x, 'Cu' => $cu, 'Ta' => $ta, 'Tcap' => $cu * $ta, 'Tmodal' => $modal, 'Tused' => $used, 'reference' => 'Table 12.2-1 '.$row['id'].'; Tables 12.8-1/2; §12.8.2; Eq 12.8-7', 'height_ft' => $height, 'period_basis' => $period]);
    }
}
