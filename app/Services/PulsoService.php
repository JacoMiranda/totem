<?php

namespace App\Services;

use App\Enums\PulsoValor;
use App\Models\Organizacao;
use App\Models\PulsoPonto;
use App\Models\PulsoResposta;
use App\Models\PulsoSessao;
use Illuminate\Support\Str;

/**
 * "Pulso Rápido": alternativa ao totem físico pro pequeno estabelecimento
 * que não tem como bancar tablet/totem - um QR impresso abre no celular
 * do cliente, 1 toque em 3 carinhas, por pergunta configurada no ponto
 * (ex.: "Atendimento", "Produto/Serviço").
 *
 * O QR impresso nunca muda (`PulsoPonto.token`, fixo). Cada ABERTURA gera
 * uma `PulsoSessao` com hash próprio, válida por 3 min OU até responder a
 * última pergunta - o que vier primeiro invalida a sessão pra sempre
 * (nem back-button nem aba duplicada conseguem enviar de novo com aquele
 * hash). Uma nova manifestação exige escanear o QR de novo, o que gera
 * hash novo.
 */
class PulsoService
{
    private const DURACAO_MINUTOS = 3;

    public function iniciarSessao(PulsoPonto $ponto): PulsoSessao
    {
        return PulsoSessao::create([
            'pulso_ponto_id' => $ponto->id,
            'hash' => Str::random(40),
            'expira_em' => now()->addMinutes(self::DURACAO_MINUTOS),
        ]);
    }

    public function estado(PulsoSessao $sessao): array
    {
        return [
            'perguntas' => $sessao->ponto->perguntas,
            'passoAtual' => $sessao->passo_atual,
            'concluida' => $sessao->concluida(),
            'expirada' => ! $sessao->concluida() && $sessao->expirada(),
            'expiraEm' => $sessao->expira_em->toIso8601String(),
        ];
    }

    /**
     * @return array{erro: string}|array{concluida: bool, proximaPergunta: ?string}
     */
    public function responder(PulsoSessao $sessao, PulsoValor $valor): array
    {
        if ($sessao->concluida()) {
            return ['erro' => 'CONCLUIDA'];
        }
        if ($sessao->expirada()) {
            return ['erro' => 'EXPIRADA'];
        }

        $ponto = $sessao->ponto;
        $perguntas = $ponto->perguntas;
        $pergunta = $perguntas[$sessao->passo_atual] ?? null;

        if ($pergunta === null) {
            return ['erro' => 'CONCLUIDA'];
        }

        PulsoResposta::create([
            'pulso_ponto_id' => $ponto->id,
            'organizacao_id' => $ponto->organizacao_id,
            'pergunta' => $pergunta,
            'valor' => $valor,
        ]);

        $sessao->passo_atual++;
        $concluida = $sessao->passo_atual >= count($perguntas);
        if ($concluida) {
            $sessao->concluida_em = now();
        }
        $sessao->save();

        return [
            'concluida' => $concluida,
            'proximaPergunta' => $concluida ? null : $perguntas[$sessao->passo_atual],
        ];
    }

    /** Contagem por pergunta, últimos N dias - alimenta o admin (e futuramente o mural/TV). */
    public function resumo(PulsoPonto $ponto, int $dias = 30): array
    {
        $registros = PulsoResposta::where('pulso_ponto_id', $ponto->id)
            ->where('criado_em', '>=', now()->subDays($dias))
            ->get(['pergunta', 'valor']);

        $porPergunta = $registros->groupBy('pergunta')->map(function ($grupo) {
            $total = $grupo->count();

            return [
                'total' => $total,
                'positivo' => $grupo->where('valor', PulsoValor::Positivo)->count(),
                'neutro' => $grupo->where('valor', PulsoValor::Neutro)->count(),
                'negativo' => $grupo->where('valor', PulsoValor::Negativo)->count(),
            ];
        });

        return [
            'total' => $registros->count(),
            'porPergunta' => $porPergunta,
        ];
    }

    /**
     * Painel público (a "tela de LED" do pitch original): agrega TODOS os
     * pontos ativos da organização, cada um com suas próprias perguntas -
     * nos moldes do MuralService::paraOrganizacao, mas bem mais simples
     * (sem tendência temporal/compromisso, só o quantitativo por carinha).
     */
    public function painelParaOrganizacao(Organizacao $org, int $dias = 30): array
    {
        $desde = now()->subDays($dias);

        $pontos = PulsoPonto::where('organizacao_id', $org->id)
            ->where('ativo', true)
            ->orderBy('nome')
            ->get();

        $totalGeral = 0;
        $porPonto = $pontos->map(function (PulsoPonto $ponto) use ($desde, &$totalGeral) {
            $registros = PulsoResposta::where('pulso_ponto_id', $ponto->id)
                ->where('criado_em', '>=', $desde)
                ->get(['pergunta', 'valor']);
            $totalGeral += $registros->count();

            $porPergunta = $registros->groupBy('pergunta')->map(function ($grupo) {
                $total = $grupo->count();

                return [
                    'total' => $total,
                    'positivoPct' => $total ? (int) round($grupo->where('valor', PulsoValor::Positivo)->count() / $total * 100) : null,
                    'neutroPct' => $total ? (int) round($grupo->where('valor', PulsoValor::Neutro)->count() / $total * 100) : null,
                    'negativoPct' => $total ? (int) round($grupo->where('valor', PulsoValor::Negativo)->count() / $total * 100) : null,
                ];
            });

            return [
                'nome' => $ponto->nome,
                'unidade' => $ponto->unidade,
                'perguntas' => $ponto->perguntas,
                'porPergunta' => $porPergunta,
            ];
        })->values();

        return [
            'titulo' => 's-Totem · '.$org->nome,
            'atualizadoEm' => now()->toIso8601String(),
            'janelaDias' => $dias,
            'totalRespostas' => $totalGeral,
            'pontos' => $porPonto,
        ];
    }
}
