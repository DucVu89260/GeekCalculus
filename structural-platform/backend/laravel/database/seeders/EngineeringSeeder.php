<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EngineeringSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::table('library_seed_state')->where('version', 'baseline-v1')->exists()) {
            return;
        }
        $data = json_decode(file_get_contents(base_path('../../database/seeds/engineering-data.json')), true, 512, JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($data) {
            foreach (['materials', 'section_types'] as $table) {
                foreach ($data[$table] as $row) {
                    if (isset($row['properties'])) {
                        $row['properties'] = json_encode($row['properties']);
                    }
                    DB::table($table)->insertOrIgnore($row + ['created_at' => now(), 'updated_at' => now()]);
                }
            }
            DB::table('library_seed_state')->insert(['version' => 'baseline-v1']);
        });
    }
}
