<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\User;
use App\Services\ProtocoloService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Relatórios (docs/API.md, "Relatórios (analista+)") - agregações via ReportController. */
class ReportApiTest extends TestCase
{
    use RefreshDatabase;

    private function criarManifestacao(array $atributos = []): Manifestation
    {
        return Manifestation::create([
            'client_id' => (string) Str::uuid(),
            'protocolo' => app(ProtocoloService::class)->gerarProtocolo(),
            'canal' => 'Totem',
            'sentimento' => 'Insatisfeito',
            'categoria' => 'Reclamação',
            'urgencia' => 'Alta',
            'status' => 'Recebida',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            ...$atributos,
        ]);
    }

    public function test_leitor_nao_pode_ver_relatorios(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);

        $this->actingAs($leitor, 'sanctum')->getJson('/api/v1/reports/summary')->assertForbidden();
    }

    public function test_analista_ve_resumo_agregado(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $this->criarManifestacao(['sentimento' => 'Insatisfeito', 'categoria' => 'Reclamação', 'urgencia' => 'Alta']);
        $this->criarManifestacao(['sentimento' => 'Excelente', 'categoria' => 'Elogio', 'urgencia' => 'Baixa']);
        $this->criarManifestacao(['sentimento' => 'Excelente', 'categoria' => 'Elogio', 'urgencia' => 'Baixa']);

        $resposta = $this->actingAs($analista, 'sanctum')->getJson('/api/v1/reports/summary');

        $resposta->assertOk();
        $resposta->assertJsonPath('total', 3);
        $resposta->assertJsonPath('porCategoria.Elogio', 2);
        $resposta->assertJsonPath('porCategoria.Reclamação', 1);
        $resposta->assertJsonPath('porSentimento.Excelente', 2);
    }

    public function test_resumo_filtra_por_unidade_do_dispositivo(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $centro = Device::create(['codigo' => 'D1', 'nome' => 'Totem Centro', 'unidade' => 'Centro', 'api_key_hash' => hash('sha256', 'x')]);
        $norte = Device::create(['codigo' => 'D2', 'nome' => 'Totem Norte', 'unidade' => 'Norte', 'api_key_hash' => hash('sha256', 'y')]);
        $this->criarManifestacao(['device_id' => $centro->id]);
        $this->criarManifestacao(['device_id' => $norte->id]);

        $resposta = $this->actingAs($analista, 'sanctum')->getJson('/api/v1/reports/summary?unidade=Centro');

        $resposta->assertOk()->assertJsonPath('total', 1);
    }

    public function test_timeseries_agrupa_por_dia(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $this->criarManifestacao(['criado_em' => now()->subDays(2)]);
        $this->criarManifestacao(['criado_em' => now()->subDays(2)]);
        $this->criarManifestacao(['criado_em' => now()]);

        $resposta = $this->actingAs($analista, 'sanctum')->getJson('/api/v1/reports/timeseries?interval=day');

        $resposta->assertOk();
        $this->assertCount(2, $resposta->json('serie'));
    }

    public function test_sla_reporta_backlog_e_fora_do_prazo(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        // Crítica aberta há 5 dias - limite é 1 dia, deve contar como fora do SLA.
        $this->criarManifestacao(['urgencia' => 'Crítica', 'status' => 'Recebida', 'criado_em' => now()->subDays(5)]);
        // Baixa aberta há 2 dias - limite é 15 dias, dentro do prazo.
        $this->criarManifestacao(['urgencia' => 'Baixa', 'status' => 'Em triagem', 'criado_em' => now()->subDays(2)]);
        // Concluída não conta nem como backlog nem como fora do SLA.
        $this->criarManifestacao(['urgencia' => 'Crítica', 'status' => 'Concluída', 'criado_em' => now()->subDays(10)]);

        $resposta = $this->actingAs($analista, 'sanctum')->getJson('/api/v1/reports/sla');

        $resposta->assertOk();
        $resposta->assertJsonPath('backlog', 2);
        $resposta->assertJsonPath('foraDoSla', 1);
    }

    public function test_export_devolve_csv(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $this->criarManifestacao();

        $resposta = $this->actingAs($analista, 'sanctum')->get('/api/v1/reports/export');

        $resposta->assertOk();
        $resposta->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('"protocolo","canal","sentimento"', $resposta->getContent());
    }
}
