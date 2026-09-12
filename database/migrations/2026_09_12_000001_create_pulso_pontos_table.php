<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Pulso Rápido": QR impresso (mesa, balcão, recepção) sem tablet/totem -
 * abre no celular do cliente, 1 toque em 3 carinhas por pergunta. Cada
 * `PulsoPonto` é UM QR físico (o token é o trecho fixo da URL impressa,
 * `/pulso/{token}`); as respostas de verdade vivem em `pulso_respostas`,
 * e a validade de cada abertura em `pulso_sessoes` (ver docs no
 * PulsoService).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pulso_pontos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organizacao_id')->constrained('organizacoes')->cascadeOnDelete();
            $table->string('nome'); // rótulo interno pro admin, ex.: "QR balcão"
            $table->string('unidade')->nullable();
            $table->json('perguntas'); // ex.: ["Atendimento", "Produto/Serviço"]
            $table->string('token', 64)->unique(); // trecho fixo impresso: /pulso/{token}
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pulso_pontos');
    }
};
