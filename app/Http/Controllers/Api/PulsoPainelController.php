<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organizacao;
use App\Services\PulsoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Painel público do s-Totem - a "tela de LED simples" do pitch original:
 * um link por organização, agregando o quantitativo de TODOS os pontos
 * ativos. Nos moldes do MuralController (público + config/atualizar/
 * regenerarToken pro admin), mas sem PIN/tema/grace - v1 propositalmente
 * mais simples, dá pra evoluir se fizer falta.
 */
class PulsoPainelController extends Controller
{
    private const CACHE_SEGUNDOS = 120;

    public function __construct(private readonly PulsoService $pulso) {}

    public function show(string $token): JsonResponse
    {
        $org = Organizacao::where('pulso_painel_ativo', true)
            ->where('pulso_painel_token', $token)
            ->first();

        if (! $org) {
            return response()->json([
                'error' => ['code' => 'PAINEL_INDISPONIVEL', 'message' => 'Painel não encontrado ou desativado.'],
            ], 404);
        }

        $dados = Cache::remember(
            "pulso:painel:{$org->id}",
            self::CACHE_SEGUNDOS,
            fn () => $this->pulso->painelParaOrganizacao($org),
        );

        return response()->json($dados);
    }

    public function config(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);

        return response()->json($this->payloadConfig($org));
    }

    public function atualizar(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);

        $dados = $request->validate([
            'ativo' => ['required', 'boolean'],
        ]);

        if ($dados['ativo'] && ! $org->pulso_painel_token) {
            $org->pulso_painel_token = $this->tokenNovo($org);
        }
        $org->pulso_painel_ativo = $dados['ativo'];
        $org->save();

        Cache::forget("pulso:painel:{$org->id}");

        return response()->json($this->payloadConfig($org));
    }

    public function regenerarToken(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);

        $org->pulso_painel_token = $this->tokenNovo($org);
        $org->save();

        Cache::forget("pulso:painel:{$org->id}");

        return response()->json($this->payloadConfig($org));
    }

    private function payloadConfig(Organizacao $org): array
    {
        return [
            'ativo' => (bool) $org->pulso_painel_ativo,
            'token' => $org->pulso_painel_token,
            'url' => $org->pulso_painel_token ? url("/s-totem/{$org->pulso_painel_token}") : null,
        ];
    }

    private function tokenNovo(Organizacao $org): string
    {
        $base = Str::of($org->slug)->lower()->replaceMatches('/[^a-z0-9]+/', '-')->trim('-')->limit(40, '');
        $prefixo = $base->isNotEmpty() ? $base->toString() : 's-totem';

        do {
            $token = $prefixo.'-painel-'.Str::lower(Str::random(4));
        } while (Organizacao::where('pulso_painel_token', $token)->exists());

        return $token;
    }

    private function organizacaoDoUsuario(Request $request): Organizacao
    {
        $org = $request->user()?->organizacao;

        abort_unless($org, 422, 'Sua conta não está vinculada a uma organização.');

        return $org;
    }
}
