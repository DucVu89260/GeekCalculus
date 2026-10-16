<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Standards\StandardsFormulaCandidateService;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** All artifacts/equations here are synthetic workflow fixtures, NOT source verification. */
class StandardsFormulaVerificationTest extends TestCase
{
    use RefreshDatabase;
    private int $edition;
    private int $doc;
    private int $eq;
    private string $hash;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        $this->edition = (int) DB::table('standard_editions')->where('code', 'AISC360-10')->value('id');
        $bytes = '%PDF synthetic workflow fixture, not AISC source';
        $this->hash = hash('sha256', $bytes);
        Storage::disk('local')->put('fixtures/source.pdf', $bytes);
        $this->doc = DB::table('standard_documents')->insertGetId([
            'edition_id' => $this->edition, 'kind' => 'specification', 'original_name' => 'synthetic.pdf',
            'private_path' => 'fixtures/source.pdf', 'sha256' => $this->hash, 'page_count' => 3,
            'processing_status' => 'indexed', 'metadata' => json_encode(['synthetic' => true]),
            'source_identity' => json_encode(['validated' => true, 'family' => 'AISC360', 'edition_year' => 2010]),
        ]);
        $clause = DB::table('standard_clauses')->insertGetId([
            'edition_id' => $this->edition, 'document_id' => $this->doc, 'code' => 'E3', 'title' => 'Synthetic test',
            'kind' => 'normative', 'source_context' => 'doc:'.$this->doc, 'source_sha256' => $this->hash,
        ]);
        $this->eq = DB::table('standard_equations')->insertGetId([
            'clause_id' => $clause, 'document_id' => $this->doc, 'source_sha256' => $this->hash,
            'source_context' => 'doc:'.$this->doc, 'label' => 'E3-2', 'latex' => 'Q=ab',
            'pdf_page' => 2, 'source_anchor' => json_encode(['pdf_page' => 2]), 'extraction_method' => 'synthetic',
            'design_method' => 'both', 'implementation_key' => 'synthetic.workflow',
            'variables' => json_encode([['symbol' => 'Q', 'definition' => 'Test quantity', 'unit' => '1']]),
            'conditions' => json_encode(['Synthetic workflow test only']), 'verification_status' => 'needs_review',
        ]);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function url(): string { return '/api/v1/admin/standards/AISC360-10/equations/'.$this->eq; }
    private function approval(array $overrides = []): array
    {
        return array_replace_recursive([
            'status' => 'verified', 'notes' => 'Compared synthetic workflow fixture, not an AISC source approval.',
            'expected_version' => 1,
            'source_comparison' => ['compared' => true, 'document_id' => $this->doc, 'source_sha256' => $this->hash,
                'pdf_page' => 2, 'latex_sha256' => hash('sha256', 'Q=ab')],
        ], $overrides);
    }

    public function test_approval_requires_explicit_matching_source_content_and_version(): void
    {
        $body = $this->approval(); unset($body['source_comparison']);
        $this->postJson($this->url().'/review', $body)->assertUnprocessable();
        foreach (['compared' => false, 'document_id' => $this->doc + 1, 'pdf_page' => 1, 'source_sha256' => str_repeat('a', 64), 'latex_sha256' => str_repeat('b', 64)] as $key => $value) {
            $this->postJson($this->url().'/review', $this->approval(['source_comparison' => [$key => $value]]))->assertUnprocessable();
        }
        $this->postJson($this->url().'/review', $this->approval(['expected_version' => 99]))->assertStatus(409);
        $this->assertDatabaseCount('standard_review_history', 0);
        $this->postJson($this->url().'/review', $this->approval())->assertOk()->assertJsonPath('data.record_version', 2);
    }

    public function test_stale_edit_and_cross_edition_or_non_admin_review_are_rejected(): void
    {
        $edit = ['notes' => 'Synthetic transcription edit', 'expected_version' => 1, 'data' => ['latex' => 'Q=ba']];
        $this->patchJson($this->url(), $edit)->assertOk()->assertJsonPath('data.record_version', 2);
        $this->patchJson($this->url(), $edit)->assertStatus(409);
        $this->postJson(str_replace('AISC360-10', 'ASCE7-10', $this->url()).'/review', $this->approval())->assertNotFound();
        $this->actingAs(User::factory()->create(['role' => 'user']));
        $this->postJson($this->url().'/review', $this->approval())->assertForbidden();
        $this->patchJson($this->url(), $edit)->assertForbidden();
        $this->getJson($this->url().'/history')->assertForbidden();
    }

