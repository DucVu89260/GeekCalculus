<?php

namespace App\Console\Commands;

use App\Services\StandardsOutlineImporter;
use Illuminate\Console\Command;

class ImportStandardsOutline extends Command
{
    protected $signature = 'standards:import-outline {json : JSON manifest for a registered standards edition}';
    protected $description = 'Import a page-linked outline for any registered standards edition (AISC bookmarks or clauses JSON)';

    public function handle(StandardsOutlineImporter $importer): int
    {
        try {
            $manifest = $importer->read($this->argument('json'));
            $importer->import($manifest);
            $this->info($manifest['edition']->code.': imported '.count($manifest['clauses']).' outline entries and '.count($manifest['candidates']).' unverified equation labels.');
            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }
    }
}
