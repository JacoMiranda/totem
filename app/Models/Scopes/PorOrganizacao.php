<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Isola os dados por conta de cliente. Aplicado a Device e Manifestation.
 *
 * Regra, e o porquê de cada caso:
 *
 *  - Usuário logado COM organização -> só vê a própria. É o caso normal do
 *    painel/portal.
 *  - Usuário logado SEM organização (organizacao_id nulo) -> é a equipe da
 *    PLATAFORMA (nós); enxerga todas as contas, para suporte e back-office.
 *  - Sem usuário logado -> NÃO filtra. Aqui entram as rotas autenticadas por
 *    device key (o totem criando manifestação) e a consulta pública por
 *    protocolo+PIN. Nenhuma delas lista registros: operam sobre UM registro
 *    já identificado, então não há vazamento entre contas por esse caminho.
 *    Quem garante o vínculo nesses fluxos é o próprio device (ver
 *    ManifestationController) - não este scope.
 *
 * Para ignorar deliberadamente (jobs, migrações, comandos de manutenção):
 * `Model::withoutGlobalScope(PorOrganizacao::class)`.
 */
class PorOrganizacao implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $user = Auth::user();

        if (! $user || ! $user->organizacao_id) {
            return;
        }

        $builder->where($model->getTable().'.organizacao_id', $user->organizacao_id);
    }
}
