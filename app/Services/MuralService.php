<?php

namespace App\Services;

use App\Models\Manifestation;
use App\Models\Organizacao;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Números do mural público de transparência (docs/MURAL-PUBLICO.md).
 *
 * É a "visão de confiança": percentuais e compromisso, nunca volumes
 * absolutos nem contagem de denúncias. O cliente da empresa vê o quanto a
 * ouvidoria responde e resolve, não o tamanho da fila de problemas.
 *
 * Janela padrão: últimos 90 dias por `criado_em` (data do atendimento).
 */
class MuralService
{
    /** Dias de prazo por urgência - espelha ReportController::LIMITE_SLA_DIAS. */
    private const PRAZO_DIAS = ['Crítica' => 1, 'Alta' => 3, 'Média' => 7, 'Baixa' => 15];

    private const RESPONDIDA = ['Respondida', 'Concluída', 'Arquivada'];

    private const RESOLVIDA = ['Concluída', 'Arquivada'];

    private const JANELA_DIAS = 90;

    private const MIN_AMOSTRA = 5;

    public function paraOrganizacao(Organizacao $org): array
    {
        $desde = CarbonImmutable::now()->subDays(self::JANELA_DIAS)->startOfDay();

        $registros = $this->base($org)
            ->where('criado_em', '>=', $desde)
            ->get(['criado_em', 'atualizado_em', 'status', 'urgencia', 'sentimento', 'categoria', 'resposta_publicada_em']);

        $total = $registros->count();
        $comSentimento = $registros->filter(fn ($m) => $m->sentimento !== null);
        $respondidas = $registros->filter(fn ($m) => $this->respondida($m));
        $noPrazo = $respondidas->filter(fn ($m) => $this->respondidaNoPrazo($m));

        // "Reclamações" pro cliente = Reclamação + Denúncia (o que ele traz
        // como problema). Mostrar que a maioria já foi resolvida é o sinal
        // de confiança mais direto.
        $reclamacoes = $registros->filter(fn ($m) => in_array($m->categoria?->value, ['Reclamação', 'Denúncia'], true));
        $reclamacoesResolvidas = $reclamacoes->filter(fn ($m) => in_array($m->status->value, self::RESOLVIDA, true));

        $tempos = $respondidas
            ->map(fn ($m) => $m->criado_em->diffInHours($this->momentoResposta($m)))
            ->filter(fn ($h) => $h >= 0);

        return [
            'titulo' => $org->muralTitulo(),
            'tema' => in_array($org->mural_tema, ['claro', 'escuro'], true) ? $org->mural_tema : 'claro',
            'orientacao' => [
                'local' => $org->mural_totem_local ?: null,
                'linhaCor' => $org->mural_linha_cor ?: null,
            ],
            'atualizadoEm' => now()->toIso8601String(),
            'janelaDias' => self::JANELA_DIAS,
            'amostraPequena' => $total < self::MIN_AMOSTRA,
            'indicadores' => [
                'respondidasPct' => $this->pct($respondidas->count(), $total),
                'resolvidasPct' => $this->pct(
                    $registros->filter(fn ($m) => in_array($m->status->value, self::RESOLVIDA, true))->count(),
                    $total,
                ),
                'noPrazoPct' => $this->pct($noPrazo->count(), $respondidas->count()),
                'reclamacoesResolvidasPct' => $this->pct($reclamacoesResolvidas->count(), $reclamacoes->count()),
                'satisfacaoPct' => $this->pct(
                    $comSentimento->filter(fn ($m) => in_array($m->sentimento->value, ['Excelente', 'Satisfeito'], true))->count(),
                    $comSentimento->count(),
                ),
                'tempoMedioRespostaHoras' => $tempos->isEmpty() ? null : (int) round($tempos->avg()),
            ],
            'compromisso' => [
                // Manifestações abertas que já passaram do prazo, AGORA.
                'tudoNoPrazo' => $this->abertasForaDoPrazo($org)->isEmpty(),
                'diasSemAtraso' => $this->diasSemAtraso($org),
                'diasOuvindo' => $this->diasOuvindo($org),
            ],
            // Volume por semana na janela (pro gráfico de barras). É o
            // ÚNICO lugar com número absoluto - e é o movimento do canal
            // ("cada vez mais gente usa"), não a fila de problemas.
            'porPeriodo' => $this->porPeriodo($registros, $desde),
            // O que as pessoas trazem - % por teor (Denúncia entra em
            // Reclamação, nunca aparece separada). Soma 100.
            'distribuicao' => $this->distribuicao($registros),
            // Como as pessoas chegam - sentimento agrupado em 3 faixas.
            'clima' => [
                'positivoPct' => $this->pct(
                    $comSentimento->filter(fn ($m) => in_array($m->sentimento->value, ['Excelente', 'Satisfeito'], true))->count(),
                    $comSentimento->count(),
                ),
                'neutroPct' => $this->pct(
                    $comSentimento->filter(fn ($m) => $m->sentimento->value === 'Neutro')->count(),
                    $comSentimento->count(),
                ),
                'atentoPct' => $this->pct(
                    $comSentimento->filter(fn ($m) => in_array($m->sentimento->value, ['Preocupado', 'Insatisfeito'], true))->count(),
                    $comSentimento->count(),
                ),
            ],
            'elogios' => $this->elogios($org),
        ];
    }

