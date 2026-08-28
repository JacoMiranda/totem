<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Manifestation;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** Relatórios (docs/API.md, "Relatórios (analista+)") - agregações em Eloquent, sem tabela materializada (report_daily fica pra quando o volume justificar). */
class ReportController extends Controller
{
    private const LIMITE_SLA_DIAS = ['Crítica' => 1, 'Alta' => 3, 'Média' => 7, 'Baixa' => 15];

    private const STATUS_RESOLVIDOS = ['Concluída', 'Arquivada'];

    public function summary(Request $request): JsonResponse
    {
        Gate::authorize('ver-relatorios');

        $base = $this->baseQuery($request);

        return response()->json([
            'total' => (clone $base)->count(),
            'porCategoria' => (clone $base)->whereNotNull('categoria')->groupBy('categoria')->selectRaw('categoria, count(*) as total')->pluck('total', 'categoria'),
            'porSentimento' => (clone $base)->whereNotNull('sentimento')->groupBy('sentimento')->selectRaw('sentimento, count(*) as total')->pluck('total', 'sentimento'),
            'porUrgencia' => (clone $base)->groupBy('urgencia')->selectRaw('urgencia, count(*) as total')->pluck('total', 'urgencia'),
            'porStatus' => (clone $base)->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status'),
        ]);
    }

    /** `interval`: day|week|month (default day). Agrupamento feito em PHP (Carbon), não SQL, pra não depender de funções de data específicas do driver (funciona igual no MySQL de produção e no sqlite dos testes). */
    public function timeseries(Request $request): JsonResponse
    {
        Gate::authorize('ver-relatorios');

        $interval = in_array($request->string('interval', 'day')->toString(), ['day', 'week', 'month'], true)
            ? $request->string('interval', 'day')->toString()
            : 'day';

        $serie = $this->baseQuery($request)
            ->get(['criado_em'])
            ->groupBy(fn (Manifestation $m) => $this->bucket($m->criado_em, $interval))
            ->map(fn ($grupo, $periodo) => ['periodo' => $periodo, 'total' => $grupo->count()])
            ->values()
            ->sortBy('periodo')
            ->values();

        return response()->json(['interval' => $interval, 'serie' => $serie]);
    }

    /**
     * Tempo médio de resolução usa `atualizado_em` como aproximação do
     * momento de conclusão (simplificação: não rastreia a transição exata
     * pra "Concluída"/"Arquivada" em manifestation_status_history - correto
     * o bastante pra um indicador agregado, revisitar se precisão por
     * manifestação individual for necessária).
     */
    public function sla(Request $request): JsonResponse
    {
        Gate::authorize('ver-relatorios');

        $registros = $this->baseQuery($request)->get(['criado_em', 'atualizado_em', 'status', 'urgencia']);

        $resolvidas = $registros->filter(fn (Manifestation $m) => in_array($m->status->value, self::STATUS_RESOLVIDOS, true));
        $tempoMedioHoras = $resolvidas->isEmpty()
            ? null
            : round($resolvidas->avg(fn (Manifestation $m) => $m->criado_em->diffInHours($m->atualizado_em)), 1);

        $abertas = $registros->reject(fn (Manifestation $m) => in_array($m->status->value, self::STATUS_RESOLVIDOS, true));
        $foraDoSla = $abertas->filter(function (Manifestation $m) {
            $limiteDias = self::LIMITE_SLA_DIAS[$m->urgencia->value] ?? 15;

            return $m->criado_em->diffInDays(now()) > $limiteDias;
        });

        return response()->json([
            'tempoMedioResolucaoHoras' => $tempoMedioHoras,
            'backlog' => $abertas->count(),
            'foraDoSla' => $foraDoSla->count(),
            'foraDoSlaPorUrgencia' => $foraDoSla->groupBy(fn (Manifestation $m) => $m->urgencia->value)->map->count(),
        ]);
    }

    /** `formato=csv` só (PDF fica fora de escopo por ora - CSV já cobre a necessidade de exportar pra planilha/análise externa). */
    public function export(Request $request): Response
    {
        Gate::authorize('ver-relatorios');

        $registros = $this->baseQuery($request)->orderBy('criado_em')->get();

        $linhas = [];
        $linhas[] = ['protocolo', 'canal', 'sentimento', 'categoria', 'urgencia', 'status', 'criado_em'];
        foreach ($registros as $m) {
            $linhas[] = [
                $m->protocolo ?? '',
                $m->canal->value,
                $m->sentimento?->value ?? '',
                $m->categoria?->value ?? '',
                $m->urgencia->value,
                $m->status->value,
                $m->criado_em->toIso8601String(),
            ];
        }

        $csv = implode("\n", array_map(fn ($linha) => implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', (string) $v).'"', $linha)), $linhas));

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="manifestacoes.csv"',
        ]);
    }

    private function baseQuery(Request $request): Builder
    {
        return Manifestation::query()
            ->when($request->filled('de'), fn ($q) => $q->whereDate('criado_em', '>=', $request->string('de')))
            ->when($request->filled('ate'), fn ($q) => $q->whereDate('criado_em', '<=', $request->string('ate')))
            ->when($request->filled('unidade'), fn ($q) => $q->whereHas('device', fn ($d) => $d->where('unidade', $request->string('unidade'))));
    }

    private function bucket(Carbon $data, string $interval): string
    {
        return match ($interval) {
            'week' => $data->clone()->startOfWeek()->toDateString(),
            'month' => $data->format('Y-m'),
            default => $data->toDateString(),
        };
    }
}
