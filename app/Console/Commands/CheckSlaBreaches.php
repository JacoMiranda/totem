<?php

namespace App\Console\Commands;

use App\Models\Manifestation;
use App\Models\NotificationLog;
use App\Services\NotificationDispatchService;
use Illuminate\Console\Command;

/**
 * Verifica manifestações abertas além do prazo de SLA da sua urgência
 * (mesmos limites de ReportController::LIMITE_SLA_DIAS) e dispara UMA
 * notificação `sla_estourado` por manifestação - nunca repete pra quem já
 * tem um log desse tipo (checagem por NotificationLog existente), senão
 * cada execução horária do schedule reenviaria o mesmo alerta pra sempre.
 */
class CheckSlaBreaches extends Command
{
    protected $signature = 'ouvidoria:checar-sla';

    protected $description = 'Notifica manifestações abertas que estouraram o prazo de SLA da sua urgência';

    private const LIMITE_SLA_DIAS = ['Crítica' => 1, 'Alta' => 3, 'Média' => 7, 'Baixa' => 15];

    private const STATUS_RESOLVIDOS = ['Concluída', 'Arquivada'];

    public function handle(NotificationDispatchService $notificacoes): int
    {
        $jaNotificadas = NotificationLog::where('tipo', 'sla_estourado')->pluck('manifestation_id')->filter();

        $abertas = Manifestation::whereNotIn('status', self::STATUS_RESOLVIDOS)
            ->whereNotIn('id', $jaNotificadas)
            ->get(['id', 'criado_em', 'urgencia', 'protocolo']);

        $notificadas = 0;
        foreach ($abertas as $manifestacao) {
            $limiteDias = self::LIMITE_SLA_DIAS[$manifestacao->urgencia->value] ?? 15;
            if ($manifestacao->criado_em->diffInDays(now()) > $limiteDias) {
                $notificacoes->dispatchParaTipo('sla_estourado', $manifestacao);
                $notificadas++;
            }
        }

        $this->info("{$notificadas} manifestação(ões) notificada(s) por estouro de SLA.");

        return self::SUCCESS;
    }
}