    /**
     * Contagem por semana (ISO) na janela. Sempre devolve todas as semanas,
     * inclusive as zeradas, pro gráfico não "pular" períodos.
     *
     * @param  \Illuminate\Support\Collection<int,Manifestation>  $registros
     */
    private function porPeriodo($registros, CarbonImmutable $desde): array
    {
        $inicio = $desde->startOfWeek();
        $semanas = [];
        for ($s = $inicio; $s->lte(CarbonImmutable::now()); $s = $s->addWeek()) {
            $semanas[$s->toDateString()] = 0;
        }

        foreach ($registros as $m) {
            $chave = CarbonImmutable::parse($m->criado_em)->startOfWeek()->toDateString();
            if (array_key_exists($chave, $semanas)) {
                $semanas[$chave]++;
            }
        }

        return collect($semanas)
            ->map(fn ($total, $dia) => [
                'rotulo' => CarbonImmutable::parse($dia)->format('d/m'),
                'total' => $total,
            ])
            ->values()
            ->all();
    }

    /** @param \Illuminate\Support\Collection<int,Manifestation> $registros */
    private function distribuicao($registros): array
    {
        $comTeor = $registros->filter(fn ($m) => $m->categoria !== null);
        $total = $comTeor->count();
        if ($total === 0) {
            return [];
        }

        $conta = fn (array $cats) => $comTeor->filter(fn ($m) => in_array($m->categoria->value, $cats, true))->count();

        return collect([
            ['chave' => 'Elogio', 'n' => $conta(['Elogio'])],
            ['chave' => 'Sugestão', 'n' => $conta(['Sugestão'])],
            ['chave' => 'Dúvida', 'n' => $conta(['Dúvida'])],
            ['chave' => 'Reclamação', 'n' => $conta(['Reclamação', 'Denúncia'])],
        ])
            ->filter(fn ($f) => $f['n'] > 0)
            ->map(fn ($f) => ['chave' => $f['chave'], 'pct' => (int) round($f['n'] / $total * 100)])
            ->values()
            ->all();
    }

    /** Query base da organização, sem o escopo de tenant (aqui não há usuário logado). */
    private function base(Organizacao $org): Builder
    {
        return Manifestation::withoutGlobalScopes()
            ->where('organizacao_id', $org->id)
            ->whereNull('anonimizado_em');
    }

    private function respondida(Manifestation $m): bool
    {
        return $m->resposta_publicada_em !== null || in_array($m->status->value, self::RESPONDIDA, true);
    }

