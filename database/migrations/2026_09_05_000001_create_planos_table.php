<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catálogo de pacotes. O cliente escolhe um no cadastro e o sistema
 * provisiona `limite_dispositivos` totens já nomeados (ver
 * App\Services\NomeadorDeTotens).
 *
 * `preco_centavos` é NULLABLE de propósito: os valores ainda não foram
 * definidos. Guardar em centavos (inteiro) evita erro de arredondamento de
 * float, e nulo significa "sob consulta" - a home mostra isso em vez de
 * inventar um número.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('planos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();          // ex.: 'essencial'
            $table->string('nome');                    // ex.: 'Essencial'
            $table->text('descricao')->nullable();
            $table->unsignedSmallInteger('limite_dispositivos');
            $table->unsignedInteger('preco_centavos')->nullable();
            $table->json('recursos')->nullable();      // bullets exibidos na home
            $table->unsignedSmallInteger('trial_dias')->default(0);
            $table->boolean('ativo')->default(true);
            $table->unsignedSmallInteger('ordem')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('planos');
    }
};
