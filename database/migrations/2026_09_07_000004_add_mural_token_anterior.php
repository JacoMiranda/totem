<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Quando o admin troca o token do mural (/mural/<token>), qualquer TV que
 * já esteja mostrando o link antigo ficaria órfã. `mural_token_anterior`
 * continua resolvendo por 48h (`mural_token_anterior_ate`) - tempo pra
 * atualizar o link nas telas -, exibindo um aviso de que o endereço mudou.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->string('mural_token_anterior', 64)->nullable();
            $table->timestamp('mural_token_anterior_ate')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn(['mural_token_anterior', 'mural_token_anterior_ate']);
        });
    }
};
