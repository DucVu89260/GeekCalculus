<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Database\Seeders\StandardsSeeder;
use Tests\TestCase;
use App\Models\User;

class StandardsRegistryTest extends TestCase {
    use RefreshDatabase;

    public function test_edition_registry_contains_six_edition_records(): void {
        $this->seed(StandardsSeeder::class);
        $this->assertDatabaseCount('standard_families', 2);
        $this->assertDatabaseCount('standard_editions', 6);
        $this->assertDatabaseHas('standard_editions',['code'=>'AISC360-10','year'=>2010]);
        $this->assertDatabaseHas('standard_editions',['code'=>'ASCE7-22','year'=>2022]);
    }

    public function test_seed_is_idempotent(): void {
        $this->seed(StandardsSeeder::class);
        $this->seed(StandardsSeeder::class);
        $this->assertDatabaseCount('standard_editions',6);
    }

    public function test_authenticated_user_can_read_db_backed_aisc_catalog(): void {
        $this->seed(StandardsSeeder::class);
        $this->actingAs(User::factory()->create(['role' => 'user']));
        $this->getJson('/api/v1/standards')->assertOk()
            ->assertJsonFragment(['code'=>'AISC360-10'])
            ->assertJsonFragment(['code'=>'ASCE7-22']);
        $this->getJson('/api/v1/standards/AISC360-10')->assertOk()
            ->assertJsonPath('data.edition.status','in_development');
        $this->getJson('/api/v1/standards/AISC360-10/equations')->assertOk()
            ->assertJsonPath('data',[]);
        $this->getJson('/api/v1/standards/UNKNOWN')->assertNotFound();
    }

    public function test_anonymous_user_cannot_access_private_standards(): void {
        $this->getJson('/api/v1/standards')->assertUnauthorized();
        $this->getJson('/api/v1/standards/AISC360-10')->assertUnauthorized();
        $this->post('/api/v1/standards/AISC360-10/documents',[])->assertUnauthorized();
    }

    public function test_asce710_explorer_has_source_index_before_private_corpus_import(): void {
        $this->seed(StandardsSeeder::class);
        $this->actingAs(User::factory()->create(['role'=>'user']));
        $this->getJson('/api/v1/standards/ASCE7-10')->assertOk()
            ->assertJsonCount(875,'data.clauses')->assertJsonPath('data.library.page_count',658);
        $this->getJson('/api/v1/standards/ASCE7-10/equations')->assertOk()->assertJsonCount(310,'data');
    }
}
