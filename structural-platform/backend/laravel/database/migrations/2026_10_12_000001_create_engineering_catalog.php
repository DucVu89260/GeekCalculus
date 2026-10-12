<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('locales', function (Blueprint $table) {
            $table->string('code', 8)->primary();
            $table->string('name');
        });
        Schema::create('catalog_options', function (Blueprint $table) {
            $table->string('code', 64)->primary();
            $table->string('kind', 32)->index();
            $table->unsignedInteger('sort_order')->default(0);
        });
        Schema::create('catalog_option_translations', function (Blueprint $table) {
            $table->id();
            $table->string('option_code', 64);
            $table->string('locale', 8);
            $table->string('name');
            $table->foreign('option_code')->references('code')->on('catalog_options')->cascadeOnDelete();
            $table->foreign('locale')->references('code')->on('locales')->cascadeOnDelete();
            $table->unique(['option_code', 'locale']);
        });
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            foreach (['project_type', 'standard', 'material', 'unit', 'module'] as $column) {
                $table->string($column, 64);
                $table->foreign($column)->references('code')->on('catalog_options')->restrictOnDelete();
            }
            $table->string('status')->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
        Schema::dropIfExists('catalog_option_translations');
        Schema::dropIfExists('catalog_options');
        Schema::dropIfExists('locales');
    }
};
