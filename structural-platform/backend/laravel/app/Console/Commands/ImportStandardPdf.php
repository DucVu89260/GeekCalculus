<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportStandardPdf extends Command
{
    protected $signature = 'standards:import-pdf {pdf : Local licensed PDF path} {manifest : JSON extracted from that exact PDF}';
    protected $description = 'One-time private AISC 360-10 PDF registration plus database TOC/equation-label indexing';

    public function handle(): int
    {
        $pdf = $this->argument('pdf');
        $manifestPath = $this->argument('manifest');
        if (!is_file($pdf) || !is_readable($pdf) || !is_file($manifestPath)) {
            $this->error('A readable PDF and its manifest are required.');
            return self::FAILURE;
        }

        try {
            $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            $sha = hash_file('sha256', $pdf);
            if (($manifest['edition_code'] ?? '') !== 'AISC360-10'
                || !hash_equals((string) ($manifest['source_sha256'] ?? ''), $sha)
                || !is_int($manifest['pdf_page_count'] ?? null)
                || ($manifest['pdf_page_count'] ?? 0) < 100) {
                throw new \RuntimeException('Source PDF and extracted JSON do not match; refusing to import.');
            }
            $stream = fopen($pdf, 'rb');
            $signature = fread($stream, 5);
            fclose($stream);
            if ($signature !== '%PDF-') {
                throw new \RuntimeException('Source file is not a PDF.');
            }
            $edition = DB::table('standard_editions')->where('code', 'AISC360-10')->first();
            if (!$edition) throw new \RuntimeException('Run migrations and StandardsSeeder first.');

            $relative = 'private/standards/AISC360-10/'.$sha.'.pdf';
            $disk = Storage::disk('local');
            $createdFile = false;
            if (!$disk->exists($relative)) {
                $source = fopen($pdf, 'rb');
                try {
                    if (!$disk->put($relative, $source)) {
                        throw new \RuntimeException('Unable to save licensed PDF into private storage.');
                    }
                    $createdFile = true;
                } finally {
                    fclose($source);
                }
            }

            try {
                DB::transaction(function () use ($edition, $sha, $manifest, $relative, $pdf, $manifestPath) {
                    // One document registration is authoritative for this exact source hash.
                    DB::table('standard_documents')->updateOrInsert(
                        ['edition_id' => $edition->id, 'sha256' => $sha],
                        [
                            'kind' => 'specification',
                            'original_name' => basename($pdf),
                            'private_path' => $relative,
                            'page_count' => $manifest['pdf_page_count'],
                            'processing_status' => 'indexed',
                            'updated_at' => now(),
                        ]
                    );
                    $status = Artisan::call('standards:import-outline', ['json' => $manifestPath]);
                    if ($status !== 0) {
                        throw new \RuntimeException('Outline importer failed: '.Artisan::output());
                    }
                    $documentId = DB::table('standard_documents')
                        ->where('edition_id', $edition->id)->where('sha256', $sha)->value('id');

                    // Source anchors must point to the exact imported PDF.
                    DB::table('standard_clauses')->where('edition_id', $edition->id)
                        ->whereNull('document_id')->whereNotNull('pdf_page')
                        ->update(['document_id' => $documentId]);
                });
            } catch (\Throwable $exception) {
                if ($createdFile) $disk->delete($relative);
                throw $exception;
            }
            $this->info('AISC360-10 source imported; re-running with the same PDF is idempotent.');
            $this->info('Source SHA-256: '.$sha);
            $this->info('PDF stored privately. Equation labels remain candidates, not approved design formulas.');
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
