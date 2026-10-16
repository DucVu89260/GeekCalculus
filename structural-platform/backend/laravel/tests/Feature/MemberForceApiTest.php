<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MemberForceApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_processing_requires_login_and_restricts_operations(): void
    {
        Http::fake();
        $this->postJson('/api/API_IF_SAP26.2.0_V1/extremes', [])->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/API_IF_SAP26.2.0_V1/unknown', [])->assertNotFound();
        $this->postJson('/api/API_IF_SAP26.2.0_V1/cb', [])->assertNotFound();
        $this->postJson('/api/v1/member-forces/cb', [])->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_authenticated_processing_preserves_payload_and_validation_errors(): void
    {
        $this->actingAs(User::factory()->create());
        config(['sectional.engine_url' => 'http://engine.test']);
        Http::fake(['engine.test/*' => Http::response(['status' => 'error', 'code' => 'INVALID_FORCE_DATA'], 422)]);
        $this->postJson('/api/API_IF_SAP26.2.0_V1/extremes', ['frame' => 'F1'])->assertUnprocessable()
            ->assertJsonPath('code', 'INVALID_FORCE_DATA');
        Http::assertSent(fn ($r) => $r->url() === 'http://engine.test/API_IF_SAP26.2.0_V1/extremes'
            && $r->method() === 'POST' && $r->data()['frame'] === 'F1');
    }

    public function test_csv_download_is_preserved(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => Http::response("frame,P\nF1,-5\n", 200, ['Content-Type' => 'text/csv; charset=utf-8']));
        $this->postJson('/api/API_IF_SAP26.2.0_V1/connection-export', ['format' => 'csv'])->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=utf-8')
            ->assertHeader('Content-Disposition', 'attachment; filename="member-forces.csv"')
            ->assertContent("frame,P\nF1,-5\n");
    }

    public function test_engine_failure_and_oversized_input_are_safe(): void
    {
        $this->actingAs(User::factory()->create());
        Http::fake(fn () => throw new ConnectionException('private connection details'));
        $this->postJson('/api/API_IF_SAP26.2.0_V1/extremes', [])->assertStatus(503)
            ->assertExactJson(['status' => 'error', 'code' => 'ENGINE_UNAVAILABLE']);
        Http::fake();
        $this->postJson('/api/API_IF_SAP26.2.0_V1/extremes', ['padding' => str_repeat('x', 20_000_001)])
            ->assertStatus(413);
        Http::assertNothingSent();
    }
}