    public function test_engine_requires_review_evidence_and_rechecks_source_and_content_on_every_lookup(): void
    {
        $lookup = '/api/v1/standards/AISC360-10/rules?equation_id='.$this->eq;
        $this->getJson($lookup)->assertOk()->assertJsonPath('data', []);
        // A status set outside the review workflow must never authorize engine input.
        DB::table('standard_equations')->where('id', $this->eq)->update(['verification_status' => 'verified']);
        $this->getJson($lookup)->assertOk()->assertJsonPath('data', []);
        DB::table('standard_equations')->where('id', $this->eq)->update(['verification_status' => 'needs_review']);
        $this->postJson($this->url().'/review', $this->approval())->assertOk();
        $this->getJson($lookup)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.source.document_id', $this->doc);
        DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => 'Q=0']);
        $this->getJson($lookup)->assertOk()->assertJsonPath('data', []);
        DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => 'Q=ab']);
        $this->getJson($lookup)->assertOk()->assertJsonCount(1, 'data');
        Storage::disk('local')->put('fixtures/source.pdf', '%PDF changed fixture');
        $this->getJson($lookup)->assertOk()->assertJsonPath('data', []);
    }

    public function test_missing_or_malformed_expression_units_or_source_cannot_be_approved(): void
    {
        foreach (['', 'Q=\\frac{a}{b', 'Q=\\href{https://example.com}{a}', 'Q='] as $latex) {
            DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => $latex]);
            $this->postJson($this->url().'/review', $this->approval(['source_comparison' => ['latex_sha256' => hash('sha256', $latex)]]))->assertStatus(409);
        }
        DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => 'Q=ab', 'variables' => json_encode([['symbol' => 'Q', 'definition' => 'Quantity']])]);
        $this->postJson($this->url().'/review', $this->approval())->assertStatus(409);
        Storage::disk('local')->delete('fixtures/source.pdf');
        $this->postJson($this->url().'/review', $this->approval())->assertStatus(409);
        $this->assertDatabaseCount('standard_review_history', 0);
    }

    private function candidate(): array
    {
        return ['edition_code' => 'AISC360-10', 'source_sha256' => $this->hash, 'pdf_page_count' => 3,
            'equations' => [['label' => 'E3-2', 'clause_code' => 'E3', 'kind' => 'normative', 'pdf_page' => 2,
                'source_anchor' => ['pdf_page' => 2, 'equation_id' => 'E3-2'], 'latex' => null,
                'extraction_method' => 'native_layout_requires_transcription', 'extraction_confidence' => 0.0,
                'evidence' => ['text' => 'synthetic source', 'text_sha256' => hash('sha256', 'synthetic source')]]]];
    }

    public function test_candidate_reimport_is_idempotent_and_preserves_manual_or_approved_records(): void
    {
        $service = app(StandardsFormulaCandidateService::class);
        $manifest = $this->candidate();
        $this->assertSame(1, $service->import($this->edition, $this->doc, $manifest)['protected']);
        DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => null]);
        $this->assertSame(1, $service->import($this->edition, $this->doc, $manifest)['updated']);
        $this->assertSame(1, $service->import($this->edition, $this->doc, $manifest)['unchanged']);
        DB::table('standard_equations')->where('id', $this->eq)->update(['latex' => 'Q=ab', 'verification_status' => 'needs_review']);
        $this->postJson($this->url().'/review', $this->approval(['expected_version' => 2]))->assertOk();
        $manifest['equations'][0]['latex'] = 'Q=0';
        $this->assertSame(1, $service->import($this->edition, $this->doc, $manifest)['protected']);
        $this->assertDatabaseHas('standard_equations', ['id' => $this->eq, 'latex' => 'Q=ab', 'verification_status' => 'verified']);
        $this->assertSame(0, Artisan::call('standards:formula-report'));
        $report = json_decode(Artisan::output(), true);
        $this->assertSame(1, $report['approved_equations']);
        $this->assertTrue($report['source_available']);
    }
}
