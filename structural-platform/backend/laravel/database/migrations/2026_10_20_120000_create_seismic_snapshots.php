<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seismic_imports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->longText('book');
            $t->longText('normalized')->nullable();
            $t->timestamps();
        });
        Schema::create('seismic_runs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('seismic_import_id')->nullable()->constrained('seismic_imports')->nullOnDelete();
            $t->longText('snapshot');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seismic_runs');
        Schema::dropIfExists('seismic_imports');
    }
};
