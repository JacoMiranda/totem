<?php

namespace App\Services;

use App\Models\Manifestation;
use App\Models\Organizacao;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Distribuição automática de manifestações entre a equipe.
 *
 * Pool = usuários da organização com `recebe_atribuicao` ligado e `ativo`
 * (cadastro em /admin/equipe). A escolha é por MENOR CARGA: vai pra quem
 * tem menos manifestações em aberto (status != Concluída/Arquivada).
 * Empate → sorteio. Isso equaliza ao longo do tempo e se ajusta sozinho
 * quando alguém é reatribuído, entra ou sai de férias.
 *
 * Sem ninguém no pool → devolve null e a manifestação fica sem responsável
 * (a equipe atribui à mão no painel).
 */
class AtribuidorDeManifestacoes
{
    private const ABERTAS = ['Recebida', 'Em triagem', 'Em análise', 'Respondida'];

    public function proximoResponsavel(Organizacao $org): ?User
    {
        $pool = User::query()
            ->where('organizacao_id', $org->id)
            ->where('ativo', true)
            ->where('recebe_atribuicao', true)
            ->get(['id', 'name']);

        if ($pool->isEmpty()) {
            return null;
        }

        $carga = $this->cargaPorResponsavel($org, $pool->pluck('id')->all());
        $menor = $pool->min(fn (User $u) => $carga[$u->id] ?? 0);

        /** @var Collection<int,User> $candidatos */
        $candidatos = $pool->filter(fn (User $u) => ($carga[$u->id] ?? 0) === $menor)->values();

        return $candidatos->random();
    }

    /** @param  int[]  $ids  @return array<int,int> */
    private function cargaPorResponsavel(Organizacao $org, array $ids): array
    {
        return Manifestation::withoutGlobalScopes()
            ->where('organizacao_id', $org->id)
            ->whereIn('responsavel_id', $ids)
            ->whereIn('status', self::ABERTAS)
            ->selectRaw('responsavel_id, count(*) as total')
            ->groupBy('responsavel_id')
            ->pluck('total', 'responsavel_id')
            ->map(fn ($n) => (int) $n)
            ->all();
    }

    /**
     * Reatribui em massa: todas as manifestações EM ABERTO de $de passam
     * para $para. Devolve quantas mudaram.
     */
    public function transferirCarga(Organizacao $org, User $de, User $para): int
    {
        return Manifestation::withoutGlobalScopes()
            ->where('organizacao_id', $org->id)
            ->where('responsavel_id', $de->id)
            ->whereIn('status', self::ABERTAS)
            ->update(['responsavel_id' => $para->id]);
    }
}
