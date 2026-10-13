<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Section;
use App\Models\SectionType;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryTransferTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function archive(): array
    {
        return $this->getJson('/api/library/export')->assertOk()->json('data');
    }

    private function section(): array
    {
        return ['code' => 'verified-rc', 'name_vi' => 'Tiết diện thử 300×500', 'name_en' => 'Test section 300×500', 'material_code' => 'concrete_b25', 'section_type_code' => 'rectangle', 'source' => 'Fixture, not design data', 'properties' => ['width' => 300, 'depth' => 500, 'area' => 150000, 'inertia_y' => 3125000000, 'inertia_z' => 1125000000, 'torsion_constant' => 1000000000, 'elastic_modulus_y' => 12500000, 'elastic_modulus_z' => 7500000, 'shear_area_y' => 125000, 'shear_area_z' => 125000]];
    }

    public function test_transfer_is_admin_only_and_export_excludes_accounts_projects_and_ids(): void
    {
        $archive = $this->archive();
        $this->assertSame('geekcalculus-engineering-library', $archive['format']);
        $this->assertSame(1, $archive['version']);
        $this->assertCount(4, $archive['materials']);
        $this->assertCount(8, $archive['section_types']);
        foreach (['users', 'projects', 'password'] as $key) {
            $this->assertArrayNotHasKey($key, $archive);
        }
        foreach (['id', 'computed', 'created_at', 'updated_at'] as $key) {
            $this->assertArrayNotHasKey($key, $archive['materials'][0]);
        }
        $this->actingAs(User::factory()->create(['role' => 'user']));
        $this->getJson('/api/library/export')->assertForbidden();
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertForbidden();
        auth()->forgetGuards();
        $this->getJson('/api/library/export')->assertUnauthorized();
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertUnauthorized();
    }

    public function test_round_trip_restores_values_and_remaps_foreign_keys_on_another_database(): void
    {
        $archive = $this->archive();
        $archive['sections'][] = $this->section();
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertOk()->assertJsonPath('data.created', 1)->assertJsonPath('data.skipped', 12);
        $archive = $this->archive();
        $originalId = Section::first()->material_id;
        $this->assertSame('concrete_b25', $archive['sections'][0]['material_code']);
        $this->assertArrayNotHasKey('material_id', $archive['sections'][0]);
        $this->assertArrayNotHasKey('computed', $archive['sections'][0]);
        Section::query()->delete();
        Material::query()->delete();
        SectionType::query()->delete();
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertOk()->assertExactJson(['data' => ['created' => 13, 'updated' => 0, 'skipped' => 0]]);
        $this->assertNotSame($originalId, Section::first()->material_id);
        $this->assertSame(Material::where('code', 'concrete_b25')->value('id'), Section::first()->material_id);
        $this->assertSame(SectionType::where('code', 'rectangle')->value('id'), Section::first()->section_type_id);
        $roundTrip = $this->archive();
        unset($roundTrip['exported_at'], $archive['exported_at']);
        $this->assertEquals($archive, $roundTrip);
        $this->getJson('/api/sections')->assertJsonStructure(['data' => [['computed' => ['radius_y', 'radius_z']]]]);
        $this->getJson('/api/catalog?locale=vi')->assertJsonFragment(['name' => 'Bê tông B25']);
    }

    public function test_skip_and_explicit_overwrite_preserve_ids_and_records_missing_from_file(): void
    {
        $archive = $this->archive();
        $archive['materials'] = [array_replace($archive['materials'][0], ['name_vi' => 'Tên đã xác minh', 'name_en' => 'Verified label', 'source' => 'Test source'])];
        $archive['section_types'] = [];
        $id = Material::where('code', $archive['materials'][0]['code'])->value('id');
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertOk()->assertExactJson(['data' => ['created' => 0, 'updated' => 0, 'skipped' => 1]]);
        $this->assertDatabaseMissing('materials', ['name_en' => 'Verified label']);
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $archive])->assertOk()->assertExactJson(['data' => ['created' => 0, 'updated' => 1, 'skipped' => 0]]);
        $this->assertDatabaseHas('materials', ['id' => $id, 'name_en' => 'Verified label', 'source' => 'Test source']);
        $this->assertDatabaseCount('materials', 4);
        $this->assertDatabaseCount('section_types', 8);
        $this->getJson('/api/catalog?locale=en')->assertJsonFragment(['name' => 'Verified label']);
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseHas('materials', ['id' => $id, 'name_en' => 'Verified label']);
    }

    public function test_bad_later_record_rolls_back_creates_updates_and_catalog_labels(): void
    {
        $before = $this->archive();
        $archive = $before;
        $archive['materials'][0]['name_en'] = 'Should roll back';
        $new = $archive['materials'][0];
        $new['code'] = 'new-but-rolled-back';
        $archive['materials'][] = $new;
        $section = $this->section();
        $section['properties']['shear_area_y'] = 160000;
        $archive['sections'][] = $section;
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $archive])->assertUnprocessable()->assertJsonValidationErrors('archive.sections.0.properties.shear_area_y');
        $after = $this->archive();
        unset($before['exported_at'], $after['exported_at']);
        $this->assertEquals($before, $after);
        $this->assertDatabaseMissing('catalog_options', ['code' => 'new-but-rolled-back']);
        $this->assertDatabaseMissing('catalog_option_translations', ['name' => 'Should roll back']);
    }

    public function test_retyping_referenced_type_is_a_conflict_and_rolls_back_the_batch(): void
    {
        $archive = $this->archive();
        $archive['sections'][] = $this->section();
        $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertOk();
        $before = $this->archive();
        $archive = $before;
        $archive['materials'][0]['name_en'] = 'Should roll back';
        foreach ($archive['section_types'] as &$type) {
            if ($type['code'] === 'rectangle') {
                $type['shape'] = 'circle';
            }
        }
        unset($type);
        $this->postJson('/api/library/import', ['mode' => 'overwrite', 'archive' => $archive])->assertStatus(409);
        $after = $this->archive();
        unset($before['exported_at'], $after['exported_at']);
        $this->assertEquals($before, $after);
    }

    public function test_unknown_version_duplicate_codes_missing_references_and_injected_ids_are_rejected(): void
    {
        $original = $this->archive();
        $cases = [];
        $archive = $original;
        $archive['version'] = 2;
        $cases[] = $archive;
        $archive = $original;
        $archive['materials'][] = $archive['materials'][0];
        $cases[] = $archive;
        $archive = $original;
        $archive['sections'][] = array_replace($this->section(), ['material_code' => 'missing']);
        $cases[] = $archive;
        $archive = $original;
        $archive['materials'][0]['id'] = 999;
        $cases[] = $archive;
        $archive = $original;
        $archive['users'] = [];
        $cases[] = $archive;
        foreach ($cases as $archive) {
            $this->postJson('/api/library/import', ['mode' => 'skip', 'archive' => $archive])->assertUnprocessable();
        }
        $this->assertDatabaseCount('materials', 4);
        $this->assertDatabaseCount('sections', 0);
    }
}
