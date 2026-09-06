<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * `recebe_atribuicao`: entra no rodízio de distribuição automática de
 * manifestações (ver App\Services\AtribuidorDeManifestacoes). Quem tem o
 * flag ligado recebe casos novos automaticamente, equilibrado pela carga
 * em aberto. Editável no cadastro de equipe (/admin/equipe).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('recebe_atribuicao')->default(false)->after('ativo');
        });

        // Analistas existentes já entram no rodízio por padrão (o papel de
        // quem resolve). Admin/atendente/leitor ficam de fora até ligarem.
        DB::table('users')->where('role', 'analista')->update(['recebe_atribuicao' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('recebe_atribuicao');
        });
    }
};
