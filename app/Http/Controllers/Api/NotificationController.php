<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Log de notificações (docs/API.md, "Notificações (admin)") - gerenciar-notificacoes, admin only. */
class NotificationController extends Controller
{
    public function __construct(private readonly NotificationDispatchService $notificacoes) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-notificacoes');

        $pagina = NotificationLog::query()
            ->when($request->filled('tipo'), fn ($q) => $q->where('tipo', $request->string('tipo')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->paginate($request->integer('pageSize', 25));

        return response()->json([
            'data' => $pagina->through(fn (NotificationLog $log) => [
                'id' => $log->id,
                'tipo' => $log->tipo,
                'canal' => $log->canal->value,
                'destino' => $log->destino,
                'status' => $log->status->value,
                'tentativas' => $log->tentativas,
                'enviadaEm' => $log->enviada_em?->toIso8601String(),
                'manifestationId' => $log->manifestation_id,
            ]),
            'meta' => ['page' => $pagina->currentPage(), 'pageSize' => $pagina->perPage(), 'total' => $pagina->total()],
        ]);
    }

    /** Dispara um evento de teste (sem manifestação real associada) - útil pra validar canal/destino configurado antes de confiar nele em produção. */
    public function test(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-notificacoes');

        $validado = $request->validate(['tipo' => ['sometimes', 'string']]);

        $this->notificacoes->dispatchParaTipo($validado['tipo'] ?? 'teste', null);

        return response()->json(['ok' => true]);
    }
}
