<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organizacao;
use App\Services\MuralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
 *
 * Trocar o token deixa o ANTIGO resolvendo por 48h (grace) - assim uma TV
 * que já está no ar não fica órfã de imediato; ela mostra um aviso de que
 * o endereço mudou.
 */
class MuralController extends Controller
{
    private const CACHE_SEGUNDOS = 120;

    private const GRACE_HORAS = 48;

    public function __construct(private readonly MuralService $mural) {}

    public function show(Request $request, string $token): JsonResponse
    {
        $org = Organizacao::where('mural_ativo', true)
            ->where(function ($q) use ($token) {
                $q->where('mural_token', $token)
                    ->orWhere(fn ($q2) => $q2->where('mural_token_anterior', $token)->where('mural_token_anterior_ate', '>', now()));
            })
            ->first();

        if (! $org) {
            return response()->json([
                'error' => ['code' => 'MURAL_INDISPONIVEL', 'message' => 'Mural não encontrado, desativado, ou o endereço mudou.'],
            ], 404);
        }

        // PIN opcional: sem o código certo, devolve só o "trave-se" - a
        // tela pede o PIN e refaz a chamada com ?pin=.
        if ($org->mural_pin) {
            $pin = (string) $request->query('pin', '');
            if ($pin !== $org->mural_pin) {
                return response()->json([
                    'exigePin' => true,
                    'pinInvalido' => $pin !== '',
                    'titulo' => $org->muralTitulo(),
                    'tema' => in_array($org->mural_tema, ['claro', 'escuro'], true) ? $org->mural_tema : 'claro',
                ]);
            }
        }

        $dados = Cache::remember(
            "mural:org:{$org->id}",
            self::CACHE_SEGUNDOS,
            fn () => $this->mural->paraOrganizacao($org),
        );
        // Servido pelo token ANTIGO (grace) -> a tela mostra um aviso.
        $dados['linkMudando'] = $org->mural_token !== $token;
        $dados['exigePin'] = false;

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
            // PIN: 4 a 8 dígitos, ou vazio pra remover.
            'pin' => ['sometimes', 'nullable', 'string', 'regex:/^\d{4,8}$/'],
        ]);

        if ($request->filled('token') && $dados['token'] !== $org->mural_token) {
            $this->guardarTokenAnterior($org);
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
        if ($request->has('pin')) {
            $org->mural_pin = $dados['pin'] ?: null;
        }
        $org->save();

        Cache::forget("mural:org:{$org->id}");

        return response()->json($this->payloadConfig($org));
    }

    public function regenerarToken(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-mural');
        $org = $this->organizacaoDoUsuario($request);

        $this->guardarTokenAnterior($org);
        $org->mural_token = $this->tokenNovo($org, aleatorio: true);
        $org->save();

        Cache::forget("mural:org:{$org->id}");

        return response()->json($this->payloadConfig($org));
    }

    /** Deixa o token atual valendo por mais 48h como "anterior". */
    private function guardarTokenAnterior(Organizacao $org): void
    {
        if ($org->mural_token) {
            $org->mural_token_anterior = $org->mural_token;
            $org->mural_token_anterior_ate = now()->addHours(self::GRACE_HORAS);
        }
    }

    private function payloadConfig(Organizacao $org): array
    {
        $graceAtivo = $org->mural_token_anterior && $org->mural_token_anterior_ate?->isFuture();

        return [
            'ativo' => (bool) $org->mural_ativo,
            'titulo' => $org->mural_titulo,
            'tituloEfetivo' => $org->muralTitulo(),
            'tema' => in_array($org->mural_tema, ['claro', 'escuro'], true) ? $org->mural_tema : 'claro',
            'totemLocal' => $org->mural_totem_local,
            'linhaCor' => $org->mural_linha_cor,
            'pinDefinido' => (bool) $org->mural_pin,
            'token' => $org->mural_token,
            'url' => $org->mural_token ? url("/mural/{$org->mural_token}") : null,
            // Se um link antigo ainda está no ar (grace), o painel avisa
            // "o link anterior funciona até ...".
            'linkAnterior' => $graceAtivo ? [
                'token' => $org->mural_token_anterior,
                'ate' => Carbon::parse($org->mural_token_anterior_ate)->toIso8601String(),
            ] : null,
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
