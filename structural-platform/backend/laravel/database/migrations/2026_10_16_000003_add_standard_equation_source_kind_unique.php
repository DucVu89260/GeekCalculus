<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->string('kind', 30)->default('normative');
        });

        DB::table('standard_equations as equation')
            ->join('standard_clauses as clause', 'clause.id', '=', 'equation.clause_id')
            ->orderBy('equation.id')
            ->select(['equation.id', 'clause.kind'])
            ->get()
            ->each(function ($row): void {
                DB::table('standard_equations')
                    ->where('id', $row->id)
                    ->update(['kind' => $row->kind]);
            });

        Schema::table('standard_equations', function (Blueprint $table) {
            $table->unique(
                ['document_id', 'kind', 'label'],
                'standard_equations_document_kind_label_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('standard_equations', function (Blueprint $table) {
            $table->dropUnique('standard_equations_document_kind_label_unique');
            $table->dropColumn('kind');
        });
    }
};
