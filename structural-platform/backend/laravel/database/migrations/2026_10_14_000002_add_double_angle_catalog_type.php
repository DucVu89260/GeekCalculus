<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add this new capability once; never resurrect types an admin already deleted.
        if (DB::table('library_seed_state')->where('version', 'double-angle-v1')->exists()) {
            return;
        }
        DB::transaction(function () {
            DB::table('section_types')->insertOrIgnore([
                'code' => 'double_angle', 'shape' => 'double_angle', 'category' => 'steel',
                'name_vi' => 'DOUBLE ANGLE — Hai thép góc', 'name_en' => 'DOUBLE ANGLE',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('library_seed_state')->insert(['version' => 'double-angle-v1']);
        });
    }

    public function down(): void
    {
        // Catalog records are user data once created; rollback must not delete them.
    }
};
