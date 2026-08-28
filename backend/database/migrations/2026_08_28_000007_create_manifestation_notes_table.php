<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Notas internas - nunca públicas (não aparecem no acompanhamento por protocolo). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manifestation_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('manifestation_id');
            $table->foreign('manifestation_id')->references('id')->on('manifestations')->cascadeOnDelete();
            $table->foreignId('autor_id')->constrained('users')->cascadeOnDelete();
            $table->text('texto');
            $table->timestamp('criado_em')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manifestation_notes');
    }
};
