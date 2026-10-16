<?php

namespace App\Console\Commands;

use App\Services\Standards\StandardsImportService;
use App\Services\Standards\StandardPdfInspector;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ImportStandardsOutline extends Command
{
    protected $signature = 'standards:import-outline {json : Path to a manifest whose source document is already registered}';

    protected $description = 'Import an outline only when it matches a registered source document and page count';

    public function handle(StandardsImportService $imports, StandardPdfInspector $inspector): int
    {
        $file = (string) $this->argument('json');
        if (!is_file($file) || !is_readable($file)) {
            $this->error('A readable JSON manifest is required.');
            return self::FAILURE;
        }

        try {
            $manifest = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest)) {
                throw new RuntimeException('Manifest must contain a JSON object.');
            }
            $editionCode = $manifest['edition_code'] ?? null;
            $sourceHash = strtolower((string) ($manifest['source_sha256'] ?? ''));
            if (!is_string($editionCode) || !preg_match('/^[a-f0-9]{64}$/', $sourceHash)) {
                throw new RuntimeException('Outline must identify a configured edition and source SHA-256.');
            }
            $document = DB::table('standard_documents')
                ->join('standard_editions', 'standard_editions.id', '=', 'standard_documents.edition_id')
                ->where('standard_editions.code', $editionCode)
                ->where('standard_documents.sha256', $sourceHash)
                ->select('standard_documents.*')
                ->first();
            if (!$document) {
                throw new RuntimeException('Outline import requires a registered source document with the same SHA-256.');
            }
            if (($manifest['schema_version'] ?? 1) < 2 && !in_array($document->verification_status, ['verified', 'published'], true)) {
                throw new RuntimeException('Legacy outline manifests are accepted only for verified registered documents.');
            }
            if (!is_int($manifest['pdf_page_count'] ?? null) || $manifest['pdf_page_count'] !== (int) $document->page_count) {
                throw new RuntimeException('Outline page count does not match the registered source document.');
            }

            $disk = Storage::disk((string) config('standards.private_disk', 'local'));
            if (!$disk->exists($document->private_path)) {
                throw new RuntimeException('Registered private source PDF is missing.');
            }
            $temporaryPdf = tempnam(sys_get_temp_dir(), 'standards-source-');
            if ($temporaryPdf === false) {
                throw new RuntimeException('Unable to create a temporary source file for inspection.');
            }
            try {
                $source = $disk->readStream($document->private_path);
                $target = fopen($temporaryPdf, 'wb');
                if (!is_resource($source) || !is_resource($target)) {
                    throw new RuntimeException('Unable to read the registered private source PDF.');
                }
                stream_copy_to_stream($source, $target);
                fclose($source);
                fclose($target);

                $inspection = $inspector->inspect($temporaryPdf, $editionCode);
                if (!hash_equals($sourceHash, strtolower((string) ($inspection['source_sha256'] ?? ''))) ||
                    (int) ($inspection['pdf_page_count'] ?? 0) !== (int) $document->page_count) {
                    throw new RuntimeException('Registered PDF failed its source SHA-256 or page-count check.');
                }
                $actualManifest = $inspector->extract($temporaryPdf, $editionCode);
                if (!hash_equals($sourceHash, strtolower((string) ($actualManifest['source_sha256'] ?? ''))) ||
                    (int) ($actualManifest['pdf_page_count'] ?? 0) !== (int) $document->page_count) {
                    throw new RuntimeException('Re-extracted outline does not match the registered source document.');
                }
                $report = $imports->importRegisteredOutline($actualManifest);
            } finally {
                @unlink($temporaryPdf);
            }
            $this->line(json_encode(['status' => 'indexed', 'report' => $report], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
