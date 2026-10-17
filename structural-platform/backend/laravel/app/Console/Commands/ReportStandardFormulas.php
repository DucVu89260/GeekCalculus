<?php

namespace App\Console\Commands;

use App\Services\Standards\StandardsReviewService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ReportStandardFormulas extends Command
{
    protected $signature = 'standards:formula-report {code=AISC360-10}';
    protected $description = 'Read-only source availability and equation review coverage report (no private paths/text)';

    public function handle(StandardsReviewService $review): int
    {
        if (!Schema::hasTable('standard_documents')) {
            $this->line(json_encode(['schema_ready' => false, 'source_available' => false, 'approved_equations' => 0]));
            return self::SUCCESS;
        }
        $edition = DB::table('standard_editions')->where('code', $this->argument('code'))->first();
        if (!$edition) { $this->error('Edition is not registered.'); return self::FAILURE; }
        $disk = Storage::disk(config('standards.private_disk', 'local'));
        $documents = DB::table('standard_documents')->where('edition_id', $edition->id)->get()->map(function ($doc) use ($disk) {
            $present = $doc->private_path && $disk->exists($doc->private_path);
            $hash = null;
            if ($present) {
                $stream = $disk->readStream($doc->private_path);
                if (is_resource($stream)) { $ctx = hash_init('sha256'); hash_update_stream($ctx, $stream); fclose($stream); $hash = hash_final($ctx); }
            }
            return ['id' => $doc->id, 'sha256' => $doc->sha256, 'page_count' => $doc->page_count,
                'file_present' => (bool) $present, 'hash_matches' => $hash !== null && hash_equals($doc->sha256, $hash)];
        })->all();
        $equations = DB::table('standard_equations as e')->join('standard_clauses as c', 'c.id', '=', 'e.clause_id')
            ->where('c.edition_id', $edition->id)->get(['e.*', 'c.kind as clause_kind']);
        $groups = []; $approved = 0;
        foreach ($equations as $row) {
            $key = ($row->clause_kind ?? 'unknown').':'.substr($row->label, 0, 1);
            $groups[$key] ??= ['total' => 0, 'with_expression' => 0, 'approved' => 0, 'statuses' => []];
            $g = &$groups[$key]; $g['total']++;
            if (trim((string) $row->latex) !== '') { $g['with_expression']++; }
            $g['statuses'][$row->verification_status] = ($g['statuses'][$row->verification_status] ?? 0) + 1;
            if ($review->isApprovedEquation((int) $edition->id, $row)) { $g['approved']++; $approved++; }
            unset($g);
        }
        ksort($groups);
        $this->line(json_encode(['schema_ready' => true, 'edition' => $edition->code, 'documents' => $documents,
            'source_available' => collect($documents)->contains(fn ($d) => $d['hash_matches']),
            'approved_equations' => $approved, 'coverage' => $groups,
            'note' => 'Counts describe registry review evidence, not complete design-code implementation.'], JSON_PRETTY_PRINT));
        return self::SUCCESS;
    }
}
