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
 */
class DeviceController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        return response()->json(Device::orderBy('nome')->get()->map(fn (Device $d) => [
            'id' => $d->id,
            'codigo' => $d->codigo,
            'nome' => $d->nome,
            'unidade' => $d->unidade,
            'ativo' => $d->ativo,
            'ultimaSyncEm' => $d->ultima_sync_em?->toIso8601String(),
            'versaoApp' => $d->versao_app,
        ]));
    }

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

        [$device, $chaveCrua] = $this->criarComNovaChave($validado);

        return response()->json(['id' => $device->id, 'codigo' => $device->codigo, 'deviceKey' => $chaveCrua], 201);
    }

    /** Nova key - a antiga para de funcionar imediatamente (revogação implícita). */
    public function rotateKey(Device $device): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        $chaveCrua = Str::random(48);
        $device->update(['api_key_hash' => hash('sha256', $chaveCrua)]);

        return response()->json(['id' => $device->id, 'deviceKey' => $chaveCrua]);
    }

    public function update(Request $request, Device $device): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        $validado = $request->validate(['ativo' => ['required', 'boolean']]);
        $device->update($validado);

        return response()->json(['id' => $device->id, 'ativo' => $device->ativo]);
    }

    /** @return array{0: Device, 1: string} */
    private function criarComNovaChave(array $dados): array
    {
        // A key crua só existe neste momento - nunca gravada, nunca
        // recuperável depois (mesmo espírito de senha/api_key_hash já
        // usado no política-laravel pra provedores de IA).
        $chaveCrua = Str::random(48);

        $device = Device::create([
            ...$dados,
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return [$device, $chaveCrua];
    }
}
