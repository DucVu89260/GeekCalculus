<?php

namespace App\Services\Seismic;

final class MassSourceService
{
    public function calculate(array $dto, array $selection): array
    {
        $found = array_values(array_filter($dto['definitions'], fn ($d) => $d['name'] === ($selection['source'] ?? '')));
        Rules::require(count($found) === 1, 'Select an imported SAP2000 Mass Source');
        $definition = $found[0];
        $result = ['status' => 'INPUT_REQUIRED', 'W_kN' => null, 'definition' => $definition, 'mass_quantity' => null, 'basis' => $selection['basis'] ?? '', 'audit' => [], 'excluded_cases' => array_values(array_unique(array_column($dto['reactions'], 'case'))), 'reference' => '§12.7.2; SAP2000 Mass Source definition versus model mass/weight'];
        if (! ($selection['scope_confirmed'] ?? false)) {
            $result['audit'][] = 'Confirm SAP mass scope meets §12.7.2 (self weight, partitions, storage live, snow, permanent equipment as applicable).';

            return $result;
        }
        if (($selection['basis'] ?? '') === 'model_mass') {
            $rows = array_values(array_filter($dto['masses'], fn ($r) => $r['id'] === ($selection['mass_row_id'] ?? '')));
            Rules::require(count($rows) === 1, 'Select one total model mass row, not summed story/joint masses');
            $mass = $rows[0];
            Rules::require($mass['source'] === $definition['name'] || ($mass['source'] === '' && ($selection['mass_source_association_confirmed'] ?? false) === true), 'Model mass must be tied to the selected Mass Source; explicitly confirm association if export omits source name');
            Rules::require(($selection['net_model_mass_confirmed'] ?? false) === true, 'Confirm total net translational mass includes constraints, element/additional/load-derived mass without double counting');
            $mx = Rules::number($mass['mass_x_kg'], 'UX model mass', 0, true);
            $my = Rules::number($mass['mass_y_kg'], 'UY model mass', 0, true);
            Rules::require(abs($mx - $my) / max($mx, $my) < .001, 'Different UX/UY masses require directional engineering reconciliation; one common W unavailable');
            $result['mass_quantity'] = $mass;
            $result['W_kN'] = $mx * 9.80665 / 1000;
            $result['audit'][] = 'W = verified total SAP UX mass × g; UX/UY reconciled within 0.1%; g=9.80665m/s².';
        } elseif (($selection['basis'] ?? '') === 'pattern_reactions') {
            Rules::require(! $definition['flags']['element_mass'] && ! $definition['flags']['additional_mass'] && $definition['flags']['from_loads'], 'Reaction derivation supports load-only Mass Sources; element/additional masses require verified net model mass');
            Rules::require(($selection['reaction_scope_confirmed'] ?? false) === true, 'Confirm complete global vertical base reactions, single-pattern linear-static cases at factor 1, self weight exactly once, no uplift/envelope/combination/constraint omissions');
            $weight = 0;
            $used = [];
            foreach ($definition['patterns'] as $pattern => $factor) {
                if ($factor == 0) {
                    $result['audit'][] = "$pattern excluded (factor 0)";

                    continue;
                }
                $id = $selection['pattern_rows'][$pattern] ?? '';
                $rows = array_values(array_filter($dto['reactions'], fn ($r) => $r['id'] === $id));
                Rules::require(count($rows) === 1, "Select verified reaction for pattern $pattern");
                $r = $rows[0];
                $case = $dto['cases'][$r['case']] ?? null;
                Rules::require($case && $case['type'] === 'linear_static' && count($case['patterns']) === 1 && isset($case['patterns'][$pattern]) && abs($case['patterns'][$pattern] - 1) < 1e-10, "Reaction case must be imported as linear-static with only $pattern at factor 1 (case definitions / loads applied)");
                Rules::require(! in_array($id, $used), 'Do not reuse one combined reaction for multiple patterns');
                $used[] = $id;
                Rules::require($r['FZ_kN'] !== null && $r['FZ_kN'] > 0, 'Expected positive global +Z supporting reaction; verify axes/sign, no absolute-value guessing');
                Rules::require(! in_array(strtolower($r['step']), ['max', 'min', 'mode', 'envelope']), 'Envelope/mode reaction cannot derive W');
                $weight += $r['FZ_kN'] * $factor;
                $result['audit'][] = ['pattern' => $pattern, 'factor' => $factor, 'case' => $r['case'], 'vertical_kN' => $r['FZ_kN'], 'provenance' => $r['provenance']];
                $result['excluded_cases'] = array_values(array_diff($result['excluded_cases'], [$r['case']]));
            }
            $result['W_kN'] = Rules::number($weight, 'Derived W', 0, true);
        } else {
            return $result;
        }
        $result['status'] = 'calculated';

        return $result;
    }
}
