<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Schema de docs/MODELO-DADOS.md, adaptado de Postgres/Prisma pra
 * MySQL/Eloquent. Diferenças reais:
 * - `criado_em` (data do atendimento, vem do device) é um campo
 *   explícito, DIFERENTE de `recebido_em`/`atualizado_em` (que o
 *   Eloquent trata como created_at/updated_at - ver Manifestation::
 *   CREATED_AT/UPDATED_AT no model).
 * - `requerente_type`/`requerente_id`: novo (pedido do usuário, não
 *   estava no plano original) - relação polimórfica opcional pra
 *   Person ou Company; null = manifestação anônima (modo padrão do
 *   totem, preservado do protótipo).
 * - Sem GIN/full-text idênticos ao Postgres - índices normais nas
 *   colunas escalares; busca textual em transcrição/resumo fica pra
 *   quando o volume justificar (Fase 5+), não bloqueia a Fase 0.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifestations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('protocolo')->nullable()->unique(); // OUV-AAAAMM-NNNNNN, gerado no servidor
            $table->uuid('client_id')->unique(); // gerado no totem, chave de idempotência do sync
            $table->string('pin_acompanhamento')->nullable(); // hash, nunca em texto puro

            $table->string('canal')->default('Totem');
            $table->uuid('device_id')->nullable();
            $table->foreign('device_id')->references('id')->on('devices')->nullOnDelete();

            $table->string('requerente_type')->nullable();
            $table->uuid('requerente_id')->nullable();

            $table->text('transcricao')->nullable();
            $table->text('resumo')->nullable();
            $table->json('keywords')->nullable();
            $table->string('sentimento')->nullable();
            $table->string('categoria')->nullable();
            $table->string('urgencia')->default('Média');
            $table->string('status')->default('Recebida');

            $table->foreignId('responsavel_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resposta_oficial')->nullable();
            $table->timestamp('resposta_publicada_em')->nullable();

            $table->string('audio_object_key')->nullable();
            $table->string('audio_mime')->nullable();
            $table->unsignedInteger('audio_duracao_seg')->nullable();

            $table->boolean('consentimento_lgpd')->default(false);
            $table->string('origem_ip', 45)->nullable();

            $table->timestamp('criado_em'); // data do atendimento, vem do device
            $table->timestamp('recebido_em')->useCurrent(); // quando a API registrou (sync)
            $table->timestamp('atualizado_em')->useCurrent()->useCurrentOnUpdate();
            $table->timestamp('anonimizado_em')->nullable();

            $table->index('categoria');
            $table->index('status');
            $table->index('urgencia');
            $table->index('criado_em');
            $table->index(['requerente_type', 'requerente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifestations');
    }
};
