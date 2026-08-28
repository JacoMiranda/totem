<?php

namespace App\Services;

use App\Jobs\SendNotificationJob;
use App\Models\Manifestation;
use App\Models\NotificationLog;
use App\Models\NotificationPref;

/**
 * Dispara notificações por tipo de evento (docs/PLANO-SISTEMA-
 * PROFISSIONAL.md, Fase 7: "manifestação Crítica/Denúncia recebida, SLA
 * estourado, nova manifestação atribuída"). Cada preferência ATIVA
 * (NotificationPref) que casa com o `tipo` vira UM NotificationLog +
 * UM SendNotificationJob - assim cada destinatário/canal tem seu próprio
 * registro de sucesso/falha, nunca um envio "tudo ou nada".
 */
class NotificationDispatchService
{
    public function dispatchParaTipo(string $tipo, ?Manifestation $manifestation, array $contexto = []): void
    {
        $preferencias = NotificationPref::where('tipo', $tipo)->where('ativo', true)->get();

        foreach ($preferencias as $pref) {
            $log = NotificationLog::create([
                'manifestation_id' => $manifestation?->id,
                'tipo' => $tipo,
                'canal' => $pref->canal,
                'destino' => $pref->destino,
                'payload' => [...$contexto, 'mensagem' => $this->mensagemPadrao($tipo, $manifestation)],
                'status' => 'pendente',
                'tentativas' => 0,
            ]);

            SendNotificationJob::dispatch($log->id);
        }
    }

    private function mensagemPadrao(string $tipo, ?Manifestation $manifestation): string
    {
        $protocolo = $manifestation?->protocolo ?? '(sem protocolo)';

        return match ($tipo) {
            'critica_recebida' => "Nova manifestação crítica recebida - protocolo {$protocolo}.",
            'atribuida' => "Manifestação {$protocolo} foi atribuída a você.",
            'sla_estourado' => "Manifestação {$protocolo} está fora do prazo de atendimento (SLA).",
            default => "Evento '{$tipo}' - protocolo {$protocolo}.",
        };
    }
}
