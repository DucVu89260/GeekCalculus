<?php

namespace App\Console\Commands;

use App\Services\Standards\StandardsFormulaCandidateService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ExtractStandardFormulas extends Command
{
    protected $signature = 'standards:extract-formulas {code=AISC360-10} {--document= : Exact registered source document ID} {--chapters=E,F : Comma-separated chapters B through H}';
    protected $description = 'Extract private equation evidence and conservative unapproved candidates from a registered PDF';

    public function handle(StandardsFormulaCandidateService $imports): int
    {
        $output = null;
        try {
            if ($this->argument('code') !== 'AISC360-10') { throw new RuntimeException('Only AISC360-10 is supported by this extractor.'); }
            $edition = DB::table('standard_editions')->where('code', 'AISC360-10')->first();
            if (!$edition || !$this->option('document')) { throw new RuntimeException('Select the exact registered --document ID; source revisions are never guessed.'); }
            $doc = DB::table('standard_documents')->where('edition_id', $edition->id)->where('id', $this->option('document'))->first();
            $disk = Storage::disk(config('standards.private_disk', 'local'));
            if (!$doc || !$doc->private_path || !$disk->exists($doc->private_path)) { throw new RuntimeException('The selected private PDF is not available on this backend.'); }
            $pdf = $disk->path($doc->private_path);
            if (!hash_equals($doc->sha256, hash_file('sha256', $pdf))) { throw new RuntimeException('Private PDF hash differs from the registered source.'); }
            $output = tempnam(sys_get_temp_dir(), 'formula-candidates-');
            if (!$output) { throw new RuntimeException('Cannot create private temporary extraction file.'); }
            $process = Process::timeout(config('standards.inspector_timeout_seconds', 120))->run([
                config('standards.python', 'python3'), base_path('../../scripts/extract_aisc_formula_candidates.py'),
                $pdf, $output, '--chapters', (string) $this->option('chapters'),
            ]);
            if (!$process->successful()) { throw new RuntimeException('Formula extraction failed: '.trim($process->errorOutput())); }
            $manifest = json_decode(file_get_contents($output), true, 512, JSON_THROW_ON_ERROR);
            if (!hash_equals($doc->sha256, hash_file('sha256', $pdf))) { throw new RuntimeException('Source changed during extraction.'); }
            $report = $imports->import((int) $edition->id, (int) $doc->id, $manifest);
            $this->line(json_encode(['status' => 'unapproved', 'report' => $report], JSON_PRETTY_PRINT));
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        } finally {
            if ($output) { @unlink($output); }
        }
    }
}
