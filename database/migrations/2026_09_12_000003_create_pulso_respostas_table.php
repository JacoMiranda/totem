<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fato imutável de 1 toque numa carinha (ver App\Enums\PulsoValor).
 * `organizacao_id` desnormalizado (mesmo motivo de manifestations.
 * organizacao_id): todo relatório filtra por organização, sem isso viraria
 * join com pulso_pontos em toda consulta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pulso_respostas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pulso_ponto_id')->constrained('pulso_pontos')->cascadeOnDelete();
            $table->foreignUuid('organizacao_id')->constrained('organizacoes')->cascadeOnDelete();
            $table->string('pergunta');
            $table->string('valor', 10); // positivo|neutro|negativo
            $table->timestamp('criado_em')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pulso_respostas');
    }
};
