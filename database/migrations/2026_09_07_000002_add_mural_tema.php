<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `mural_tema`: aparência do mural público - 'claro' (dashboard branco,
 * cabeçalho azul) ou 'escuro' (fundo escuro, para TVs em ambiente com
 * pouca luz / menos risco de burn-in). O admin escolhe em /admin/mural.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->string('mural_tema', 12)->default('claro');
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn('mural_tema');
        });
    }
};
