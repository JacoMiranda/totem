<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mural público de transparência (docs/MURAL-PUBLICO.md). Uma tela sem
 * login que a empresa põe na recepção pro cliente ver o compromisso da
 * ouvidoria: % de manifestações respondidas/resolvidas, tempo médio de
 * resposta, elogios recentes.
 *
 * - `mural_ativo`: opt-in. Desligado por padrão - a empresa decide expor.
 * - `mural_token`: parte secreta da URL (/mural/{token}). Não é o slug,
 *   pra concorrente não achar pela razão social.
 * - `mural_titulo`: cabeçalho da tela (default: nome da organização).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->boolean('mural_ativo')->default(false);
            $table->string('mural_token', 64)->nullable()->unique();
            $table->string('mural_titulo')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizacoes', function (Blueprint $table) {
            $table->dropColumn(['mural_ativo', 'mural_token', 'mural_titulo']);
        });
    }
};
