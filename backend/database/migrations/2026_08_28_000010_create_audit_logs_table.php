<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Auditoria imutável: login, acesso a áudio, export, reclassificação, alteração de device. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('ator_id')->nullable()->constrained('users')->nullOnDelete(); // nulo = sistema/device
            $table->uuid('device_id')->nullable();
            $table->foreign('device_id')->references('id')->on('devices')->nullOnDelete();
            $table->string('acao');
            $table->string('entidade');
            $table->uuid('entidade_id')->nullable();
            $table->json('metadados')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('criado_em')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
