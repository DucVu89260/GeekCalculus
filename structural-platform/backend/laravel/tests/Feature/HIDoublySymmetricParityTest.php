<?php

namespace Tests\Feature;

use App\Domain\Structural\SteelDesign\HI\DoublySymmetricIParityCalculator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HIDoublySymmetricParityTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        return [
            'material' => ['fy_mpa' => 345, 'e_mpa' => 200000],
            'section' => ['h_mm' => 940, 'bf_mm' => 250, 'tw_mm' => 6, 'tf_mm' => 12, 'fabrication' => 'BUILT_UP'],
            'member' => ['lb_mm' => 5500, 'lx_mm' => 12000],
            'stiffeners' => ['spacing_mm' => 2500, 'thickness_mm' => 6, 'width_mm' => 100, 'layout' => 'PAIRED'],
            'forces' => [
                'axial_kN' => -138.439, 'moment_x_kNm' => -806.3536,
                'moment_y_kNm' => .0903, 'shear_x_kN' => 67.821, 'shear_y_kN' => .214,
                'moment_25_kNm' => -713.0995337748344,
                'moment_50_kNm' => -619.8454675496689,
                'moment_75_kNm' => -370.3123961538461,
            ],
        ];
    }

    public function test_cached_excel_example_matches_legacy_parity_values(): void
    {
        $r = app(DoublySymmetricIParityCalculator::class)->calculate($this->fixture());
        $this->assertEqualsWithDelta(11496, $r['section_properties']['area_mm2'], 1e-6);
        $this->assertEqualsWithDelta(1676135648, $r['section_properties']['ix_mm4'], 1e-3);
        $this->assertEqualsWithDelta(1020.0379893494, $r['strengths']['phi_mnx_kNm'], 1e-6);
        $this->assertEqualsWithDelta(112.5565551584, $r['strengths']['phi_mny_kNm'], 1e-6);
        $this->assertEqualsWithDelta(2113.4233533667, $r['strengths']['phi_pn_compression_kN'], 1e-6);
        $this->assertEqualsWithDelta(82.4065614356, $r['interaction']['lrfd_percent'], 1e-6);
        $this->assertEqualsWithDelta(.0981242610, $r['shear']['web_percent'], 1e-6);
        $this->assertEqualsWithDelta(6.0673644659, $r['shear']['flange_percent'], 1e-6);
        $this->assertFalse($r['shear']['stiffener_width_ok']);
        $this->assertFalse($r['shear']['stiffener_area_legacy_ok']);
        $this->assertSame('REVIEW_REQUIRED', $r['overall_status']);
        $this->assertSame('AISC360-05_UNVERIFIED', $r['source_standard']);
        $this->assertSame('F5', $r['classification']['flexure_chapter']);
    }

    public function test_authenticated_route_and_validation(): void
    {
        $url = '/api/v1/steel-design/components/hi-doubly-symmetric/legacy-parity';
        $this->postJson($url, $this->fixture())->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'user']));
        $this->postJson($url, $this->fixture())
            ->assertOk()
            ->assertJsonPath('overall_status', 'REVIEW_REQUIRED')
            ->assertJsonPath('mode', 'LEGACY_EXCEL_PARITY');
        $invalid = $this->fixture();
        $invalid['section']['tw_mm'] = -1;
        $this->postJson($url, $invalid)->assertUnprocessable();
    }

    public function test_invalid_geometry_is_rejected(): void
    {
        $bad = $this->fixture();
        $bad['section']['h_mm'] = 20;
        $this->expectException(\InvalidArgumentException::class);
        app(DoublySymmetricIParityCalculator::class)->calculate($bad);
    }
}
