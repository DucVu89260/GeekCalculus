<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportAsce710Pdf extends Command
{
    protected $signature = 'standards:import-asce710-pdf {pdf : Path to the ASCE 7-10 source PDF}';
    protected $description = 'Import the matching ASCE 7-10 PDF and existing page-linked outline, without OCR or equation transcription';

    public function handle(): int
    {
        $created = false;
        $relative = null;
        $disk = Storage::disk('local');
        try {
            $pdf = $this->argument('pdf');
            $index = json_decode(file_get_contents(base_path('../../standards/asce7-10-library.json')), true, 512, JSON_THROW_ON_ERROR);
            if (!is_file($pdf) || !is_readable($pdf)
                || file_get_contents($pdf, false, null, 0, 5) !== '%PDF-'
                || !hash_equals($index['source_sha256'], hash_file('sha256', $pdf))) {
                throw new \RuntimeException('PDF does not match the ASCE 7-10 outline source; refusing to import.');
            }
            $edition = DB::table('standard_editions')->where('code', 'ASCE7-10')->first();
            if (!$edition) throw new \RuntimeException('Run migrations and StandardsSeeder first.');
            $sha = $index['source_sha256'];
            $priorDoc = DB::table('standard_documents')->where('edition_id', $edition->id)->where('sha256', $sha)->first();
            // Preserve an existing full corpus registration and restore its PDF only if missing.
            $relative = $priorDoc->private_path ?? 'private/standards/ASCE7-10/'.$sha.'/source.pdf';
            if ($disk->exists($relative)) {
                if (!hash_equals($sha, hash_file('sha256', $disk->path($relative)))) {
                    throw new \RuntimeException('Existing private PDF differs; refusing to overwrite.');
                }
            } else {
                $stream = fopen($pdf, 'rb');
                try {
                    if (!$disk->put($relative, $stream)) throw new \RuntimeException('Unable to store PDF.');
                    $created = true;
                } finally { fclose($stream); }
            }
            DB::transaction(function () use ($index, $edition, $sha, $relative, $priorDoc) {
                $docId = $priorDoc->id ?? DB::table('standard_documents')->insertGetId([
                    'edition_id'=>$edition->id, 'sha256'=>$sha, 'kind'=>'specification',
                    'original_name'=>'ASCE 7-10.pdf', 'private_path'=>$relative,
                    'page_count'=>$index['page_count'], 'processing_status'=>'indexed',
                    'created_at'=>now(), 'updated_at'=>now(),
                ]);
                $ids = [];
                foreach ($index['clauses'] as $row) {
                    $key = ['edition_id'=>$edition->id, 'kind'=>$row['kind'], 'code'=>$row['code']];
                    $prior = DB::table('standard_clauses')->where($key)->first();
                    if ($prior) {
                        // Reimport does not change reviewed titles, page mappings or other source links.
                        if ($prior->document_id === null && $prior->verification_status === 'index_only'
                            && $prior->pdf_page === $row['pdf_page']) {
                            DB::table('standard_clauses')->where('id', $prior->id)->update(['document_id'=>$docId]);
                        }
                        $ids[$row['id']] = $prior->id;
                    } else {
                        $ids[$row['id']] = DB::table('standard_clauses')->insertGetId($key + [
                            'title'=>$row['title'], 'pdf_page'=>$row['pdf_page'], 'printed_page'=>$row['printed_page'],
                            'document_id'=>$docId, 'verification_status'=>'index_only', 'created_at'=>now(), 'updated_at'=>now(),
                        ]);
                    }
                }
                foreach ($index['clauses'] as $row) {
                    if (!$row['parent_id']) continue;
                    DB::table('standard_clauses')->where('id', $ids[$row['id']])->whereNull('parent_id')
                        ->where('verification_status','index_only')->update(['parent_id'=>$ids[$row['parent_id']]]);
                }
            });
            $this->info('ASCE7-10 PDF and '.count($index['clauses']).' outline entries imported. No equation transcription or OCR required.');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            if ($created && $relative) $disk->delete($relative);
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
