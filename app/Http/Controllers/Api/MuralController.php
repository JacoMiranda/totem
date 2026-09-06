<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organizacao;
use App\Services\MuralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Mural público de transparência (docs/MURAL-PUBLICO.md).
 *
 * - `show($token)` é PÚBLICO (sem login) - a tela da recepção. Só percentuais
 *   e compromisso, nunca volumes ou denúncias (ver MuralService). Cacheado
 *   e com throttle na rota.
 * - `config` / `atualizar` / `regenerarToken` são do painel (admin da conta),
 *   pra ligar/desligar o mural e pegar o link.
 */
class MuralController extends Controller
{
    private const CACHE_SEGUNDOS = 120;

    public function __construct(private readonly MuralService $mural) {}

    public function show(string $token): JsonResponse
    {
        $org = Organizacao::where('mural_token', $token)->where('mural_ativo', true)->first();

        if (! $org) {
            return response()->json(['error' => ['code' => 'MURAL_INDISPONIVEL', 'message' => 'Mural não encontrado ou desativado.']], 404);
        }

        $dados = Cache::remember(
            "mural:{$token}",
            self::CACHE_SEGUNDOS,
            fn () => $this->mural->paraOrganizacao($org),
        );

        return response()->json($dados);
    }

    /**
     * Mesmos números do mural, mas pra tela de espera do PRÓPRIO totem
     * (autenticado por device key). Mostra à pessoa que a empresa responde
     * antes dela registrar - e não depende de o mural público estar ligado.
     */
    public function paraTotem(Request $request): JsonResponse
    {
        $device = $request->attributes->get('device');
        $org = $device?->organizacao;

        if (! $org) {
            return response()->json(['error' => ['code' => 'SEM_ORGANIZACAO']], 404);
        }

        $dados = Cache::remember(
            "mural:org:{$org->id}",
            self::CACHE_SEGUNDOS,
            fn () => $this->mural->paraOrganizacao($org),
        );

        return response()->json($dados);
    }

    public function config(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-mural');
        $org = $this->organizacaoDoUsuario($request);

        return response()->json($this->payloadConfig($org));
    }

    public function atualizar(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-mural');
        $org = $this->organizacaoDoUsuario($request);

        $dados = $request->validate([
            'ativo' => ['required', 'boolean'],
            'titulo' => ['nullable', 'string', 'max:120'],
            'tema' => ['sometimes', 'in:claro,escuro'],
            'totemLocal' => ['sometimes', 'nullable', 'string', 'max:120'],
            'linhaCor' => ['sometimes', 'nullable', 'string', 'max:20'],
            // Trecho da URL: /mural/<token>. Letras minúsculas, números e
            // hífen. Curto/óbvio é menos privado (o link deixa de ser secreto).
            'token' => [
                'sometimes', 'string', 'min:5', 'max:64',
                'regex:/^[a-z0-9][a-z0-9-]{4,63}$/', 'not_in:resumo,config,token',
                Rule::unique('organizacoes', 'mural_token')->ignore($org->id),
            ],
        ]);

        if ($request->filled('token')) {
            if ($org->mural_token) {
                Cache::forget("mural:{$org->mural_token}");
            }
            $org->mural_token = $dados['token'];
        } elseif ($dados['ativo'] && ! $org->mural_token) {
            $org->mural_token = $this->tokenNovo($org);
        }
        $org->mural_ativo = $dados['ativo'];
        if ($request->has('titulo')) {
            $org->mural_titulo = $dados['titulo'] ?: null;
        }
        if (isset($dados['tema'])) {
            $org->mural_tema = $dados['tema'];
        }
        if ($request->has('totemLocal')) {
            $org->mural_totem_local = $dados['totemLocal'] ?: null;
        }
        if ($request->has('linhaCor')) {
            $org->mural_linha_cor = $dados['linhaCor'] ?: null;
        }
        $org->save();

        if ($org->mural_token) {
            Cache::forget("mural:{$org->mural_token}");
        }

        return response()->json($this->payloadConfig($org));
    }

    public function regenerarToken(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-mural');
        $org = $this->organizacaoDoUsuario($request);

        if ($org->mural_token) {
            Cache::forget("mural:{$org->mural_token}");
        }
        $org->mural_token = $this->tokenNovo($org, aleatorio: true);
        $org->save();

        return response()->json($this->payloadConfig($org));
    }

    private function payloadConfig(Organizacao $org): array
    {
        return [
            'ativo' => (bool) $org->mural_ativo,
            'titulo' => $org->mural_titulo,
            'tituloEfetivo' => $org->muralTitulo(),
            'tema' => in_array($org->mural_tema, ['claro', 'escuro'], true) ? $org->mural_tema : 'claro',
            'totemLocal' => $org->mural_totem_local,
            'linhaCor' => $org->mural_linha_cor,
            'token' => $org->mural_token,
            'url' => $org->mural_token ? url("/mural/{$org->mural_token}") : null,
        ];
    }

    /**
     * Token novo. Por padrão tenta o slug da organização ("minhaempresa");
     * se já estiver em uso, ou se `aleatorio`, usa 40 caracteres aleatórios.
     * O admin pode trocar por qualquer coisa depois em /admin/mural.
     */
    private function tokenNovo(Organizacao $org, bool $aleatorio = false): string
    {
        $slug = Str::of($org->slug)->lower()->replaceMatches('/[^a-z0-9-]/', '')->toString();

        if (! $aleatorio && strlen($slug) >= 5
            && ! Organizacao::where('mural_token', $slug)->exists()
            && ! in_array($slug, ['resumo', 'config', 'token'], true)) {
            return $slug;
        }

        return Str::lower(Str::random(40));
    }

    private function organizacaoDoUsuario(Request $request): Organizacao
    {
        $org = $request->user()?->organizacao;

        abort_unless($org, 422, 'Sua conta não está vinculada a uma organização.');

        return $org;
    }
}
