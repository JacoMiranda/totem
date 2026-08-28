<?php

namespace App\Http\Middleware;

use App\Models\Device;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Autentica o totem via header `X-Device-Key` (docs/API.md) - escopo
 * restrito (manifestations:create + ai:invoke), nunca o mesmo token de
 * acesso da equipe (Sanctum). A chave em si nunca é guardada em texto
 * puro - só o hash (mesmo padrão de senha, ver Device::api_key_hash).
 */
class DeviceApiKeyAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $chave = $request->header('X-Device-Key');

        if (! $chave) {
            return response()->json(['error' => ['code' => 'AUTH_REQUIRED', 'message' => 'Cabeçalho X-Device-Key ausente.']], 401);
        }

        $device = Device::where('api_key_hash', hash('sha256', $chave))->where('ativo', true)->first();

        if (! $device) {
            return response()->json(['error' => ['code' => 'AUTH_REQUIRED', 'message' => 'Device key inválida ou inativa.']], 401);
        }

        $request->attributes->set('device', $device);

        return $next($request);
    }
}
