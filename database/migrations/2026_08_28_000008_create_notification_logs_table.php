<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Log de envios (docs/MODELO-DADOS.md::notification) - nome
 * `notification_logs`, não `notifications`, pra não colidir com a
 * tabela que `php artisan notifications:table` criaria pro sistema
 * nativo de notificações do Laravel (Notifiable/database channel) -
 * aqui é um conceito próprio do domínio, mais simples.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('manifestation_id')->nullable();
            $table->foreign('manifestation_id')->references('id')->on('manifestations')->nullOnDelete();
            $table->string('tipo'); // critica_recebida | sla_estourado | atribuida
            $table->string('canal'); // NotifChannel
            $table->string('destino');
            $table->json('payload')->nullable();
            $table->string('status')->default('pendente'); // NotifStatus
            $table->unsignedSmallInteger('tentativas')->default(0);
            $table->timestamp('enviada_em')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
    }
};
