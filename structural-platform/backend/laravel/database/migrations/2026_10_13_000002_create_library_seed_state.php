<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_seed_state', fn (Blueprint $t) => $t->string('version')->primary());
    }

    public function down(): void
    {
        Schema::dropIfExists('library_seed_state');
    }
};
