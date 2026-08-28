<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Usada em transação (lockForUpdate) por ProtocoloService pra gerar o número sequencial do protocolo OUV-AAAAMM-NNNNNN. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('protocol_sequences', function (Blueprint $table) {
            $table->string('ano_mes', 6)->primary(); // AAAAMM
            $table->unsignedInteger('ultimo')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('protocol_sequences');
    }
};
