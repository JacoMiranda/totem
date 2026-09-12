<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organizacao;
use App\Models\PulsoPonto;
use App\Services\PulsoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Gestão dos pontos de coleta do Pulso Rápido (o QR impresso) - Gate
 * `gerenciar-pulso`, sempre escopado à organização do admin logado (é uma
 * ferramenta de auto-atendimento do cliente, não algo que a plataforma
 * cadastra por ele - diferente de Devices).
 */
class PulsoPontoController extends Controller
{
    private const PERGUNTAS_PADRAO = ['Atendimento', 'Produto/Serviço'];

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $this->organizacaoDoUsuario($request);

        $pontos = PulsoPonto::orderBy('nome')->get();

        return response()->json($pontos->map(fn (PulsoPonto $p) => $this->apresentar($p)));
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);

        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:120'],
            'unidade' => ['nullable', 'string', 'max:120'],
            'perguntas' => ['sometimes', 'array', 'min:1', 'max:4'],
            'perguntas.*' => ['string', 'max:60'],
        ]);

        $ponto = PulsoPonto::create([
            'organizacao_id' => $org->id,
            'nome' => $dados['nome'],
            'unidade' => $dados['unidade'] ?? null,
            'perguntas' => $dados['perguntas'] ?? self::PERGUNTAS_PADRAO,
            'token' => $this->tokenNovo(),
            'ativo' => true,
        ]);

        return response()->json($this->apresentar($ponto), 201);
    }

    public function update(Request $request, PulsoPonto $ponto): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);
        abort_unless($ponto->organizacao_id === $org->id, 404);

        $dados = $request->validate([
            'nome' => ['sometimes', 'string', 'max:120'],
            'unidade' => ['sometimes', 'nullable', 'string', 'max:120'],
            'perguntas' => ['sometimes', 'array', 'min:1', 'max:4'],
            'perguntas.*' => ['string', 'max:60'],
            'ativo' => ['sometimes', 'boolean'],
        ]);

        $ponto->fill(array_intersect_key($dados, array_flip(['nome', 'unidade', 'perguntas', 'ativo'])));
        $ponto->save();

        return response()->json($this->apresentar($ponto));
    }

    public function resumo(Request $request, PulsoPonto $ponto, PulsoService $pulso): JsonResponse
    {
        Gate::authorize('gerenciar-pulso');
        $org = $this->organizacaoDoUsuario($request);
        abort_unless($ponto->organizacao_id === $org->id, 404);

        return response()->json($pulso->resumo($ponto));
    }

    private function apresentar(PulsoPonto $p): array
    {
        return [
            'id' => $p->id,
            'nome' => $p->nome,
            'unidade' => $p->unidade,
            'perguntas' => $p->perguntas,
            'ativo' => $p->ativo,
            'token' => $p->token,
            'url' => url("/pulso/{$p->token}"),
        ];
    }

    private function tokenNovo(): string
    {
        do {
            $token = Str::lower(Str::random(10));
        } while (PulsoPonto::withoutGlobalScopes()->where('token', $token)->exists());

        return $token;
    }

    private function organizacaoDoUsuario(Request $request): Organizacao
    {
        $org = $request->user()?->organizacao;

        abort_unless($org, 422, 'Sua conta não está vinculada a uma organização.');

        return $org;
    }
}
