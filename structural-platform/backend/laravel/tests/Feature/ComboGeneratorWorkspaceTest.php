<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComboGeneratorWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    private function workspace(): array
    {
        return [
            'schemaVersion' => '1.1.0',
            'loadCases' => [
                ['name' => 'D', 'csiPatternType' => 'Dead', 'loadCaseName' => 'D', 'selfWtMult' => 1],
                ['name' => 'LR', 'csiPatternType' => 'Rooflive', 'loadCaseName' => 'LR', 'selfWtMult' => 0],
            ],
            'combinations' => [
                ['id' => 'GC-COMBO-0001', 'name' => '1.2D+0.5LR', 'type' => 'LinearAdditive',
                    'terms' => [['loadCaseName' => 'D', 'factor' => 1.2], ['loadCaseName' => 'LR', 'factor' => 0.5]]],
            ],
            'comboTemplates' => [],
            'seismicParameters' => [['id' => 'rho', 'name' => 'ρ', 'value' => 1]],
        ];
    }

    public function test_authenticated_user_can_save_and_load_combo_workspace(): void
    {
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/combo-generator/workspace')->assertOk()->assertJsonPath('data', null);
        $this->putJson('/api/v1/combo-generator/workspace', ['payload' => $this->workspace()])
            ->assertOk()->assertJsonPath('data.combinations', 1);
        $this->getJson('/api/v1/combo-generator/workspace')
            ->assertOk()->assertJsonPath('data.combinations.0.name', '1.2D+0.5LR')
            ->assertJsonPath('data.seismicParameters.0.name', 'ρ');
        $this->assertDatabaseCount('combo_generator_workspaces', 1);
    }

    public function test_workspace_is_scoped_to_authenticated_user(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $this->actingAs($userA)->putJson('/api/v1/combo-generator/workspace', ['payload' => $this->workspace()])->assertOk();
        $this->actingAs($userB)->getJson('/api/v1/combo-generator/workspace')->assertOk()->assertJsonPath('data', null);
        $this->actingAs($userA)->getJson('/api/v1/combo-generator/workspace')->assertOk()->assertJsonPath('data.combinations.0.id', 'GC-COMBO-0001');
    }

    public function test_unknown_load_pattern_in_combo_is_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $data = $this->workspace();
        $data['combinations'][0]['terms'][0]['loadCaseName'] = 'MISSING';
        $this->putJson('/api/v1/combo-generator/workspace', ['payload' => $data])
            ->assertUnprocessable()->assertJsonValidationErrors('payload.combinations');
        $this->assertDatabaseCount('combo_generator_workspaces', 0);
    }

    public function test_guest_cannot_access_saved_workspace(): void
    {
        $this->getJson('/api/v1/combo-generator/workspace')->assertUnauthorized();
        $this->putJson('/api/v1/combo-generator/workspace', ['payload' => $this->workspace()])->assertUnauthorized();
    }
}
