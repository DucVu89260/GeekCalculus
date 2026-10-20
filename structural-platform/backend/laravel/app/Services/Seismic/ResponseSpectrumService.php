<?php

namespace App\Services\Seismic;

final class ResponseSpectrumService
{
    public function verify(array $elf, array $row, string $axis, array $selection): array
    {
        Rules::require(in_array($axis, ['X', 'Y']), 'RS axis must be X or Y');
        Rules::require(($selection['case_type'] ?? '') === 'response_spectrum' && ($selection['global_axes'] ?? false) === true, 'Select an individual response-spectrum case with confirmed global FX/FY axes');
        Rules::require(($selection['modal_combination_confirmed'] ?? false) === true, 'Confirm combined modal results, not a single mode, combination, or gravity case');
        Rules::require(($selection['applicability_confirmed'] ?? false) === true, 'Confirm §12.9.4.1 applies; other procedures/exceptions require separate review');
        Rules::require(($row['case'] ?? '') === ($selection['case'] ?? '') && (string) ($row['id'] ?? '') === (string) ($selection['row_id'] ?? ''), 'Exact RS case/step row must match selected result');
        $signed = Rules::number(abs($row[$axis === 'X' ? 'FX_kN' : 'FY_kN'] ?? NAN), 'RS shear') * (($row[$axis === 'X' ? 'FX_kN' : 'FY_kN'] ?? 0) < 0 ? -1 : 1);
        $state = $selection['result_state'] ?? '';
        Rules::require(in_array($state, ['raw', 'scaled']), 'Declare raw/scaled result state');
        // Already-scaled result: only reverse a documented additional multiplier, not SAP spectrum g/unit scale.
        $applied = $state === 'scaled' ? Rules::number($selection['applied_multiplier'] ?? null, 'Documented additional applied scale', 0, true) : 1;
        Rules::require(trim($selection['scale_source'] ?? '') !== '', 'SAP spectrum scale/units provenance required');
        $raw = abs($signed) / $applied;
        $v = $elf['V_kN'] ?? null;
        $threshold = $v === null ? null : .85 * $v;
        $total = $threshold === null || $raw == 0 ? null : max(1, $threshold / $raw);

        return ['status' => $v === null ? 'INPUT_REQUIRED' : ($raw == 0 ? 'ZERO_SHEAR' : (abs($signed) + 1e-8 >= $threshold ? 'PASS' : 'FAIL')), 'case' => $row['case'], 'row_id' => $row['id'], 'axis' => $axis, 'signed_kN' => $signed, 'absolute_kN' => abs($signed), 'raw_kN' => $raw, 'existing_multiplier' => $applied, 'threshold_kN' => $threshold, 'ratio' => $v === null ? null : abs($signed) / $v, 'required_total_multiplier' => $total, 'additional_multiplier' => $total === null ? null : max(1, $total / $applied), 'reference' => 'ASCE 7-10 §12.9.4.1: 0.85·V_ELF (CuTa-capped period)', 'provenance' => $row['provenance'], 'scale_source' => $selection['scale_source'], 'warning' => 'Strength-force comparison only; drift scaling §12.9.4.2 is separate. PASS is not complete seismic approval.'];
    }
}
