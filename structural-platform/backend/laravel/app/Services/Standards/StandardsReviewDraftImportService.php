<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class StandardsReviewDraftImportService
{
    private const KINDS = ['normative', 'commentary', 'front_matter', 'symbols', 'glossary', 'appendix'];
    private const METHODS = ['ASD', 'LRFD'];

    /**
     * Import source-transcribed records as review drafts. This path can never approve a record.
     *
     * @param array<string, mixed> $draft
     * @param array<string, mixed> $inspection
     * @return array<string, mixed>
     */
    public function import(array $draft, array $inspection): array
    {
        $identity = $this->validateDocumentIdentity($draft, $inspection);
        $edition = DB::table('standard_editions')->where('code', $identity['edition_code'])->first();
        if (!$edition) {
            throw new RuntimeException('Run migrations and StandardsSeeder before importing review drafts.');
        }
        $document = DB::table('standard_documents')
            ->where('edition_id', $edition->id)
            ->where('sha256', $identity['source_sha256'])
            ->first();
        if (!$document) {
            throw new RuntimeException('Review drafts require the exact source PDF to be registered first.');
        }

        $draftHash = hash('sha256', json_encode($draft, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $report = DB::transaction(function () use ($draft, $identity, $edition, $document, $draftHash) {
            DB::table('standard_editions')->where('id', $edition->id)->lockForUpdate()->first();
            $lockedDocument = DB::table('standard_documents')->where('id', $document->id)->lockForUpdate()->first();
            if (!$lockedDocument || !hash_equals((string) $lockedDocument->sha256, $identity['source_sha256']) ||
                (int) $lockedDocument->page_count !== $identity['pdf_page_count']) {
                throw new RuntimeException('Registered source document identity changed during draft import.');
            }
            if ($lockedDocument->processing_status !== 'indexed') {
                throw new RuntimeException('Import the inspected PDF outline before importing review drafts.');
            }
            if (!in_array($lockedDocument->verification_status, ['candidate', 'needs_review', 'index_only'], true)) {
                throw new RuntimeException('A verified, published, or deprecated source document is immutable; register a new source revision for additional transcriptions.');
            }

            $context = 'doc:'.$lockedDocument->id;
            $now = now();
            $counts = ['equations' => 0, 'parameters' => 0, 'tables' => 0, 'updated' => 0, 'unchanged' => 0];
            foreach ($draft['equations'] as $record) {
                $this->validateEquation($record, $identity['pdf_page_count']);
                $clause = $this->findClause((int) $edition->id, (int) $lockedDocument->id, $context, $record);
                $methods = $this->methods($record['design_methods'] ?? []);
                $attrs = [
                    'clause_id' => (int) $clause->id,
                    'document_id' => (int) $lockedDocument->id,
                    'kind' => $record['kind'] ?? 'normative',
                    'source_context' => $context,
                    'source_sha256' => $identity['source_sha256'],
                    'label' => $record['label'],
                    'pdf_page' => $record['pdf_page'],
                    'printed_page_label' => $record['printed_page_label'] ?? null,
                    'source_anchor' => $this->json($record['source_anchor']),
                    'extraction_method' => 'source_audit_draft',
                    'design_method' => $this->methodValue($methods),
                    'latex' => $record['latex'],
                    'variables' => $this->json($record['variables']),
                    'conditions' => $this->json($record['conditions']),
                    'dependencies' => $this->json($record['dependencies'] ?? []),
                    'implementation_key' => $record['implementation_key'] ?? null,
                    'source_notes' => $record['notes'] ?? null,
                    'source_metadata' => $this->json($record),
                    'verification_status' => 'needs_review',
                    'updated_at' => $now,
                ];
                $prior = DB::table('standard_equations')->where('clause_id', $clause->id)->where('label', $record['label'])->first();
                $id = $this->upsertDraft('equations', $prior, $attrs, $edition->id, $lockedDocument->id, $now, $counts);
                $counts['equations']++;
            }

            foreach ($draft['parameters'] as $record) {
                $this->validateParameter($record, $identity['pdf_page_count']);
                $clause = $this->findClause((int) $edition->id, (int) $lockedDocument->id, $context, $record);
                $methods = $this->methods($record['design_methods'] ?? []);
                $attrs = [
                    'edition_id' => (int) $edition->id,
                    'document_id' => (int) $lockedDocument->id,
                    'clause_id' => (int) $clause->id,
                    'source_context' => $context,
                    'source_sha256' => $identity['source_sha256'],
                    'kind' => $record['kind'] ?? 'normative',
                    'parameter_key' => $record['parameter_key'],
                    'label' => $record['label'] ?? $record['parameter_key'],
                    'data_type' => $record['data_type'],
                    'value' => $this->json($record['value']),
                    'units' => $record['unit'] ?? null,
                    'dimensions' => $this->json([
                        'symbol' => $record['symbol'] ?? null,
                        'dimension' => $record['dimension'] ?? null,
                    ]),
                    'conditions' => $this->json($record['conditions']),
                    'design_method' => $this->methodValue($methods),
                    'pdf_page' => $record['pdf_page'],
                    'printed_page_label' => $record['printed_page_label'] ?? null,
                    'source_anchor' => $this->json($record['source_anchor']),
                    'extraction_method' => 'source_audit_draft',
                    'verification_status' => 'needs_review',
                    'implementation_key' => $record['implementation_key'] ?? null,
                    'source_notes' => $record['notes'] ?? null,
                    'source_metadata' => $this->json($record),
                    'updated_at' => $now,
                ];
                $prior = DB::table('standard_parameters')->where('edition_id', $edition->id)
                    ->where('source_context', $context)->where('kind', $record['kind'] ?? 'normative')
                    ->where('parameter_key', $record['parameter_key'])->first();
                $id = $this->upsertDraft('parameters', $prior, $attrs, $edition->id, $lockedDocument->id, $now, $counts);
                $counts['parameters']++;
            }

            foreach ($draft['tables'] as $record) {
                $this->validateTable($record, $identity['pdf_page_count']);
                $clause = $this->findClauseOrNull((int) $edition->id, (int) $lockedDocument->id, $context, $record);
                $methods = $this->methods($record['design_methods'] ?? []);
                $applicability = [
                    'description' => $record['applicability'] ?? $record['use'] ?? null,
                    'coverage_type' => $record['coverage_type'] ?? null,
                    'complete_table' => $record['complete_table'] ?? null,
                    'source_example_diagrams_included' => $record['source_example_diagrams_included'] ?? null,
                ];
                $attrs = [
                    'edition_id' => (int) $edition->id,
                    'document_id' => (int) $lockedDocument->id,
                    'clause_id' => $clause,
                    'source_context' => $context,
                    'source_sha256' => $identity['source_sha256'],
                    'kind' => $record['kind'] ?? 'normative',
                    'table_code' => $record['id'],
                    'title' => $record['title'] ?? $record['label'] ?? $record['id'],
                    'columns' => $this->json($record['columns']),
                    'rows' => $this->json($record['rows']),
                    'footnotes' => $this->json($record['footnotes'] ?? []),
                    'applicability' => $this->json($applicability),
                    'merged_cells' => $this->json($record['merged_cells'] ?? []),
                    'coverage' => $this->json($record['coverage'] ?? []),
                    'coverage_type' => $record['coverage_type'] ?? null,
                    'complete_table' => isset($record['complete_table']) ? (bool) $record['complete_table'] : null,
                    'design_methods' => $this->json($methods),
                    'pdf_page' => $record['pdf_page'],
                    'printed_page_label' => $record['printed_page_label'] ?? null,
                    'source_anchor' => $this->json($record['source_anchor']),
                    'extraction_method' => 'source_audit_draft',
                    'verification_status' => 'needs_review',
                    'implementation_key' => $record['implementation_key'] ?? null,
                    'source_notes' => $record['notes'] ?? null,
                    'source_metadata' => $this->json($record),
                    'updated_at' => $now,
                ];
                $prior = DB::table('standard_tables')->where('edition_id', $edition->id)
                    ->where('source_context', $context)->where('kind', $record['kind'] ?? 'normative')
                    ->where('table_code', $record['id'])->first();
                $id = $this->upsertDraft('tables', $prior, $attrs, $edition->id, $lockedDocument->id, $now, $counts);
                $counts['tables']++;
            }

            $report = $this->decode($lockedDocument->import_report) ?: [];
            $drafts = $report['review_drafts'] ?? [];
            if (!isset($drafts[$draftHash])) {
                $draftSummary = [
                    'draft_sha256' => $draftHash,
                    'source_sha256' => $identity['source_sha256'],
                    'equations' => $counts['equations'],
                    'parameters' => $counts['parameters'],
                    'tables' => $counts['tables'],
                    'updated' => $counts['updated'],
                    'unchanged' => $counts['unchanged'],
                    'verification_status' => 'needs_review',
                ];
                $drafts[$draftHash] = $draftSummary;
                $report['review_drafts'] = $drafts;
                DB::table('standard_documents')->where('id', $lockedDocument->id)->update([
                    'import_report' => $this->json($report),
                    'updated_at' => $now,
                ]);
                $this->history((int) $edition->id, (int) $lockedDocument->id, 'documents', (int) $lockedDocument->id,
                    $lockedDocument->verification_status, $lockedDocument->verification_status,
                    'Imported source review draft. Records remain unapproved.', $draftSummary);
            }

            return [
                'edition_code' => $identity['edition_code'],
                'document_id' => (int) $lockedDocument->id,
                'source_sha256' => $identity['source_sha256'],
                'draft_sha256' => $draftHash,
                'verification_status' => 'needs_review',
                'counts' => $counts,
            ];
        });

        app(StandardsRegistryCache::class)->invalidate((int) $edition->id);
        return $report;
    }

    /** @param array<string, mixed> $draft @param array<string, mixed> $inspection @return array<string, mixed> */
    private function validateDocumentIdentity(array $draft, array $inspection): array
    {
        $editionCode = $draft['edition_code'] ?? null;
        $editionConfig = is_string($editionCode) ? config('standards.editions.'.$editionCode) : null;
        if (!is_array($editionConfig) || !($editionConfig['ingest_enabled'] ?? false)) {
            throw new RuntimeException('Review drafts are not enabled for this edition.');
        }
        if (($draft['schema_version'] ?? null) !== 1 || !preg_match('/^[a-f0-9]{64}$/i', (string) ($draft['source_sha256'] ?? ''))) {
            throw new RuntimeException('Review draft manifest schema or source hash is invalid.');
        }
        $sourceHash = strtolower((string) $draft['source_sha256']);
        if (!hash_equals($sourceHash, strtolower((string) ($inspection['source_sha256'] ?? ''))) ||
            ($inspection['edition_code'] ?? null) !== $editionCode ||
            !is_int($inspection['pdf_page_count'] ?? null) || $inspection['pdf_page_count'] < 1) {
            throw new RuntimeException('Review draft source SHA-256, edition, or physical page count does not match actual PDF inspection.');
        }
        $sourceIdentity = $inspection['source_identity'] ?? null;
        if (!is_array($sourceIdentity) || ($sourceIdentity['validated'] ?? false) !== true ||
            ($sourceIdentity['family'] ?? null) !== $editionConfig['family_code'] ||
            (int) ($sourceIdentity['edition_year'] ?? 0) !== (int) $editionConfig['edition_year']) {
            throw new RuntimeException('Actual source PDF identity does not match the configured edition.');
        }
        $draftIdentity = $draft['source_identity'] ?? [];
        if (is_array($draftIdentity)) {
            if (isset($draftIdentity['sha256']) && !hash_equals($sourceHash, strtolower((string) $draftIdentity['sha256']))) {
                throw new RuntimeException('Review draft identity hash differs from the registered source.');
            }
            if (isset($draftIdentity['physical_page_count']) && (int) $draftIdentity['physical_page_count'] !== $inspection['pdf_page_count']) {
                throw new RuntimeException('Review draft physical page count differs from actual PDF inspection.');
            }
        }
        foreach (['equations', 'parameters', 'tables'] as $key) {
            if (!is_array($draft[$key] ?? null)) {
                throw new RuntimeException("Review draft {$key} must be an array.");
            }
        }

        return [
            'edition_code' => $editionCode,
            'source_sha256' => $sourceHash,
            'pdf_page_count' => $inspection['pdf_page_count'],
        ];
    }

    private function findClause(int $editionId, int $documentId, string $context, array $record): object
    {
        $clause = DB::table('standard_clauses')->where('edition_id', $editionId)
            ->where('kind', $record['kind'] ?? 'normative')->where('code', $record['clause_code'])
            ->where(function ($query) use ($documentId, $context) {
                $query->where('source_context', $context)->orWhere('document_id', $documentId);
            })->first();
        if (!$clause) {
            throw new RuntimeException('Import the source outline first; a draft clause is not linked to its registered document.');
        }
        return $clause;
    }

    private function findClauseOrNull(int $editionId, int $documentId, string $context, array $record): ?int
    {
        $code = $record['clause_code'] ?? null;
        if (!is_string($code) || $code === '') {
            return null;
        }
        $id = DB::table('standard_clauses')->where('edition_id', $editionId)
            ->where('kind', $record['kind'] ?? 'normative')->where('code', $code)
            ->where(function ($query) use ($documentId, $context) {
                $query->where('source_context', $context)->orWhere('document_id', $documentId);
            })->value('id');
        return $id === null ? null : (int) $id;
    }

    private function validateEquation(mixed $record, int $pageCount): void
    {
        if (!is_array($record) || !$this->identifier($record['label'] ?? null, 80) ||
            (isset($record['clause_code']) && !$this->identifier($record['clause_code'], 100)) ||
            !in_array($record['kind'] ?? 'normative', self::KINDS, true) ||
            !is_int($record['pdf_page'] ?? null) || $record['pdf_page'] < 1 || $record['pdf_page'] > $pageCount ||
            (isset($record['source_page']) && $record['source_page'] !== $record['pdf_page']) ||
            !is_array($record['source_anchor'] ?? null) ||
            ($record['source_anchor']['pdf_page'] ?? $record['pdf_page']) !== $record['pdf_page'] ||
            !is_string($record['latex'] ?? null) || trim($record['latex']) === '' ||
            !is_array($record['variables'] ?? null) || $record['variables'] === [] ||
            !is_array($record['conditions'] ?? null) || $record['conditions'] === [] ||
            !is_array($record['design_methods'] ?? null) || $record['design_methods'] === [] ||
            !is_string($record['notes'] ?? null) || trim($record['notes']) === '' ||
            (isset($record['printed_page_label']) && (!is_string($record['printed_page_label']) || strlen($record['printed_page_label']) > 40))) {
            throw new RuntimeException('Invalid source equation draft; import stopped.');
        }
        $this->methods($record['design_methods']);
        if (isset($record['implementation_key']) && $record['implementation_key'] !== null && !$this->identifier($record['implementation_key'], 160)) {
            throw new RuntimeException('Invalid equation implementation key.');
        }
    }

    private function validateParameter(mixed $record, int $pageCount): void
    {
        if (!is_array($record) || !$this->identifier($record['parameter_key'] ?? null, 160) ||
            !$this->identifier($record['clause_code'] ?? null, 100) ||
            !in_array($record['kind'] ?? 'normative', self::KINDS, true) ||
            !is_int($record['pdf_page'] ?? null) || $record['pdf_page'] < 1 || $record['pdf_page'] > $pageCount ||
            (isset($record['source_page']) && $record['source_page'] !== $record['pdf_page']) ||
            !is_array($record['source_anchor'] ?? null) ||
            ($record['source_anchor']['pdf_page'] ?? $record['pdf_page']) !== $record['pdf_page'] ||
            !array_key_exists('value', $record) || !$this->validTypedValue((string) ($record['data_type'] ?? ''), $record['value']) ||
            !$this->identifier($record['unit'] ?? null, 80) ||
            !is_array($record['conditions'] ?? null) || $record['conditions'] === [] ||
            !is_array($record['design_methods'] ?? null) || $record['design_methods'] === [] ||
            !is_string($record['notes'] ?? null) || trim($record['notes']) === '') {
            throw new RuntimeException('Invalid typed parameter draft; import stopped.');
        }
        $this->methods($record['design_methods']);
    }

    private function validateTable(mixed $record, int $pageCount): void
    {
        if (!is_array($record) || !$this->identifier($record['id'] ?? null, 100) ||
            !$this->identifier($record['clause_code'] ?? null, 100) ||
            !in_array($record['kind'] ?? 'normative', self::KINDS, true) ||
            !is_int($record['pdf_page'] ?? null) || $record['pdf_page'] < 1 || $record['pdf_page'] > $pageCount ||
            (isset($record['source_page']) && $record['source_page'] !== $record['pdf_page']) ||
            !is_array($record['source_anchor'] ?? null) ||
            ($record['source_anchor']['pdf_page'] ?? $record['pdf_page']) !== $record['pdf_page'] ||
            !is_array($record['columns'] ?? null) || $record['columns'] === [] ||
            !is_array($record['rows'] ?? null) || $record['rows'] === [] ||
            !is_array($record['merged_cells'] ?? null) ||
            !is_string($record['notes'] ?? null) || trim($record['notes']) === '') {
            throw new RuntimeException('Invalid table draft; import stopped.');
        }
        foreach ($record['rows'] as $row) {
            $rowPage = is_array($row) ? ($row['pdf_page'] ?? null) : null;
            $rowAnchor = is_array($row) ? ($row['source_anchor'] ?? null) : null;
            $anchorPage = is_array($rowAnchor) ? ($rowAnchor['pdf_page'] ?? $rowAnchor['page'] ?? null) : null;
            if (!is_array($row) || !is_int($rowPage) || $rowPage < 1 || $rowPage > $pageCount ||
                !is_array($rowAnchor) || !is_numeric($anchorPage) || (int) $anchorPage !== $rowPage) {
                throw new RuntimeException('Invalid source page or anchor in a table row draft.');
            }
        }
        if (($record['complete_table'] ?? null) !== true && ($record['complete_table'] ?? null) !== false) {
            throw new RuntimeException('A table draft must state whether transcription coverage is complete.');
        }
        if ($record['complete_table'] === false &&
            (($record['coverage_type'] ?? null) !== 'partial' ||
                !is_array($record['coverage']['omitted_case_ids'] ?? null) || $record['coverage']['omitted_case_ids'] === [])) {
            throw new RuntimeException('A partial table draft must identify omitted cases.');
        }
        $this->methods($record['design_methods'] ?? []);
    }

    /** @return list<string> */
    private function methods(array $methods): array
    {
        if (count($methods) !== count(array_unique($methods)) || array_diff($methods, self::METHODS) !== []) {
            throw new RuntimeException('Design methods must be a unique list of ASD and/or LRFD.');
        }
        return array_values($methods);
    }

    private function methodValue(array $methods): ?string
    {
        return match ($methods) {
            ['ASD', 'LRFD'], ['LRFD', 'ASD'] => 'both',
            ['ASD'] => 'ASD',
            ['LRFD'] => 'LRFD',
            default => null,
        };
    }

    private function upsertDraft(string $resource, ?object $prior, array $attrs, int $editionId, int $documentId, mixed $now, array &$counts): int
    {
        $table = match ($resource) {
            'equations' => 'standard_equations',
            'parameters' => 'standard_parameters',
            'tables' => 'standard_tables',
        };
        if ($prior && $this->matches($prior, $attrs)) {
            $counts['unchanged']++;
            return (int) $prior->id;
        }
        if ($prior && !in_array($prior->verification_status, ['candidate', 'index_only', 'needs_review'], true)) {
            throw new RuntimeException('A source draft cannot overwrite a verified, published, or deprecated record.');
        }

        $before = $prior ? $this->snapshot($prior) : null;
        $attrs['record_version'] = $prior ? (int) ($prior->record_version ?? 1) + 1 : 1;
        if ($prior) {
            DB::table($table)->where('id', $prior->id)->update($attrs);
            $id = (int) $prior->id;
        } else {
            $attrs['created_at'] = $now;
            if ($resource === 'equations') {
                $clauseKind = (string) DB::table('standard_clauses')->where('id', $attrs['clause_id'])->value('kind');
                $attrs['supersedes_id'] = $this->priorApprovedEquation($editionId, $attrs['label'], $attrs['clause_id'], $clauseKind);
            } elseif ($resource === 'parameters') {
                $attrs['supersedes_id'] = $this->priorApprovedParameter($editionId, $attrs['parameter_key'], $attrs['source_context'], $attrs['kind']);
            } else {
                $attrs['supersedes_id'] = $this->priorApprovedTable($editionId, $attrs['table_code'], $attrs['source_context'], $attrs['kind']);
            }
            $id = (int) DB::table($table)->insertGetId($attrs);
        }
        $after = $this->snapshot(DB::table($table)->where('id', $id)->first());
        $this->history($editionId, $documentId, $resource, $id,
            $prior?->verification_status, 'needs_review',
            'Imported source-transcribed content; independent review is still required.',
            ['before' => $before, 'after' => $after]);
        $counts['updated']++;
        return $id;
    }

    private function matches(object $prior, array $attrs): bool
    {
        foreach ($attrs as $field => $value) {
            if (in_array($field, ['updated_at', 'verification_status'], true)) {
                continue;
            }
            $current = $prior->{$field} ?? null;
            if (in_array($field, ['source_anchor', 'variables', 'conditions', 'dependencies', 'source_metadata', 'value', 'dimensions', 'columns', 'rows', 'footnotes', 'applicability', 'merged_cells', 'coverage', 'design_methods'], true)) {
                if ($this->normalize($this->decode($current)) !== $this->normalize($this->decode($value))) {
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

    private function priorApprovedEquation(int $editionId, string $label, int $clauseId, string $kind): ?int
    {
        $prior = DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
            ->where('c.edition_id', $editionId)->where('c.kind', $kind)->where('e.label', $label)->where('e.clause_id', '!=', $clauseId)
            ->whereIn('e.verification_status', ['verified', 'published'])->orderByDesc('e.id')->value('e.id');
        return $prior ? (int) $prior : null;
    }

    private function priorApprovedParameter(int $editionId, string $key, string $context, string $kind): ?int
    {
        $prior = DB::table('standard_parameters')->where('edition_id', $editionId)->where('parameter_key', $key)
            ->where('kind', $kind)->where('source_context', '!=', $context)->whereIn('verification_status', ['verified', 'published'])
            ->orderByDesc('id')->value('id');
        return $prior ? (int) $prior : null;
    }

    private function priorApprovedTable(int $editionId, string $key, string $context, string $kind): ?int
    {
        $prior = DB::table('standard_tables')->where('edition_id', $editionId)->where('table_code', $key)
            ->where('kind', $kind)->where('source_context', '!=', $context)->whereIn('verification_status', ['verified', 'published'])
            ->orderByDesc('id')->value('id');
        return $prior ? (int) $prior : null;
    }

    private function history(int $editionId, int $documentId, string $resource, int $recordId, ?string $from, string $to, ?string $notes, array $snapshot): void
    {
        DB::table('standard_review_history')->insert([
            'edition_id' => $editionId,
            'document_id' => $documentId,
            'reviewer_id' => null,
            'record_type' => $resource,
            'record_id' => $recordId,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => $notes,
            'content_snapshot' => $this->json($snapshot),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function snapshot(object $row): array
    {
        $snapshot = (array) $row;
        foreach (['source_anchor', 'source_metadata', 'variables', 'conditions', 'dependencies', 'value', 'dimensions', 'columns', 'rows', 'footnotes', 'applicability', 'merged_cells', 'coverage', 'design_methods'] as $field) {
            if (array_key_exists($field, $snapshot)) {
                $snapshot[$field] = $this->decode($snapshot[$field]);
            }
        }
        return $snapshot;
    }

    private function identifier(mixed $value, int $max): bool
    {
        return is_string($value) && trim($value) !== '' && strlen($value) <= $max;
    }

    private function validTypedValue(string $type, mixed $value): bool
    {
        return match ($type) {
            'number', 'dimensionless_factor' => is_int($value) || is_float($value),
            'string' => is_string($value) && trim($value) !== '',
            'boolean' => is_bool($value),
            'object', 'lookup_table', 'piecewise_rule' => is_array($value) && $value !== [],
            'scalar', 'variable' => is_scalar($value),
            default => false,
        };
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function decode(mixed $value): mixed
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

    private function normalize(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value);
        }
        foreach ($value as $key => $item) {
            $value[$key] = $this->normalize($item);
        }
        return $value;
    }
}
