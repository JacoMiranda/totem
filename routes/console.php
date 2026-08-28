<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Hospedagem compartilhada da Hostinger só permite UM cron
// (`* * * * * php artisan schedule:run`) - todo processamento em segundo
// plano (SendNotificationJob, e qualquer job futuro) passa por aqui.
// Schedule::call()+Artisan::call() (não Schedule::command()) porque essa
// conta tem `proc_open`/`exec` desabilitados - Schedule::command() usa
// Symfony Process (proc_open) pra rodar queue:work como subprocesso
// separado, o que falha nesse tipo de hospedagem (mesmo padrão já
// validado em política-laravel, ver CLAUDE.md/routes/console.php de lá).
// withoutOverlapping(2) evita que o lock (cache_locks) fique preso por
// até 24h (default do Laravel) se um worker travar no meio de um job.
Schedule::call(function () {
    Artisan::call('queue:work', [
        '--stop-when-empty' => true,
        '--max-time' => 55,
    ]);
})->name('processar-fila')->everyMinute()->withoutOverlapping(2);

// Fase 7 (notificações) - checa manifestações fora do SLA uma vez por
// hora (não precisa de granularidade menor - é um alerta operacional,
// não algo tempo-crítico) e dispara `sla_estourado` pra quem tiver
// preferência ativa cadastrada (ver NotificationDispatchService).
Schedule::call(function () {
    Artisan::call('ouvidoria:checar-sla');
})->name('checar-sla')->hourly()->withoutOverlapping(10);
