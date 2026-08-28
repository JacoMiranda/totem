<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Manifestation;
use App\Services\ProtocoloService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consulta pública por protocolo (docs/API.md, Fase 6) - SEM auth, rate
 * limited (ver routes/api.php - throttle), protegida contra enumeração:
 * erro genérico sempre que protocolo+pin não baterem, nunca revela se o
 * protocolo existe ou só o pin está errado. Nunca expõe notas internas,
 * transcrição, dados de outra pessoa nem quem é o responsável.
 */
class PublicManifestationController extends Controller
{
    public function __construct(private readonly ProtocoloService $protocolo) {}

    public function show(Request $request, string $protocolo): JsonResponse
    {
        $pin = $request->query('pin', '');
        $manifestacao = Manifestation::where('protocolo', $protocolo)->first();

        if (! $manifestacao || ! $pin || $manifestacao->pin_acompanhamento !== $this->protocolo->hashPin($pin)) {
            return response()->json(['error' => ['code' => 'NOT_FOUND', 'message' => 'Protocolo ou PIN inválidos.']], 404);
        }

        return response()->json([
            'protocolo' => $manifestacao->protocolo,
            'status' => $manifestacao->status->value,
            'recebidoEm' => $manifestacao->recebido_em->toIso8601String(),
            'linhaDoTempo' => $manifestacao->statusHistory->map(fn ($h) => [
                'status' => $h->para_status->value,
                'em' => $h->criado_em->toIso8601String(),
            ])->values(),
            'respostaOficial' => $manifestacao->resposta_publicada_em ? $manifestacao->resposta_oficial : null,
        ]);
    }
}
