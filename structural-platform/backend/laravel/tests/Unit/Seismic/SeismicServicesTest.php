<?php

namespace Tests\Unit\Seismic;

use App\Services\Seismic\BaseShearService;
use App\Services\Seismic\ResponseSpectrumService;
use App\Services\Seismic\Rules;
use App\Services\Seismic\SeismicSystemService;
use App\Services\Seismic\SiteClassificationService;
use App\Services\Seismic\SpectrumService;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class SeismicServicesTest extends TestCase
{
    private function project(): array
    {
        return ['units' => 'SI', 'height' => 11, 'Ss' => .38, 'S1' => .14, 'TL' => 8, 'risk' => 'II', 'TL_source' => 'ASCE map', 'hazard_source' => 'Synthetic hazard report', 'site_source' => 'Synthetic borehole report', 'site_class' => 'E'];
    }

    private function spectrum(array $changes = []): array
    {
        return (new SpectrumService)->calculate(array_merge($this->project(), $changes), ['class' => 'E', 'review_required' => false]);
    }

    public function test_source_table_and_documented_workbook_rounding_are_separate(): void
    {
        $s = $this->spectrum();
        $this->assertEqualsWithDelta(2.084, $s['Fa'], 1e-12);
        $this->assertEqualsWithDelta(.52794666666667, $s['SDS'], 1e-10);
        $s = $this->spectrum(['Fa_override' => 2.08, 'Fv_override' => 3.38, 'coefficient_source' => 'Issue 25 historical workbook', 'coefficient_reason' => 'Workbook rounded Fa']);
        foreach (['SMS' => .7904, 'SM1' => .4732, 'SDS' => .526933333333, 'SD1' => .315466666667, 'T0' => .119736842105, 'Ts' => .598684210526] as $key => $expected) {
            $this->assertEqualsWithDelta($expected, $s[$key], 1e-9, $key);
        }
        $this->assertTrue($s['override_review_required']);
    }

    public function test_interpolation_endpoints_and_spectrum_branches(): void
    {
        $t = Rules::tables();
        foreach (['Fa', 'Fv'] as $table) {
            foreach (['A', 'B', 'C', 'D', 'E'] as $c) {
                foreach ($t[$table]['x'] as $i => $x) {
                    $this->assertEquals($t[$table][$c][$i], Rules::interpolate($x, $t[$table]['x'], $t[$table][$c]));
                }
            }
        }
        $this->assertEquals(2.5, Rules::interpolate(0, $t['Fa']['x'], $t['Fa']['E']));
        $this->assertEquals(.9, Rules::interpolate(9, $t['Fa']['x'], $t['Fa']['E']));
        $s = $this->spectrum();
        foreach ($s['curve'] as $row) {
            $T = $row['T'];
            $want = $T < $s['T0'] ? $s['SDS'] * (.4 + .6 * $T / $s['T0']) : ($T <= $s['Ts'] ? $s['SDS'] : ($T <= 8 ? $s['SD1'] / $T : $s['SD1'] * 8 / $T ** 2));
            $this->assertEqualsWithDelta($want, $row['Sa'], 1e-10);
        }
    }

    public function test_site_specific_f_and_damping_are_blocked(): void
    {
        $site = (new SiteClassificationService)->calculate($this->project() + ['site_f' => true]);
        $this->assertSame('F', $site['class']);
        $s = (new SpectrumService)->calculate($this->project(), $site);
        $this->assertSame('REVIEW_REQUIRED', $s['status']);
        $this->assertArrayNotHasKey('SDS', $s);
    }

    public function test_n_profile_uses_full_30m_harmonic_average_and_caps_n(): void
    {
        $p = $this->project() + ['site_method' => 'N', 'profile_screened' => true, 'layers' => [['top' => 0, 'bottom' => 10, 'value' => 10], ['top' => 10, 'bottom' => 30, 'value' => 40]]];
        $r = (new SiteClassificationService)->calculate($p);
        $this->assertEquals(20, $r['average']);
        $this->assertSame('D', $r['class']);
        $p['layers'] = [['top' => 0, 'bottom' => 30, 'value' => 200]];
        $this->assertEquals(100, (new SiteClassificationService)->calculate($p)['average']);
    }

    public function test_vs_profile_and_soft_clay_override(): void
    {
        $p = $this->project() + ['site_method' => 'Vs', 'profile_screened' => true, 'layers' => [['top' => 0, 'bottom' => 30, 'value' => 400]]];
        $r = (new SiteClassificationService)->calculate($p);
        $this->assertSame('C', $r['class']);
        $p['soft_clay_e'] = true;
        $this->assertSame('E', (new SiteClassificationService)->calculate($p)['class']);
    }

    public function test_incomplete_profile_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new SiteClassificationService)->calculate($this->project() + ['site_method' => 'N', 'profile_screened' => true, 'layers' => [['top' => 0, 'bottom' => 20, 'value' => 20]]]);
    }

    public function test_gapped_profile_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new SiteClassificationService)->calculate($this->project() + ['site_method' => 'N', 'profile_screened' => true, 'layers' => [['top' => 1, 'bottom' => 30, 'value' => 20]]]);
    }

    public function test_rock_needs_confirmation(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new SiteClassificationService)->calculate($this->project() + ['site_method' => 'Vs', 'profile_screened' => true, 'layers' => [['top' => 0, 'bottom' => 30, 'value' => 1200]]]);
    }

    public function test_independent_systems_period_caps_units_and_restrictions(): void
    {
        $service = new SeismicSystemService;
        $s = $this->spectrum();
        $x = $service->calculate($this->project(), $s, ['system' => 'B2', 'Tmodal' => 10]);
        $y = $service->calculate($this->project(), $s, ['system' => 'C1', 'Tmodal' => .1, 'moment_eligible' => true]);
        $this->assertEqualsWithDelta(.02 * (11 / .3048) ** .75, $x['Ta'], 1e-12);
        $this->assertEqualsWithDelta($x['Cu'] * $x['Ta'], $x['Tused'], 1e-12);
        $this->assertEquals(.1, $y['Tused']);
        $this->assertNotEquals($x['R'], $y['R']);
        $us = $this->project();
        $us['units'] = 'US';
        $us['height'] = 11 / .3048;
        $this->assertEqualsWithDelta($x['Ta'], $service->calculate($us, $s, ['system' => 'B2'])['Ta'], 1e-12);
        $this->assertSame('REVIEW_REQUIRED', $service->calculate($this->project(), $s, ['system' => 'C4'])['status']);
        $p = $this->project();
        $p['height'] = 11;
        $this->assertSame('REVIEW_REQUIRED', $service->calculate($p, $s, ['system' => 'B3'])['status']);
    }

    public function test_elf_all_bounds_long_period_conditional_minimum_and_missing_w(): void
    {
        $service = new BaseShearService;
        $s = ['SDS' => .6, 'SD1' => .3, 'TL' => 8, 'Ie' => 1, 'S1' => .2];
        $v = $service->calculate($s, ['R' => 5, 'Tused' => .1], 1000);
        $this->assertEqualsWithDelta(.12, $v['Cs'], 1e-12);
        $this->assertEquals(120, $v['V_kN']);
        $v = $service->calculate($s, ['R' => 5, 'Tused' => 1], 1000);
        $this->assertEqualsWithDelta(.06, $v['Cs'], 1e-12);
        $v = $service->calculate($s, ['R' => 5, 'Tused' => 10], 1000);
        $this->assertEqualsWithDelta(.0048, $v['upper'], 1e-12);
        $this->assertEqualsWithDelta(.0264, $v['Cs'], 1e-12);
        $s['S1'] = .8;
        $v = $service->calculate($s, ['R' => 5, 'Tused' => 10], 1000);
        $this->assertEqualsWithDelta(.08, $v['Cs'], 1e-12);
        $s['SDS'] = .01;
        $s['S1'] = .1;
        $v = $service->calculate($s, ['R' => 5, 'Tused' => 10], null);
        $this->assertEquals(.01, $v['Cs']);
        $this->assertNull($v['V_kN']);
        $this->assertSame('INPUT_REQUIRED', $v['status']);
    }

    public function test_workbook_elf_and_response_spectrum_independent_numeric_regression(): void
    {
        $s = $this->spectrum(['Fa_override' => 2.08, 'coefficient_source' => 'historical', 'coefficient_reason' => 'rounding']);
        $elfService = new BaseShearService;
        $rs = new ResponseSpectrumService;
        foreach ([['X', 3.25, .211, 2266.388, 2549.317069], ['Y', 3.5, .51, 2104.503, 2367.222978]] as [$axis,$r,$period,$vrs,$expected]) {
            $elf = $elfService->calculate($s, ['R' => $r, 'Tused' => $period], 15723.584);
            $this->assertEqualsWithDelta($expected, $elf['V_kN'], .001);
            $row = ['id' => 'r1', 'case' => 'RS'.$axis, 'FX_kN' => -$vrs, 'FY_kN' => -$vrs, 'provenance' => ['fixture' => 'Issue25']];
            $sel = ['case' => $row['case'], 'row_id' => 'r1', 'case_type' => 'response_spectrum', 'global_axes' => true, 'modal_combination_confirmed' => true, 'applicability_confirmed' => true, 'result_state' => 'raw', 'scale_source' => 'SAP normalized spectrum'];
            $out = $rs->verify($elf, $row, $axis, $sel);
            $this->assertSame('PASS', $out['status']);
            $this->assertSame(1, $out['required_total_multiplier']);
            $this->assertLessThan(0, $out['signed_kN']);
        }
    }

    public function test_rs_scaling_does_not_double_apply_existing_multiplier(): void
    {
        $service = new ResponseSpectrumService;
        $row = ['id' => 'r', 'case' => 'RSX', 'FX_kN' => -90, 'FY_kN' => 0, 'provenance' => []];
        $sel = ['case' => 'RSX', 'row_id' => 'r', 'case_type' => 'response_spectrum', 'global_axes' => true, 'modal_combination_confirmed' => true, 'applicability_confirmed' => true, 'result_state' => 'scaled', 'applied_multiplier' => 1.5, 'scale_source' => 'documented 1.5 additional'];
        $out = $service->verify(['V_kN' => 100], $row, 'X', $sel);
        $this->assertSame('PASS', $out['status']);
        $this->assertEquals(60, $out['raw_kN']);
        $this->assertEquals(1, $out['additional_multiplier']);
        $this->assertEqualsWithDelta(85 / 60, $out['required_total_multiplier'], 1e-12);
        $out = $service->verify(['V_kN' => 200], $row, 'X', $sel);
        $this->assertSame('FAIL', $out['status']);
        $this->assertEqualsWithDelta(170 / 90, $out['additional_multiplier'], 1e-12);
        $row['FX_kN'] = 0;
        $out = $service->verify(['V_kN' => 100], $row, 'X', $sel);
        $this->assertSame('ZERO_SHEAR', $out['status']);
        $this->assertNull($out['additional_multiplier']);
    }

    public function test_rs_wrong_case_or_combination_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        (new ResponseSpectrumService)->verify(['V_kN' => 100],['case' => 'combo'],'X',['case_type' => 'combination']);
    }

    public function test_override_requires_reason(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->spectrum(['Fa_override' => 2.08]);
    }
}
