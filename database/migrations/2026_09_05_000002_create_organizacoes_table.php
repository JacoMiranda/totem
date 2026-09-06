<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Conta do cliente (tenant). Tudo que é operacional - usuários, totens,
 * manifestações - pendura aqui, e as consultas do painel são filtradas por
 * `organizacao_id` (ver App\Models\Scopes\PorOrganizacao).
 *
 * `slug` é a base do código dos totens: "Luiza Brok" -> "LuizaBrok" ->
 * LuizaBrok-01, LuizaBrok-02... (ver NomeadorDeTotens).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizacoes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nome');
            $table->string('slug')->unique();
            $table->string('documento')->nullable();   // CNPJ, quando houver
            $table->foreignUuid('plano_id')->nullable()->constrained('planos')->nullOnDelete();
            $table->string('status')->default('trial'); // App\Enums\OrganizacaoStatus
            $table->timestamp('trial_expira_em')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizacoes');
    }
};
