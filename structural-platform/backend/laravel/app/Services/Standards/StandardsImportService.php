<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class StandardsImportService
{
    private const CLAUSE_KINDS = ['normative', 'commentary', 'front_matter', 'symbols', 'glossary', 'appendix'];

    /**
     * Register a source already inspected from its actual PDF, then import only index candidates.
     * Reviewed and published records are immutable to this path.
     *
     * @param array<string, mixed> $manifest
     * @param array<string, mixed> $inspection
     * @return array<string, mixed>
     */
    public function import(string $pdfPath, array $manifest, array $inspection, ?string $revision = null, ?string $documentType = null): array
    {
        $identity = $this->validateManifest($manifest, $inspection, $documentType);
        $identity['original_name'] = $manifest['original_filename'] ?? basename($pdfPath);
        $edition = DB::table('standard_editions')->where('code', $identity['edition_code'])->first();
        if (!$edition) {
            throw new RuntimeException('Run migrations and StandardsSeeder before importing a standard.');
        }

        $sourceHash = $identity['source_sha256'];
        $kind = $identity['document_type'];
        $disk = Storage::disk((string) config('standards.private_disk', 'local'));
        $priorDocument = DB::table('standard_documents')
            ->where('edition_id', $edition->id)
            ->where('sha256', $sourceHash)
            ->first();
        if ($priorDocument && $priorDocument->kind !== $kind) {
            throw new RuntimeException('This source hash is already registered under a different document type.');
        }
        if ($priorDocument && $revision && $priorDocument->revision && $priorDocument->revision !== $revision) {
            throw new RuntimeException('The same source hash cannot be registered as a different document revision.');
        }

        $relativePath = $priorDocument?->private_path ?: 'standards/'.$identity['edition_code'].'/'.$sourceHash.'.pdf';
        $createdFile = false;
        if ($disk->exists($relativePath)) {
            if (!hash_equals($sourceHash, $this->hashStoredFile($disk->readStream($relativePath)))) {
                throw new RuntimeException('A file already exists at the registered private path but its SHA-256 does not match.');
            }
        } else {
            $source = fopen($pdfPath, 'rb');
            if ($source === false) {
                throw new RuntimeException('Unable to read the source PDF.');
            }
            try {
                if (!$disk->put($relativePath, $source)) {
                    throw new RuntimeException('Unable to save the source PDF to private storage.');
                }
                $createdFile = true;
            } catch (\Throwable $exception) {
                // Some remote adapters can leave a partial object when put() fails.
                $disk->delete($relativePath);
                throw $exception;
            } finally {
                fclose($source);
            }
            if (!hash_equals($sourceHash, $this->hashStoredFile($disk->readStream($relativePath)))) {
                $disk->delete($relativePath);
                throw new RuntimeException('Stored source PDF failed its SHA-256 check.');
            }
        }

        $manifestHash = hash('sha256', json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        try {
            $report = DB::transaction(function () use (
                $edition, $manifest, $identity, $revision, $kind, $relativePath, $manifestHash
            ) {
                // Serialize imports of the same edition on databases that support row locks.
                DB::table('standard_editions')->where('id', $edition->id)->lockForUpdate()->first();

                $now = now();
                $document = DB::table('standard_documents')
                    ->where('edition_id', $edition->id)
                    ->where('sha256', $identity['source_sha256'])
                    ->first();
                if (!$document) {
                    $documentId = DB::table('standard_documents')->insertGetId([
                        'edition_id' => $edition->id,
                        'kind' => $kind,
                        'original_name' => basename($identity['original_name']),
                        'private_path' => $relativePath,
                        'sha256' => $identity['source_sha256'],
                        'page_count' => $identity['pdf_page_count'],
                        'processing_status' => 'processing',
                        'revision' => $revision ?? $manifest['revision'] ?? null,
                        'metadata' => json_encode($identity['metadata'], JSON_THROW_ON_ERROR),
                        'source_identity' => json_encode($identity['source_identity'], JSON_THROW_ON_ERROR),
                        'verification_status' => 'candidate',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $document = DB::table('standard_documents')->where('id', $documentId)->first();
                } else {
                    $canCompletePendingDocument = $document->page_count === null &&
                        in_array($document->verification_status, ['candidate', 'needs_review'], true) &&
                        in_array($document->processing_status, ['pending', 'processing', 'indexed'], true);
                    if ($document->page_count !== null && (int) $document->page_count !== $identity['pdf_page_count']) {
                        throw new RuntimeException('Registered page count differs from the inspected source PDF.');
                    }
                    if ($document->page_count === null && !$canCompletePendingDocument) {
                        throw new RuntimeException('A reviewed source document cannot be completed from an uninspected upload.');
                    }
                    if (!hash_equals((string) $document->sha256, $identity['source_sha256'])) {
                        throw new RuntimeException('Registered source hash differs from the inspected source PDF.');
                    }
                    if (in_array($document->verification_status, ['candidate', 'needs_review'], true)) {
                        DB::table('standard_documents')->where('id', $document->id)->update([
                            'private_path' => $relativePath,
                            'page_count' => $identity['pdf_page_count'],
                            'processing_status' => 'processing',
                            'revision' => $document->revision ?: ($revision ?? $manifest['revision'] ?? null),
                            'metadata' => json_encode($identity['metadata'], JSON_THROW_ON_ERROR),
                            'source_identity' => json_encode($identity['source_identity'], JSON_THROW_ON_ERROR),
                            'updated_at' => $now,
                        ]);
                    }
                }

                $documentId = (int) $document->id;
                $sourceContext = 'doc:'.$documentId;
                $counts = $this->importClausesAndEquations(
                    $edition->id,
                    $documentId,
                    $sourceContext,
                    $identity['source_sha256'],
                    $identity['pdf_page_count'],
                    $manifest,
                    $now,
                );

                $summary = [
                    'edition_code' => $identity['edition_code'],
                    'document_id' => $documentId,
                    'source_sha256' => $identity['source_sha256'],
                    'pdf_page_count' => $identity['pdf_page_count'],
                    'bookmark_count' => $manifest['bookmark_count'] ?? count($manifest['raw_bookmarks'] ?? []),
                    'native_bookmark_count' => $manifest['report']['native_bookmarks'] ?? count($manifest['raw_bookmarks'] ?? []),
                    'indexed_heading_count' => $manifest['report']['indexed_headings'] ?? $counts['clauses'],
                    'indexed_clause_count' => $counts['clauses'],
                    'source_parts' => $manifest['parts'] ?? $manifest['report']['parts'] ?? [],
                    'boundaries' => $manifest['boundaries'] ?? [],
                    'pages' => $this->validatePages($manifest['pages'] ?? null, $identity['pdf_page_count']),
                    'extraction_report' => $manifest['report'] ?? [],
                    'manifest_sha256' => $manifestHash,
                    'warnings' => $manifest['warnings'] ?? $manifest['report']['warnings'] ?? [],
                    'equation_candidate_count' => $counts['equations'],
                    'table_candidate_count' => $counts['tables'],
                    'parameter_count' => DB::table('standard_parameters')->where('edition_id', $edition->id)->where('document_id', $documentId)->count(),
                    'table_count' => DB::table('standard_tables')->where('edition_id', $edition->id)->where('document_id', $documentId)->count(),
                    'verification_status' => 'candidate',
                ];
                if (in_array($document->verification_status, ['verified', 'published'], true)) {
                    $existingReport = json_decode((string) ($document->import_report ?? ''), true);
                    $existingManifestHash = is_array($existingReport) ? ($existingReport['manifest_sha256'] ?? null) : null;
                    if ($existingManifestHash && !hash_equals((string) $existingManifestHash, $manifestHash)) {
                        throw new RuntimeException('A verified source document cannot be re-indexed from changed extraction output; register a new source revision.');
                    }
                } else {
                    DB::table('standard_documents')->where('id', $documentId)->update([
                        'processing_status' => 'indexed',
                        'imported_at' => $document->imported_at ?? $now,
                        'import_report' => json_encode($summary, JSON_THROW_ON_ERROR),
                        'updated_at' => $now,
                    ]);
                }

                return $summary;
            });
        } catch (\Throwable $exception) {
            if ($createdFile && !DB::table('standard_documents')->where('edition_id', $edition->id)->where('sha256', $sourceHash)->exists()) {
                $disk->delete($relativePath);
            }
            throw $exception;
        }

        app(StandardsRegistryCache::class)->invalidate((int) $edition->id);

        return $report;
    }

    /**
     * Import a detached outline only when it matches an already registered document.
     *
     * @param array<string, mixed> $manifest
     * @return array<string, mixed>
     */
    public function importRegisteredOutline(array $manifest): array
    {
        $editionCode = $manifest['edition_code'] ?? null;
        if (!is_string($editionCode) || !isset(config('standards.editions')[$editionCode])) {
            throw new RuntimeException('The manifest edition is not configured.');
        }
        $edition = DB::table('standard_editions')->where('code', $editionCode)->first();
        if (!$edition) {
            throw new RuntimeException('Run StandardsSeeder before importing an outline.');
        }
        $sourceHash = strtolower((string) ($manifest['source_sha256'] ?? ''));
        if (!preg_match('/^[a-f0-9]{64}$/', $sourceHash)) {
            throw new RuntimeException('Invalid source SHA-256 in outline manifest.');
        }
        $document = DB::table('standard_documents')->where('edition_id', $edition->id)->where('sha256', $sourceHash)->first();
        if (!$document) {
            throw new RuntimeException('Outline import requires a registered source document with the same SHA-256.');
        }
        if (!is_int($manifest['pdf_page_count'] ?? null) || $manifest['pdf_page_count'] !== (int) $document->page_count) {
            throw new RuntimeException('Outline page count does not match the registered source document.');
        }
        if (($manifest['schema_version'] ?? 1) < 2 && !in_array($document->verification_status, ['verified', 'published'], true)) {
            throw new RuntimeException('Legacy outline manifests are accepted only for verified registered documents.');
        }

        $sourceIdentity = $manifest['source_identity'] ?? null;
        $editionConfig = config('standards.editions.'.$editionCode);
        if (!is_array($sourceIdentity) || !($sourceIdentity['validated'] ?? false) ||
            ($sourceIdentity['family'] ?? null) !== ($editionConfig['family_code'] ?? null) ||
            (int) ($sourceIdentity['edition_year'] ?? 0) !== (int) ($editionConfig['edition_year'] ?? 0)) {
            throw new RuntimeException('Outline source identity does not match its configured edition.');
        }

        $manifestHash = hash('sha256', json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $report = DB::transaction(function () use ($edition, $document, $manifest, $sourceHash, $manifestHash) {
            $lockedDocument = DB::table('standard_documents')->where('id', $document->id)->lockForUpdate()->first();
            if (!$lockedDocument || !hash_equals((string) $lockedDocument->sha256, $sourceHash)) {
                throw new RuntimeException('Registered source document changed during outline import.');
            }
            $isProtected = in_array($lockedDocument->verification_status, ['verified', 'published'], true);
            if ($isProtected) {
                $existingReport = json_decode((string) ($lockedDocument->import_report ?? ''), true);
                $existingHash = is_array($existingReport) ? ($existingReport['manifest_sha256'] ?? null) : null;
                if ($existingHash && !hash_equals((string) $existingHash, $manifestHash)) {
                    throw new RuntimeException('A verified source document cannot be re-indexed from changed extraction output; register a new source revision.');
                }
            }
            $counts = $this->importClausesAndEquations(
                $edition->id,
                (int) $lockedDocument->id,
                'doc:'.$lockedDocument->id,
                $sourceHash,
                (int) $lockedDocument->page_count,
                $manifest,
                now(),
            );
            $summary = [
                'edition_code' => $edition->code,
                'document_id' => (int) $lockedDocument->id,
                'source_sha256' => $sourceHash,
                'pdf_page_count' => (int) $lockedDocument->page_count,
                'bookmark_count' => $manifest['bookmark_count'] ?? count($manifest['raw_bookmarks'] ?? []),
                'native_bookmark_count' => $manifest['report']['native_bookmarks'] ?? count($manifest['raw_bookmarks'] ?? []),
                'indexed_heading_count' => $manifest['report']['indexed_headings'] ?? $counts['clauses'],
                'indexed_clause_count' => $counts['clauses'],
                'source_parts' => $manifest['parts'] ?? $manifest['report']['parts'] ?? [],
                'boundaries' => $manifest['boundaries'] ?? [],
                'pages' => $this->validatePages($manifest['pages'] ?? null, (int) $lockedDocument->page_count),
                'extraction_report' => $manifest['report'] ?? [],
                'manifest_sha256' => $manifestHash,
                'equation_candidate_count' => $counts['equations'],
                'table_candidate_count' => $counts['tables'],
                'parameter_count' => DB::table('standard_parameters')->where('edition_id', $edition->id)->where('document_id', $lockedDocument->id)->count(),
                'table_count' => DB::table('standard_tables')->where('edition_id', $edition->id)->where('document_id', $lockedDocument->id)->count(),
                'verification_status' => $lockedDocument->verification_status,
            ];
            if (!$isProtected || !$lockedDocument->import_report) {
                DB::table('standard_documents')->where('id', $lockedDocument->id)->update([
                    'processing_status' => 'indexed',
                    'imported_at' => $lockedDocument->imported_at ?? now(),
                    'import_report' => json_encode($summary, JSON_THROW_ON_ERROR),
                    'updated_at' => now(),
                ]);
            }
            return $summary;
        });
        app(StandardsRegistryCache::class)->invalidate((int) $edition->id);

        return $report;
    }

    /** @param array<string, mixed> $manifest @param array<string, mixed> $inspection @return array<string, mixed> */
    private function validateManifest(array $manifest, array $inspection, ?string $documentType): array
    {
        $editionCode = $manifest['edition_code'] ?? null;
        $editionConfig = is_string($editionCode) ? config('standards.editions.'.$editionCode) : null;
        if (!is_array($editionConfig) || !($editionConfig['ingest_enabled'] ?? false)) {
            throw new RuntimeException('This standards edition is not enabled for ingestion.');
        }
        if (!in_array($manifest['schema_version'] ?? null, [2, '2', '2.0'], true)) {
            throw new RuntimeException('New document imports require a schema version 2 manifest.');
        }

        $manifestHash = strtolower((string) ($manifest['source_sha256'] ?? ''));
        $actualHash = strtolower((string) ($inspection['source_sha256'] ?? ''));
        if (!preg_match('/^[a-f0-9]{64}$/', $manifestHash) || !hash_equals($actualHash, $manifestHash)) {
            throw new RuntimeException('Source PDF and manifest SHA-256 do not match.');
        }
        $pageCount = $manifest['pdf_page_count'] ?? null;
        if (!is_int($pageCount) || $pageCount < 1 || $pageCount !== ($inspection['pdf_page_count'] ?? null)) {
            throw new RuntimeException('Manifest page count does not match inspection of the actual PDF.');
        }
        if (($inspection['edition_code'] ?? null) !== $editionCode) {
            throw new RuntimeException('The inspected PDF edition does not match the manifest edition.');
        }

        $sourceIdentity = $manifest['source_identity'] ?? null;
        $inspectedIdentity = $inspection['source_identity'] ?? null;
        if (!is_array($sourceIdentity) || !is_array($inspectedIdentity) ||
            ($sourceIdentity['validated'] ?? false) !== true ||
            ($sourceIdentity['family'] ?? null) !== $editionConfig['family_code'] ||
            (int) ($sourceIdentity['edition_year'] ?? 0) !== (int) $editionConfig['edition_year'] ||
            ($sourceIdentity['family'] ?? null) !== ($inspectedIdentity['family'] ?? null) ||
            (int) ($sourceIdentity['edition_year'] ?? 0) !== (int) ($inspectedIdentity['edition_year'] ?? 0) ||
            ($inspectedIdentity['validated'] ?? false) !== true) {
            throw new RuntimeException('PDF identity does not match the configured standard family and edition year.');
        }
        if (!is_array($manifest['metadata'] ?? null) || !is_array($inspection['metadata'] ?? null)) {
            throw new RuntimeException('PDF metadata is required in both the extracted manifest and actual inspection.');
        }
        if (isset($inspection['document_type']) && ($manifest['document_type'] ?? null) !== $inspection['document_type']) {
            throw new RuntimeException('Manifest document type does not match the inspected PDF.');
        }
        $kind = $documentType ?? $manifest['document_type'] ?? 'specification';
        if (!in_array($kind, $editionConfig['document_types'] ?? [], true)) {
            throw new RuntimeException('Document type is not enabled for this standards edition.');
        }
        if (isset($manifest['bookmarks']) && !is_array($manifest['bookmarks'])) {
            throw new RuntimeException('Manifest bookmarks must be an array.');
        }
        if (isset($manifest['clauses']) && !is_array($manifest['clauses'])) {
            throw new RuntimeException('Manifest clauses must be an array.');
        }
        if (!isset($manifest['clauses']) && !isset($manifest['bookmarks'])) {
            throw new RuntimeException('Manifest requires clause or bookmark rows.');
        }

        return [
            'edition_code' => $editionCode,
            'source_sha256' => $actualHash,
            'pdf_page_count' => $pageCount,
            'metadata' => $inspection['metadata'],
            'source_identity' => $inspectedIdentity,
            'document_type' => $kind,
            'original_name' => $manifest['original_filename'] ?? basename($inspection['original_name'] ?? 'standard.pdf'),
        ];
    }

    /** @param array<string, mixed> $manifest @return array{clauses:int,equations:int,tables:int} */
    private function importClausesAndEquations(
        int $editionId,
        int $documentId,
        string $sourceContext,
        string $sourceHash,
        int $pageCount,
        array $manifest,
        mixed $now,
    ): array {
        $rows = $manifest['clauses'] ?? $manifest['bookmarks'] ?? [];
        if (!is_array($rows)) {
            throw new RuntimeException('Manifest clause rows are invalid.');
        }
        $clauseIds = [];
        $importedClauses = 0;
        foreach ($rows as $row) {
            $this->validateClauseRow($row, $pageCount);
            $kind = $row['kind'];
            $code = $row['code'];
            $contextKey = $editionId.'|'.$kind.'|'.$code;
            $prior = DB::table('standard_clauses')->where('edition_id', $editionId)
                ->where('kind', $kind)->where('code', $code)->where('source_context', $sourceContext)->first();

            // Attach the first authoritative source to a seeded legacy TOC row instead of duplicating it.
            if (!$prior) {
                $legacy = DB::table('standard_clauses')->where('edition_id', $editionId)
                    ->where('kind', $kind)->where('code', $code)->where('source_context', 'legacy')
                    ->whereNull('document_id')->first();
                if ($legacy && in_array($legacy->verification_status, ['index_only', 'candidate'], true)) {
                    $prior = $legacy;
                }
            }

            $id = $prior?->id;
            $canIndex = !$prior || in_array($prior->verification_status, ['index_only', 'candidate'], true);
            $attrs = [
                'document_id' => $documentId,
                'source_context' => $sourceContext,
                'source_sha256' => $sourceHash,
                'title' => $row['title'],
                'pdf_page' => $row['pdf_page'],
                'printed_page_label' => $row['printed_page_label'] ?? (isset($row['printed_page']) ? (string) $row['printed_page'] : null),
                'source_anchor' => isset($row['source_anchor']) ? json_encode($row['source_anchor'], JSON_THROW_ON_ERROR) : null,
                'extraction_method' => $row['extraction_method'] ?? 'pdf_outline',
                'level' => $row['level'] ?? null,
                'verification_status' => in_array($row['verification_status'] ?? 'index_only', ['index_only', 'candidate'], true)
                    ? ($row['verification_status'] ?? 'index_only') : 'index_only',
                'updated_at' => $now,
            ];
            if (isset($row['printed_page']) && is_numeric($row['printed_page'])) {
                $attrs['printed_page'] = (int) $row['printed_page'];
            }

            if ($prior && $canIndex) {
                DB::table('standard_clauses')->where('id', $prior->id)->update($attrs);
                $id = $prior->id;
            } elseif (!$prior) {
                $id = DB::table('standard_clauses')->insertGetId($attrs + [
                    'edition_id' => $editionId,
                    'kind' => $kind,
                    'code' => $code,
                    'created_at' => $now,
                ]);
            }
            if ($id) {
                $clauseIds[$contextKey] = (int) $id;
                $clauseIds[$kind.'|'.$code] = (int) $id;
                $importedClauses++;
            }
        }

        foreach ($rows as $row) {
            if (empty($row['parent_code'])) {
                continue;
            }
            $kind = $row['kind'];
            $parentId = $clauseIds[$kind.'|'.$row['parent_code']] ?? null;
            $id = $clauseIds[$kind.'|'.$row['code']] ?? null;
            if ($parentId && $id && $parentId !== $id) {
                DB::table('standard_clauses')->where('id', $id)
                    ->where('document_id', $documentId)
                    ->whereIn('verification_status', ['index_only', 'candidate'])
                    ->update(['parent_id' => $parentId, 'updated_at' => $now]);
            }
        }

        $equations = $manifest['equation_candidates'] ?? [];
        if (!is_array($equations)) {
            throw new RuntimeException('Manifest equation candidates are invalid.');
        }
        $importedEquations = 0;
        foreach ($equations as $equation) {
            $this->validateEquationRow($equation, $pageCount);
            $clauseCode = $equation['clause_code'];
            $kind = $equation['kind'] ?? 'normative';
            $clauseId = $clauseIds[$kind.'|'.$clauseCode] ?? null;
            if (!$clauseId) {
                continue;
            }
            $prior = DB::table('standard_equations')->where('clause_id', $clauseId)
                ->where('label', $equation['label'])->first();
            if ($prior) {
                if (in_array($prior->verification_status, ['candidate', 'index_only'], true)) {
                    DB::table('standard_equations')->where('id', $prior->id)->update([
                        'document_id' => $documentId,
                        'kind' => $kind,
                        'source_context' => $sourceContext,
                        'source_sha256' => $sourceHash,
                        'pdf_page' => $equation['pdf_page'],
                        'printed_page_label' => $equation['printed_page_label'] ?? null,
                        'source_anchor' => isset($equation['source_anchor']) ? json_encode($equation['source_anchor'], JSON_THROW_ON_ERROR) : null,
                        'extraction_method' => $equation['extraction_method'] ?? 'text_identifier',
                        'updated_at' => $now,
                    ]);
                }
                $importedEquations++;
                continue;
            }

            DB::table('standard_equations')->insert([
                'clause_id' => $clauseId,
                'document_id' => $documentId,
                'kind' => $kind,
                'source_context' => $sourceContext,
                'source_sha256' => $sourceHash,
                'label' => $equation['label'],
                'pdf_page' => $equation['pdf_page'],
                'printed_page_label' => $equation['printed_page_label'] ?? null,
                'source_anchor' => isset($equation['source_anchor']) ? json_encode($equation['source_anchor'], JSON_THROW_ON_ERROR) : null,
                'extraction_method' => $equation['extraction_method'] ?? 'text_identifier',
                'latex' => null,
                'variables' => null,
                'conditions' => null,
                'verification_status' => 'candidate',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $importedEquations++;
        }

        $tableCandidates = $manifest['table_candidates'] ?? [];
        if (!is_array($tableCandidates)) {
            throw new RuntimeException('Manifest table candidates are invalid.');
        }
        $importedTables = 0;
        foreach ($tableCandidates as $candidate) {
            $this->validateTableCandidate($candidate, $pageCount);
            $kind = $candidate['kind'];
            $label = $candidate['label'];
            $clauseId = null;
            if (is_string($candidate['clause_code'] ?? null)) {
                $clauseId = DB::table('standard_clauses')->where('edition_id', $editionId)
                    ->where('kind', $kind)->where('code', $candidate['clause_code'])
                    ->where(function ($query) use ($documentId, $sourceContext) {
                        $query->where('source_context', $sourceContext)->orWhere('document_id', $documentId);
                    })->value('id');
            }
            $prior = DB::table('standard_tables')->where('edition_id', $editionId)
                ->where('source_context', $sourceContext)->where('kind', $kind)->where('table_code', $label)->first();
            $attributes = [
                'document_id' => $documentId,
                'clause_id' => $clauseId,
                'source_sha256' => $sourceHash,
                'pdf_page' => $candidate['pdf_page'],
                'printed_page_label' => $candidate['printed_page_label'] ?? null,
                'source_anchor' => isset($candidate['source_anchor']) ? json_encode($candidate['source_anchor'], JSON_THROW_ON_ERROR) : null,
                'extraction_method' => $candidate['extraction_method'] ?? 'pdf_table_identifier',
                'columns' => json_encode($candidate['columns'] ?? [], JSON_THROW_ON_ERROR),
                'rows' => json_encode($candidate['rows'] ?? [], JSON_THROW_ON_ERROR),
                'footnotes' => json_encode($candidate['footnotes'] ?? [], JSON_THROW_ON_ERROR),
                'merged_cells' => json_encode($candidate['merged_cells'] ?? [], JSON_THROW_ON_ERROR),
                'source_notes' => isset($candidate['limitations']) && is_array($candidate['limitations']) ? implode("\n", $candidate['limitations']) : null,
                'source_metadata' => json_encode($candidate, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'verification_status' => 'candidate',
                'updated_at' => $now,
            ];
            if ($prior) {
                // An outline re-import may refresh only an unreviewed index placeholder.
                if (in_array($prior->verification_status, ['candidate', 'index_only'], true)) {
                    $same = $this->sameRowValues($prior, $attributes);
                    if (!$same) {
                        DB::table('standard_tables')->where('id', $prior->id)->update($attributes);
                    }
                }
                $importedTables++;
                continue;
            }
            $supersedes = DB::table('standard_tables')->where('edition_id', $editionId)
                ->where('kind', $kind)->where('table_code', $label)
                ->whereIn('verification_status', ['verified', 'published'])->orderByDesc('id')->value('id');
            DB::table('standard_tables')->insert($attributes + [
                'edition_id' => $editionId,
                'source_context' => $sourceContext,
                'kind' => $kind,
                'table_code' => $label,
                'title' => $candidate['title'] ?? $label,
                'applicability' => null,
                'coverage' => null,
                'coverage_type' => null,
                'complete_table' => null,
                'design_methods' => json_encode([], JSON_THROW_ON_ERROR),
                'implementation_key' => null,
                'record_version' => 1,
                'supersedes_id' => $supersedes ?: null,
                'created_at' => $now,
            ]);
            $importedTables++;
        }

        return ['clauses' => $importedClauses, 'equations' => $importedEquations, 'tables' => $importedTables];
    }

    private function validateClauseRow(mixed $row, int $pageCount): void
    {
        if (!is_array($row) || !in_array($row['kind'] ?? '', self::CLAUSE_KINDS, true) ||
            !is_string($row['code'] ?? null) || trim($row['code']) === '' || strlen($row['code']) > 100 ||
            !is_string($row['title'] ?? null) || trim($row['title']) === '' || strlen($row['title']) > 255 ||
            !is_int($row['pdf_page'] ?? null) || $row['pdf_page'] < 1 || $row['pdf_page'] > $pageCount ||
            (isset($row['level']) && (!is_int($row['level']) || $row['level'] < 0 || $row['level'] > 255)) ||
            (isset($row['printed_page_label']) && (!is_string($row['printed_page_label']) || strlen($row['printed_page_label']) > 40)) ||
            (isset($row['extraction_method']) && (!is_string($row['extraction_method']) || strlen($row['extraction_method']) > 40)) ||
            (isset($row['source_anchor']) && !is_array($row['source_anchor']))) {
            throw new RuntimeException('Invalid source clause row; import stopped.');
        }
    }

    private function validateEquationRow(mixed $row, int $pageCount): void
    {
        if (!is_array($row) || !is_string($row['label'] ?? null) || trim($row['label']) === '' || strlen($row['label']) > 80 ||
            !is_string($row['clause_code'] ?? null) || trim($row['clause_code']) === '' ||
            !in_array($row['kind'] ?? 'normative', self::CLAUSE_KINDS, true) ||
            !is_int($row['pdf_page'] ?? null) || $row['pdf_page'] < 1 || $row['pdf_page'] > $pageCount ||
            (isset($row['printed_page_label']) && (!is_string($row['printed_page_label']) || strlen($row['printed_page_label']) > 40)) ||
            (isset($row['extraction_method']) && (!is_string($row['extraction_method']) || strlen($row['extraction_method']) > 40)) ||
            (isset($row['source_anchor']) && !is_array($row['source_anchor']))) {
            throw new RuntimeException('Invalid equation candidate row; import stopped.');
        }
    }

    private function validateTableCandidate(mixed $row, int $pageCount): void
    {
        if (!is_array($row) || !is_string($row['label'] ?? null) || trim($row['label']) === '' || strlen($row['label']) > 100 ||
            !in_array($row['kind'] ?? '', self::CLAUSE_KINDS, true) ||
            !is_int($row['pdf_page'] ?? null) || $row['pdf_page'] < 1 || $row['pdf_page'] > $pageCount ||
            (isset($row['printed_page_label']) && (!is_string($row['printed_page_label']) || strlen($row['printed_page_label']) > 40)) ||
            (isset($row['extraction_method']) && (!is_string($row['extraction_method']) || strlen($row['extraction_method']) > 40)) ||
            (isset($row['source_anchor']) && !is_array($row['source_anchor'])) ||
            (isset($row['rows']) && !is_array($row['rows'])) ||
            (isset($row['columns']) && !is_array($row['columns'])) ||
            (isset($row['footnotes']) && !is_array($row['footnotes'])) ||
            (isset($row['merged_cells']) && !is_array($row['merged_cells']))) {
            throw new RuntimeException('Invalid table candidate row; import stopped.');
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function validatePages(mixed $pages, int $pageCount): array
    {
        if ($pages === null) {
            throw new RuntimeException('A source page map is required for schema version 2 imports.');
        }
        if (!is_array($pages) || count($pages) !== $pageCount) {
            throw new RuntimeException('The manifest page map must cover every physical PDF page exactly once.');
        }
        $normalized = [];
        foreach ($pages as $page) {
            if (!is_array($page) || !is_int($page['pdf_page'] ?? null) || $page['pdf_page'] < 1 || $page['pdf_page'] > $pageCount ||
                !in_array($page['kind'] ?? '', self::CLAUSE_KINDS, true) ||
                (isset($page['printed_page_label']) && (!is_string($page['printed_page_label']) || strlen($page['printed_page_label']) > 40))) {
                throw new RuntimeException('Invalid physical page map entry.');
            }
            $key = $page['pdf_page'];
            if (isset($normalized[$key])) {
                throw new RuntimeException('The manifest page map contains duplicate physical pages.');
            }
            $normalized[$key] = [
                'pdf_page' => $key,
                'printed_page_label' => $page['printed_page_label'] ?? null,
                'kind' => $page['kind'],
            ];
        }
        ksort($normalized);
        if (array_keys($normalized) !== range(1, $pageCount)) {
            throw new RuntimeException('The manifest page map omits physical pages.');
        }
        return array_values($normalized);
    }

    private function sameRowValues(object $prior, array $attributes): bool
    {
        $jsonFields = ['source_anchor', 'columns', 'rows', 'footnotes', 'merged_cells', 'source_metadata', 'applicability', 'coverage', 'design_methods'];
        foreach ($attributes as $field => $value) {
            if ($field === 'updated_at') {
                continue;
            }
            $current = $prior->{$field} ?? null;
            if (in_array($field, $jsonFields, true)) {
                if ($this->normalizeJson($this->decodeJson($current)) !== $this->normalizeJson($this->decodeJson($value))) {
                    return false;
                }
            } elseif ($field === 'complete_table') {
                if ($current === null ? $value !== null : (bool) $current !== (bool) $value) {
                    return false;
                }
            } elseif ((string) $current !== (string) $value) {
                return false;
            }
        }
        return true;
    }

    private function decodeJson(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }
        try {
            return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return $value;
        }
    }

    private function normalizeJson(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value);
        }
        foreach ($value as $key => $item) {
            $value[$key] = $this->normalizeJson($item);
        }
        return $value;
    }

    /** @param resource|false $stream */
    private function hashStoredFile($stream): string
    {
        if (!is_resource($stream)) {
            throw new RuntimeException('Unable to read the stored standards document.');
        }
        $context = hash_init('sha256');
        hash_update_stream($context, $stream);
        fclose($stream);

        return hash_final($context);
    }
}
