<?php

namespace App\Console\Commands;

use App\Services\Standards\StandardPdfInspector;
use App\Services\Standards\StandardsReviewDraftImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ImportStandardsReviewDrafts extends Command
{
    protected $signature = 'standards:import-review-drafts {json : Source-transcribed equation, parameter, and table draft JSON}';

    protected $description = 'Import registered-source transcriptions as unapproved review drafts';

    public function handle(StandardPdfInspector $inspector, StandardsReviewDraftImportService $imports): int
    {
        $manifestPath = (string) $this->argument('json');
        if (!is_file($manifestPath) || !is_readable($manifestPath)) {
            $this->error('A readable review draft JSON file is required.');
            return self::FAILURE;
        }

        $temporaryPdf = null;
        try {
            $draft = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($draft)) {
                throw new RuntimeException('Review draft file must contain a JSON object.');
            }
            $editionCode = $draft['edition_code'] ?? null;
            $sourceHash = strtolower((string) ($draft['source_sha256'] ?? ''));
            if (!is_string($editionCode) || !preg_match('/^[a-f0-9]{64}$/', $sourceHash)) {
                throw new RuntimeException('Review draft must identify a configured edition and source SHA-256.');
            }
            $document = DB::table('standard_documents')
                ->join('standard_editions', 'standard_editions.id', '=', 'standard_documents.edition_id')
                ->where('standard_editions.code', $editionCode)
                ->where('standard_documents.sha256', $sourceHash)
                ->select('standard_documents.*')
                ->first();
            if (!$document) {
                throw new RuntimeException('Review drafts require the exact source PDF to be registered first.');
            }

            $disk = Storage::disk((string) config('standards.private_disk', 'local'));
            if (!$document->private_path || !$disk->exists($document->private_path)) {
                throw new RuntimeException('Registered private source PDF is missing.');
            }
            $temporaryPdf = tempnam(sys_get_temp_dir(), 'standards-review-');
            if ($temporaryPdf === false) {
                throw new RuntimeException('Unable to create a temporary source file for inspection.');
            }
            $source = $disk->readStream($document->private_path);
            $target = fopen($temporaryPdf, 'wb');
            if (!is_resource($source) || !is_resource($target)) {
                if (is_resource($source)) { fclose($source); }
                if (is_resource($target)) { fclose($target); }
                throw new RuntimeException('Unable to read registered private source PDF.');
            }
            try {
                if (stream_copy_to_stream($source, $target) === false) {
                    throw new RuntimeException('Unable to copy registered source PDF for inspection.');
                }
            } finally {
                fclose($source);
                fclose($target);
            }

            $inspection = $inspector->inspect($temporaryPdf, $editionCode);
            if (!hash_equals($sourceHash, strtolower((string) ($inspection['source_sha256'] ?? ''))) ||
                (int) ($inspection['pdf_page_count'] ?? 0) !== (int) $document->page_count) {
                throw new RuntimeException('Registered private PDF failed actual source hash or physical page-count inspection.');
            }

            $report = $imports->import($draft, $inspection);
            $this->line(json_encode(['status' => 'needs_review', 'report' => $report], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        } finally {
            if (is_string($temporaryPdf)) {
                @unlink($temporaryPdf);
            }
        }
    }
}
