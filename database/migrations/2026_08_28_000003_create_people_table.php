<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cadastro de pessoa física - pedido do usuário (não estava no plano
 * original, que só previa manifestação anônima). Uma manifestação PODE
 * ter um requerente identificado (person OU company, nunca os dois -
 * ver requerente_type/requerente_id em manifestations) ou nenhum
 * (modo anônimo do totem, preservado do protótipo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('people', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nome');
            $table->string('cpf', 14)->nullable()->unique();
            $table->string('email')->nullable();
            $table->string('telefone')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('people');
    }
};
