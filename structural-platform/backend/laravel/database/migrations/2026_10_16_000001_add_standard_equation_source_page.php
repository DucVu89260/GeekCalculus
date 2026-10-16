<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->unsignedInteger('pdf_page')->nullable()->after('label');
        });
    }
    public function down(): void {
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->dropColumn('pdf_page');
        });
    }
};
