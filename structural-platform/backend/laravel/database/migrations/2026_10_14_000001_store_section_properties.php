<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sections', function (Blueprint $table) {
            // Canonical, versioned XY result; preserve legacy catalog data until recalculated.
            $table->json('section_properties')->nullable();
            $table->timestamp('section_properties_calculated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sections', fn (Blueprint $table) => $table->dropColumn(['section_properties', 'section_properties_calculated_at']));
    }
};
