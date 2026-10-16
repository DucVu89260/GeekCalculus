<?php

namespace App\Console\Commands;

use App\Services\Standards\StandardPdfInspector;
use App\Services\Standards\StandardsImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportStandardPdf extends Command
{
    protected $signature = 'standards:import-pdf
        {pdf : Licensed PDF available to the backend}
        {manifest : Version 2 extraction manifest generated from this PDF}
        {--edition= : Optional edition code to cross-check the manifest}
        {--revision= : Optional publisher revision identifier}
        {--kind= : Optional document type override}';

    protected $description = 'Inspect, privately register, and index a standards PDF with source provenance';

    public function handle(StandardPdfInspector $inspector, StandardsImportService $imports): int
    {
        $pdfPath = (string) $this->argument('pdf');
        $manifestPath = (string) $this->argument('manifest');
        if (!is_file($pdfPath) || !is_readable($pdfPath) || !is_file($manifestPath) || !is_readable($manifestPath)) {
            $this->error('A readable source PDF and its extraction manifest are required.');
            return self::FAILURE;
        }

        try {
            $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest)) {
                throw new RuntimeException('Extraction manifest must contain a JSON object.');
            }
            $editionCode = (string) ($this->option('edition') ?: ($manifest['edition_code'] ?? ''));
            if ($editionCode === '' || $editionCode !== ($manifest['edition_code'] ?? null)) {
                throw new RuntimeException('Requested edition does not match the extraction manifest.');
            }

            $inspection = $inspector->inspect($pdfPath, $editionCode);
            $this->validateInspection($inspection, $manifest, $editionCode);

            if (($manifest['schema_version'] ?? 1) < 2) {
                $document = DB::table('standard_documents')
                    ->join('standard_editions', 'standard_editions.id', '=', 'standard_documents.edition_id')
                    ->where('standard_editions.code', $editionCode)
                    ->where('standard_documents.sha256', $inspection['source_sha256'])
                    ->select('standard_documents.*')
                    ->first();
                if (!$document || !in_array($document->verification_status, ['verified', 'published'], true)) {
                    throw new RuntimeException('Legacy manifests are accepted only for an already verified registered document.');
                }
            }

            // Re-extract from the inspected source so a detached or edited outline cannot supply page anchors.
            $extractedManifest = $inspector->extract($pdfPath, $editionCode);
            $this->validateInspection($inspection, $extractedManifest, $editionCode);
            $extractedManifest['original_filename'] = basename($pdfPath);
            $report = $imports->import(
                $pdfPath,
                $extractedManifest,
                $inspection,
                $this->option('revision') ?: null,
                $this->option('kind') ?: null,
            );

            $this->line(json_encode(['status' => 'indexed', 'report' => $report], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }

    /** @param array<string, mixed> $inspection @param array<string, mixed> $manifest */
    private function validateInspection(array $inspection, array $manifest, string $editionCode): void
    {
        if (($inspection['edition_code'] ?? null) !== $editionCode ||
            !is_string($inspection['source_sha256'] ?? null) ||
            !preg_match('/^[a-f0-9]{64}$/', strtolower($inspection['source_sha256'])) ||
            !is_int($inspection['pdf_page_count'] ?? null) || $inspection['pdf_page_count'] < 1) {
            throw new RuntimeException('Actual PDF inspection returned incomplete or inconsistent identity data.');
        }
        if (!hash_equals(strtolower((string) ($manifest['source_sha256'] ?? '')), strtolower($inspection['source_sha256'])) ||
            ($manifest['pdf_page_count'] ?? null) !== $inspection['pdf_page_count']) {
            throw new RuntimeException('Manifest SHA-256 or page count does not match inspection of the actual PDF.');
        }
    }
}
