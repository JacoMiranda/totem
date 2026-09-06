<?php

namespace App\Http\Controllers\Api\Plataforma;

use App\Http\Controllers\Controller;
use App\Models\Plano;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Catálogo de pacotes (back-office da plataforma). O time comercial ajusta
 * limite de totens, dias de trial, preço e a lista de recursos exibida na
 * home. Gate `gerenciar-plataforma`.
 */
class PlanoController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        $emUso = Plano::withCount('organizacoes')->get();

        return response()->json(
            Plano::orderBy('ordem')->get()->map(fn (Plano $p) => $this->apresentar($p, $emUso->firstWhere('id', $p->id)?->organizacoes_count ?? 0)),
        );
    }

    public function update(Request $request, Plano $plano): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        $dados = $request->validate([
            'nome' => ['sometimes', 'string', 'max:80'],
            'descricao' => ['sometimes', 'nullable', 'string', 'max:300'],
            'limiteDispositivos' => ['sometimes', 'integer', 'min:1', 'max:500'],
            'precoCentavos' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'trialDias' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'ativo' => ['sometimes', 'boolean'],
            'recursos' => ['sometimes', 'array', 'max:12'],
            'recursos.*' => ['string', 'max:120'],
        ]);

        $plano->fill(array_filter([
            'nome' => $dados['nome'] ?? null,
            'limite_dispositivos' => $dados['limiteDispositivos'] ?? null,
            'trial_dias' => $dados['trialDias'] ?? null,
        ], fn ($v) => $v !== null));

        if ($request->has('descricao')) {
            $plano->descricao = $dados['descricao'] ?: null;
        }
        if ($request->has('precoCentavos')) {
            $plano->preco_centavos = $dados['precoCentavos']; // null = "sob consulta"
        }
        if ($request->has('ativo')) {
            $plano->ativo = $dados['ativo'];
        }
        if ($request->has('recursos')) {
            $plano->recursos = array_values(array_filter(array_map('trim', $dados['recursos'])));
        }
        $plano->save();

        return response()->json($this->apresentar($plano, $plano->organizacoes()->count()));
    }

    private function apresentar(Plano $p, int $contas): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'nome' => $p->nome,
            'descricao' => $p->descricao,
            'limiteDispositivos' => $p->limite_dispositivos,
            'precoCentavos' => $p->preco_centavos,
            'precoFormatado' => $p->precoFormatado(),
            'trialDias' => $p->trial_dias,
            'ativo' => (bool) $p->ativo,
            'recursos' => $p->recursos ?? [],
            'contas' => $contas,
        ];
    }
}
