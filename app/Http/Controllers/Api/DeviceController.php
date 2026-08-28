<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * Gestão de dispositivos (docs/API.md, seção "Dispositivos (admin)") -
 * protegido por Sanctum (equipe) + Gate gerenciar-dispositivos, NUNCA
 * pelo próprio device.key (um totem não pode se auto-cadastrar).
 * Versão mínima da Fase 1 - só o essencial pra existir um device de
 * verdade pra testar as rotas de manifestação; listagem/rotate-key/
 * ativar-desativar completos entram na Fase 4 (painel admin).
 */
class DeviceController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // Gate::authorize (nao $this->authorize) - o Controller base
        // deste projeto e minimo, sem a trait AuthorizesRequests que
        // outras versoes/scaffolds do Laravel incluem por padrao.
        Gate::authorize('gerenciar-dispositivos');

        $validado = $request->validate([
            'codigo' => ['required', 'string', 'max:255', 'unique:devices,codigo'],
            'nome' => ['required', 'string', 'max:255'],
            'unidade' => ['nullable', 'string', 'max:255'],
        ]);

        // A key crua só existe neste momento - nunca gravada, nunca
        // recuperável depois (mesmo espírito de senha/api_key_hash já
        // usado no política-laravel pra provedores de IA).
        $chaveCrua = Str::random(48);

        $device = Device::create([
            ...$validado,
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return response()->json([
            'id' => $device->id,
            'codigo' => $device->codigo,
            'deviceKey' => $chaveCrua,
        ], 201);
    }
}
