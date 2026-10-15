<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Database\Seeders\StandardsSeeder;
use Tests\TestCase;

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

    public function test_anonymous_user_cannot_access_private_standards(): void {
        $this->getJson('/api/v1/standards')->assertUnauthorized();
        $this->getJson('/api/v1/standards/AISC360-10')->assertUnauthorized();
        $this->post('/api/v1/standards/AISC360-10/documents',[])->assertUnauthorized();
    }
}
