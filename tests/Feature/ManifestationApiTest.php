<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Contrato de docs/API.md - manifestações (totem/criação) e dispositivos (admin). */
class ManifestationApiTest extends TestCase
{
    use RefreshDatabase;

    private function criarDevice(): array
    {
        $chaveCrua = 'chave-de-teste-'.Str::random(20);
        $device = Device::create([
            'codigo' => 'TOTEM-TESTE-01',
            'nome' => 'Totem de Teste',
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return [$device, $chaveCrua];
    }

    public function test_cria_manifestacao_com_device_key_valida(): void
    {
        [$device, $chave] = $this->criarDevice();

        $resposta = $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
            'transcricao' => 'Reclamação de teste sobre demora no atendimento.',
            'sentimento' => 'Insatisfeito',
            'categoria' => 'Reclamação',
            'urgencia' => 'Alta',
        ], ['X-Device-Key' => $chave]);

        $resposta->assertCreated();
        $resposta->assertJsonStructure(['id', 'protocolo', 'pin', 'status', 'audioUploadUrl']);
        $this->assertMatchesRegularExpression('/^OUV-\d{6}-\d{6}$/', $resposta->json('protocolo'));
        $this->assertSame(4, strlen($resposta->json('pin')));
        $this->assertSame('Recebida', $resposta->json('status'));

        $this->assertDatabaseHas('manifestations', ['device_id' => $device->id, 'status' => 'Recebida']);
        $this->assertDatabaseHas('manifestation_status_history', ['para_status' => 'Recebida', 'de_status' => null]);
    }

    public function test_sem_device_key_e_rejeitado(): void
    {
        $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
        ])->assertUnauthorized();
    }

    public function test_device_key_invalida_e_rejeitada(): void
    {
        $this->criarDevice();

        $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
        ], ['X-Device-Key' => 'chave-errada'])->assertUnauthorized();
    }

    /**
     * Bug que o design evita por construção: reenviar o MESMO clientId
     * (retry de sync após queda de rede, por exemplo) nunca pode criar um
     * segundo registro - ver docs/ARQUITETURA.md (idempotência do sync).
     */
    public function test_reenviar_o_mesmo_client_id_e_idempotente(): void
    {
        [, $chave] = $this->criarDevice();
        $clientId = (string) Str::uuid();
        $payload = [
            'clientId' => $clientId,
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
        ];

        $primeira = $this->postJson('/api/v1/manifestations', $payload, ['X-Device-Key' => $chave]);
        $primeira->assertCreated();

        $segunda = $this->postJson('/api/v1/manifestations', $payload, ['X-Device-Key' => $chave]);
        $segunda->assertOk(); // 200, não 201 - é um replay, não uma criação nova
        $this->assertSame($primeira->json('protocolo'), $segunda->json('protocolo'));
        $this->assertNull($segunda->json('pin')); // PIN só aparece na criação de verdade, nunca de novo num replay

        $this->assertSame(1, Manifestation::where('client_id', $clientId)->count());
    }

    public function test_upload_de_audio(): void
    {
        Storage::fake('local');
        [, $chave] = $this->criarDevice();

        $criacao = $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
        ], ['X-Device-Key' => $chave]);

        $manifestationId = $criacao->json('id');
        $arquivo = UploadedFile::fake()->create('gravacao.webm', 500, 'audio/webm');

        $upload = $this->post("/api/v1/manifestations/{$manifestationId}/audio", ['file' => $arquivo, 'duracaoSeg' => 42], ['X-Device-Key' => $chave]);

        $upload->assertOk();
        $upload->assertJson(['ok' => true]);
        Storage::disk('local')->assertExists("audio/{$manifestationId}.webm");
        $this->assertDatabaseHas('manifestations', ['id' => $manifestationId, 'audio_duracao_seg' => 42]);
    }

    public function test_consulta_por_protocolo(): void
    {
        [, $chave] = $this->criarDevice();
        $criacao = $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
        ], ['X-Device-Key' => $chave]);

        $this->getJson('/api/v1/manifestations/'.$criacao->json('protocolo'), ['X-Device-Key' => $chave])
            ->assertOk()
            ->assertJson(['protocolo' => $criacao->json('protocolo'), 'status' => 'Recebida']);
    }

    public function test_admin_cria_dispositivo(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $resposta = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/devices', [
            'codigo' => 'TOTEM-CENTRO-01',
            'nome' => 'Totem Centro',
        ]);

        $resposta->assertCreated();
        $resposta->assertJsonStructure(['id', 'codigo', 'deviceKey']);
        $this->assertDatabaseHas('devices', ['codigo' => 'TOTEM-CENTRO-01']);
    }

    public function test_leitor_nao_pode_criar_dispositivo(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);

        $this->actingAs($leitor, 'sanctum')->postJson('/api/v1/devices', [
            'codigo' => 'TOTEM-X',
            'nome' => 'Totem X',
        ])->assertForbidden();
    }
}
