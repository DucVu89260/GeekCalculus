<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EngineeringApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function project(array $changes = []): array
    {
        return array_replace([
            'name' => 'Nhà mẫu', 'project_type' => 'building', 'standard' => 'tcvn_5574_2018',
            'material' => 'concrete_b25', 'unit' => 'kn_m', 'module' => 'rc_beam',
        ], $changes);
    }

    public function test_health_checks_the_database(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJson(['status' => 'ok', 'database' => 'connected']);
    }

    public function test_catalog_has_both_languages_and_all_dropdowns(): void
    {
        $vi = $this->getJson('/api/catalog?locale=vi')->assertOk()->assertJsonCount(6, 'modules')
            ->assertJsonCount(5, 'standards')->assertJsonCount(4, 'materials')
            ->assertJsonCount(2, 'units')->assertJsonCount(3, 'project_types');
        $en = $this->getJson('/api/catalog?locale=en')->assertOk();
        $this->assertSame('Dầm bê tông cốt thép', $vi->json('modules.0.name'));
        $this->assertSame('RC beam', $en->json('modules.0.name'));
        $this->assertSame($vi->json('modules.0.code'), $en->json('modules.0.code'));
    }

    public function test_seed_is_repeatable_and_preserves_user_projects(): void
    {
        $this->postJson('/api/projects', $this->project())->assertCreated();
        $this->seed(DatabaseSeeder::class);
        $this->assertDatabaseCount('catalog_options', 20);
        $this->assertDatabaseCount('catalog_option_translations', 40);
        $this->assertDatabaseCount('locales', 2);
        $this->assertDatabaseCount('projects', 1);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_created_project_is_persisted_with_localized_labels(): void
    {
        $id = $this->postJson('/api/projects?locale=en', $this->project(['name' => '  Office tower  ']))
            ->assertCreated()->assertJsonPath('data.name', 'Office tower')
            ->assertJsonPath('data.module_name', 'RC beam')->json('data.id');
        $this->getJson('/api/projects?locale=vi')->assertOk()->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.module_name', 'Dầm bê tông cốt thép')
            ->assertJsonPath('meta.total', 1);
        $this->assertDatabaseHas('projects', ['id' => $id, 'name' => 'Office tower', 'status' => 'draft']);
    }

    public function test_wrong_catalog_kind_is_rejected(): void
    {
        $this->postJson('/api/projects', $this->project(['module' => 'concrete_b25']))
            ->assertUnprocessable()->assertJsonValidationErrors('module');
        $this->assertDatabaseCount('projects', 0);
    }

    public function test_unknown_choices_and_whitespace_names_are_rejected(): void
    {
        $this->postJson('/api/projects', $this->project(['name' => '   ', 'unit' => 'bogus']))
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'unit']);
    }

    public function test_required_fields_and_unknown_locale_are_rejected(): void
    {
        $this->postJson('/api/projects', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'project_type', 'standard', 'material', 'unit', 'module']);
        $this->getJson('/api/catalog?locale=fr')->assertUnprocessable()->assertJsonValidationErrors('locale');
    }

    public function test_project_list_is_paginated(): void
    {
        for ($i = 1; $i <= 51; $i++) {
            DB::table('projects')->insert($this->project(['name' => "Project $i"]) + ['status' => 'draft', 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->getJson('/api/projects')->assertOk()->assertJsonCount(50, 'data')
            ->assertJsonPath('meta.total', 51)->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/projects?page=2')->assertOk()->assertJsonCount(1, 'data');
    }
}
