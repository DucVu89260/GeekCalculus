<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->string('design_code', 32)->nullable()->index();
        });
        Schema::table('section_types', function (Blueprint $table) {
            $table->string('design_code', 32)->nullable();
            $table->string('region_type', 64)->nullable();
            $table->index(['design_code', 'region_type']);
        });
    }

    public function down(): void
    {
        Schema::table('section_types', function (Blueprint $table) {
            $table->dropIndex(['design_code', 'region_type']);
            $table->dropColumn(['design_code', 'region_type']);
        });
        Schema::table('materials', function (Blueprint $table) {
            $table->dropIndex(['design_code']);
            $table->dropColumn('design_code');
        });
    }
};
