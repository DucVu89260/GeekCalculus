<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(EngineeringSeeder::class);
        $catalog = json_decode(file_get_contents(base_path('../../database/seeds/catalog.json')), true, 512, JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($catalog) {
            foreach (['vi' => 'Tiếng Việt', 'en' => 'English'] as $code => $name) {
                DB::table('locales')->updateOrInsert(['code' => $code], ['name' => $name]);
            }
            foreach ($catalog as $kind => $options) {
                if ($kind === 'materials') {
                    continue;
                }
                foreach ($options as $sort => $option) {
                    DB::table('catalog_options')->updateOrInsert(['code' => $option['code']], ['kind' => $kind, 'sort_order' => $sort]);
                    foreach ($option['translations'] as $locale => $name) {
                        DB::table('catalog_option_translations')->updateOrInsert(
                            ['option_code' => $option['code'], 'locale' => $locale], ['name' => $name]
                        );
                    }
                }
            }
        });
        foreach (DB::table('materials')->get() as $material) {
            DB::table('catalog_options')->updateOrInsert(['code' => $material->code], ['kind' => 'materials', 'sort_order' => 100]);
            foreach (['vi' => $material->name_vi, 'en' => $material->name_en] as $locale => $name) {
                DB::table('catalog_option_translations')->updateOrInsert(['option_code' => $material->code, 'locale' => $locale], ['name' => $name]);
            }
        }
    }
}
