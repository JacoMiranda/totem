<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Painel público do s-Totem (a "tela de LED simples" do pitch original):
 * um link só, por organização, agregando TODOS os pontos ativos - mesmo
 * espírito do mural_token, mas sem PIN/tema/grace por enquanto (v1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->boolean('pulso_painel_ativo')->default(false);
            $table->string('pulso_painel_token', 64)->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn(['pulso_painel_ativo', 'pulso_painel_token']);
        });
    }
};
