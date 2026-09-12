<?php

namespace App\Http\Controllers\Api;

use App\Enums\PulsoValor;
use App\Http\Controllers\Controller;
use App\Models\PulsoSessao;
use App\Services\PulsoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;

/**
 * Endpoints públicos e anônimos do Pulso Rápido - identificados só pelo
 * hash da sessão (ver PulsoService::iniciarSessao). Sem Sanctum, sem
 * device key: quem abre é o CELULAR do cliente do estabelecimento.
 */
class PulsoController extends Controller
{
    public function __construct(private readonly PulsoService $pulso) {}

    public function sessao(string $hash): JsonResponse
    {
        $sessao = PulsoSessao::with('ponto')->where('hash', $hash)->first();

        abort_unless($sessao, 404);

        return response()->json($this->pulso->estado($sessao));
    }

    public function responder(Request $request, string $hash): JsonResponse
    {
        $sessao = PulsoSessao::with('ponto')->where('hash', $hash)->first();

        abort_unless($sessao, 404);

        $dados = $request->validate([
            'valor' => ['required', new Enum(PulsoValor::class)],
        ]);

        $resultado = $this->pulso->responder($sessao, PulsoValor::from($dados['valor']));

        // 410 (não 422): o hash existe, só não vale mais - concluído ou
        // vencido. Distinto do formulário mal preenchido.
        if (isset($resultado['erro'])) {
            return response()->json(['error' => ['code' => $resultado['erro']]], 410);
        }

        return response()->json($resultado);
    }
}
