<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Totem físico (kiosk) - autenticado por device API key (escopo restrito: manifestations:create + ai:invoke), ver docs/ARQUITETURA.md. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('codigo')->unique(); // ex.: TOTEM-CENTRO-01
            $table->string('nome');
            $table->string('unidade')->nullable();
            $table->string('api_key_hash');
            $table->boolean('ativo')->default(true);
            $table->timestamp('ultima_sync_em')->nullable();
            $table->string('versao_app')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
