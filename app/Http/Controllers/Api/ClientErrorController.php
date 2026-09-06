<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Recebe erros do NAVEGADOR do totem (mic não pegou, Gemini falhou, WAV não
 * decodificou...) e joga no canal `kiosk`, visível em /admin/logs.
 *
 * O objetivo é a equipe ver o problema SEM depender do cidadão saber
 * descrever o que aconteceu na frente do totem. Autenticado por device key
 * (o mesmo do resto do fluxo do totem) e com throttle - um totem em loop de
 * erro não pode encher o disco.
 */
class ClientErrorController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'contexto' => ['required', 'string', 'max:80'],
            'mensagem' => ['required', 'string', 'max:500'],
            'diagnostico' => ['nullable', 'string', 'max:500'],
        ]);

        /** @var Device|null $device */
        $device = $request->attributes->get('device');

        Log::channel('kiosk')->warning('[totem] '.$dados['contexto'].': '.$dados['mensagem'], [
            'device' => $device?->codigo,
            'organizacao' => $device?->organizacao_id,
            'diagnostico' => Str::limit((string) ($dados['diagnostico'] ?? ''), 500),
            'ua' => Str::limit((string) $request->userAgent(), 300),
        ]);

        return response()->json(['ok' => true]);
    }
}
