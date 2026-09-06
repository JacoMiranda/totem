<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PIN opcional pro mural. Sem PIN, o link abre direto (comportamento
 * atual). Com PIN, cada navegador (TV) digita o código uma vez e guarda -
 * um link copiado pra outro navegador pede o PIN de novo.
 *
 * Guardado em texto claro de propósito: é um código de 4-6 dígitos de
 * conveniência pra travar uma tela, não uma credencial. O dado do mural
 * já é só percentual agregado (ver MuralService).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->string('mural_pin', 12)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn('mural_pin');
        });
    }
};
