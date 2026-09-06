<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Vincula o que já existe a uma organização.
 *
 * `organizacao_id` é NULLABLE em `users` de propósito: nulo = equipe da
 * PLATAFORMA (nós), que enxerga todas as contas. Em `devices` e
 * `manifestations` o nulo é só transitório, para os registros criados antes
 * desta migração - a "Organização Padrão" abaixo os adota.
 *
 * `manifestations.organizacao_id` é desnormalizado (dá pra chegar nele por
 * device_id) porque TODA listagem/relatório do painel filtra por
 * organização; sem a coluna, cada consulta viraria um join.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignUuid('organizacao_id')->nullable()->after('id')
                ->constrained('organizacoes')->nullOnDelete();
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->foreignUuid('organizacao_id')->nullable()->after('id')
                ->constrained('organizacoes')->cascadeOnDelete();
        });

        Schema::table('manifestations', function (Blueprint $table) {
            $table->uuid('organizacao_id')->nullable()->after('id')->index();
        });

        $this->adotarRegistrosOrfaos();
    }

    /**
     * Cria a "Organização Padrão" e adota devices/manifestações que já
     * existiam. Sem isso, tudo o que foi registrado antes da Fase 10
     * sumiria das telas assim que o filtro por organização entrasse.
     */
    private function adotarRegistrosOrfaos(): void
    {
        $temDevicesOrfaos = DB::table('devices')->whereNull('organizacao_id')->exists();
        $temUsuarios = DB::table('users')->exists();

        if (! $temDevicesOrfaos && ! $temUsuarios) {
            return;
        }

        $id = (string) Str::uuid();
        DB::table('organizacoes')->insert([
            'id' => $id,
            'nome' => 'Organização Padrão',
            'slug' => 'Padrao',
            'status' => 'ativa',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('devices')->whereNull('organizacao_id')->update(['organizacao_id' => $id]);
        DB::table('users')->whereNull('organizacao_id')->update(['organizacao_id' => $id]);
        DB::table('manifestations')->whereNull('organizacao_id')->update(['organizacao_id' => $id]);
    }

    public function down(): void
    {
        Schema::table('manifestations', fn (Blueprint $t) => $t->dropColumn('organizacao_id'));
        Schema::table('devices', function (Blueprint $t) {
            $t->dropForeign(['organizacao_id']);
            $t->dropColumn('organizacao_id');
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dropForeign(['organizacao_id']);
            $t->dropColumn('organizacao_id');
        });
    }
};
