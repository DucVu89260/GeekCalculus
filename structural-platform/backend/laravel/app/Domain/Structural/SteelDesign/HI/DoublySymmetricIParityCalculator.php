<?php

declare(strict_types=1);

namespace App\Domain\Structural\SteelDesign\HI;

use InvalidArgumentException;

/**
 * Legacy Excel parity, NOT independently validated AISC 360-10.
 * Workbook is labelled AISC 360-05. Dimensions are converted to cm and
 * stresses to kN/cm2 for reproducibility against 2.Details cached results.
 */
final class DoublySymmetricIParityCalculator
{
    public const ENGINE_VERSION = 'legacy-parity-0.1.0';

    public function calculate(array $input): array
    {
        $material = $input['material'];
        $section = $input['section'];
        $member = $input['member'];
        $stiffeners = $input['stiffeners'];
        $forces = $input['forces'];

        $fy = $this->positive($material['fy_mpa'], 'fy_mpa') / 10;
        $e = $this->positive($material['e_mpa'], 'e_mpa') / 10;
        $h = $this->positive($section['h_mm'], 'h_mm') / 10;
        $bf = $this->positive($section['bf_mm'], 'bf_mm') / 10;
        $tw = $this->positive($section['tw_mm'], 'tw_mm') / 10;
        $tf = $this->positive($section['tf_mm'], 'tf_mm') / 10;
        $lb = $this->positive($member['lb_mm'], 'lb_mm') / 10;
        $lx = $this->positive($member['lx_mm'], 'lx_mm') / 10;
        $a = $this->nonNegative($stiffeners['spacing_mm'], 'spacing_mm') / 10;
        $ts = $this->positive($stiffeners['thickness_mm'], 'thickness_mm') / 10;
        $bs = $this->positive($stiffeners['width_mm'], 'width_mm') / 10;
        $fabrication = $section['fabrication'];
        $layout = $stiffeners['layout'];

        if ($h <= 2 * $tf || $bf < $tw || $bs > ($bf - $tw) / 2 || $e <= $fy) {
            throw new InvalidArgumentException('Invalid I/H geometry, stiffener width, or E/Fy ratio.');
        }
        if (!in_array($fabrication, ['BUILT_UP', 'ROLLED'], true) || !in_array($layout, ['PAIRED', 'SINGLE_ANGLE', 'SINGLE_PLATE'], true)) {
            throw new InvalidArgumentException('Unsupported fabrication or stiffener layout.');
        }
        foreach (['axial_kN', 'moment_x_kNm', 'moment_y_kNm', 'shear_x_kN', 'shear_y_kN', 'moment_25_kNm', 'moment_50_kNm', 'moment_75_kNm'] as $key) {
            if (!isset($forces[$key]) || !is_numeric($forces[$key]) || !is_finite((float) $forces[$key])) {
                throw new InvalidArgumentException("Invalid force value: {$key}.");
            }
        }

        $hw = $h - 2 * $tf;
        $area = $hw * $tw + 2 * $bf * $tf;
        $ix = ($bf * $h ** 3 - ($bf - $tw) * $hw ** 3) / 12;
        $iy = ($hw * $tw ** 3 + 2 * $tf * $bf ** 3) / 12;
        $sx = $ix / ($h / 2);
        $sy = $iy / ($bf / 2);
        $zx = $bf * $tf * ($hw + $tf) + $tw * $hw ** 2 / 4;
        $zy = $hw * $tw ** 2 / 4 + $tf * $bf ** 2 / 2;
        // Excel D57 web length convention is retained solely for legacy parity.
        $j = (2 * $bf * $tf ** 3 + ($h - $tf) * $tw ** 3) / 3;
        $rx = sqrt($ix / $area);
        $ry = sqrt($iy / $area);

        $ratioF = $bf / (2 * $tf);
        $ratioW = $hw / $tw;
        $kc = max(.35, min(.76, 4 / sqrt($ratioW)));
        $fl = .7 * $fy;
        $flangeP = .38 * sqrt($e / $fy);
        $flangeR = .95 * sqrt($kc * $e / $fl);
        $webP = 3.76 * sqrt($e / $fy);
        $webR = 5.7 * sqrt($e / $fy);
        $flangeClass = $this->sectionClass($ratioF, $flangeP, $flangeR, true);
        $webClass = $this->sectionClass($ratioW, $webP, $webR, false);
        $chapter = $webClass === 'COMPACT' ? ($flangeClass === 'COMPACT' ? 'F2' : 'F3') : ($webClass === 'NONCOMPACT' ? 'F4' : 'F5');

        $mx = abs((float) $forces['moment_x_kNm']);
        $my = abs((float) $forces['moment_y_kNm']);
        $vx = abs((float) $forces['shear_x_kN']);
        $vy = abs((float) $forces['shear_y_kN']);
        $n = (float) $forces['axial_kN'];
        // Excel K120: all four signed moments (unsafe on reversal, retained for parity).
        $denominator = 2.5 * (float) $forces['moment_x_kNm'] + 3 * $forces['moment_25_kNm'] + 4 * $forces['moment_50_kNm'] + 3 * $forces['moment_75_kNm'];
        $cb = abs($denominator) > 1.0e-12 ? 12.5 * (float) $forces['moment_x_kNm'] / $denominator : 1.0;
        if ($cb <= 0 || !is_finite($cb)) {
            throw new InvalidArgumentException('Legacy signed Cb is invalid for this moment diagram.');
        }
        $mp = $fy * $zx;
        $mnYPlastic = min($fy * $zy, 1.6 * $fy * $sy);
        $mnYLocal = match ($flangeClass) {
            'COMPACT' => $mnYPlastic,
            'NONCOMPACT' => $mnYPlastic - ($mnYPlastic - .7 * $fy * $zy) * ($ratioF - $flangeP) / ($flangeR - $flangeP),
            default => .69 * $e / ($ratioF ** 2) * $sy,
        };
        $mnY = min($mnYPlastic, $mnYLocal);

        $ho = $h - $tf;
        $ltbJRatio = $j / ($sx * $ho);
        $lp = 0.0;
        $lr = 0.0;
        $rpg = 1.0;
        $nominalLtb = 0.0;
        $nominalLocal = INF;
        $nominalYield = $mp;
        if (in_array($chapter, ['F2', 'F3'], true)) {
            $rts = sqrt($iy * $ho / (2 * $sx));
            $lp = 1.76 * $ry * sqrt($e / $fy);
            $lr = 1.95 * $rts * ($e / $fl) * sqrt($ltbJRatio)
                * sqrt(1 + sqrt(1 + 6.76 * ($fl / ($e * $ltbJRatio)) ** 2));
            $fcr = $cb * M_PI ** 2 * $e * sqrt(1 + .078 * $ltbJRatio * ($lb / $rts) ** 2) / ($lb / $rts) ** 2;
            $nominalLtb = $lb <= $lp ? $mp : ($lb <= $lr
                ? min($cb * ($mp - ($mp - $fl * $sx) * ($lb - $lp) / ($lr - $lp)), $mp)
                : min($mp, $fcr * $sx));
            if ($chapter === 'F3') {
                $nominalLocal = $flangeClass === 'NONCOMPACT'
                    ? $mp - ($mp - $fl * $sx) * ($ratioF - $flangeP) / ($flangeR - $flangeP)
                    : .9 * $e * $kc * $sx / ($ratioF ** 2);
            }
        } else {
            $aw = min(10, $hw * $tw / ($bf * $tf));
            $rt = $bf / sqrt(12 * ($ho / $h + ($aw / 6) * ($hw ** 2 / ($h * $ho))));
            $lp = 1.1 * $rt * sqrt($e / $fy);
            if ($chapter === 'F4') {
                $lr = 1.95 * $rt * ($e / $fl) * sqrt($ltbJRatio)
                    * sqrt(1 + sqrt(1 + 6.76 * ($fl / ($e * $ltbJRatio)) ** 2));
                $rpcMy = min($mp, 1.6 * $fy * $sx) / ($fy * $sx);
                $rpc = $ratioW > $webP
                    ? min($rpcMy - ($rpcMy - 1) * ($ratioW - $webP) / ($webR - $webP), $rpcMy)
                    : $rpcMy;
                $nominalYield = $rpc * $fy * $sx;
                $fcr = $cb * M_PI ** 2 * $e * sqrt(1 + .078 * $ltbJRatio * ($lb / $rt) ** 2) / ($lb / $rt) ** 2;
                $nominalLtb = $lb <= $lp ? $mp : ($lb <= $lr
                    ? min($cb * ($nominalYield - ($nominalYield - $fl * $sx) * ($lb - $lp) / ($lr - $lp)), $nominalYield)
                    : min($fcr * $sx, $nominalYield));
                $nominalLocal = $flangeClass === 'COMPACT' ? INF : ($flangeClass === 'NONCOMPACT'
                    ? $nominalYield - ($nominalYield - $fl * $sx) * ($ratioF - $flangeP) / ($flangeR - $flangeP)
                    : .9 * $e * $kc * $sx / ($ratioF ** 2));
            } else {
                $lr = M_PI * $rt * sqrt($e / $fl);
                $rpg = min(1 - $aw / (1200 + 300 * $aw) * ($ratioW - 5.7 * sqrt($e / $fy)), 1);
                $fn = $lb <= $lp ? $fy : ($lb <= $lr
                    ? min($cb * ($fy - .3 * $fy * ($lb - $lp) / ($lr - $lp)), $fy)
                    : min($cb * M_PI ** 2 * $e / ($lb / $rt) ** 2, $fy));
                $nominalLtb = $rpg * $fn * $sx;
                $nominalLocal = $flangeClass === 'COMPACT' ? INF : $rpg * ($flangeClass === 'NONCOMPACT'
                    ? $fy - .3 * $fy * ($ratioF - $flangeP) / ($flangeR - $flangeP)
                    : .9 * $e * $kc / ($ratioF ** 2)) * $sx;
                $nominalYield = $rpg * $fy * $sx;
            }
        }
        $mnX = min($nominalLtb, $nominalLocal, $nominalYield);
        $phiMnX = .9 * $mnX / 100;
        $phiMnY = .9 * $mnY / 100;

        $qsLimitP = .64 * sqrt($kc * $e / $fy);
        $qsLimitR = 1.17 * sqrt($kc * $e / $fy);
        $qs = $ratioF > $qsLimitR ? .9 * $kc * $e / ($fy * $ratioF ** 2)
            : ($ratioF > $qsLimitP ? 1.415 - .65 * $ratioF * sqrt($fy / ($kc * $e)) : 1);
        $effectiveHw = $ratioW >= 1.49 * sqrt($e / $fy)
            ? min(1.92 * $tw * sqrt($e / $fy) * (1 - .34 * sqrt($e / $fy) / $ratioW), $hw) : $hw;
        $qa = ($effectiveHw * $tw + 2 * $bf * $tf) / $area;
        $q = $qs * $qa;

        $feX = M_PI ** 2 * $e / ($lx / $rx) ** 2;
        // Excel W194 = Q194: weak-axis branch incorrectly uses strong-axis Fe.
        // Reproduce exactly for source parity; must be FIXED before validated design.
        $feY = $feX;
        $fcrX = ($lx / $rx) > 4.71 * sqrt($e / ($fy * $q)) ? .877 * $feX : $q * .658 ** ($q * $fy / $feX) * $fy;
        $fcrY = ($lb / $ry) > 4.71 * sqrt($e / ($fy * $q)) ? .877 * $feY : $q * .658 ** ($q * $fy / $feY) * $fy;
        $pn = min($fcrX, $fcrY) * $area;
        $phiPn = .9 * $pn;
        $phiPt = .9 * $fy * $area;
        $pRatio = abs($n) / ($n < 0 ? $phiPn : $phiPt);
        $ratioMx = $mx / $phiMnX;
        $ratioMy = $my / $phiMnY;
        $roundedMinor = round($ratioMy * 100, 2) / 100;
        $interaction = $pRatio >= .2
            ? $pRatio + (8 / 9) * ($ratioMx + $roundedMinor)
            : $pRatio / 2 + $ratioMx + $roundedMinor;

        $aspect = $a / $hw;
        $kv = $a === 0.0 ? 1.2 : 5 + 5 / ($aspect ** 2);
        $webCv = ($fabrication === 'ROLLED' && $ratioW < 2.24 * sqrt($e / $fy))
            ? 1 : $this->shearCv($ratioW, $kv, $e, $fy);
        $vnWeb = .6 * $fy * $hw * $tw * $webCv;
        $phiWeb = $fabrication === 'ROLLED' && $ratioW < 2.24 * sqrt($e / $fy) ? 1.0 : .9;
        $phiVWeb = $phiWeb * $vnWeb;
        $cvFlange = $this->shearCv($bf / $tf, 1.2, $e, $fy);
        $phiVFlange = .9 * .6 * $fy * 2 * $bf * $tf * $cvFlange;
        $tensionFieldEligible = !($aspect > 3 || (260 / $ratioW) ** 2 > 3)
            && $hw * $tw / ($bf * $tf) <= 2.5 && $hw / $bf <= 6;
        $vnTensionField = $tensionFieldEligible
            ? .6 * $fy * $hw * $tw * ($ratioW > 1.1 * sqrt($kv * $e / $fy)
                ? $webCv + (1 - $webCv) / (1.15 * sqrt(1 + $aspect ** 2)) : 1)
            : null;
        $ds = match ($layout) { 'PAIRED' => 1, 'SINGLE_ANGLE' => 1.8, 'SINGLE_PLATE' => 2.4 };
        $requiredAreaLRFD = .15 * $ds * $hw * $tw * (1 - $webCv) * ($vy / $phiVWeb) - 18 * $tw ** 2;
        $stiffenerWidthOk = $bs / $ts <= .56 * sqrt($e / $fy);
        $stiffenerAreaOk = $requiredAreaLRFD >= 0; // faithful to Excel D259, not normative.
        $stiffenerChecksOk = $stiffenerWidthOk && $stiffenerAreaOk;

        $checks = [
            $this->check($chapter, 'major_axis_flexure', $mx, $phiMnX, 'kN.m'),
            $this->check('F6', 'minor_axis_flexure', $my, $phiMnY, 'kN.m'),
            $this->check('E3', 'axial_compression', max(0, -$n), $phiPn, 'kN'),
            $this->check('D2', 'axial_tension_gross_yielding_only', max(0, $n), $phiPt, 'kN'),
            $this->check('H1', 'axial_flexure_interaction', $interaction, 1, 'ratio'),
            $this->check('G2', 'web_shear_legacy_axis_Vy', $vy, $phiVWeb, 'kN'),
            $this->check('G7', 'flange_shear_legacy_axis_Vx', $vx, $phiVFlange, 'kN'),
        ];
        $warnings = [
            ['code' => 'LEGACY_EDITION', 'message' => 'Workbook is labelled AISC 360-05, not AISC 360-10.'],
            ['code' => 'LEGACY_CB', 'message' => 'Cb uses signed moments and selected station, not a verified maximum envelope.'],
            ['code' => 'LEGACY_WEAK_AXIS_FE', 'message' => 'Excel W194 reuses strong-axis Euler Fe for weak-axis compression. Phase 1 reproduces this defect for comparison only.'],
            ['code' => 'INCOMPLETE_TENSION', 'message' => 'No net-section tension fracture check in source workbook.'],
            ['code' => 'NO_GLOBAL_PASS', 'message' => 'Parity mode is not a certified design assessment.'],
        ];
        if (!$stiffenerChecksOk) {
            $warnings[] = ['code' => 'STIFFENER_REVIEW', 'message' => 'Legacy transverse stiffener checks do not all pass. Do not rely on tension field enhancement.'];
        }
        $failed = array_values(array_filter($checks, fn (array $item) => $item['status'] === 'FAIL'));

        return [
            'status' => 'success', 'mode' => 'LEGACY_EXCEL_PARITY',
            'source_standard' => 'AISC360-05_UNVERIFIED', 'target_standard' => 'AISC360-10_NOT_VALIDATED',
            'shape' => 'HI_DOUBLY_SYMMETRIC', 'engine_version' => self::ENGINE_VERSION,
            'overall_status' => 'REVIEW_REQUIRED',
            'section_properties' => [
                'area_mm2' => $area * 100, 'ix_mm4' => $ix * 10000, 'iy_mm4' => $iy * 10000,
                'sx_mm3' => $sx * 1000, 'sy_mm3' => $sy * 1000, 'zx_mm3' => $zx * 1000,
                'zy_mm3' => $zy * 1000, 'j_legacy_mm4' => $j * 10000,
                'rx_mm' => $rx * 10, 'ry_mm' => $ry * 10,
            ],
            'classification' => [
                'flange' => $flangeClass, 'web' => $webClass, 'flexure_chapter' => $chapter,
                'lambda_flange' => $ratioF, 'lambda_web' => $ratioW,
                'lambda_p_flange' => $flangeP, 'lambda_r_flange' => $flangeR,
                'lambda_p_web' => $webP, 'lambda_r_web' => $webR,
            ],
            'strengths' => [
                'phi_mnx_kNm' => $phiMnX, 'phi_mny_kNm' => $phiMnY,
                'phi_pn_compression_kN' => $phiPn, 'phi_pn_tension_gross_kN' => $phiPt,
                'phi_vn_web_kN' => $phiVWeb, 'phi_vn_flange_kN' => $phiVFlange,
            ],
            'interaction' => [
                'lrfd_utilization' => $interaction, 'lrfd_percent' => $interaction * 100,
                'axial_ratio' => $pRatio, 'moment_x_ratio' => $ratioMx,
                'moment_y_ratio_rounded' => $roundedMinor,
            ],
            'shear' => [
                'web_percent' => 100 * $vy / $phiVWeb, 'flange_percent' => 100 * $vx / $phiVFlange,
                'tension_field_eligible_legacy' => $tensionFieldEligible,
                'nominal_tension_field_kN_legacy' => $vnTensionField,
                'stiffener_width_ok' => $stiffenerWidthOk,
                'stiffener_area_legacy_ok' => $stiffenerAreaOk,
                'tension_field_not_approved' => !$stiffenerChecksOk,
            ],
            'limit_states' => $checks, 'failed_checks' => array_column($failed, 'id'),
            'trace' => [
                'cb_signed_legacy' => $cb, 'lp_mm' => $lp * 10, 'lr_mm' => $lr * 10,
                'rpg' => $rpg, 'mnx_ltb_kNm' => $nominalLtb / 100,
                'mnx_local_kNm' => is_finite($nominalLocal) ? $nominalLocal / 100 : null,
                'mnx_yield_kNm' => $nominalYield / 100,
                'qs' => $qs, 'qa' => $qa, 'q' => $q,
                'fcrx_mpa' => $fcrX * 10, 'fcry_mpa' => $fcrY * 10,
                'web_cv' => $webCv, 'flange_cv' => $cvFlange,
                'stiffener_required_area_legacy_cm2' => $requiredAreaLRFD,
            ],
            'warnings' => $warnings,
        ];
    }

