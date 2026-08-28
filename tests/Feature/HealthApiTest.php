<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Fase 8/9 (health) - usado pra validar deploy (docs/API.md, "Health"). */
class HealthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_reporta_ok(): void
    {
        config(['services.gemini.api_key' => 'chave-de-teste']);

        $resposta = $this->getJson('/api/v1/health');

        $resposta->assertOk();
        $resposta->assertJson(['status' => 'ok', 'db' => true, 'storage' => true, 'gemini' => true]);
    }

    public function test_health_sem_chave_gemini_reporta_false_mas_continua_ok(): void
    {
        config(['services.gemini.api_key' => null]);

        $resposta = $this->getJson('/api/v1/health');

        $resposta->assertOk();
        $resposta->assertJson(['status' => 'ok', 'gemini' => false]);
    }

    public function test_health_devices_exige_gate_de_dispositivos(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);

        $this->actingAs($leitor, 'sanctum')->getJson('/api/v1/health/devices')->assertForbidden();
    }

    public function test_health_devices_marca_atrasado(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        Device::create(['codigo' => 'D1', 'nome' => 'Nunca sincronizou', 'api_key_hash' => hash('sha256', 'a'), 'ativo' => true, 'ultima_sync_em' => null]);
        Device::create(['codigo' => 'D2', 'nome' => 'Recente', 'api_key_hash' => hash('sha256', 'b'), 'ativo' => true, 'ultima_sync_em' => now()->subHours(2)]);

        $resposta = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/health/devices');

        $resposta->assertOk();
        $resposta->assertJsonFragment(['codigo' => 'D1', 'atrasado' => true]);
        $resposta->assertJsonFragment(['codigo' => 'D2', 'atrasado' => false]);
    }

    public function test_respostas_incluem_headers_de_seguranca(): void
    {
        $resposta = $this->getJson('/api/v1/health');

        $resposta->assertHeader('X-Content-Type-Options', 'nosniff');
        $resposta->assertHeader('X-Frame-Options', 'DENY');
        $resposta->assertHeader('Content-Security-Policy');
    }
}
