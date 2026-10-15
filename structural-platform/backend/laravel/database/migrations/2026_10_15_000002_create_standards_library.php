<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('standard_families', function (Blueprint $t) {
            $t->id(); $t->string('code', 40)->unique(); $t->string('name'); $t->string('publisher', 100)->nullable(); $t->timestamps();
        });
        Schema::create('standard_editions', function (Blueprint $t) {
            $t->id(); $t->foreignId('family_id')->constrained('standard_families')->restrictOnDelete();
            $t->string('code', 64)->unique(); $t->unsignedSmallInteger('year'); $t->string('title');
            $t->string('status', 30)->default('catalogued'); $t->timestamps();
            $t->unique(['family_id', 'year']);
        });
        Schema::create('standard_documents', function (Blueprint $t) {
            $t->id(); $t->foreignId('edition_id')->constrained('standard_editions')->restrictOnDelete();
            $t->string('kind', 30); $t->string('original_name'); $t->string('private_path');
            $t->char('sha256', 64); $t->unsignedInteger('page_count')->nullable();
            $t->string('processing_status', 30)->default('pending'); $t->timestamps();
            $t->unique(['edition_id', 'sha256']);
        });
        Schema::create('standard_clauses', function (Blueprint $t) {
            $t->id(); $t->foreignId('edition_id')->constrained('standard_editions')->restrictOnDelete();
            $t->foreignId('parent_id')->nullable()->constrained('standard_clauses')->nullOnDelete();
            $t->foreignId('document_id')->nullable()->constrained('standard_documents')->nullOnDelete();
            $t->string('code', 100); $t->string('title'); $t->string('kind', 30)->default('normative');
            $t->unsignedInteger('pdf_page')->nullable(); $t->unsignedInteger('printed_page')->nullable();
            $t->longText('summary')->nullable(); $t->string('verification_status', 30)->default('index_only');
            $t->timestamps(); $t->unique(['edition_id','kind','code']);
        });
        Schema::create('standard_equations', function (Blueprint $t) {
            $t->id(); $t->foreignId('clause_id')->constrained('standard_clauses')->restrictOnDelete();
            $t->string('label', 80); $t->text('latex')->nullable(); $t->json('variables')->nullable();
            $t->json('conditions')->nullable(); $t->string('verification_status', 30)->default('candidate');
            $t->string('implementation_key')->nullable(); $t->timestamps();
            $t->unique(['clause_id','label']);
        });
        Schema::create('standard_notes', function (Blueprint $t) {
            $t->id(); $t->foreignId('clause_id')->constrained('standard_clauses')->restrictOnDelete();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('kind',30)->default('personal_note'); $t->longText('body');
            $t->string('review_status',30)->default('draft'); $t->timestamps();
        });
    }
    public function down(): void {
        foreach (['standard_notes','standard_equations','standard_clauses','standard_documents','standard_editions','standard_families'] as $table) Schema::dropIfExists($table);
    }
};
