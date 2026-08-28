<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Materialização pra dashboards rápidos (Fase 5) - atualizada por job, nunca apagada mesmo após retenção/anonimização de áudio/transcrição. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_daily', function (Blueprint $table) {
            // uuid substituto, nao PK composta - MySQL forca NOT NULL em
            // toda coluna de PRIMARY KEY, o que quebraria a nulabilidade
            // de unidade/categoria/sentimento/urgencia/status (uma
            // dimensao "todos"/nao-informada precisa poder ser nula).
            // UNIQUE (nao PRIMARY) permite null distinto em cada linha.
            $table->uuid('id')->primary();
            $table->date('dia');
            // Tamanho curto (30, nao o default 255) de proposito: index
            // UNIQUE composto com 5 colunas string em utf8mb4 (4 bytes/
            // char) pode passar do limite de tamanho de chave do InnoDB
            // (767/3072 bytes conforme config) se cada coluna for 255 -
            // sao so valores curtos tipo enum, 30 sobra com folga.
            $table->string('unidade', 30)->nullable();
            $table->string('categoria', 30)->nullable();
            $table->string('sentimento', 30)->nullable();
            $table->string('urgencia', 30)->nullable();
            $table->string('status', 30)->nullable();
            $table->unsignedInteger('total')->default(0);

            $table->unique(['dia', 'unidade', 'categoria', 'sentimento', 'urgencia', 'status'], 'report_daily_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_daily');
    }
};
