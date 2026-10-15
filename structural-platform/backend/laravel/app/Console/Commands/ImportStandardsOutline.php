<?php

namespace App\\Console\\Commands;

use Illuminate\\Console\\Command;
use Illuminate\\Support\\Facades\\DB;

class ImportStandardsOutline extends Command
{
    protected $signature = 'standards:import-outline {json : Path to extracted private JSON}';
    protected $description = 'Import verified-source PDF TOC bookmarks into an existing standards edition';

    public function handle(): int
    {
        $file = $this->argument('json');
        if (!is_file($file)) {
            $this->error('JSON file not found');
            return self::FAILURE;
        }
        try {
            $raw = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if (($raw['edition_code'] ?? '') !== 'AISC360-10' ||
                !isset($raw['source_sha256'], $raw['pdf_page_count'], $raw['bookmarks']) ||
                !is_array($raw['bookmarks'])) {
                throw new \\RuntimeException('Expected AISC360-10 private outline manifest');
            }
            if (!preg_match('/^[a-f0-9]{64}$/', $raw['source_sha256'])) {
                throw new \\RuntimeException('Invalid source hash');
            }
            $edition = DB::table('standard_editions')->where('code', 'AISC360-10')->first();
            if (!$edition) throw new \\RuntimeException('Run StandardsSeeder first');
            DB::transaction(function () use ($raw, $edition) {
                $ids = [];
                foreach ($raw['bookmarks'] as $row) {
                    if (!in_array($row['kind'] ?? '', ['normative','commentary','front_matter'], true) ||
                        !is_string($row['code'] ?? null) || strlen($row['code']) > 100 ||
                        !is_string($row['title'] ?? null) || strlen($row['title']) > 255 ||
                        !is_int($row['pdf_page'] ?? null) || $row['pdf_page'] < 1 ||
                        $row['pdf_page'] > $raw['pdf_page_count']) {
                        throw new \\RuntimeException('Invalid bookmark row: import stopped');
                    }
                    $key = ['edition_id'=>$edition->id,'kind'=>$row['kind'],'code'=>$row['code']];
                    $prior = DB::table('standard_clauses')->where($key)->first();
                    $attrs = ['title'=>$row['title'],'pdf_page'=>$row['pdf_page'],
                        'verification_status'=>'index_only','updated_at'=>now()];
                    if ($prior) {
                        // Never overwrite manually verified content or source corrections.
                        if ($prior->verification_status === 'index_only') DB::table('standard_clauses')->where('id',$prior->id)->update($attrs);
                        $ids[$row['kind'].'|'.$row['code']] = $prior->id;
                    } else {
                        $ids[$row['kind'].'|'.$row['code']] = DB::table('standard_clauses')->insertGetId(
                            $key + $attrs + ['created_at'=>now()]
                        );
                    }
                }
                foreach ($raw['bookmarks'] as $row) {
                    if (!$row['parent_code']) continue;
                    $parentId = $ids[$row['kind'].'|'.$row['parent_code']] ?? null;
                    $id = $ids[$row['kind'].'|'.$row['code']] ?? null;
                    if ($parentId && $id) DB::table('standard_clauses')->where('id',$id)
                        ->where('verification_status','index_only')->update(['parent_id'=>$parentId]);
                }
            });
            $this->info('Imported '.count($raw['bookmarks']).' outline entries as index_only.');
            return self::SUCCESS;
        } catch (\\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
