<?php

namespace App\Console\Commands;

use App\Models\Manifestation;
use App\Services\AnonimizacaoService;
use Illuminate\Console\Command;

/**
 * Job de retenção LGPD (docs/PLANO-SISTEMA-PROFISSIONAL.md, Fase 8) -
 * anonimiza toda manifestação mais antiga que `ouvidoria.retencao_dias`
 * (contado a partir de `criado_em`, a data do atendimento) que ainda não
 * foi anonimizada. Idempotente por natureza: `anonimizado_em` já
 * preenchido tira o registro da consulta, então rodar de novo no mesmo
 * dia não repete trabalho nem gera erro.
 */
class PurgeLgpdData extends Command
{
    protected $signature = 'ouvidoria:expurgar-lgpd';

    protected $description = 'Anonimiza manifestações mais antigas que o prazo de retenção configurado (LGPD)';

    public function handle(AnonimizacaoService $anonimizacao): int
    {
        $limite = now()->subDays(config('ouvidoria.retencao_dias'));

        $manifestacoes = Manifestation::whereNull('anonimizado_em')
            ->where('criado_em', '<', $limite)
            ->get();

        foreach ($manifestacoes as $manifestacao) {
            $anonimizacao->anonimizar($manifestacao);
        }

        $this->info("{$manifestacoes->count()} manifestação(ões) anonimizada(s) (retenção: ".config('ouvidoria.retencao_dias').' dias).');

        return self::SUCCESS;
    }
}
