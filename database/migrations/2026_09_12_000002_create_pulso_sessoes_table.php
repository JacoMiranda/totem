<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cada abertura do link (scan do QR) gera UMA sessão com hash próprio -
 * é o "link gerado" de verdade (o token do ponto, impresso, é fixo e
 * nunca muda). `passo_atual` guarda a última pergunta respondida; ao
 * responder a última da lista, `concluida_em` é preenchido e a sessão
 * não aceita mais respostas (410 em PulsoController::responder). Passados
 * 3 min sem concluir (`expira_em`), o mesmo vale por timeout. Ambos os
 * casos exigem escanear o QR de novo, que gera uma sessão nova.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pulso_sessoes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('pulso_ponto_id')->constrained('pulso_pontos')->cascadeOnDelete();
            $table->string('hash', 64)->unique();
            $table->unsignedTinyInteger('passo_atual')->default(0);
            $table->timestamp('expira_em');
            $table->timestamp('concluida_em')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pulso_sessoes');
    }
};
