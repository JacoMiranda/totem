<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Orientação de deslocamento no rodapé do mural: onde fica o totem e, se a
 * instituição usa faixas coloridas no chão, qual seguir.
 *
 * - `mural_totem_local` vazio  => o totem está na mesma sala da TV.
 * - `mural_linha_cor`  vazio   => não menciona linha nenhuma.
 * Editável em /admin/mural.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->string('mural_totem_local', 120)->nullable();
            $table->string('mural_linha_cor', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn(['mural_totem_local', 'mural_linha_cor']);
        });
    }
};
