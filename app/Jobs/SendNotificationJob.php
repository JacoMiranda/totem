<?php

namespace App\Jobs;

use App\Models\NotificationLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Envia UM registro de notification_logs (email ou webhook) - fila
 * `database` (não Redis/BullMQ, ver CLAUDE.md), processada pelo mesmo
 * `queue:work --stop-when-empty` disparado a cada minuto pelo cron do
 * hPanel (docs/PLANO-SISTEMA-PROFISSIONAL.md previa BullMQ; aqui é Jobs
 * nativos do Laravel, mesmo padrão já usado em política-laravel).
 */
class SendNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var int[] segundos de espera entre tentativas - backoff crescente. */
    public array $backoff = [30, 120];

    public function __construct(private readonly string $notificationLogId) {}

    public function handle(): void
    {
        $log = NotificationLog::find($this->notificationLogId);
        if (! $log) {
            return; // registro removido/expurgado (ver Fase 8, LGPD) - nada a fazer.
        }

        try {
            match ($log->canal->value) {
                'email' => Mail::raw($this->corpoTexto($log), function ($message) use ($log) {
                    $message->to($log->destino)->subject('Ouvidoria Cidadã - '.$log->tipo);
                }),
                'webhook' => $this->enviarWebhook($log),
                default => throw new \RuntimeException("Canal desconhecido: {$log->canal->value}"),
            };

            $log->update(['status' => 'enviada', 'enviada_em' => now(), 'tentativas' => $log->tentativas + 1]);
        } catch (Throwable $e) {
            $log->update(['tentativas' => $log->tentativas + 1]);
            Log::warning('SendNotificationJob: falha ao enviar', ['id' => $log->id, 'canal' => $log->canal->value, 'erro' => $e->getMessage()]);

            if ($this->attempts() >= $this->tries) {
                $log->update(['status' => 'falha']);
            }

            throw $e; // deixa o Laravel reagendar conforme $tries/$backoff.
        }
    }

    private function enviarWebhook(NotificationLog $log): void
    {
        $resposta = Http::timeout(10)->post($log->destino, $log->payload ?? []);
        if (! $resposta->successful()) {
            throw new \RuntimeException("Webhook respondeu {$resposta->status()}");
        }
    }

    private function corpoTexto(NotificationLog $log): string
    {
        $payload = $log->payload ?? [];

        return $payload['mensagem'] ?? "Evento: {$log->tipo}";
    }
}
