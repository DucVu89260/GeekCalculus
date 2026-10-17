<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportStandardCorpus extends Command
{
    protected $signature = 'standards:import-corpus {directory : Private extracted ASCE 7-10 bundle}';
    protected $description = 'Import all source pages, images, raw numeric tokens and unverified formula/table/figure occurrences';

    public function handle(): int
    {
        $created = [];
        try {
            $root = realpath($this->argument('directory'));
            if (!$root || !is_file($root.'/manifest.json')) throw new \RuntimeException('Corpus manifest not found');
            $rawJson = file_get_contents($root.'/manifest.json');
            $m = json_decode($rawJson, true, 512, JSON_THROW_ON_ERROR);
            if (($m['schema_version'] ?? null) !== 1 || ($m['edition_code'] ?? '') !== 'ASCE7-10'
                || !preg_match('/^[a-f0-9]{64}$/', $m['source_sha256'] ?? '')
                || !is_int($m['pdf_page_count'] ?? null) || $m['pdf_page_count'] < 1
                || !is_array($m['pages'] ?? null) || count($m['pages']) !== $m['pdf_page_count']) {
                throw new \RuntimeException('Invalid ASCE7-10 corpus schema or incomplete page coverage');
            }
            $sha = $m['source_sha256'];
            if (!is_file($root.'/source.pdf') || !hash_equals($sha, hash_file('sha256', $root.'/source.pdf'))
                || file_get_contents($root.'/source.pdf', false, null, 0, 5) !== '%PDF-') {
                throw new \RuntimeException('Source PDF hash/signature mismatch');
            }
            $edition = DB::table('standard_editions')->where('code','ASCE7-10')->first();
            if (!$edition) throw new \RuntimeException('Run migrations and StandardsSeeder first');
            $disk = Storage::disk('local');
            $prefix = 'private/standards/ASCE7-10/'.$sha;
            // Validate every page and image before making any database/file changes.
            foreach ($m['pages'] as $index => $p) {
                if (($p['pdf_page'] ?? null) !== $index+1
                    || !in_array($p['kind'] ?? '', ['normative','commentary','front_matter'], true)
                    || !in_array($p['extraction_method'] ?? '', ['native','native+ocr'], true)
                    || !is_string($p['native_text'] ?? null) || !is_string($p['ocr_text'] ?? null)
                    || !is_array($p['numeric_tokens'] ?? null) || !is_array($p['blocks'] ?? null)
                    || !is_array($p['items'] ?? null)
                    || !hash_equals($p['text_sha256'] ?? '', hash('sha256',$p['native_text']))) {
                    throw new \RuntimeException('Invalid page data at '.($index+1));
                }
                $image = realpath($root.'/'.($p['image_path'] ?? ''));
                if (!$image || !str_starts_with($image, $root.'/pages/') || !is_file($image)
                    || !preg_match('#^pages/[0-9]{4}\.png$#', $p['image_path'])
                    || !hash_equals($p['image_sha256'] ?? '',hash_file('sha256',$image))) {
                    throw new \RuntimeException('Missing, unsafe or corrupt page image at '.($index+1));
                }
                foreach ($p['items'] as $item) {
                    if (!in_array($item['kind'] ?? '',['equation','table','figure'],true)
                        || !is_string($item['label'] ?? null) || strlen($item['label']) > 80
                        || !in_array($item['channel'] ?? '',['native','ocr'],true)
                        || !is_int($item['offset'] ?? null) || $item['offset'] < 0
                        || !is_string($item['context'] ?? null)) throw new \RuntimeException('Invalid source occurrence');
                }
            }
            $manifestHash = hash('sha256',$rawJson);
            $manifestPath = $prefix.'/manifest-'.$manifestHash.'.json';
            $copy = function ($source,$destination) use ($disk,&$created) {
                if ($disk->exists($destination)) {
                    if (!hash_equals(hash_file('sha256',$source),hash_file('sha256',$disk->path($destination))))
                        throw new \RuntimeException('Existing private archive differs; refusing to overwrite');
                    return;
                }
                $stream = fopen($source,'rb');
                try { if (!$disk->put($destination,$stream)) throw new \RuntimeException('Archive write failed'); }
                finally { fclose($stream); }
                $created[] = $destination;
            };
            $copy($root.'/source.pdf',$prefix.'/source.pdf');
            $copy($root.'/manifest.json',$manifestPath);
            foreach ($m['pages'] as $p) $copy($root.'/'.$p['image_path'],$prefix.'/'.$p['image_path']);
            if (is_file($root.'/coverage.json')) $copy($root.'/coverage.json',$prefix.'/coverage-'.$manifestHash.'.json');
            DB::transaction(function () use ($m,$edition,$prefix,$sha,$manifestPath) {
                $key = ['edition_id'=>$edition->id,'sha256'=>$sha];
                $prior = DB::table('standard_documents')->where($key)->first();
                $attrs = ['kind'=>'specification','original_name'=>'ASCE 7-10.pdf','private_path'=>$prefix.'/source.pdf',
                    'page_count'=>$m['pdf_page_count'],'processing_status'=>'extracted_unverified',
                    'corpus_path'=>$manifestPath,'extraction_summary'=>json_encode($m['summary'] ?? []),'updated_at'=>now()];
                if ($prior) { $docId = $prior->id; DB::table('standard_documents')->where('id',$docId)->update($attrs); }
                else $docId = DB::table('standard_documents')->insertGetId($key+$attrs+['created_at'=>now()]);
                foreach ($m['pages'] as $p) {
                    $pageKey = ['document_id'=>$docId,'pdf_page'=>$p['pdf_page']];
                    $attrs = array_intersect_key($p,array_flip(['printed_label','chapter','kind','extraction_method','coverage_status',
                        'native_text','ocr_text','ocr_words_tsv','image_sha256','text_sha256']));
                    $attrs += ['blocks'=>json_encode($p['blocks']),'numeric_tokens'=>json_encode($p['numeric_tokens']),
                        'image_path'=>$prefix.'/'.$p['image_path']];
                    DB::table('standard_source_pages')->updateOrInsert($pageKey,$attrs);
                    $pageId = DB::table('standard_source_pages')->where($pageKey)->value('id');
                    foreach ($p['items'] as $item) {
                        // Reviewed records are never overwritten by another raw extraction.
                        DB::table('standard_source_items')->insertOrIgnore([
                            'page_id'=>$pageId,'kind'=>$item['kind'],'label'=>$item['label'],
                            'channel'=>$item['channel'],'offset'=>$item['offset'],'context'=>$item['context'],
                            'occurrence_type'=>'reference_or_definition','verification_status'=>'candidate',
                        ]);
                    }
                }
                foreach ($m['clauses'] ?? [] as $c) {
                    DB::table('standard_clauses')->insertOrIgnore([
                        'edition_id'=>$edition->id,'document_id'=>$docId,'code'=>$c['code'],'title'=>$c['title'],
                        'kind'=>$c['kind'],'pdf_page'=>$c['pdf_page'],
                        'printed_page'=>ctype_digit((string)($c['printed_label'] ?? '')) ? (int)$c['printed_label'] : null,
                        'verification_status'=>'index_only','created_at'=>now(),'updated_at'=>now(),
                    ]);
                }
                foreach ($m['clauses'] ?? [] as $c) {
                    if (empty($c['parent_code'])) continue;
                    $parent = DB::table('standard_clauses')->where('edition_id',$edition->id)
                        ->where('kind',$c['kind'])->where('code',$c['parent_code'])->value('id');
                    if ($parent) DB::table('standard_clauses')->where('edition_id',$edition->id)
                        ->where('kind',$c['kind'])->where('code',$c['code'])->where('verification_status','index_only')
                        ->update(['parent_id'=>$parent]);
                }
                DB::table('standard_editions')->where('id',$edition->id)->update(['status'=>'in_development','updated_at'=>now()]);
            });
            $this->info('Imported '.$m['pdf_page_count'].' pages; raw source candidates are NOT approved calculation formulas.');
            $this->info('SHA-256: '.$sha);
            return self::SUCCESS;
        } catch (\Throwable $e) {
            foreach ($created as $path) Storage::disk('local')->delete($path);
            $this->error($e->getMessage()); return self::FAILURE;
        }
    }
}
