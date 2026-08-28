<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Jobs\SendNotificationJob;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\NotificationLog;
use App\Models\NotificationPref;
use App\Models\User;
use App\Services\ProtocoloService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Fase 7 (notificações) - NotificationDispatchService, SendNotificationJob,
 * gatilhos reais (crítica/denúncia recebida, atribuição, SLA estourado) e
 * as rotas de log/preferências/teste. `QUEUE_CONNECTION=sync` no
 * phpunit.xml faz os jobs rodarem na hora, sem precisar de Queue::fake()
 * pra observar o resultado (status do NotificationLog).
 */
class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private function criarDevice(): string
    {
        $chave = 'chave-'.Str::random(20);
        Device::create(['codigo' => 'TOTEM-NOTIF', 'nome' => 'Totem', 'api_key_hash' => hash('sha256', $chave), 'ativo' => true]);

        return $chave;
    }

    private function criarManifestacao(array $atributos = []): Manifestation
    {
        return Manifestation::create([
            'client_id' => (string) Str::uuid(),
            'protocolo' => app(ProtocoloService::class)->gerarProtocolo(),
            'canal' => 'Totem',
            'urgencia' => 'Baixa',
            'status' => 'Recebida',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            ...$atributos,
        ]);
    }

    public function test_manifestacao_critica_dispara_notificacao(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        NotificationPref::create(['user_id' => $admin->id, 'tipo' => 'critica_recebida', 'canal' => 'email', 'destino' => 'ouvidor@exemplo.gov.br', 'ativo' => true]);
        $chave = $this->criarDevice();

        $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
            'urgencia' => 'Crítica',
        ], ['X-Device-Key' => $chave])->assertCreated();

        $this->assertDatabaseHas('notification_logs', ['tipo' => 'critica_recebida', 'destino' => 'ouvidor@exemplo.gov.br', 'status' => 'enviada']);
    }

    public function test_manifestacao_sem_urgencia_critica_nao_dispara(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        NotificationPref::create(['user_id' => $admin->id, 'tipo' => 'critica_recebida', 'canal' => 'email', 'destino' => 'ouvidor@exemplo.gov.br', 'ativo' => true]);
        $chave = $this->criarDevice();

        $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
            'urgencia' => 'Baixa',
        ], ['X-Device-Key' => $chave])->assertCreated();

        $this->assertDatabaseCount('notification_logs', 0);
    }

    public function test_atribuicao_dispara_notificacao_via_webhook(): void
    {
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $atendente = User::factory()->create(['role' => UserRole::Atendente]);
        NotificationPref::create(['user_id' => $analista->id, 'tipo' => 'atribuida', 'canal' => 'webhook', 'destino' => 'https://hooks.exemplo/ouvidoria', 'ativo' => true]);
        $manifestacao = $this->criarManifestacao();

        $this->actingAs($analista, 'sanctum')
            ->patchJson("/api/v1/manifestations/{$manifestacao->id}/assign", ['responsavelId' => $atendente->id])
            ->assertOk();

        $this->assertDatabaseHas('notification_logs', ['tipo' => 'atribuida', 'status' => 'enviada']);
        Http::assertSent(fn ($request) => $request->url() === 'https://hooks.exemplo/ouvidoria');
    }

    public function test_webhook_indisponivel_marca_tentativa_sem_derrubar_a_requisicao(): void
    {
        Http::fake(['*' => Http::response([], 500)]);
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        NotificationPref::create(['user_id' => $analista->id, 'tipo' => 'atribuida', 'canal' => 'webhook', 'destino' => 'https://hooks.exemplo/quebrado', 'ativo' => true]);
        $manifestacao = $this->criarManifestacao();

        $log = NotificationLog::create([
            'manifestation_id' => $manifestacao->id,
            'tipo' => 'atribuida',
            'canal' => 'webhook',
            'destino' => 'https://hooks.exemplo/quebrado',
            'payload' => ['mensagem' => 'teste'],
            'status' => 'pendente',
            'tentativas' => 0,
        ]);

        // Chama handle() direto (não ::dispatch()) - com QUEUE_CONNECTION=sync
        // o job não tem infraestrutura real de retry (SyncJob::attempts()
        // sempre devolve 1), então rodar via dispatch() deixaria a exceção
        // subir e derrubar o teste; isso é esperado do driver sync (em
        // produção, a fila `database` + queue:work faz o retry de verdade
        // conforme $tries/$backoff do Job).
        try {
            (new SendNotificationJob($log->id))->handle();
        } catch (\Throwable) {
            // esperado - o job relança pra deixar o worker reagendar de verdade.
        }

        $log->refresh();
        $this->assertSame(1, $log->tentativas);
        $this->assertSame('pendente', $log->status->value); // 1ª tentativa, ainda não esgotou $tries
    }

    public function test_checar_sla_notifica_uma_vez_so(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        NotificationPref::create(['user_id' => $admin->id, 'tipo' => 'sla_estourado', 'canal' => 'email', 'destino' => 'ouvidor@exemplo.gov.br', 'ativo' => true]);
        // Crítica aberta há 5 dias - limite é 1 dia, estourou.
        $this->criarManifestacao(['urgencia' => 'Crítica', 'status' => 'Recebida', 'criado_em' => now()->subDays(5)]);

        Artisan::call('ouvidoria:checar-sla');
        $this->assertDatabaseCount('notification_logs', 1);

        // Rodar de novo NÃO duplica - já existe um log 'sla_estourado' pra essa manifestação.
        Artisan::call('ouvidoria:checar-sla');
        $this->assertDatabaseCount('notification_logs', 1);
    }

    public function test_apenas_admin_ve_log_de_notificacoes(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $this->actingAs($leitor, 'sanctum')->getJson('/api/v1/notifications')->assertForbidden();
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/notifications')->assertOk();
    }

    public function test_usuario_gerencia_as_proprias_preferencias(): void
    {
        $atendente = User::factory()->create(['role' => UserRole::Atendente]);

        $this->actingAs($atendente, 'sanctum')->putJson('/api/v1/notification-prefs', [
            'preferencias' => [
                ['tipo' => 'atribuida', 'canal' => 'email', 'destino' => $atendente->email, 'ativo' => true],
            ],
        ])->assertOk();

        $resposta = $this->actingAs($atendente, 'sanctum')->getJson('/api/v1/notification-prefs');
        $resposta->assertOk();
        $resposta->assertJsonFragment(['tipo' => 'atribuida', 'destino' => $atendente->email]);
    }
}
