<?php

namespace App\Console\Commands;

use App\Services\StandardsOutlineImporter;
use App\Services\Standards\StandardPdfInspector;
use App\Services\Standards\StandardsImportService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

            // Shared manifests index registered editions only. The AISC v2 path
            // additionally inspects actual bytes/edition/pages before review metadata.
            if ($editionCode !== 'AISC360-10' || ($manifest['schema_version'] ?? 1) < 2) {
                return $this->importIndexOnlyPdf(app(StandardsOutlineImporter::class));
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

    private function importIndexOnlyPdf(StandardsOutlineImporter $importer): int
    {
        $created = false; $relative = null;
        $disk = Storage::disk('local');
        try {
            $manifest = $importer->read($this->argument('manifest'));
            $pdf = $this->argument('pdf');
            if (!is_file($pdf) || !is_readable($pdf)
                || file_get_contents($pdf,false,null,0,5) !== '%PDF-'
                || !hash_equals($manifest['source_sha256'],hash_file('sha256',$pdf))) {
                throw new \RuntimeException('Source PDF and JSON do not match; refusing to import.');
            }
            $edition = $manifest['edition'];
            $prior = DB::table('standard_documents')->where('edition_id',$edition->id)->where('sha256',$manifest['source_sha256'])->first();
            if ($prior && $prior->page_count !== null && $prior->page_count !== $manifest['pages']) {
                throw new \RuntimeException('Page count conflicts with existing source document.');
            }
            $relative = $prior->private_path ?? 'private/standards/'.$edition->code.'/'.$manifest['source_sha256'].'.pdf';
            if ($disk->exists($relative)) {
                if (!hash_equals($manifest['source_sha256'],hash_file('sha256',$disk->path($relative)))) {
                    throw new \RuntimeException('Existing private PDF differs; refusing to overwrite.');
                }
            } else {
                $stream = fopen($pdf,'rb');
                try {
                    if (!$disk->put($relative,$stream)) throw new \RuntimeException('Unable to store source PDF.');
                    $created = true;
                } finally { fclose($stream); }
            }
            DB::transaction(function () use ($importer,$manifest,$edition,$pdf,$prior,$relative) {
                // Existing corpus metadata, path and review progress remain authoritative.
                $docId = $prior->id ?? DB::table('standard_documents')->insertGetId([
                    'edition_id'=>$edition->id, 'sha256'=>$manifest['source_sha256'],
                    'kind'=>'specification', 'original_name'=>basename($pdf), 'private_path'=>$relative,
                    'page_count'=>$manifest['pages'], 'processing_status'=>'indexed', 'created_at'=>now(), 'updated_at'=>now(),
                ]);
                $importer->import($manifest,$docId);
            });
            $this->info($edition->code.': private PDF and '.count($manifest['clauses']).' outline entries imported. Reimport is idempotent.');
            $this->info('Source SHA-256: '.$manifest['source_sha256']);
            $this->info('No formula transcription or approval. Optional equation labels remain candidates.');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            if ($created && $relative) $disk->delete($relative);
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