    private function check(string $clause, string $id, float $demand, float $capacity, string $unit): array
    {
        return ['id' => $id, 'clause' => $clause, 'demand' => $demand, 'capacity' => $capacity,
            'unit' => $unit, 'utilization' => $demand / $capacity,
            'status' => $demand <= $capacity ? 'PASS' : 'FAIL'];
    }

    private function positive(mixed $number, string $key): float
    {
        $result = $this->nonNegative($number, $key);
        if ($result <= 0) throw new InvalidArgumentException("{$key} must be positive.");
        return $result;
    }

    private function nonNegative(mixed $number, string $key): float
    {
        if (!is_numeric($number) || !is_finite((float) $number) || (float) $number < 0) {
            throw new InvalidArgumentException("{$key} must be finite and nonnegative.");
        }
        return (float) $number;
    }

    private function sectionClass(float $ratio, float $compactLimit, float $slenderLimit, bool $flange): string
    {
        if ($flange ? $ratio >= $slenderLimit : $ratio > $slenderLimit) return 'SLENDER';
        if ($ratio > $compactLimit) return 'NONCOMPACT';
        return 'COMPACT';
    }

    private function shearCv(float $ratio, float $kv, float $e, float $fy): float
    {
        $p = 1.1 * sqrt($kv * $e / $fy);
        $r = 1.37 * sqrt($kv * $e / $fy);
        if ($ratio <= $p) return 1;
        if ($ratio <= $r) return $p / $ratio;
        return 1.51 * $e * $kv / ($fy * $ratio ** 2);
    }
}
