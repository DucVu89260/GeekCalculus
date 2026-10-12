<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->string('role')->default('user'));
        Schema::table('projects', fn (Blueprint $t) => $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete());
        Schema::create('materials', function (Blueprint $t) {
            $t->id();
            $t->string('code', 64)->unique();
            $t->string('name_vi');
            $t->string('name_en');
            $t->string('category');
            $t->json('properties');
            $t->text('source')->nullable();
            $t->timestamps();
        });
        Schema::create('section_types', function (Blueprint $t) {
            $t->id();
            $t->string('code', 64)->unique();
            $t->string('name_vi');
            $t->string('name_en');
            $t->string('category');
            $t->string('shape');
            $t->timestamps();
        });
        Schema::create('sections', function (Blueprint $t) {
            $t->id();
            $t->string('code', 64)->unique();
            $t->string('name_vi');
            $t->string('name_en');
            $t->foreignId('material_id')->constrained()->restrictOnDelete();
            $t->foreignId('section_type_id')->constrained()->restrictOnDelete();
            $t->json('properties');
            $t->text('source')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sections');
        Schema::dropIfExists('section_types');
        Schema::dropIfExists('materials');
        Schema::table('projects', fn (Blueprint $t) => $t->dropConstrainedForeignId('user_id'));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('role'));
    }
};
