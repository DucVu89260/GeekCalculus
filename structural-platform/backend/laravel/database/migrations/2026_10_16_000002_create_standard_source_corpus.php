<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('standard_documents', function (Blueprint $t) {
            $t->string('corpus_path')->nullable();
            $t->json('extraction_summary')->nullable();
        });
        Schema::create('standard_source_pages', function (Blueprint $t) {
            $t->id(); $t->foreignId('document_id')->constrained('standard_documents')->restrictOnDelete();
            $t->unsignedInteger('pdf_page'); $t->string('printed_label', 30)->nullable();
            $t->string('chapter', 30)->nullable(); $t->string('kind', 30);
            $t->string('extraction_method', 30); $t->string('coverage_status', 40);
            $t->longText('native_text'); $t->longText('ocr_text');
            $t->longText('ocr_words_tsv')->nullable(); $t->json('blocks'); $t->json('numeric_tokens');
            $t->string('image_path'); $t->char('image_sha256', 64); $t->char('text_sha256', 64);
            $t->unique(['document_id','pdf_page']);
        });
        Schema::create('standard_source_items', function (Blueprint $t) {
            $t->id(); $t->foreignId('page_id')->constrained('standard_source_pages')->restrictOnDelete();
            $t->string('kind', 20); $t->string('label', 80); $t->string('channel', 10);
            $t->unsignedInteger('offset'); $t->text('context');
            $t->string('occurrence_type', 40); $t->string('verification_status', 30)->default('candidate');
            $t->unique(['page_id','kind','label','channel','offset'], 'standard_source_occurrence_unique');
            $t->index(['kind','label']);
        });
    }
    public function down(): void {
        Schema::dropIfExists('standard_source_items'); Schema::dropIfExists('standard_source_pages');
        Schema::table('standard_documents', function (Blueprint $t) { $t->dropColumn(['corpus_path','extraction_summary']); });
    }
};
