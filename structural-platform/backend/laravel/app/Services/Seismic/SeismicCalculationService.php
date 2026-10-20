<?php

namespace App\Services\Seismic;

final class SeismicCalculationService
{
    public function calculate(array $input, ?array $dto): array
    {
        $p = $input['project'] ?? [];
        Rules::require(! isset($p['Fa_override']) && ! isset($p['Fv_override']) || ! empty($p['coefficient_source']), 'Coefficient override source required');
        Rules::require(in_array($p['units'] ?? '', ['SI', 'US']), 'Project units must be SI or US');
        $site = (new SiteClassificationService)->calculate($p);
        $s = (new SpectrumService)->calculate($p, $site);
        $out = ['schema_version' => 'seismic-run/1', 'code' => Rules::tables()['version'], 'standard_source' => Rules::tables()['source'], 'calculated_at' => gmdate(DATE_ATOM), 'input' => $input, 'site' => $site, 'spectrum' => $s, 'mass' => null, 'directions' => [], 'status' => 'REVIEW_REQUIRED'];
        if ($s['status'] !== 'calculated') {
            return $out;
        }
        if ($dto && ! empty($input['mass']['source'])) {
            $out['mass'] = (new MassSourceService)->calculate($dto, $input['mass']);
        }
        foreach (['X', 'Y'] as $axis) {
            $system = (new SeismicSystemService)->calculate($p, $s, $input['directions'][$axis] ?? []);
            $elf = $system['status'] === 'calculated' ? (new BaseShearService)->calculate($s, $system, $out['mass']['W_kN'] ?? null) : null;
            $rs = null;
            $selection = $input['rs'][$axis] ?? null;
            if ($dto && $selection && ! empty($selection['row_id']) && $elf) {
                $rows = array_values(array_filter($dto['reactions'], fn ($r) => $r['id'] === $selection['row_id']));
                Rules::require(count($rows) === 1, 'RS row not found');
                Rules::require(($dto['cases'][$rows[0]['case']]['type'] ?? 'unknown') === 'response_spectrum', 'Imported SAP load-case metadata must identify this as a response-spectrum case');
                Rules::require(! in_array(strtolower($rows[0]['step']), ['mode', 'step']), 'Individual mode/time-step cannot be used as combined modal base shear');
                $rs = (new ResponseSpectrumService)->verify($elf, $rows[0], $axis, $selection);
            }
            $out['directions'][$axis] = ['system' => $system, 'elf' => $elf, 'rs' => $rs];
        }

        return $out;
    }
}
