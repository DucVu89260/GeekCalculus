<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ImportAsce710Pdf extends Command
{
    protected $signature = 'standards:import-asce710-pdf {pdf : Path to the ASCE 7-10 source PDF}';
    protected $description = 'Import ASCE 7-10 using the bundled outline (alias of standards:import-pdf)';

    public function handle(): int
    {
        return $this->call('standards:import-pdf', [
            'pdf'=>$this->argument('pdf'),
            'manifest'=>base_path('../../standards/asce7-10-library.json'),
        ]);
    }
}
