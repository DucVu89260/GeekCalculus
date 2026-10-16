<?php

namespace Tests\Feature;

use App\Services\Standards\StandardPdfInspector;
use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ImportStandardPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_private_pdf_import_is_idempotent_and_keeps_source_rows_as_candidates(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $this->mockInspector($inspection, $manifest, 2);

        try {
            $arguments = ['pdf' => $pdf, 'manifest' => $manifestPath];
            $this->assertSame(0, Artisan::call('standards:import-pdf', $arguments), Artisan::output());
            $this->assertSame(0, Artisan::call('standards:import-pdf', $arguments), Artisan::output());

            $this->assertDatabaseCount('standard_documents', 1);
            $this->assertDatabaseHas('standard_documents', [
                'sha256' => $inspection['source_sha256'],
                'processing_status' => 'indexed',
                'verification_status' => 'candidate',
                'page_count' => 612,
            ]);
            $documentId = (int) DB::table('standard_documents')->where('sha256', $inspection['source_sha256'])->value('id');
            $this->assertDatabaseHas('standard_clauses', [
                'code' => 'E3',
                'pdf_page' => 89,
                'source_context' => 'doc:'.$documentId,
                'source_sha256' => $inspection['source_sha256'],
                'printed_page_label' => '16.1-33',
                'verification_status' => 'index_only',
            ]);
            $this->assertDatabaseHas('standard_equations', [
                'label' => 'E3-1',
                'verification_status' => 'candidate',
                'document_id' => $documentId,
            ]);
            $this->assertDatabaseHas('standard_tables', [
                'table_code' => 'B4.1a',
                'source_context' => 'doc:'.$documentId,
                'verification_status' => 'candidate',
            ]);
            $candidateTable = DB::table('standard_tables')->where('table_code', 'B4.1a')->first();
            $this->assertSame([], $this->decodeJson($candidateTable->rows));
            $this->assertSame([], $this->decodeJson($candidateTable->columns));
            $this->assertSame(1, DB::table('standard_tables')->where('table_code', 'B4.1a')->count());
            $this->assertSame(1, DB::table('standard_clauses')->where('code', 'E3')->count());
            $this->actingAs(\App\Models\User::factory()->create(['role' => 'user']))
                ->getJson('/api/v1/standards/AISC360-10')
                ->assertOk()
                ->assertJsonPath('data.documents.0.import_report.pages.88.pdf_page', 89)
                ->assertJsonPath('data.documents.0.import_report.pages.88.printed_page_label', '16.1-33');
            Storage::disk('local')->assertExists('standards/AISC360-10/'.$inspection['source_sha256'].'.pdf');
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
        }
    }

    public function test_mismatched_pdf_and_manifest_are_rejected_before_persistence(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $manifest['source_sha256'] = str_repeat('a', 64);
        file_put_contents($manifestPath, json_encode($manifest, JSON_THROW_ON_ERROR));
        $this->mockInspector($inspection, $this->extractedManifest($inspection), 0);

        try {
            $this->assertSame(1, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $this->assertDatabaseCount('standard_documents', 0);
            Storage::disk('local')->assertMissing('standards/AISC360-10/'.$inspection['source_sha256'].'.pdf');
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
        }
    }

    public function test_inspected_pdf_completes_an_admin_uploaded_pending_document(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $relative = 'standards/AISC360-10/'.$inspection['source_sha256'].'.pdf';
        Storage::disk('local')->put($relative, fopen($pdf, 'rb'));
        $editionId = DB::table('standard_editions')->where('code', 'AISC360-10')->value('id');
        DB::table('standard_documents')->insert([
            'edition_id' => $editionId,
            'kind' => 'specification',
            'original_name' => 'uploaded.pdf',
            'private_path' => $relative,
            'sha256' => $inspection['source_sha256'],
            'page_count' => null,
            'processing_status' => 'pending',
            'verification_status' => 'candidate',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->mockInspector($inspection, $manifest, 1);

        try {
            $this->assertSame(0, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $this->assertDatabaseHas('standard_documents', [
                'sha256' => $inspection['source_sha256'],
                'page_count' => 612,
                'processing_status' => 'indexed',
            ]);
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
        }
    }

    public function test_invalid_page_map_rolls_back_database_rows_and_removes_new_private_copy(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $manifest['pages'] = [];
        file_put_contents($manifestPath, json_encode($manifest, JSON_THROW_ON_ERROR));
        $this->mockInspector($inspection, $manifest, 1);

        try {
            $this->assertSame(1, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $this->assertDatabaseCount('standard_documents', 0);
            $this->assertDatabaseCount('standard_equations', 0);
            $this->assertDatabaseHas('standard_clauses', ['code' => 'E3', 'source_context' => 'legacy']);
            Storage::disk('local')->assertMissing('standards/AISC360-10/'.$inspection['source_sha256'].'.pdf');
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
        }
    }

    public function test_a_corrupt_existing_private_blob_is_not_replaced_or_deleted(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $relativePath = 'standards/AISC360-10/'.$inspection['source_sha256'].'.pdf';
        Storage::disk('local')->put($relativePath, '%PDF-corrupt');
        $this->mockInspector($inspection, $manifest, 1);

        try {
            $this->assertSame(1, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]));
            $this->assertDatabaseCount('standard_documents', 0);
            Storage::disk('local')->assertExists($relativePath);
            $this->assertSame('%PDF-corrupt', Storage::disk('local')->get($relativePath));
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
        }
    }

    public function test_equations_are_unique_by_document_kind_and_label(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        [$pdf, $manifestPath, $manifest, $inspection] = $this->fixture();
        $manifest['clauses'][] = [
            'code' => 'E1', 'title' => 'General Provisions', 'kind' => 'normative', 'pdf_page' => 87,
            'printed_page_label' => '16.1-31', 'source_anchor' => ['pdf_page' => 87], 'extraction_method' => 'heading_scan',
        ];
        $manifest['clauses'][] = [
            'code' => 'E3-C', 'title' => 'Commentary on E3', 'kind' => 'commentary', 'pdf_page' => 90,
            'printed_page_label' => '16.1-34', 'source_anchor' => ['pdf_page' => 90], 'extraction_method' => 'heading_scan',
        ];
        $manifest['pages'][89]['kind'] = 'commentary';
        $manifest['pages'][89]['printed_page_label'] = '16.1-34';
        $manifest['clauses'][0]['kind'] = 'normative';
        $manifest['equation_candidates'][] = [
            'label' => 'E3-1', 'clause_code' => 'E3-C', 'kind' => 'commentary', 'pdf_page' => 90,
            'printed_page_label' => '16.1-34', 'source_anchor' => ['pdf_page' => 90], 'extraction_method' => 'text_identifier',
        ];
        file_put_contents($manifestPath, json_encode($manifest, JSON_THROW_ON_ERROR));
        $this->mockInspector($inspection, $manifest, 1);

        $pdf2 = $manifestPath2 = null;
        try {
            $this->assertSame(0, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $manifestPath]), Artisan::output());
            $documentId = (int) DB::table('standard_documents')->where('sha256', $inspection['source_sha256'])->value('id');
            $this->assertSame(1, DB::table('standard_equations')->where('document_id', $documentId)->where('kind', 'normative')->where('label', 'E3-1')->count());
            $this->assertSame(1, DB::table('standard_equations')->where('document_id', $documentId)->where('kind', 'commentary')->where('label', 'E3-1')->count());

            $equation = [
                'clause_id' => DB::table('standard_clauses')->where('document_id', $documentId)->where('kind', 'normative')->where('code', 'E1')->value('id'),
                'document_id' => $documentId,
                'kind' => 'normative',
                'source_context' => 'doc:'.$documentId,
                'source_sha256' => $inspection['source_sha256'],
                'label' => 'E3-1',
                'pdf_page' => 87,
                'verification_status' => 'candidate',
                'created_at' => now(),
                'updated_at' => now(),
            ];
            $duplicateRejected = false;
            try {
                DB::transaction(fn () => DB::table('standard_equations')->insert($equation));
            } catch (QueryException) {
                $duplicateRejected = true;
            }
            $this->assertTrue($duplicateRejected, 'The same document/kind/label must not appear under a second clause.');

            $pdf2 = tempnam(sys_get_temp_dir(), 'standard-revision-pdf-');
            $manifestPath2 = tempnam(sys_get_temp_dir(), 'standard-revision-json-');
            file_put_contents($pdf2, "%PDF-1.5\nSynthetic revision 2, not a publication.");
            $inspection2 = $inspection;
            $inspection2['source_sha256'] = hash_file('sha256', $pdf2);
            $manifest2 = $manifest;
            $manifest2['source_sha256'] = $inspection2['source_sha256'];
            file_put_contents($manifestPath2, json_encode($manifest2, JSON_THROW_ON_ERROR));
            $this->mockInspector($inspection2, $manifest2, 1);

            $this->assertSame(0, Artisan::call('standards:import-pdf', ['pdf' => $pdf2, 'manifest' => $manifestPath2]), Artisan::output());
            $documentId2 = (int) DB::table('standard_documents')->where('sha256', $inspection2['source_sha256'])->value('id');
            $this->assertNotSame($documentId, $documentId2);
            $this->assertSame(2, DB::table('standard_equations')->where('kind', 'normative')->where('label', 'E3-1')->count());
            $this->assertSame(2, DB::table('standard_equations')->where('kind', 'commentary')->where('label', 'E3-1')->count());
        } finally {
            @unlink($pdf);
            @unlink($manifestPath);
            if (is_string($pdf2)) { @unlink($pdf2); }
            if (is_string($manifestPath2)) { @unlink($manifestPath2); }
        }
    }

    /** @return array{string,string,array<string,mixed>,array<string,mixed>} */
    private function fixture(): array
    {
        $pdf = tempnam(sys_get_temp_dir(), 'standard-pdf-');
        $manifestPath = tempnam(sys_get_temp_dir(), 'standard-json-');
        file_put_contents($pdf, "%PDF-1.5\nSynthetic fixture, not a publication.");
        $inspection = [
            'edition_code' => 'AISC360-10',
            'source_sha256' => hash_file('sha256', $pdf),
            'pdf_page_count' => 612,
            'metadata' => ['title' => 'Synthetic AISC 360-10 test fixture'],
            'source_identity' => ['family' => 'AISC360', 'edition_year' => 2010, 'validated' => true],
        ];
        $manifest = $this->extractedManifest($inspection);
        file_put_contents($manifestPath, json_encode($manifest, JSON_THROW_ON_ERROR));

        return [$pdf, $manifestPath, $manifest, $inspection];
    }

    /** @param array<string, mixed> $inspection @return array<string, mixed> */
    private function extractedManifest(array $inspection): array
    {
        $pages = [];
        for ($page = 1; $page <= 612; $page++) {
            $pages[] = [
                'pdf_page' => $page,
                'printed_page_label' => match ($page) { 72 => '16.1-16', 89 => '16.1-33', default => null },
                'kind' => $page < 57 ? 'front_matter' : 'normative',
            ];
        }

        return [
            'schema_version' => 2,
            'edition_code' => 'AISC360-10',
            'source_sha256' => $inspection['source_sha256'],
            'pdf_page_count' => 612,
            'document_type' => 'specification',
            'metadata' => $inspection['metadata'],
            'source_identity' => $inspection['source_identity'],
            'pages' => $pages,
            'boundaries' => ['main_text_pdf_page' => 57],
            'report' => ['native_bookmarks' => 1, 'indexed_headings' => 1],
            'clauses' => [[
                'code' => 'E3',
                'title' => 'Flexural Buckling of Members without Slender Elements',
                'kind' => 'normative',
                'pdf_page' => 89,
                'printed_page_label' => '16.1-33',
                'parent_code' => 'E',
                'level' => 1,
                'source_anchor' => ['source_type' => 'bookmark', 'code' => 'E3', 'pdf_page' => 89],
                'extraction_method' => 'pdf_outline',
            ]],
            'equation_candidates' => [[
                'label' => 'E3-1',
                'clause_code' => 'E3',
                'kind' => 'normative',
                'pdf_page' => 89,
                'printed_page_label' => '16.1-33',
                'source_anchor' => ['source_type' => 'equation_label', 'label' => 'E3-1', 'pdf_page' => 89],
                'extraction_method' => 'text_identifier',
            ]],
            'table_candidates' => [[
                'label' => 'B4.1a',
                'kind' => 'normative',
                'pdf_page' => 72,
                'printed_page_label' => '16.1-16',
                'source_anchor' => ['page' => 72],
                'extraction_method' => 'pdf_table_identifier',
                'rows' => [],
                'columns' => [],
                'footnotes' => [],
                'merged_cells' => [],
                'limitations' => ['Table cells have not been transcribed.'],
            ]],
        ];
    }

    /** @param array<string, mixed> $inspection @param array<string, mixed> $extracted */
    private function mockInspector(array $inspection, array $extracted, int $calls): void
    {
        $mock = Mockery::mock(StandardPdfInspector::class);
        if ($calls > 0) {
            $mock->shouldReceive('inspect')->times($calls)->andReturn($inspection);
            $mock->shouldReceive('extract')->times($calls)->andReturn($extracted);
        } else {
            $mock->shouldReceive('inspect')->once()->andReturn($inspection);
            $mock->shouldNotReceive('extract');
        }
        $this->app->instance(StandardPdfInspector::class, $mock);
    }

    private function decodeJson(mixed $value): mixed
    {
        return is_string($value) ? json_decode($value, true, 512, JSON_THROW_ON_ERROR) : $value;
    }
}
