<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class StandardsReviewService
{
    private const TABLES = [
        'documents' => 'standard_documents',
        'clauses' => 'standard_clauses',
        'equations' => 'standard_equations',
        'parameters' => 'standard_parameters',
        'tables' => 'standard_tables',
    ];

    private const TRANSITIONS = [
        'candidate' => ['needs_review'],
        'index_only' => ['needs_review'],
        'needs_review' => ['verified'],
        'verified' => ['published', 'deprecated'],
        'published' => ['deprecated'],
        'deprecated' => [],
    ];

    public function edit(int $editionId, string $resource, int $recordId, array $content, int $reviewerId, string $notes): object
    {
        $table = $this->table($resource);
        $updated = DB::transaction(function () use ($editionId, $resource, $recordId, $content, $reviewerId, $notes, $table) {
            $row = $this->find($editionId, $resource, $recordId, true);
            if (!in_array($row->verification_status, ['candidate', 'index_only', 'needs_review'], true)) {
                throw new RuntimeException('Verified, published, and deprecated records are immutable. Add a new source revision to correct them.');
            }
            $attrs = $this->validateContent($resource, $content);
            if ($attrs === []) {
                throw new RuntimeException('No editable fields were provided.');
            }

            $before = $this->snapshot($row);
            foreach ($attrs as $field => $value) {
                if (in_array($field, ['variables', 'conditions', 'value', 'dimensions', 'columns', 'rows', 'footnotes', 'applicability', 'merged_cells', 'source_anchor', 'coverage', 'design_methods'], true)) {
                    $attrs[$field] = $value === null ? null : json_encode($value, JSON_THROW_ON_ERROR);
                }
            }
            $attrs['updated_at'] = now();
            if (in_array($resource, ['equations', 'parameters', 'tables'], true)) {
                $attrs['record_version'] = ((int) ($row->record_version ?? 1)) + 1;
            }
            DB::table($table)->where('id', $recordId)->update($attrs);
            $updated = $this->find($editionId, $resource, $recordId);
            $this->appendHistory($editionId, $resource, $recordId, $row->document_id ?? null,
                $reviewerId, $row->verification_status, $row->verification_status, $notes,
                ['before' => $before, 'after' => $this->snapshot($updated)]);
            return $updated;
        });
        app(StandardsRegistryCache::class)->invalidate($editionId);

        return $updated;
    }

    public function transition(int $editionId, string $resource, int $recordId, string $status, int $reviewerId, ?string $notes): object
    {
        $this->table($resource);
        $updated = DB::transaction(function () use ($editionId, $resource, $recordId, $status, $reviewerId, $notes) {
            $row = $this->find($editionId, $resource, $recordId, true);
            $current = $row->verification_status;
            if (!in_array($status, self::TRANSITIONS[$current] ?? [], true)) {
                throw new RuntimeException("Invalid review transition from {$current} to {$status}.");
            }
            if (in_array($status, ['verified', 'published'], true)) {
                if (mb_strlen(trim((string) $notes)) < 10) {
                    throw ValidationException::withMessages(['notes' => 'Add a review reason with source evidence before verifying or publishing.']);
                }
                $this->assertReviewable($resource, $row, $status);
            }
            if ($status === 'deprecated' && trim((string) $notes) === '') {
                throw ValidationException::withMessages(['notes' => 'A reason is required when deprecating a record.']);
            }

            $table = self::TABLES[$resource];
            DB::table($table)->where('id', $recordId)->update([
                'verification_status' => $status,
                'updated_at' => now(),
            ]);
            $updated = $this->find($editionId, $resource, $recordId);
            $this->appendHistory($editionId, $resource, $recordId, $row->document_id ?? null,
                $reviewerId, $current, $status, $notes, $this->snapshot($updated));
            return $updated;
        });
        app(StandardsRegistryCache::class)->invalidate($editionId);

        return $updated;
    }

    public function history(int $editionId, string $resource, int $recordId, ?int $limit = 100): array
    {
        $this->table($resource);
        return DB::table('standard_review_history as h')
            ->leftJoin('users as u', 'u.id', '=', 'h.reviewer_id')
            ->where('h.edition_id', $editionId)
            ->where('h.record_type', $resource)
            ->where('h.record_id', $recordId)
            ->orderByDesc('h.id')
            ->limit(max(1, min((int) $limit, 200)))
            ->get(['h.id', 'h.from_status', 'h.to_status', 'h.notes', 'h.content_snapshot', 'h.created_at', 'u.id as reviewer_id', 'u.name as reviewer_name'])
            ->map(function ($event) {
                $event->content_snapshot = $this->decode($event->content_snapshot);
                return $event;
            })->all();
    }

    private function table(string $resource): string
    {
        if (!isset(self::TABLES[$resource])) {
            throw new RuntimeException('Unsupported standards record type.');
        }
        return self::TABLES[$resource];
    }

    private function find(int $editionId, string $resource, int $recordId, bool $lock = false): object
    {
        $query = match ($resource) {
            'documents' => DB::table('standard_documents')->where('edition_id', $editionId)->where('id', $recordId),
            'clauses' => DB::table('standard_clauses')->where('edition_id', $editionId)->where('id', $recordId),
            'equations' => DB::table('standard_equations as e')
                ->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
                ->where('c.edition_id', $editionId)->where('e.id', $recordId)->select('e.*'),
            'parameters' => DB::table('standard_parameters')->where('edition_id', $editionId)->where('id', $recordId),
            'tables' => DB::table('standard_tables')->where('edition_id', $editionId)->where('id', $recordId),
            default => throw new RuntimeException('Unsupported standards record type.'),
        };
        if ($lock) {
            $query->lockForUpdate();
        }
        $row = $query->first();
        if (!$row) {
            abort(404, 'Standards record not found.');
        }

        return $row;
    }

    /** @return array<string, mixed> */
    private function validateContent(string $resource, array $content): array
    {
        $rules = match ($resource) {
            'clauses' => [
                'title' => ['sometimes', 'required', 'string', 'max:255'],
                'summary' => ['sometimes', 'nullable', 'string', 'max:20000'],
                'source_anchor' => ['sometimes', 'nullable', 'array'],
                'pdf_page' => ['sometimes', 'nullable', 'integer', 'min:1'],
                'printed_page_label' => ['sometimes', 'nullable', 'string', 'max:40'],
            ],
            'equations' => [
                'latex' => ['sometimes', 'nullable', 'string', 'max:20000'],
                'variables' => ['sometimes', 'nullable', 'array'],
                'conditions' => ['sometimes', 'nullable', 'array'],
                'design_method' => ['sometimes', 'nullable', 'in:ASD,LRFD,both'],
                'implementation_key' => ['sometimes', 'nullable', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/'],
                'source_anchor' => ['sometimes', 'nullable', 'array'],
                'pdf_page' => ['sometimes', 'nullable', 'integer', 'min:1'],
                'printed_page_label' => ['sometimes', 'nullable', 'string', 'max:40'],
                'source_notes' => ['sometimes', 'nullable', 'string', 'max:20000'],
            ],
            'parameters' => [
                'kind' => ['sometimes', 'required', 'in:normative,commentary,front_matter,symbols,glossary,appendix'],
                'label' => ['sometimes', 'nullable', 'string', 'max:255'],
                'data_type' => ['sometimes', 'required', 'in:number,string,boolean,object,scalar,variable,dimensionless_factor,lookup_table,piecewise_rule'],
                'value' => ['sometimes', 'nullable'],
                'units' => ['sometimes', 'nullable', 'string', 'max:80'],
                'dimensions' => ['sometimes', 'nullable', 'array'],
                'conditions' => ['sometimes', 'nullable', 'array'],
                'design_method' => ['sometimes', 'nullable', 'in:ASD,LRFD,both'],
                'implementation_key' => ['sometimes', 'nullable', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/'],
                'source_anchor' => ['sometimes', 'nullable', 'array'],
                'pdf_page' => ['sometimes', 'nullable', 'integer', 'min:1'],
                'printed_page_label' => ['sometimes', 'nullable', 'string', 'max:40'],
                'source_notes' => ['sometimes', 'nullable', 'string', 'max:20000'],
            ],
            'tables' => [
                'title' => ['sometimes', 'nullable', 'string', 'max:255'],
                'columns' => ['sometimes', 'nullable', 'array'],
                'rows' => ['sometimes', 'nullable', 'array'],
                'footnotes' => ['sometimes', 'nullable', 'array'],
                'applicability' => ['sometimes', 'nullable', 'array'],
                'merged_cells' => ['sometimes', 'nullable', 'array'],
                'implementation_key' => ['sometimes', 'nullable', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/'],
                'source_anchor' => ['sometimes', 'nullable', 'array'],
                'pdf_page' => ['sometimes', 'nullable', 'integer', 'min:1'],
                'printed_page_label' => ['sometimes', 'nullable', 'string', 'max:40'],
                'coverage' => ['sometimes', 'nullable', 'array'],
                'coverage_type' => ['sometimes', 'nullable', 'string', 'max:40'],
                'complete_table' => ['sometimes', 'nullable', 'boolean'],
                'design_methods' => ['sometimes', 'nullable', 'array'],
                'source_notes' => ['sometimes', 'nullable', 'string', 'max:20000'],
            ],
            default => [],
        };
        if ($rules === []) {
            throw new RuntimeException('This standards resource does not support content editing.');
        }
        $validator = Validator::make($content, $rules);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    private function assertReviewable(string $resource, object $row, string $targetStatus): void
    {
        if ($resource === 'documents') {
            $this->assertSourceDocument($row);
            return;
        }

        if (empty($row->document_id) || empty($row->source_sha256) || empty($row->pdf_page)) {
            throw new RuntimeException('A source document, SHA-256, and physical PDF page are required before approval.');
        }
        $document = DB::table('standard_documents')->where('id', $row->document_id)->first();
        if (!$document || !hash_equals(strtolower((string) $document->sha256), strtolower((string) $row->source_sha256))) {
            throw new RuntimeException('The source document reference or physical PDF page is invalid.');
        }
        $this->assertSourceDocument($document);
        if ((int) $row->pdf_page > (int) $document->page_count) {
            throw new RuntimeException('The source document reference or physical PDF page is invalid.');
        }
        $anchor = $this->decode($row->source_anchor ?? null);
        $anchorPage = is_array($anchor) ? ($anchor['pdf_page'] ?? $anchor['page'] ?? $anchor['physical_page'] ?? null) : null;
        if (!is_array($anchor) || !is_numeric($anchorPage) || (int) $anchorPage !== (int) $row->pdf_page ||
            (isset($anchor['printed_page_label'], $row->printed_page_label) &&
                (string) $anchor['printed_page_label'] !== (string) $row->printed_page_label)) {
            throw new RuntimeException('The source anchor must identify the same physical page as the reviewed record.');
        }
        if (empty($row->extraction_method)) {
            throw new RuntimeException('An extraction method is required before approval.');
        }
        if ($resource === 'clauses') {
            if (trim((string) $row->code) === '' || trim((string) $row->title) === '') {
                throw new RuntimeException('Clause code and title are required before approval.');
            }
            return;
        }
        if ($resource === 'equations') {
            $variables = $this->decode($row->variables);
            if (trim((string) $row->latex) === '' || !is_array($variables) || $variables === [] || !$this->hasJsonValue($row->conditions)) {
                throw new RuntimeException('An equation needs a transcription, variable definitions, conditions, and source anchor before approval.');
            }
            foreach ($variables as $variable) {
                if (!is_array($variable) || trim((string) ($variable['symbol'] ?? '')) === '' ||
                    trim((string) ($variable['definition'] ?? '')) === '') {
                    throw new RuntimeException('Each equation variable needs a symbol and definition before approval.');
                }
            }
        } elseif ($resource === 'parameters') {
            $value = $this->decode($row->value);
            if (trim((string) $row->parameter_key) === '' || $row->value === null || !$this->validTypedValue((string) $row->data_type, $value) ||
                trim((string) $row->units) === '' || !$this->hasJsonValue($row->conditions)) {
                throw new RuntimeException('A parameter needs a typed value, applicability conditions, and key before approval.');
            }
        } elseif ($resource === 'tables') {
            if (trim((string) $row->table_code) === '' || !$this->hasJsonValue($row->columns) || !$this->hasJsonValue($row->rows)) {
                throw new RuntimeException('A table needs headings and indexed rows before approval.');
            }
            $rows = $this->decode($row->rows);
            foreach ($rows as $tableRow) {
                if (!is_array($tableRow)) {
                    throw new RuntimeException('Every reviewed table row must retain its source page and anchor.');
                }
                $tableAnchor = $this->decode($tableRow['source_anchor'] ?? null);
                $tablePage = $tableRow['pdf_page'] ?? null;
                $tableAnchorPage = is_array($tableAnchor) ? ($tableAnchor['pdf_page'] ?? $tableAnchor['page'] ?? $tableAnchor['physical_page'] ?? null) : null;
                if (!is_numeric($tablePage) || (int) $tablePage < 1 || (int) $tablePage > (int) $document->page_count ||
                    !is_numeric($tableAnchorPage) || (int) $tableAnchorPage !== (int) $tablePage) {
                    throw new RuntimeException('Every reviewed table row must have a matching in-range physical page anchor.');
                }
            }
            if ($row->complete_table === null) {
                throw new RuntimeException('Table coverage must say whether the source table is complete or partial.');
            }
            if (!$row->complete_table) {
                $coverage = $this->decode($row->coverage);
                if ($row->coverage_type !== 'partial' || !is_array($coverage) ||
                    empty($coverage['omitted_case_ids']) || !is_array($coverage['omitted_case_ids'])) {
                    throw new RuntimeException('A partial table must identify its coverage and omitted source cases.');
                }
            }
        }

        if (in_array($resource, ['equations', 'parameters'], true) &&
            !in_array($row->design_method ?? null, ['ASD', 'LRFD', 'both'], true)) {
            throw new RuntimeException('Reviewed calculations and parameters must declare ASD, LRFD, or both.');
        }
        if ($resource === 'tables') {
            $methods = $this->decode($row->design_methods);
            if (!is_array($methods) || $methods === [] || array_diff($methods, ['ASD', 'LRFD']) !== []) {
                throw new RuntimeException('A reviewed table must identify its applicable ASD and/or LRFD methods.');
            }
        }

        if ($targetStatus === 'published' && in_array($resource, ['equations', 'parameters'], true)) {
            if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/', (string) ($row->implementation_key ?? ''))) {
                throw new RuntimeException('Published calculation inputs require a stable implementation key.');
            }
            if (empty($row->design_method) || !in_array($row->design_method, ['ASD', 'LRFD', 'both'], true)) {
                throw new RuntimeException('Published calculation inputs must declare ASD, LRFD, or both.');
            }
        }
    }

    private function assertSourceDocument(object $document): void
    {
        $disk = Storage::disk((string) config('standards.private_disk', 'local'));
        if (!$document->private_path || !$disk->exists($document->private_path) ||
            !preg_match('/^[a-f0-9]{64}$/i', (string) $document->sha256) ||
            !hash_equals(strtolower((string) $document->sha256), strtolower($this->hashStoredFile($disk->readStream($document->private_path)))) ||
            (int) $document->page_count < 1 || $document->processing_status !== 'indexed' ||
            !is_array($this->decode($document->metadata)) || $this->decode($document->metadata) === []) {
            throw new RuntimeException('The indexed source needs a private file with matching hash, metadata, and physical page count.');
        }
        $identity = $this->decode($document->source_identity);
        $edition = DB::table('standard_editions as e')->join('standard_families as f', 'f.id', '=', 'e.family_id')
            ->where('e.id', $document->edition_id)->first(['e.year', 'f.code as family_code']);
        if (!is_array($identity) || ($identity['validated'] ?? false) !== true ||
            ($identity['family'] ?? null) !== $edition?->family_code ||
            (int) ($identity['edition_year'] ?? 0) !== (int) ($edition?->year ?? 0)) {
            throw new RuntimeException('The inspected source identity does not match its registered edition.');
        }
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

    private function hasJsonValue(mixed $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        $decoded = $this->decode($value);
        return is_array($decoded) && $decoded !== [];
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

    private function snapshot(object $row): array
    {
        $snapshot = (array) $row;
        foreach (['metadata', 'source_identity', 'import_report', 'source_anchor', 'source_metadata', 'variables', 'conditions', 'dependencies', 'value', 'dimensions', 'columns', 'rows', 'footnotes', 'applicability', 'merged_cells', 'coverage', 'design_methods'] as $field) {
            if (array_key_exists($field, $snapshot)) {
                $snapshot[$field] = $this->decode($snapshot[$field]);
            }
        }
        return $snapshot;
    }

    private function appendHistory(int $editionId, string $resource, int $recordId, ?int $documentId, int $reviewerId, ?string $from, string $to, ?string $notes, array $snapshot): void
    {
        DB::table('standard_review_history')->insert([
            'edition_id' => $editionId,
            'document_id' => $documentId,
            'reviewer_id' => $reviewerId,
            'record_type' => $resource,
            'record_id' => $recordId,
            'from_status' => $from,
            'to_status' => $to,
            'notes' => $notes,
            'content_snapshot' => json_encode($snapshot, JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** @param resource|false $stream */
    private function hashStoredFile($stream): string
    {
        if (!is_resource($stream)) {
            throw new RuntimeException('Unable to read the private source document.');
        }
        $context = hash_init('sha256');
        hash_update_stream($context, $stream);
        fclose($stream);
        return hash_final($context);
    }
}
