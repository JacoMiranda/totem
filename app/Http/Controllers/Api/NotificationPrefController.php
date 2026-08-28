<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPref;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;
use App\Enums\NotifChannel;

/**
 * Preferências de notificação (docs/API.md, "GET/PUT /notification-prefs")
 * - sempre as do PRÓPRIO usuário autenticado, sem gate especial além de
 * estar logado (auth:sanctum) - ninguém edita a preferência de outra
 * pessoa por aqui.
 */
class NotificationPrefController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->notificationPrefs()->get()->map(fn (NotificationPref $p) => [
                'id' => $p->id,
                'tipo' => $p->tipo,
                'canal' => $p->canal->value,
                'destino' => $p->destino,
                'ativo' => $p->ativo,
            ]),
        );
    }

    /** Substitui a lista completa de preferências do usuário (upsert simples por tipo+canal). */
    public function update(Request $request): JsonResponse
    {
        $validado = $request->validate([
            'preferencias' => ['required', 'array'],
            'preferencias.*.tipo' => ['required', 'string'],
            'preferencias.*.canal' => ['required', new Enum(NotifChannel::class)],
            'preferencias.*.destino' => ['required', 'string'],
            'preferencias.*.ativo' => ['required', 'boolean'],
        ]);

        foreach ($validado['preferencias'] as $pref) {
            NotificationPref::updateOrCreate(
                ['user_id' => $request->user()->id, 'tipo' => $pref['tipo'], 'canal' => $pref['canal']],
                ['destino' => $pref['destino'], 'ativo' => $pref['ativo']],
            );
        }

        return response()->json(['ok' => true]);
    }
}
