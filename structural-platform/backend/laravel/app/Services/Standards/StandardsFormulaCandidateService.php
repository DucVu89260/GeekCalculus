<?php

namespace App\Services\Standards;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class StandardsFormulaCandidateService
{
    public function import(int $editionId, int $documentId, array $manifest): array
    {
        $doc = DB::table('standard_documents')->where('id', $documentId)->where('edition_id', $editionId)->first();
        $edition = DB::table('standard_editions')->where('id', $editionId)->first();
        if (!$doc || $edition?->code !== 'AISC360-10' || ($manifest['edition_code'] ?? null) !== $edition->code ||
            ($manifest['source_sha256'] ?? null) !== $doc->sha256 || ($manifest['pdf_page_count'] ?? null) !== (int) $doc->page_count) {
            throw new RuntimeException('Candidate manifest does not match the registered edition/artifact/page count.');
        }
        Validator::make($manifest, [
            'equations' => ['required', 'array', 'max:2000'],
            'equations.*.label' => ['required', 'regex:/^[B-H][0-9]+[a-z]?-\d+[a-z]?$/'],
            'equations.*.clause_code' => ['required', 'string', 'max:100'],
            'equations.*.kind' => ['required', 'in:normative'],
            'equations.*.pdf_page' => ['required', 'integer', 'min:1', 'max:'.$doc->page_count],
            'equations.*.latex' => ['nullable', 'string', 'max:20000'],
            'equations.*.extraction_confidence' => ['required', 'numeric', 'between:0,1'],
            'equations.*.extraction_method' => ['required', 'string', 'max:40'],
            'equations.*.source_anchor' => ['required', 'array'],
            'equations.*.evidence.text' => ['required', 'string', 'max:100000'],
            'equations.*.evidence.text_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
        ])->validate();
        $report = DB::transaction(function () use ($doc, $editionId, $manifest) {
            $report = ['updated' => 0, 'protected' => 0, 'unmatched' => 0, 'unchanged' => 0];
            foreach ($manifest['equations'] as $candidate) {
                if (($candidate['source_anchor']['pdf_page'] ?? null) !== $candidate['pdf_page'] ||
                    ($candidate['source_anchor']['equation_id'] ?? null) !== $candidate['label'] ||
                    !hash_equals($candidate['evidence']['text_sha256'], hash('sha256', $candidate['evidence']['text']))) {
                    throw new RuntimeException('Candidate source evidence or anchor is inconsistent.');
                }
                $row = DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
                    ->where('c.edition_id', $editionId)->where('c.code', $candidate['clause_code'])->where('c.kind', 'normative')
                    ->where('e.document_id', $doc->id)->where('e.source_sha256', $doc->sha256)
                    ->where('e.label', $candidate['label'])->select('e.*')->lockForUpdate()->first();
                if (!$row) { $report['unmatched']++; continue; }
                $metadata = json_encode($candidate, JSON_THROW_ON_ERROR);
                if ($row->source_metadata === $metadata) { $report['unchanged']++; continue; }
                $manuallyEdited = DB::table('standard_review_history')->where('record_type', 'equations')->where('record_id', $row->id)->whereNotNull('reviewer_id')->exists();
                if (!in_array($row->verification_status, ['candidate', 'needs_review'], true) || trim((string) $row->latex) !== '' || $manuallyEdited ||
                    in_array($doc->verification_status, ['verified', 'published', 'deprecated'], true)) {
                    $report['protected']++; continue;
                }
                // The index's page is preserved; a reference-only candidate cannot silently move it.
                if ((int) $row->pdf_page !== $candidate['pdf_page']) { $report['unmatched']++; continue; }
                DB::table('standard_equations')->where('id', $row->id)->update([
                    'extraction_confidence' => $candidate['extraction_confidence'],
                    'latex' => $candidate['latex'] ?? null, 'source_metadata' => $metadata,
                    'extraction_method' => $candidate['extraction_method'],
                    'source_anchor' => json_encode($candidate['source_anchor'], JSON_THROW_ON_ERROR),
                    'verification_status' => empty($candidate['latex']) ? 'candidate' : 'needs_review',
                    'record_version' => (int) $row->record_version + 1, 'updated_at' => now(),
                ]);
                $report['updated']++;
            }
            return $report;
        });
        app(StandardsRegistryCache::class)->invalidate($editionId);
        return $report;
    }
}