    private function momentoResposta(Manifestation $m): CarbonImmutable
    {
        return CarbonImmutable::parse($m->resposta_publicada_em ?? $m->atualizado_em);
    }

    private function respondidaNoPrazo(Manifestation $m): bool
    {
        $prazo = self::PRAZO_DIAS[$m->urgencia->value] ?? 15;

        return $m->criado_em->diffInDays($this->momentoResposta($m)) <= $prazo;
    }

    /** Manifestações ainda abertas cujo prazo já venceu. */
    private function abertasForaDoPrazo(Organizacao $org)
    {
        return $this->base($org)
            ->whereNotIn('status', self::RESOLVIDA)
            ->get(['criado_em', 'urgencia', 'status'])
            ->filter(function (Manifestation $m) {
                $prazo = self::PRAZO_DIAS[$m->urgencia->value] ?? 15;

                return $m->criado_em->diffInDays(now()) > $prazo;
            });
    }

    /**
     * Dias consecutivos (a partir de ontem, pra trás) sem nenhuma
     * manifestação daquele dia que tenha estourado o prazo - respondida
     * tarde OU ainda aberta e vencida. Teto de 365.
     */
    private function diasSemAtraso(Organizacao $org): int
    {
        $registros = $this->base($org)
            ->where('criado_em', '>=', CarbonImmutable::now()->subDays(365)->startOfDay())
            ->get(['criado_em', 'atualizado_em', 'status', 'urgencia', 'resposta_publicada_em']);

        $atrasoPorDia = [];
        foreach ($registros as $m) {
            $dia = $m->criado_em->toDateString();
            $prazo = self::PRAZO_DIAS[$m->urgencia->value] ?? 15;
            $atrasou = $this->respondida($m)
                ? $m->criado_em->diffInDays($this->momentoResposta($m)) > $prazo
                : $m->criado_em->diffInDays(now()) > $prazo;
            $atrasoPorDia[$dia] = ($atrasoPorDia[$dia] ?? false) || $atrasou;
        }

        $dias = 0;
        for ($i = 1; $i <= 365; $i++) {
            $dia = CarbonImmutable::now()->subDays($i)->toDateString();
            if ($atrasoPorDia[$dia] ?? false) {
                break;
            }
            $dias++;
        }

        return $dias;
    }

    private function diasOuvindo(Organizacao $org): int
    {
        $primeira = $this->base($org)->min('criado_em');

        return $primeira ? (int) CarbonImmutable::parse($primeira)->diffInDays(now()) : 0;
    }

    /** Últimos elogios com resumo - social proof pro cliente. Texto higienizado. */
    private function elogios(Organizacao $org): array
    {
        return $this->base($org)
            ->where('categoria', 'Elogio')
            ->whereNotNull('resumo')
            ->where('criado_em', '>=', CarbonImmutable::now()->subDays(120))
            ->orderByDesc('criado_em')
            ->limit(40)
            ->get(['resumo', 'criado_em', 'device_id'])
            ->unique(fn (Manifestation $m) => mb_strtolower(trim((string) $m->resumo)))
            ->take(7)
            ->map(fn (Manifestation $m) => [
                'texto' => $this->higienizar((string) $m->resumo),
                'unidade' => $m->device?->unidade,
                'quando' => $m->criado_em->toDateString(),
            ])
            ->values()
            ->all();
    }

    /** Remove o que parecer dado pessoal de um resumo antes de expor em tela pública. */
    private function higienizar(string $texto): string
    {
        $texto = preg_replace('/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/', '[documento]', $texto) ?? $texto;
        $texto = preg_replace('/\b\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/', '[telefone]', $texto) ?? $texto;
        $texto = preg_replace('/[\w.+-]+@[\w-]+\.[\w.-]+/', '[e-mail]', $texto) ?? $texto;

        return Str::limit(trim($texto), 170);
    }

    private function pct(int $parte, int $total): ?int
    {
        return $total > 0 ? (int) round($parte / $total * 100) : null;
    }
}
