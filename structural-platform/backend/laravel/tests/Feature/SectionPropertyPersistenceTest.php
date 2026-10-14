<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Section;
use App\Models\SectionType;
use App\Models\User;
use App\Services\SectionPropertyCalculator;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Concerns\SectionPropertyTestSupport;
use Tests\TestCase;

class SectionPropertyPersistenceTest extends TestCase
{
    use RefreshDatabase;
    use SectionPropertyTestSupport;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function section(array $changes = []): array
    {
        return array_replace([
            'code' => 'calculated-rc',
            'name_vi' => 'Cột tính toán',
            'name_en' => 'Calculated column',
            'section_type_id' => SectionType::where('shape', 'rectangle')->value('id'),
            'material_id' => Material::where('category', 'concrete')->value('id'),
            'source' => 'Geometry solver test',
            'properties' => ['width' => 300, 'depth' => 500, 'concrete_cover' => 30, 'area_modifier' => .9],
        ], $changes);
    }

    public function test_get_reads_saved_canonical_rx_ry_without_engine_calls_and_keeps_legacy_yz_radii(): void
    {
        $fixture = $this->sectionPropertyFixture();
        $new = Section::create($this->section() + [
            'section_properties' => $fixture,
            'section_properties_calculated_at' => now(),
        ]);
        $legacy = Section::create($this->section([
            'code' => 'legacy-rc',
            'name_en' => 'Legacy column',
            'properties' => [
                'width' => 300,
                'depth' => 500,
                'area' => 150000,
                'inertia_y' => 3125000000,
                'inertia_z' => 1125000000,
            ],
        ]));

        Http::preventStrayRequests();
        $response = $this->getJson('/api/sections')->assertOk();
        $rows = collect($response->json('data'))->keyBy('code');

        $response->assertJsonPath('data.0.section_properties.status', 'success');
        $this->assertSame([
            'rx' => $fixture['properties']['elastic']['rx'],
            'ry' => $fixture['properties']['elastic']['ry'],
        ], $rows[$new->code]['computed']);
        $this->assertArrayNotHasKey('radius_y', $rows[$new->code]['computed']);
        $this->assertArrayNotHasKey('radius_z', $rows[$new->code]['computed']);
        $this->assertEqualsWithDelta(sqrt(3125000000 / 150000), $rows[$legacy->code]['computed']['radius_y'], 1e-12);
        $this->assertEqualsWithDelta(sqrt(1125000000 / 150000), $rows[$legacy->code]['computed']['radius_z'], 1e-12);
        $this->assertArrayNotHasKey('rx', $rows[$legacy->code]['computed']);
        Http::assertNothingSent();
    }

