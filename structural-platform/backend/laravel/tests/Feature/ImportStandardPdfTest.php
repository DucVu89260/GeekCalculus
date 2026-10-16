<?php

namespace Tests\Feature;

use Database\Seeders\StandardsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportStandardPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_private_pdf_import_is_idempotent_and_preserves_verified_source(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        $pdf = tempnam(sys_get_temp_dir(), 'aisc-pdf-');
        $json = tempnam(sys_get_temp_dir(), 'aisc-json-');
        file_put_contents($pdf, "%PDF-1.5\nA test fixture; never a licensed publication.");
        $sha = hash_file('sha256', $pdf);
        file_put_contents($json, json_encode([
            'edition_code' => 'AISC360-10',
            'source_sha256' => $sha,
            'pdf_page_count' => 612,
            'bookmarks' => [
                ['code' => 'E3', 'title' => 'E3-Flexural Buckling', 'kind' => 'normative',
                    'pdf_page' => 89, 'parent_code' => null],
            ],
            'equation_candidates' => [
                ['label' => 'E3-1', 'clause_code' => 'E3', 'pdf_page' => 89],
            ],
        ]));
        try {
            $arguments = ['pdf' => $pdf, 'manifest' => $json];
            $this->assertSame(0, Artisan::call('standards:import-pdf', $arguments), Artisan::output());
            $this->assertSame(0, Artisan::call('standards:import-pdf', $arguments), Artisan::output());
            $this->assertDatabaseCount('standard_documents', 1);
            $this->assertDatabaseHas('standard_documents', [
                'sha256' => $sha,
                'processing_status' => 'indexed',
                'page_count' => 612,
            ]);
            $this->assertDatabaseHas('standard_clauses', [
                'code' => 'E3', 'pdf_page' => 89, 'verification_status' => 'index_only'
            ]);
            $this->assertDatabaseHas('standard_equations', [
                'label' => 'E3-1', 'verification_status' => 'candidate'
            ]);
            Storage::disk('local')->assertExists('private/standards/AISC360-10/'.$sha.'.pdf');
        } finally {
            @unlink($pdf);
            @unlink($json);
        }
    }

    public function test_mismatched_pdf_and_manifest_are_rejected(): void
    {
        Storage::fake('local');
        $this->seed(StandardsSeeder::class);
        $pdf = tempnam(sys_get_temp_dir(), 'aisc-pdf-');
        $json = tempnam(sys_get_temp_dir(), 'aisc-json-');
        file_put_contents($pdf, "%PDF-1.5\nFixture");
        file_put_contents($json, json_encode([
            'edition_code' => 'AISC360-10',
            'source_sha256' => str_repeat('a', 64),
            'pdf_page_count' => 612,
            'bookmarks' => [],
        ]));
        try {
            $this->assertSame(1, Artisan::call('standards:import-pdf', ['pdf' => $pdf, 'manifest' => $json]));
            $this->assertDatabaseCount('standard_documents', 0);
        } finally {
            @unlink($pdf);
            @unlink($json);
        }
    }
}
