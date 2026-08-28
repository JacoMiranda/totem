<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** TTS e análises reaproveitáveis - chave = sha256(texto[+voz]), ver docs/ARQUITETURA.md (proxy Gemini). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_cache', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('chave', 64)->unique(); // sha256
            $table->string('tipo'); // tts | analyze
            $table->string('object_key')->nullable(); // tts: caminho do áudio cacheado
            $table->longText('texto')->nullable(); // analyze: resultado cacheado
            $table->timestamp('criado_em')->useCurrent();
            $table->timestamp('expira_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_cache');
    }
};
