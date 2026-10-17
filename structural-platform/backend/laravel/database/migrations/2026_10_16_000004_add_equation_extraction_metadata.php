<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->float('extraction_confidence')->nullable();
            $table->jsonb('asd_lrfd_factors')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('standard_equations', fn (Blueprint $table) => $table->dropColumn(['extraction_confidence', 'asd_lrfd_factors']));
    }
};