    public function test_asymmetric_i_geometry_requires_complete_dimensions_and_maps_canonical_flange_fields(): void
    {
        $this->fakeSectionPropertyCalculations([$this->sectionPropertyFixture('section-i-asymmetric.json')]);
        $asymmetricProperties = [
            'depth' => 400,
            'web_thickness' => 8,
            'top_flange_width' => 180,
            'bottom_flange_width' => 220,
            'top_flange_thickness' => 12,
            'bottom_flange_thickness' => 16,
        ];
        $response = $this->postJson('/api/sections', $this->section([
            'code' => 'asymmetric-i',
            'section_type_id' => SectionType::where('shape', 'i')->value('id'),
            'material_id' => Material::where('category', 'steel')->value('id'),
            'properties' => $asymmetricProperties,
        ]))->assertCreated()
            ->assertJsonPath('data.section_properties.geometry_type', 'i_section')
            ->assertJsonPath('data.section_properties.normalized_input.geometry.dimensions.top_flange_width', 180)
            ->assertJsonPath('data.section_properties.normalized_input.geometry.dimensions.bottom_flange_thickness', 16);

        $saved = Section::findOrFail($response->json('data.id'));
        $this->assertEquals([
            'depth' => 400.0,
            'web_thickness' => 8.0,
            'top_flange_width' => 180.0,
            'bottom_flange_width' => 220.0,
            'top_flange_thickness' => 12.0,
            'bottom_flange_thickness' => 16.0,
        ], $saved->properties);
        $this->assertArrayNotHasKey('width', $saved->properties);
        $this->assertArrayNotHasKey('flange_thickness', $saved->properties);
        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->url() === 'http://section-engine.test/v1/sections/calculate'
            && $request->data()['geometry']['type'] === 'i_section'
            && $request->data()['geometry']['geometry_variant'] === 'sharp_corner'
            && $request->data()['geometry']['dimensions'] == [
                'depth' => 400,
                'top_flange_width' => 180,
                'bottom_flange_width' => 220,
                'web_thickness' => 8,
                'top_flange_thickness' => 12,
                'bottom_flange_thickness' => 16,
            ]
        );
    }

    public function test_geometry_mapping_covers_all_seeded_section_shapes_and_symmetric_i_fallback(): void
    {
        $cases = [
            ['rectangle', ['width' => 300, 'depth' => 500], 'rectangle', 'solid', ['width' => 300, 'height' => 500]],
            ['circle', ['diameter' => 400], 'circle', 'solid', ['diameter' => 400]],
            ['i', ['depth' => 400, 'width' => 200, 'web_thickness' => 8, 'flange_thickness' => 12], 'i_section', 'sharp_corner', ['depth' => 400, 'top_flange_width' => 200, 'bottom_flange_width' => 200, 'web_thickness' => 8, 'top_flange_thickness' => 12, 'bottom_flange_thickness' => 12]],
            ['channel', ['depth' => 300, 'width' => 100, 'web_thickness' => 8, 'flange_thickness' => 12], 'channel', 'sharp_corner', ['depth' => 300, 'width' => 100, 'web_thickness' => 8, 'flange_thickness' => 12]],
            ['tee', ['depth' => 300, 'width' => 100, 'web_thickness' => 8, 'flange_thickness' => 12], 'tee', 'sharp_corner', ['depth' => 300, 'width' => 100, 'web_thickness' => 8, 'flange_thickness' => 12]],
            ['angle', ['depth' => 200, 'width' => 100, 'thickness' => 10], 'angle', 'sharp_corner', ['depth' => 200, 'width' => 100, 'thickness' => 10]],
            ['rectangular_hollow', ['depth' => 200, 'width' => 100, 'thickness' => 5], 'rectangular_hollow', 'sharp_corner', ['width' => 100, 'height' => 200, 'thickness' => 5]],
            ['circular_hollow', ['diameter' => 100, 'thickness' => 5], 'circular_hollow', 'uniform_wall', ['diameter' => 100, 'thickness' => 5]],
            ['double_angle', ['depth' => 200, 'width' => 100, 'thickness' => 8, 'distance' => 0], 'double_angle', 'back_to_back', ['depth' => 200, 'width' => 100, 'thickness' => 8, 'distance' => 0]],
        ];

        foreach ($cases as [$catalogShape, $properties, $type, $variant, $dimensions]) {
            $request = SectionPropertyCalculator::requestFor($catalogShape, $properties);
            $this->assertSame([
                'type' => $type,
                'geometry_variant' => $variant,
                'geometry_model_version' => '1.0.0',
                'dimensions' => $dimensions,
            ], $request['geometry'], $catalogShape);
            $this->assertSame('mm', $request['units']);
            $this->assertTrue($request['options']['include_advanced']);
        }

        $asymmetric = SectionPropertyCalculator::requestFor('i', [
            'depth' => 400,
            'width' => 200,
            'flange_thickness' => 12,
            'web_thickness' => 8,
            'top_flange_width' => 180,
            'bottom_flange_width' => 220,
            'top_flange_thickness' => 10,
            'bottom_flange_thickness' => 14,
        ]);
        $this->assertSame(180, $asymmetric['geometry']['dimensions']['top_flange_width']);
        $this->assertSame(220, $asymmetric['geometry']['dimensions']['bottom_flange_width']);
        $this->assertSame(10, $asymmetric['geometry']['dimensions']['top_flange_thickness']);
        $this->assertSame(14, $asymmetric['geometry']['dimensions']['bottom_flange_thickness']);
    }

    public function test_invalid_geometry_or_invalid_engine_result_never_creates_or_overwrites_a_section(): void
    {
        Http::preventStrayRequests();
        $invalidI = $this->section([
            'section_type_id' => SectionType::where('shape', 'i')->value('id'),
            'material_id' => Material::where('category', 'steel')->value('id'),
            'properties' => [
                'depth' => 400,
                'web_thickness' => 8,
                'top_flange_width' => 180,
                'bottom_flange_width' => 220,
                'top_flange_thickness' => 12,
            ],
        ]);
        $this->postJson('/api/sections', $invalidI)->assertUnprocessable()->assertJsonValidationErrors('properties.bottom_flange_thickness');
        $invalidChannel = $this->section([
            'section_type_id' => SectionType::where('shape', 'channel')->value('id'),
            'material_id' => Material::where('category', 'steel')->value('id'),
            'properties' => ['depth' => 100, 'width' => 40, 'web_thickness' => 40, 'flange_thickness' => 10],
        ]);
        $this->postJson('/api/sections', $invalidChannel)->assertUnprocessable()->assertJsonValidationErrors('properties');
        $this->assertDatabaseCount('sections', 0);
        Http::assertNothingSent();

        $fixture = $this->sectionPropertyFixture();
        $existing = Section::create($this->section([
            'code' => 'stable-before-failure',
            'section_properties' => $fixture,
            'section_properties_calculated_at' => now()->subYear(),
        ]));
        $before = $existing->fresh()->only(['name_en', 'properties', 'section_properties', 'section_properties_calculated_at']);
        config(['sectional.engine_url' => 'http://section-engine.test']);
        Http::fake([
            'http://section-engine.test/v1/sections/calculate' => Http::sequence()
                ->push(['status' => 'success'], 200)
                ->push(['status' => 'success'], 200),
        ]);

        $this->postJson('/api/sections', $this->section(['code' => 'engine-response-invalid']))
            ->assertStatus(503);
        $this->patchJson('/api/sections/'.$existing->id, $this->section([
            'code' => $existing->code,
            'name_en' => 'Should not be saved',
        ]))->assertStatus(503);

        $this->assertDatabaseCount('sections', 1);
        $this->assertEquals($before, $existing->fresh()->only(['name_en', 'properties', 'section_properties', 'section_properties_calculated_at']));
        Http::assertSentCount(2);
    }

    public function test_engine_connection_timeout_is_unavailable_and_does_not_create_a_section(): void
    {
        config(['sectional.engine_url' => 'http://section-engine.test']);
        Http::preventStrayRequests();
        Http::fake([
            'http://section-engine.test/v1/sections/calculate' => Http::sequence()
                ->pushFailedConnection('Connection timed out.'),
        ]);

        $this->postJson('/api/sections', $this->section(['code' => 'timeout-no-write']))
            ->assertStatus(503);

        $this->assertDatabaseCount('sections', 0);
    }

    public function test_engine_result_must_match_normalized_units_model_dimensions_and_numeric_types(): void
    {
        $fixture = $this->sectionPropertyFixture();
        $invalidResults = [];

        $bad = $fixture;
        $bad['normalized_input']['units'] = 'cm';
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['normalized_input']['geometry']['geometry_model_version'] = '2.0.0';
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['normalized_input']['geometry']['dimensions']['width'] = 301.0;
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['normalized_input']['geometry']['dimensions']['width'] = '300';
        $invalidResults[] = $bad;

        // Non-string hashes must fail validation cleanly rather than reach preg_match() as a TypeError.
        $bad = $fixture;
        $bad['solver']['config_hash'] = [];
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['geometry_hash'] = [];
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['properties']['geometric']['area'] = '150000';
        $invalidResults[] = $bad;

        $bad = $fixture;
        unset($bad['formula_report']);
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['formula_report']['manifest_hash'] = str_repeat('0', 64);
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['formula_report']['properties'][0]['value'] += 1;
        $invalidResults[] = $bad;

        $bad = $fixture;
        array_pop($bad['formula_report']['properties']);
        $invalidResults[] = $bad;

        $bad = $fixture;
        unset($bad['mechanics']);
        $invalidResults[] = $bad;

        $bad = $fixture;
        $bad['mechanics']['geometry']['polar_centroidal']['inertia_mm4'] += 1;
        $invalidResults[] = $bad;

        $this->fakeSectionPropertyCalculations($invalidResults);
        foreach ($invalidResults as $index => $_result) {
            $this->postJson('/api/sections', $this->section(['code' => 'invalid-engine-result-'.$index]))
                ->assertStatus(503);
        }

        $this->assertDatabaseCount('sections', 0);
        Http::assertSentCount(count($invalidResults));
    }

    public function test_zero_warping_and_zero_double_angle_distance_are_saved_with_formula_snapshots(): void
    {
        $this->fakeSectionPropertyCalculations([
            $this->sectionPropertyFixture('section-chs.json'),
            $this->sectionPropertyFixture('section-double-angle-zero-gap.json'),
        ]);
        $steel = Material::where('category', 'steel')->value('id');
        foreach ([
            ['circular_hollow', ['diameter' => 200, 'thickness' => 8]],
            ['double_angle', ['depth' => 200, 'width' => 100, 'thickness' => 8, 'distance' => 0]],
        ] as [$shape, $dimensions]) {
            $response = $this->postJson('/api/sections', $this->section([
                'code' => 'zero-valid-'.$shape,
                'material_id' => $steel,
                'section_type_id' => SectionType::where('shape', $shape)->value('id'),
                'properties' => $dimensions,
            ]))->assertCreated();
            $section = Section::findOrFail($response->json('data.id'));
            $registry = json_decode(file_get_contents(base_path('../../section-properties/section-registry.json')), true);
            $this->assertCount(count($registry['properties']), $section->formulaReport()['properties']);
            $this->assertSame('computed', $section->mechanicalProperties()['geometry']['status']);
            $this->assertSame('section-properties/shared-typescript', $section->formulaReport()['core']);
            if ($shape === 'circular_hollow') {
                $this->assertEquals(0, data_get($section->section_properties, 'advanced.warping_constant_cw.value'));
                $this->assertSame('computed', data_get($section->section_properties, 'advanced.warping_constant_cw.status'));
            } else {
                $this->assertEquals(0, data_get($section->section_properties, 'normalized_input.geometry.dimensions.distance'));
                $this->assertNotEmpty($section->formulaReport()['connection_model']);
            }
        }
    }
}
