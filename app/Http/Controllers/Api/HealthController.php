<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Throwable;

/** docs/API.md ("Health") - usado na Fase 9 pra confirmar que o deploy (banco, disco, fila) está de pé antes de liberar o subdomínio. */
class HealthController extends Controller
{
    public function health(): JsonResponse
    {
        $db = $this->checarBanco();
        $storage = $this->checarStorage();
        $gemini = filled(config('services.gemini.api_key'));

        return response()->json([
            'status' => $db && $storage ? 'ok' : 'degraded',
            'db' => $db,
            'storage' => $storage,
            'gemini' => $gemini,
        ], $db && $storage ? 200 : 503);
    }

    /** (admin) totems cadastrados + última sincronização - flag `atrasado` quando não sincroniza há mais de 24h (ou nunca sincronizou). */
    public function devices(): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        return response()->json(Device::orderBy('nome')->get()->map(fn (Device $d) => [
            'id' => $d->id,
            'codigo' => $d->codigo,
            'nome' => $d->nome,
            'ativo' => $d->ativo,
            'ultimaSyncEm' => $d->ultima_sync_em?->toIso8601String(),
            'atrasado' => ! $d->ultima_sync_em || $d->ultima_sync_em->lt(now()->subDay()),
        ]));
    }

    private function checarBanco(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function checarStorage(): bool
    {
        try {
            Storage::disk('local')->put('.healthcheck', 'ok');
            $ok = Storage::disk('local')->get('.healthcheck') === 'ok';
            Storage::disk('local')->delete('.healthcheck');

            return $ok;
        } catch (Throwable) {
            return false;
        }
    }
}
