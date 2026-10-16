<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('standard_documents', function (Blueprint $table) {
            $table->string('revision', 100)->nullable();
            $table->jsonb('metadata')->nullable();
            $table->jsonb('source_identity')->nullable();
            $table->jsonb('import_report')->nullable();
            $table->string('verification_status', 30)->default('candidate');
            $table->timestamp('imported_at')->nullable();
            $table->index(['edition_id', 'processing_status', 'verification_status'], 'standard_documents_status_idx');
        });

        Schema::table('standard_clauses', function (Blueprint $table) {
            $table->string('source_context', 120)->default('legacy');
            $table->char('source_sha256', 64)->nullable();
            $table->string('printed_page_label', 40)->nullable();
            $table->jsonb('source_anchor')->nullable();
            $table->string('extraction_method', 40)->nullable();
            $table->unsignedSmallInteger('level')->nullable();
        });

        Schema::table('standard_clauses', function (Blueprint $table) {
            $table->dropUnique('standard_clauses_edition_id_kind_code_unique');
            $table->unique(
                ['edition_id', 'kind', 'code', 'source_context'],
                'standard_clauses_source_context_unique',
            );
            $table->index(['edition_id', 'kind', 'code'], 'standard_clauses_lookup_idx');
        });

        Schema::table('standard_equations', function (Blueprint $table) {
            $table->foreignId('document_id')->nullable()
                ->constrained('standard_documents')->nullOnDelete();
            $table->string('source_context', 120)->default('legacy');
            $table->char('source_sha256', 64)->nullable();
            $table->string('printed_page_label', 40)->nullable();
            $table->jsonb('source_anchor')->nullable();
            $table->string('extraction_method', 40)->nullable();
            $table->string('design_method', 20)->nullable();
            $table->unsignedInteger('record_version')->default(1);
            $table->foreignId('supersedes_id')->nullable()->constrained('standard_equations')->nullOnDelete();
            $table->jsonb('dependencies')->nullable();
            $table->text('source_notes')->nullable();
            $table->jsonb('source_metadata')->nullable();
        });

        Schema::create('standard_parameters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('edition_id')->constrained('standard_editions')->restrictOnDelete();
            $table->foreignId('document_id')->nullable()->constrained('standard_documents')->nullOnDelete();
            $table->foreignId('clause_id')->nullable()->constrained('standard_clauses')->nullOnDelete();
            $table->foreignId('supersedes_id')->nullable()->constrained('standard_parameters')->nullOnDelete();
            $table->string('source_context', 120)->default('legacy');
            $table->char('source_sha256', 64)->nullable();
            $table->string('kind', 30)->default('normative');
            $table->string('parameter_key', 160);
            $table->string('label', 255)->nullable();
            $table->string('data_type', 40);
            $table->jsonb('value')->nullable();
            $table->string('units', 80)->nullable();
            $table->jsonb('dimensions')->nullable();
            $table->jsonb('conditions')->nullable();
            $table->string('design_method', 20)->nullable();
            $table->text('source_notes')->nullable();
            $table->jsonb('source_metadata')->nullable();
            $table->unsignedInteger('pdf_page')->nullable();
            $table->string('printed_page_label', 40)->nullable();
            $table->jsonb('source_anchor')->nullable();
            $table->string('extraction_method', 40)->nullable();
            $table->string('verification_status', 30)->default('candidate');
            $table->string('implementation_key', 160)->nullable();
            $table->unsignedInteger('record_version')->default(1);
            $table->timestamps();
            $table->unique(['edition_id', 'source_context', 'kind', 'parameter_key'], 'standard_parameters_context_kind_key_unique');
            $table->index(['edition_id', 'parameter_key'], 'standard_parameters_lookup_idx');
            $table->index(['edition_id', 'verification_status'], 'standard_parameters_status_idx');
        });

        Schema::create('standard_tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('edition_id')->constrained('standard_editions')->restrictOnDelete();
            $table->foreignId('document_id')->nullable()->constrained('standard_documents')->nullOnDelete();
            $table->foreignId('clause_id')->nullable()->constrained('standard_clauses')->nullOnDelete();
            $table->foreignId('supersedes_id')->nullable()->constrained('standard_tables')->nullOnDelete();
            $table->string('source_context', 120)->default('legacy');
            $table->char('source_sha256', 64)->nullable();
            $table->string('kind', 30)->default('normative');
            $table->string('table_code', 100);
            $table->string('title', 255)->nullable();
            $table->jsonb('columns')->nullable();
            $table->jsonb('rows')->nullable();
            $table->jsonb('footnotes')->nullable();
            $table->jsonb('applicability')->nullable();
            $table->jsonb('merged_cells')->nullable();
            $table->jsonb('coverage')->nullable();
            $table->string('coverage_type', 40)->nullable();
            $table->boolean('complete_table')->nullable();
            $table->jsonb('design_methods')->nullable();
            $table->unsignedInteger('pdf_page')->nullable();
            $table->string('printed_page_label', 40)->nullable();
            $table->jsonb('source_anchor')->nullable();
            $table->string('extraction_method', 40)->nullable();
            $table->string('verification_status', 30)->default('candidate');
            $table->string('implementation_key', 160)->nullable();
            $table->unsignedInteger('record_version')->default(1);
            $table->text('source_notes')->nullable();
            $table->jsonb('source_metadata')->nullable();
            $table->timestamps();
            $table->unique(['edition_id', 'source_context', 'kind', 'table_code'], 'standard_tables_context_kind_code_unique');
            $table->index(['edition_id', 'table_code'], 'standard_tables_lookup_idx');
            $table->index(['edition_id', 'verification_status'], 'standard_tables_status_idx');
        });

        Schema::create('standard_review_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('edition_id')->constrained('standard_editions')->restrictOnDelete();
            $table->foreignId('document_id')->nullable()->constrained('standard_documents')->nullOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('record_type', 40);
            $table->unsignedBigInteger('record_id');
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->text('notes')->nullable();
            $table->jsonb('content_snapshot')->nullable();
            $table->timestamps();
            $table->index(['edition_id', 'record_type', 'record_id'], 'standard_review_record_idx');
            $table->index(['reviewer_id', 'created_at'], 'standard_review_reviewer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('standard_review_history');
        Schema::dropIfExists('standard_tables');
        Schema::dropIfExists('standard_parameters');
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->dropForeign(['document_id']);
            $table->dropForeign(['supersedes_id']);
            $table->dropColumn([
                'document_id', 'source_context', 'source_sha256', 'printed_page_label',
                'source_anchor', 'extraction_method', 'design_method', 'record_version', 'supersedes_id', 'dependencies',
                'source_notes', 'source_metadata',
            ]);
        });
        Schema::table('standard_clauses', function (Blueprint $table) {
            $table->dropUnique('standard_clauses_source_context_unique');
            $table->dropIndex('standard_clauses_lookup_idx');
            $table->dropColumn([
                'source_context', 'source_sha256', 'printed_page_label',
                'source_anchor', 'extraction_method', 'level',
            ]);
            $table->unique(['edition_id', 'kind', 'code']);
        });
        Schema::table('standard_documents', function (Blueprint $table) {
            $table->dropIndex('standard_documents_status_idx');
            $table->dropColumn([
                'revision', 'metadata', 'source_identity', 'import_report',
                'verification_status', 'imported_at',
            ]);
        });
    }
};
