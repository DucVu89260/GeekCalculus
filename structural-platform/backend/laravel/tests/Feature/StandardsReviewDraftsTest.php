<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Standards\StandardPdfInspector;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class StandardsReviewDraftsTest extends TestCase
{
    use RefreshDatabase;

    public function test_source_drafts_are_idempotent_and_never_enter_approved_lookup_until_published(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $inspection, $outline] = $this->sourceFixture();
        $this->mockInspector($inspection, $outline);

        try {
            $this->assertSame(0, Artisan::call('standards:import-pdf', [
                'pdf' => $pdf,
                'manifest' => $manifestPath,
                '--revision' => '2010-10',
            ]), Artisan::output());
            $draft = $this->reviewDraft($inspection);
            $draftPath = tempnam(sys_get_temp_dir(), 'standards-drafts-');
            file_put_contents($draftPath, json_encode($draft, JSON_THROW_ON_ERROR));
            $this->mockInspector($inspection, null, 2);

            $this->assertSame(0, Artisan::call('standards:import-review-drafts', ['json' => $draftPath]), Artisan::output());
            $firstHistoryCount = DB::table('standard_review_history')->count();
            $this->assertSame(0, Artisan::call('standards:import-review-drafts', ['json' => $draftPath]), Artisan::output());
            $this->assertSame($firstHistoryCount, DB::table('standard_review_history')->count());
            $this->assertSame(1, DB::table('standard_equations')->where('label', 'E3-1')->count());
            $this->assertDatabaseHas('standard_equations', ['label' => 'E3-1', 'verification_status' => 'needs_review', 'design_method' => 'both']);
            $this->assertDatabaseHas('standard_parameters', ['parameter_key' => 'compression.phi_c', 'verification_status' => 'needs_review']);
            $this->assertDatabaseHas('standard_tables', ['table_code' => 'B4.1a', 'coverage_type' => 'partial', 'complete_table' => false]);
            $this->assertSame(1, DB::table('standard_tables')->where('table_code', 'B4.1a')->count());
            $this->assertDatabaseHas('standard_review_history', ['record_type' => 'equations', 'to_status' => 'needs_review']);

            $this->actingAs(User::factory()->create(['role' => 'user']));
            $this->getJson('/api/v1/standards/AISC360-10/clauses?kind=normative&per_page=2')
                ->assertOk()->assertJsonPath('meta.total', 19)->assertJsonPath('meta.last_page', 10);
            $this->getJson('/api/v1/standards/AISC360-10/clauses?q=E3')
                ->assertOk()->assertJsonPath('data.0.source_sha256', $inspection['source_sha256']);
            $this->getJson('/api/v1/standards/AISC360-10/equations?status=needs_review&clause_id='.DB::table('standard_clauses')->where('code', 'E3')->value('id'))
                ->assertOk()->assertJsonPath('data.0.source_anchor.equation_id', 'E3-1')
                ->assertJsonPath('data.0.printed_page', '16.1-33')
                ->assertJsonPath('data.0.dependencies', [])
                ->assertJsonPath('data.0.source_metadata.source_anchor.equation_id', 'E3-1')
                ->assertJsonPath('data.0.design_method', 'both')
                ->assertJsonPath('data.0.design_methods', ['ASD', 'LRFD']);
            $this->getJson('/api/v1/standards/AISC360-10/parameters?kind=normative&data_type=number')
                ->assertOk()->assertJsonPath('data.0.value', 0.9)
                ->assertJsonPath('data.0.clause_code', 'E1');
            $this->getJson('/api/v1/standards/AISC360-10/tables?status=needs_review')
                ->assertOk()->assertJsonPath('data.0.coverage_type', 'partial')
                ->assertJsonPath('data.0.rows.0.source_anchor.row_id', 'B4.1a-case-1');
            $this->getJson('/api/v1/standards/AISC360-10/search?q=B4.1a')
                ->assertOk()->assertJsonPath('meta.total', 2);
            $documentId = (int) DB::table('standard_documents')->where('sha256', $inspection['source_sha256'])->value('id');
            $fileResponse = $this->get('/api/v1/standards/AISC360-10/documents/'.$documentId.'/file');
            $fileResponse->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertStringContainsString('private', $fileResponse->headers->get('Cache-Control'));
            $this->assertStringContainsString('no-store', $fileResponse->headers->get('Cache-Control'));
            $this->getJson('/api/v1/standards/AISC360-10/rules?implementation_key=E3-1')
                ->assertOk()->assertJsonPath('data', []);
            $this->getJson('/api/v1/standards/AISC360-10')
                ->assertOk()
                ->assertJsonPath('data.documents.0.import_report.pages.88.pdf_page', 89)
                ->assertJsonPath('data.documents.0.import_report.pages.88.kind', 'normative');
            $this->postJson('/api/v1/admin/standards/AISC360-10/equations/1/review', ['status' => 'verified'])
                ->assertForbidden();

            $privateNote = $this->postJson('/api/v1/standards/AISC360-10/notes', ['clause_id' => DB::table('standard_clauses')->where('code', 'E3')->value('id'), 'body' => 'Personal reading note'])
                ->assertCreated()->json('data');
            $this->assertSame('draft', $privateNote['review_status']);
            $this->getJson('/api/v1/standards/AISC360-10/notes?clause_id='.$privateNote['clause_id'])
                ->assertOk()->assertJsonFragment(['body' => 'Personal reading note']);
            $otherUser = User::factory()->create(['role' => 'user']);
            $this->actingAs($otherUser)
                ->getJson('/api/v1/standards/AISC360-10/notes?clause_id='.$privateNote['clause_id'])
                ->assertOk()->assertJsonPath('data', []);

            $admin = User::factory()->create(['role' => 'admin']);
            $this->actingAs($admin);
            $equationId = (int) DB::table('standard_equations')->where('label', 'E3-1')->value('id');
            $this->patchJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId, [
                'notes' => 'Admin transcription correction',
                'data' => ['latex' => 'P_n = F_{cr}A_g'],
            ])->assertOk();
            $this->postJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId.'/review', [
                'status' => 'verified',
            ])->assertUnprocessable();
            $this->postJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId.'/review', [
                'status' => 'verified', 'notes' => 'Compared against source page 16.1-33',
            ])->assertOk()->assertJsonPath('data.verification_status', 'verified');
            $this->postJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId.'/review', [
                'status' => 'published', 'notes' => 'Reviewed implementation mapping',
            ])->assertOk()->assertJsonPath('data.verification_status', 'published');

            $parameterId = (int) DB::table('standard_parameters')->where('parameter_key', 'compression.phi_c')->value('id');
            $this->postJson('/api/v1/admin/standards/AISC360-10/parameters/'.$parameterId.'/review', [
                'status' => 'verified', 'notes' => 'Checked factor value and LRFD applicability',
            ])->assertOk()->assertJsonPath('data.verification_status', 'verified');
            $this->postJson('/api/v1/admin/standards/AISC360-10/parameters/'.$parameterId.'/review', [
                'status' => 'published', 'notes' => 'Matched the approved factor implementation',
            ])->assertOk()->assertJsonPath('data.verification_status', 'published');

            $tableId = (int) DB::table('standard_tables')->where('table_code', 'B4.1a')->value('id');
            $this->postJson('/api/v1/admin/standards/AISC360-10/tables/'.$tableId.'/review', [
                'status' => 'verified', 'notes' => 'Verified transcribed cases and recorded omitted cases',
            ])->assertOk()->assertJsonPath('data.verification_status', 'verified');
            $this->patchJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId, [
                'notes' => 'Must not edit after publication', 'data' => ['latex' => '0'],
            ])->assertStatus(409);
            $this->getJson('/api/v1/standards/AISC360-10/rules?implementation_key=E3-1')
                ->assertOk()->assertJsonPath('data.0.verification_status', 'published')
                ->assertJsonPath('data.0.source.sha256', $inspection['source_sha256'])
                ->assertJsonPath('data.0.edition.family_code', 'AISC360')
                ->assertJsonPath('data.0.edition.code', 'AISC360-10')
                ->assertJsonPath('data.0.edition.year', 2010)
                ->assertJsonPath('data.0.source.revision', '2010-10');
            $this->getJson('/api/v1/standards/AISC360-10/rules?parameter_key=compression.phi_c&method=LRFD')
                ->assertOk()->assertJsonPath('data.0.content.value', 0.9)
                ->assertJsonPath('data.0.verification_status', 'published')
                ->assertJsonPath('data.0.edition.code', 'AISC360-10')
                ->assertJsonPath('data.0.source.revision', '2010-10');
            $this->getJson('/api/v1/admin/standards/AISC360-10/equations/'.$equationId.'/history')
                ->assertOk()->assertJsonFragment(['to_status' => 'published']);

            $documentId = (int) DB::table('standard_documents')->where('sha256', $inspection['source_sha256'])->value('id');
            $this->postJson('/api/v1/admin/standards/AISC360-10/documents/'.$documentId.'/review', [
                'status' => 'needs_review', 'notes' => 'Ready for document review',
            ])->assertOk();
            $this->postJson('/api/v1/admin/standards/AISC360-10/documents/'.$documentId.'/review', [
                'status' => 'verified', 'notes' => 'Inspected the private source and identity',
            ])->assertOk();

            $changedOutline = $outline;
            $changedOutline['equation_candidates'][0]['pdf_page'] = 90;
            $changedOutline['equation_candidates'][0]['printed_page_label'] = '16.1-34';
            $this->mockInspector($inspection, $changedOutline);
            $this->assertSame(1, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $this->assertDatabaseHas('standard_equations', [
                'id' => $equationId,
                'pdf_page' => 89,
                'printed_page_label' => '16.1-33',
                'verification_status' => 'published',
            ]);
            $storedReport = json_decode((string) DB::table('standard_documents')->where('id', $documentId)->value('import_report'), true);
            $this->assertSame(89, $storedReport['pages'][88]['pdf_page']);
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
            if (isset($draftPath)) { @unlink($draftPath); }
        }
    }

    public function test_out_of_range_draft_page_rolls_back_all_records(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $inspection, $outline] = $this->sourceFixture();
        $this->mockInspector($inspection, $outline);

        try {
            $this->assertSame(0, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $draft = $this->reviewDraft($inspection);
            $draft['equations'][0]['pdf_page'] = 613;
            $draftPath = tempnam(sys_get_temp_dir(), 'standards-invalid-drafts-');
            file_put_contents($draftPath, json_encode($draft, JSON_THROW_ON_ERROR));
            $this->mockInspector($inspection, null);

            $this->assertSame(1, Artisan::call('standards:import-review-drafts', ['json' => $draftPath]));
            $this->assertDatabaseHas('standard_equations', ['label' => 'E3-1', 'verification_status' => 'candidate']);
            $this->assertDatabaseCount('standard_parameters', 0);
            $candidateTable = DB::table('standard_tables')->where('table_code', 'B4.1a')->first();
            $this->assertSame('candidate', $candidateTable->verification_status);
            $this->assertSame([], $this->decodeJson($candidateTable->rows));
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
            if (isset($draftPath)) { @unlink($draftPath); }
        }
    }

    public function test_typed_parameter_value_validation_rolls_back_earlier_draft_records(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $inspection, $outline] = $this->sourceFixture();
        $this->mockInspector($inspection, $outline);

        try {
            $this->assertSame(0, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $draft = $this->reviewDraft($inspection);
            $draft['parameters'][0]['value'] = '0.9';
            $draftPath = tempnam(sys_get_temp_dir(), 'standards-invalid-typed-');
            file_put_contents($draftPath, json_encode($draft, JSON_THROW_ON_ERROR));
            $this->mockInspector($inspection, null);

            $this->assertSame(1, Artisan::call('standards:import-review-drafts', ['json' => $draftPath]));
            $this->assertDatabaseHas('standard_equations', ['label' => 'E3-1', 'verification_status' => 'candidate']);
            $this->assertDatabaseCount('standard_parameters', 0);
            $this->assertDatabaseHas('standard_tables', [
                'table_code' => 'B4.1a', 'verification_status' => 'candidate',
            ]);
            $candidateTable = DB::table('standard_tables')->where('table_code', 'B4.1a')->first();
            $this->assertSame([], $this->decodeJson($candidateTable->rows));
            $this->assertDatabaseCount('standard_review_history', 0);
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
            if (isset($draftPath)) { @unlink($draftPath); }
        }
    }

    /** @return array{string,string,array<string,mixed>,array<string,mixed>} */
    private function sourceFixture(): array
    {
        $pdf = tempnam(sys_get_temp_dir(), 'standards-review-pdf-');
        $manifestPath = tempnam(sys_get_temp_dir(), 'standards-review-json-');
        file_put_contents($pdf, "%PDF-1.5\nSynthetic fixture, not a publication.");
        $inspection = [
            'edition_code' => 'AISC360-10',
            'source_sha256' => hash_file('sha256', $pdf),
            'pdf_page_count' => 612,
            'metadata' => ['title' => 'Synthetic AISC 360-10 test fixture'],
            'source_identity' => ['family' => 'AISC360', 'edition_year' => 2010, 'validated' => true],
        ];
        $outline = [
            'schema_version' => 2,
            'edition_code' => 'AISC360-10',
            'source_sha256' => $inspection['source_sha256'],
            'pdf_page_count' => 612,
            'document_type' => 'specification',
            'metadata' => $inspection['metadata'],
            'source_identity' => $inspection['source_identity'],
            'pages' => $this->pageMap(),
            'boundaries' => ['main_text_pdf_page' => 57],
            'report' => ['native_bookmarks' => 3, 'indexed_headings' => 3],
            'clauses' => [],
            'equation_candidates' => [],
            'table_candidates' => [[
                'label' => 'B4.1a', 'kind' => 'normative', 'pdf_page' => 72,
                'printed_page_label' => '16.1-16', 'source_anchor' => ['page' => 72],
                'extraction_method' => 'pdf_table_identifier', 'rows' => [], 'columns' => [],
                'footnotes' => [], 'merged_cells' => [],
                'limitations' => ['Table cells have not been transcribed.'],
            ]],
        ];
        foreach ([['E3', 89, '16.1-33'], ['E1', 87, '16.1-31'], ['B4.1a', 72, '16.1-16']] as [$code, $page, $printed]) {
            $outline['clauses'][] = [
                'code' => $code,
                'title' => $code.' provision',
                'kind' => 'normative',
                'pdf_page' => $page,
                'printed_page_label' => $printed,
                'parent_code' => null,
                'level' => 1,
                'source_anchor' => ['source_type' => 'heading', 'code' => $code, 'pdf_page' => $page],
                'extraction_method' => 'heading_scan',
            ];
        }
        $outline['equation_candidates'][] = [
            'label' => 'E3-1', 'clause_code' => 'E3', 'kind' => 'normative',
            'pdf_page' => 89, 'printed_page_label' => '16.1-33',
            'source_anchor' => ['source_type' => 'equation_label', 'label' => 'E3-1', 'pdf_page' => 89],
            'extraction_method' => 'text_identifier',
        ];
        file_put_contents($manifestPath, json_encode($outline, JSON_THROW_ON_ERROR));
        return [$pdf, $manifestPath, $inspection, $outline];
    }

    /** @return array<int, array{pdf_page:int,printed_page_label:?string,kind:string}> */
    private function pageMap(): array
    {
        $pages = [];
        for ($page = 1; $page <= 612; $page++) {
            $pages[] = [
                'pdf_page' => $page,
                'printed_page_label' => match ($page) { 72 => '16.1-16', 87 => '16.1-31', 89 => '16.1-33', default => null },
                'kind' => $page < 57 ? 'front_matter' : 'normative',
            ];
        }
        return $pages;
    }

    private function reviewDraft(array $inspection): array
    {
        $pageAnchor = fn (string $type, string $code, int $page, string $printed, string $idKey, string $id) => [
            'source_type' => $type, 'clause_code' => $code, $idKey => $id,
            'pdf_page' => $page, 'printed_page_label' => $printed,
        ];
        return [
            'schema_version' => 1,
            'edition_code' => 'AISC360-10',
            'source_sha256' => $inspection['source_sha256'],
            'source_identity' => ['sha256' => $inspection['source_sha256'], 'physical_page_count' => 612],
            'equations' => [[
                'id' => 'E3-1', 'label' => 'E3-1', 'clause_code' => 'E3', 'kind' => 'normative',
                'pdf_page' => 89, 'source_page' => 89, 'printed_page_label' => '16.1-33',
                'source_anchor' => $pageAnchor('equation', 'E3', 89, '16.1-33', 'equation_id', 'E3-1'),
                'latex' => 'P_n=F_{cr}A_g', 'variables' => [['symbol' => 'P_n', 'definition' => 'Nominal strength']],
                'conditions' => ['Axial compression'], 'design_methods' => ['ASD', 'LRFD'],
                'dependencies' => [], 'implementation_key' => 'E3-1', 'verification_status' => 'needs_review',
                'notes' => 'Requires independent validation.',
            ]],
            'parameters' => [[
                'id' => 'compression.phi_c', 'parameter_key' => 'compression.phi_c', 'label' => 'Compression factor',
                'clause_code' => 'E1', 'kind' => 'normative', 'pdf_page' => 87, 'source_page' => 87,
                'printed_page_label' => '16.1-31', 'source_anchor' => $pageAnchor('provision', 'E1', 87, '16.1-31', 'parameter_key', 'compression.phi_c'),
                'symbol' => 'φ_c', 'value' => 0.9, 'data_type' => 'number', 'unit' => '1', 'dimension' => 'dimensionless',
                'design_methods' => ['LRFD'], 'conditions' => ['Compression design'], 'implementation_key' => 'COMPRESSION.phi',
                'verification_status' => 'needs_review', 'notes' => 'Requires independent validation.',
            ]],
            'tables' => [[
                'id' => 'B4.1a', 'label' => 'B4.1a', 'clause_code' => 'B4.1a', 'kind' => 'normative',
                'pdf_page' => 72, 'source_page' => 72, 'printed_page_label' => '16.1-16',
                'source_anchor' => $pageAnchor('table', 'B4.1a', 72, '16.1-16', 'table_id', 'B4.1a'),
                'title' => 'Width-to-thickness ratios', 'applicability' => 'Axial compression',
                'coverage_type' => 'partial', 'complete_table' => false, 'coverage' => ['included_case_ids' => ['B4.1a-case-1'], 'omitted_case_ids' => ['B4.1a-case-2']],
                'columns' => ['case', 'ratio'], 'rows' => [[
                    'id' => 'B4.1a-case-1', 'pdf_page' => 72, 'source_anchor' => $pageAnchor('table_row', 'B4.1a', 72, '16.1-16', 'row_id', 'B4.1a-case-1'),
                    'description' => 'Test case', 'conditions' => ['Axial compression'], 'verification_status' => 'needs_review',
                ]],
                'footnotes' => [], 'merged_cells' => [], 'design_methods' => ['ASD', 'LRFD'],
                'verification_status' => 'needs_review', 'notes' => 'Partial table; remaining cases omitted.',
            ]],
        ];
    }

    private function mockInspector(array $inspection, ?array $manifest, int $calls = 1): void
    {
        $mock = Mockery::mock(StandardPdfInspector::class);
        $mock->shouldReceive('inspect')->times($calls)->andReturn($inspection);
        if ($manifest !== null) {
            $mock->shouldReceive('extract')->times($calls)->andReturn($manifest);
        } else {
            $mock->shouldNotReceive('extract');
        }
        $this->app->instance(StandardPdfInspector::class, $mock);
    }

    private function decodeJson(mixed $value): mixed
    {
        return is_string($value) ? json_decode($value, true, 512, JSON_THROW_ON_ERROR) : $value;
    }
}
