<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use App\Services\Standards\StandardsRegistryCache;
use RuntimeException;

class StandardsOutlineImporter
{
    public function read(string $path): array
    {
        if (!is_file($path) || !is_readable($path)) throw new RuntimeException('Readable JSON manifest required.');
        $raw = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($raw)) throw new RuntimeException('Expected a JSON manifest object.');
        $code = $raw['edition_code'] ?? '';
        $pages = $raw['pdf_page_count'] ?? $raw['page_count'] ?? null;
        if (!is_string($code) || !preg_match('/^[A-Z][A-Z0-9_.-]{0,63}$/', $code)
            || !is_string($raw['source_sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/', $raw['source_sha256'])
            || !is_int($pages) || $pages < 1
            || (isset($raw['pdf_page_count'], $raw['page_count']) && $raw['pdf_page_count'] !== $raw['page_count'])) {
            throw new RuntimeException('Invalid edition code, source SHA-256 or PDF page count.');
        }
        $edition = DB::table('standard_editions')->where('code', $code)->first();
        if (!$edition) throw new RuntimeException('Unknown standards edition: '.$code.'. Register the edition first.');
        if (isset($raw['bookmarks'], $raw['clauses'])) throw new RuntimeException('Use bookmarks or clauses, not both.');
        $legacy = array_key_exists('bookmarks', $raw);
        $rows = $legacy ? $raw['bookmarks'] : ($raw['clauses'] ?? null);
        if (!is_array($rows) || !array_is_list($rows)) throw new RuntimeException('Expected a bookmarks or clauses array.');
        $clauses = []; $sourceIds = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !in_array($row['kind'] ?? '', ['normative','commentary','front_matter'], true)
                || !$this->text($row['code'] ?? null, 100) || !$this->text($row['title'] ?? null, 255)
                || !$this->page($row['pdf_page'] ?? null, $pages)
                || (isset($row['printed_page']) && (!is_int($row['printed_page']) || $row['printed_page'] < 1))) {
                throw new RuntimeException('Invalid outline row or page outside source PDF.');
            }
            $key = $row['kind'].'|'.$row['code'];
            if (isset($clauses[$key])) throw new RuntimeException('Duplicate outline entry: '.$key);
            $clauses[$key] = $row + ['parent_code'=>null, 'parent_id'=>null, 'printed_page'=>null];
            if (!$legacy && isset($row['id'])) {
                if ((!is_int($row['id']) && !is_string($row['id'])) || isset($sourceIds[(string) $row['id']])) {
                    throw new RuntimeException('Invalid or duplicate source clause ID.');
                }
                $sourceIds[(string) $row['id']] = $key;
            }
        }
        foreach ($clauses as $key => &$row) {
            $parent = null;
            if ($legacy && $row['parent_code'] !== null) {
                if (!$this->text($row['parent_code'],100)) throw new RuntimeException('Invalid parent code.');
                $parent = $row['kind'].'|'.$row['parent_code'];
            } elseif (!$legacy && $row['parent_id'] !== null) {
                if (!is_int($row['parent_id']) && !is_string($row['parent_id'])) throw new RuntimeException('Invalid parent ID.');
                $parent = $sourceIds[(string) $row['parent_id']] ?? '';
            }
            if ($parent !== null && (!isset($clauses[$parent]) || $clauses[$parent]['kind'] !== $row['kind'])) {
                throw new RuntimeException('Missing or cross-section parent.');
            }
            $row['parent_key'] = $parent;
        }
        unset($row);
        foreach ($clauses as $key => $row) {
            $seen = [$key=>true]; $parent = $row['parent_key'];
            while ($parent !== null) {
                if (isset($seen[$parent])) throw new RuntimeException('Outline hierarchy contains a cycle.');
                $seen[$parent] = true; $parent = $clauses[$parent]['parent_key'];
            }
        }
        // Only optional label candidates are ingested. Ignore expressions, statuses and implementation keys.
        $candidates = $raw['equation_candidates'] ?? [];
        if (!is_array($candidates) || !array_is_list($candidates)) throw new RuntimeException('Expected equation_candidates array.');
        $seen = [];
        foreach ($candidates as $eq) {
            if (!is_array($eq) || !$this->text($eq['label'] ?? null,80) || !$this->text($eq['clause_code'] ?? null,100)
                || !$this->page($eq['pdf_page'] ?? null,$pages)
                || !isset($clauses['normative|'.$eq['clause_code']])) throw new RuntimeException('Invalid equation candidate or missing normative clause.');
            $key = $eq['clause_code'].'|'.$eq['label'];
            if (isset($seen[$key])) throw new RuntimeException('Duplicate equation candidate.');
            $seen[$key] = true;
        }
        return ['edition'=>$edition, 'source_sha256'=>$raw['source_sha256'], 'pages'=>$pages, 'clauses'=>$clauses, 'candidates'=>$candidates];
    }

    private function text(mixed $value, int $limit): bool
    {
        return is_string($value) && trim($value) !== '' && mb_strlen($value) <= $limit;
    }

    private function page(mixed $value, int $pages): bool
    {
        return is_int($value) && $value >= 1 && $value <= $pages;
    }

    public function import(array $manifest, ?int $documentId = null): void
    {
        DB::transaction(function () use ($manifest, $documentId) {
            $edition = $manifest['edition'];
            $document = $documentId === null
                ? DB::table('standard_documents')->where('edition_id',$edition->id)->where('sha256',$manifest['source_sha256'])->first()
                : DB::table('standard_documents')->where('id',$documentId)->where('edition_id',$edition->id)->where('sha256',$manifest['source_sha256'])->first();
            if ($documentId !== null && !$document) throw new RuntimeException('Source document does not match manifest.');
            $ids = []; $editable = [];
            foreach ($manifest['clauses'] as $key => $row) {
                $identity = ['edition_id'=>$edition->id, 'kind'=>$row['kind'], 'code'=>$row['code']];
                $prior = DB::table('standard_clauses')->where($identity)->first();
                if ($prior && $prior->document_id !== null) {
                    $hash = DB::table('standard_documents')->where('id',$prior->document_id)->value('sha256');
                    if ($hash !== $manifest['source_sha256']) throw new RuntimeException('Clause already belongs to a different PDF: '.$row['code']);
                }
                $attrs = ['title'=>$row['title'], 'pdf_page'=>$row['pdf_page'], 'updated_at'=>now()];
                if ($row['printed_page'] !== null) $attrs['printed_page'] = $row['printed_page'];
                if ($document) $attrs['document_id'] = $document->id;
                if ($prior) {
                    $ids[$key] = $prior->id;
                    if ($prior->verification_status !== 'index_only') continue;
                    DB::table('standard_clauses')->where('id',$prior->id)->update($attrs);
                } else {
                    $ids[$key] = DB::table('standard_clauses')->insertGetId($identity + $attrs + ['verification_status'=>'index_only','created_at'=>now()]);
                }
                $editable[$key] = true;
            }
            foreach ($manifest['clauses'] as $key => $row) {
                if (isset($editable[$key])) DB::table('standard_clauses')->where('id',$ids[$key])->update(['parent_id'=>$row['parent_key'] === null ? null : $ids[$row['parent_key']]]);
            }
            foreach ($manifest['candidates'] as $eq) {
                $identity = ['clause_id'=>$ids['normative|'.$eq['clause_code']], 'label'=>$eq['label']];
                $prior = DB::table('standard_equations')->where($identity)->first();
                if ($prior && ($prior->verification_status !== 'candidate' || trim((string) $prior->latex) !== '' ||
                    DB::table('standard_review_history')->where('record_type', 'equations')->where('record_id', $prior->id)->whereNotNull('reviewer_id')->exists())) continue;
                if ($prior) DB::table('standard_equations')->where('id',$prior->id)->update(['pdf_page'=>$eq['pdf_page'],'updated_at'=>now()]);
                else DB::table('standard_equations')->insert($identity + ['pdf_page'=>$eq['pdf_page'],'verification_status'=>'candidate','created_at'=>now(),'updated_at'=>now()]);
            }
        });
        app(StandardsRegistryCache::class)->invalidate((int) $manifest['edition']->id);
    }
}
