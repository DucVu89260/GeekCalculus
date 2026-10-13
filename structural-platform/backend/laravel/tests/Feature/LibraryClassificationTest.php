<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\SectionType;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryClassificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function material(): array
    {
        return Material::where('code', 'steel_s235')->first()->only(['code', 'name_vi', 'name_en', 'category', 'source', 'properties']);
    }

    public function test_material_design_code_has_three_choices_and_full_crud(): void
    {
        $this->getJson('/api/library/schema')->assertOk()->assertJsonPath('design_codes.0.code', 'EN')->assertJsonPath('design_codes.1.code', 'AISC/ACI')->assertJsonPath('design_codes.2.code', 'AS');
        foreach (['EN', 'AISC/ACI', 'AS'] as $index => $code) {
            $data = $this->material() + ['design_code' => $code];
            $data['code'] = 'classified-'.$index;
            $id = $this->postJson('/api/materials', $data)->assertCreated()->assertJsonPath('data.design_code', $code)->json('data.id');
            $this->getJson('/api/materials')->assertJsonFragment(['code' => $data['code'], 'design_code' => $code]);
            $data['design_code'] = 'AS';
            $this->patchJson('/api/materials/'.$id, $data)->assertOk()->assertJsonPath('data.design_code', 'AS');
            $this->deleteJson('/api/materials/'.$id)->assertOk();
        }
        $this->postJson('/api/materials', array_replace($this->material(), ['code' => 'bad-market', 'design_code' => 'INVALID']))->assertUnprocessable()->assertJsonValidationErrors('design_code');
    }

    public function test_region_type_is_optional_free_text_independent_of_geometry_category(): void
    {
        $data = ['code' => 'aisc-w', 'name_vi' => 'Nhóm W Mỹ', 'name_en' => 'US W family', 'category' => 'steel', 'shape' => 'i', 'design_code' => 'AISC/ACI', 'region_type' => 'W'];
        $id = $this->postJson('/api/section-types', $data)->assertCreated()->assertJsonPath('data.region_type', 'W')->assertJsonPath('data.shape', 'i')->json('data.id');
        $this->getJson('/api/section-types')->assertJsonFragment(['code' => 'aisc-w', 'design_code' => 'AISC/ACI', 'region_type' => 'W']);
        $data['region_type'] = 'Manufacturer custom W series';
        $this->patchJson('/api/section-types/'.$id, $data)->assertOk()->assertJsonPath('data.region_type', $data['region_type']);
        $data['region_type'] = str_repeat('X', 65);
        $this->patchJson('/api/section-types/'.$id, $data)->assertUnprocessable()->assertJsonValidationErrors('region_type');
        $data['region_type'] = null;
        $data['design_code'] = null;
        $this->patchJson('/api/section-types/'.$id, $data)->assertOk()->assertJsonPath('data.region_type', null)->assertJsonPath('data.design_code', null);
        $this->deleteJson('/api/section-types/'.$id)->assertOk();
    }

    public function test_existing_records_stay_unclassified_and_reseeding_keeps_classification_edits(): void
    {
        $this->assertSame(0, Material::whereNotNull('design_code')->count());
        $this->assertSame(0, SectionType::whereNotNull('region_type')->count());
        $data = $this->material() + ['design_code' => 'EN'];
        $row = Material::where('code', 'steel_s235')->first();
        $originalProperties = $row->properties;
        $this->patchJson('/api/materials/'.$row->id, $data)->assertOk();
        $data = $this->material();
        $data['name_en'] = 'Old client edited label';
        $this->patchJson('/api/materials/'.$row->id, $data)->assertOk()->assertJsonPath('data.design_code', 'EN');
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseHas('materials', ['id' => $row->id, 'design_code' => 'EN', 'name_en' => 'Old client edited label']);
        $this->assertEquals($originalProperties, $row->fresh()->properties);
    }

    public function test_archive_round_trip_keeps_classification_and_old_archives_preserve_new_metadata(): void
    {
        Material::where('code', 'steel_s235')->update(['design_code' => 'EN']);
        SectionType::where('code', 'i')->update(['design_code' => 'AISC/ACI', 'region_type' => 'W']);
        $archive = $this->getJson('/api/library/export')->assertOk()->json('data');
        $this->assertSame('EN', collect($archive['materials'])->firstWhere('code', 'steel_s235')['design_code']);
        $this->assertSame('W', collect($archive['section_types'])->firstWhere('code', 'i')['region_type']);
        $oldArchive = $archive;
        foreach ($oldArchive['materials'] as &$row) {
            unset($row['design_code']);
        }
        unset($row);
        foreach ($oldArchive['section_types'] as &$row) {
            unset($row['design_code'], $row['region_type']);
        }
        unset($row);
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $oldArchive])->assertOk();
        $this->assertDatabaseHas('materials', ['code' => 'steel_s235', 'design_code' => 'EN']);
        $this->assertDatabaseHas('section_types', ['code' => 'i', 'design_code' => 'AISC/ACI', 'region_type' => 'W']);
        Material::query()->update(['design_code' => null]);
        SectionType::query()->update(['design_code' => null, 'region_type' => null]);
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $archive])->assertOk();
        $this->assertDatabaseHas('materials', ['code' => 'steel_s235', 'design_code' => 'EN']);
        $this->assertDatabaseHas('section_types', ['code' => 'i', 'design_code' => 'AISC/ACI', 'region_type' => 'W']);
    }

    public function test_invalid_market_rolls_back_earlier_archive_updates(): void
    {
        $archive = $this->getJson('/api/library/export')->json('data');
        $archive['materials'][0]['name_en'] = 'Must roll back';
        $archive['section_types'][0]['design_code'] = 'INVALID';
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $archive])->assertUnprocessable()->assertJsonValidationErrors('archive.section_types.0.design_code');
        $this->assertDatabaseMissing('materials', ['name_en' => 'Must roll back']);
    }
}
