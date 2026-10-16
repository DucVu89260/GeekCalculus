<?php

namespace App\Console\Commands;

use App\Services\StandardsOutlineImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportStandardPdf extends Command
{
    protected $signature = 'standards:import-pdf {pdf : Local source PDF} {manifest : JSON outline from that exact PDF}';
    protected $description = 'Import a private PDF and page-linked outline for any registered standards edition';

    public function handle(StandardsOutlineImporter $importer): int
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
