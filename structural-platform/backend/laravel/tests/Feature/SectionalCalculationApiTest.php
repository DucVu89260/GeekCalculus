<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SectionalCalculationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['sectional.engine_url' => 'http://section-engine.test']);
    }

    private function calculationRequest(): array
    {
        return [
            'geometry' => [
                'type' => 'rectangle',
                'geometry_variant' => 'solid',
                'dimensions' => ['width' => 200, 'height' => 400],
            ],
            'units' => 'mm',
            'options' => ['include_advanced' => true],
        ];
    }

    private function signIn(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'user']));
    }

    public function test_calculation_and_type_routes_require_authentication(): void
    {
        Http::fake();

        $this->postJson('/api/v1/sections/calculate', $this->calculationRequest())->assertUnauthorized();
        $this->getJson('/api/v1/section-types')->assertUnauthorized();

        Http::assertNothingSent();
    }

    public function test_calculation_is_forwarded_and_does_not_persist_sections(): void
    {
        $this->signIn();
        $result = ['status' => 'success', 'geometry_type' => 'rectangle', 'properties' => ['geometric' => ['area' => 80_000]]];
        Http::fake(['http://section-engine.test/*' => Http::response($result, 200)]);

        $this->postJson('/api/v1/sections/calculate', $this->calculationRequest())
            ->assertOk()
            ->assertJsonPath('geometry_type', 'rectangle')
            ->assertJsonPath('properties.geometric.area', 80_000);

        Http::assertSent(fn (ClientRequest $request) =>
            $request->method() === 'POST'
            && $request->url() === 'http://section-engine.test/v1/sections/calculate'
            && $request->data()['geometry']['dimensions']['width'] === 200
        );
        $this->assertDatabaseCount('sections', 0);
    }

    public function test_section_type_schemas_are_proxied(): void
    {
        $this->signIn();
        $schemas = ['data' => [['type' => 'rectangle', 'input_schema' => ['type' => 'object']]]];
        Http::fake(['http://section-engine.test/*' => Http::response($schemas, 200)]);

        $this->getJson('/api/v1/section-types')->assertOk()->assertJsonPath('data.0.type', 'rectangle');
        Http::assertSent(fn (ClientRequest $request) =>
            $request->method() === 'GET' && $request->url() === 'http://section-engine.test/v1/section-types'
        );
    }

    public function test_engine_connection_failure_is_a_clean_503(): void
    {
        $this->signIn();
        Http::fake(fn () => throw new ConnectionException('connection details must not leak'));

        $this->postJson('/api/v1/sections/calculate', $this->calculationRequest())
            ->assertStatus(503)
            ->assertExactJson([
                'status' => 'error',
                'code' => 'ENGINE_UNAVAILABLE',
                'message' => 'Section calculation service is unavailable.',
            ]);
    }

    public function test_engine_validation_status_and_code_are_preserved(): void
    {
        $this->signIn();
        Http::fake(['http://section-engine.test/*' => Http::response([
            'status' => 'error',
            'code' => 'INVALID_DIMENSION',
            'message' => 'Input validation failed.',
            'errors' => [['path' => 'geometry.dimensions.width', 'type' => 'greater_than', 'message' => 'Input should be greater than 0']],
        ], 422)]);

        $this->postJson('/api/v1/sections/calculate', $this->calculationRequest())
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('code', 'INVALID_DIMENSION');
    }

    public function test_oversized_requests_are_rejected_before_proxying(): void
    {
        $this->signIn();
        Http::fake();

        $response = $this->postJson('/api/v1/sections/calculate', ['padding' => str_repeat('x', 65_537)]);

        $response->assertStatus(413)->assertJsonPath('code', 'REQUEST_TOO_LARGE');
        Http::assertNothingSent();
    }
}
