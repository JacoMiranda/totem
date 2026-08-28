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

/**
 * Contrato de docs/API.md - auth da equipe, painel de manifestações (RBAC),
 * gestão de dispositivos e consulta pública. Complementa
 * ManifestationApiTest (totem/criação) e FundacaoSchemaTest (schema).
 */
class TeamPanelApiTest extends TestCase
{
    use RefreshDatabase;

    private function criarManifestacao(array $atributos = []): Manifestation
    {
        return Manifestation::create([
            'client_id' => (string) Str::uuid(),
            'protocolo' => app(ProtocoloService::class)->gerarProtocolo(),
            'canal' => 'Totem',
            'transcricao' => 'Relato de teste sobre atendimento.',
            'resumo' => 'Resumo de teste.',
            'keywords' => ['teste'],
            'sentimento' => 'Insatisfeito',
            'categoria' => 'Reclamação',
            'urgencia' => 'Alta',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
            ...$atributos,
        ]);
    }

    // ---------------------------------------------------------------
    // Auth (equipe)
    // ---------------------------------------------------------------

    public function test_login_com_credenciais_validas(): void
    {
        $user = User::factory()->create(['role' => UserRole::Analista]);

        $resposta = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'senha' => 'password']);

        $resposta->assertOk();
        $resposta->assertJsonStructure(['accessToken', 'user' => ['id', 'name', 'email', 'role', 'unidade']]);
        $this->assertSame('analista', $resposta->json('user.role'));
    }

    public function test_login_com_senha_errada_e_rejeitado(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'senha' => 'senha-errada'])
            ->assertUnprocessable();
    }

    public function test_login_de_usuario_inativo_e_rejeitado(): void
    {
        $user = User::factory()->create(['ativo' => false]);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'senha' => 'password'])
            ->assertUnprocessable();
    }

    public function test_me_e_logout_com_token_de_verdade(): void
    {
        $user = User::factory()->create(['role' => UserRole::Admin]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'senha' => 'password'])->json('accessToken');

        $this->withToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJson(['email' => $user->email, 'role' => 'admin']);

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // Guard do Sanctum cacheia o user resolvido por instância dentro do
        // MESMO container de teste (3 chamadas nesta função reaproveitam o
        // mesmo $app) - `forgetGuards()` força reavaliar o token contra o
        // banco de novo, senão o teste passaria por engano (cache de
        // processo, não do token em si, que já está confirmado apagado acima).
        \Illuminate\Support\Facades\Auth::forgetGuards();

        // token revogado - mesmo token não autentica mais.
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    // ---------------------------------------------------------------
    // Manifestações (painel, RBAC)
    // ---------------------------------------------------------------

    public function test_leitor_pode_listar_e_ver_detalhe(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);
        $manifestacao = $this->criarManifestacao();

        // `data` precisa ser um array PURO de resumos, não o objeto
        // paginador aninhado (bug real: $pagina->through() sem ->items()
        // devolve o próprio paginador, que serializa como
        // {current_page, data, ...} em vez de [...] - quebrava o
        // ManifestationsList.tsx do painel, que espera `data.data` como
        // array pra mapear).
        $this->actingAs($leitor, 'sanctum')->getJson('/api/v1/manifestations')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.protocolo', $manifestacao->protocolo)
            ->assertJsonCount(1, 'data');

        $this->actingAs($leitor, 'sanctum')->getJson("/api/v1/manifestations/{$manifestacao->id}")
            ->assertOk()
            ->assertJson(['id' => $manifestacao->id, 'protocolo' => $manifestacao->protocolo])
            ->assertJsonStructure(['transcricao', 'linhaDoTempo', 'notas']);
    }

    public function test_leitor_nao_pode_acessar_audio(): void
    {
        $leitor = User::factory()->create(['role' => UserRole::Leitor]);
        $manifestacao = $this->criarManifestacao(['audio_object_key' => 'audio/teste.webm']);

        $this->actingAs($leitor, 'sanctum')->getJson("/api/v1/manifestations/{$manifestacao->id}/audio")
            ->assertForbidden();
    }

    public function test_analista_acessa_audio_e_fica_auditado(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::disk('local')->put('audio/teste.webm', 'conteudo-fake');
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $manifestacao = $this->criarManifestacao(['audio_object_key' => 'audio/teste.webm']);

        $this->actingAs($analista, 'sanctum')->get("/api/v1/manifestations/{$manifestacao->id}/audio")
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'ator_id' => $analista->id,
            'acao' => 'acesso_audio',
            'entidade_id' => $manifestacao->id,
        ]);
    }

    public function test_atendente_muda_status_mas_nao_reclassifica(): void
    {
        $atendente = User::factory()->create(['role' => UserRole::Atendente]);
        $manifestacao = $this->criarManifestacao();

        $this->actingAs($atendente, 'sanctum')
            ->patchJson("/api/v1/manifestations/{$manifestacao->id}/status", ['status' => 'Em triagem'])
            ->assertOk()
            ->assertJson(['status' => 'Em triagem']);
        $this->assertDatabaseHas('manifestation_status_history', ['manifestation_id' => $manifestacao->id, 'para_status' => 'Em triagem', 'de_status' => 'Recebida']);

        $this->actingAs($atendente, 'sanctum')
            ->patchJson("/api/v1/manifestations/{$manifestacao->id}/classify", ['urgencia' => 'Crítica'])
            ->assertForbidden();
    }

    public function test_analista_atribui_reclassifica_e_responde(): void
    {
        $analista = User::factory()->create(['role' => UserRole::Analista]);
        $responsavel = User::factory()->create(['role' => UserRole::Atendente]);
        $manifestacao = $this->criarManifestacao();

        $this->actingAs($analista, 'sanctum')
            ->patchJson("/api/v1/manifestations/{$manifestacao->id}/assign", ['responsavelId' => $responsavel->id])
            ->assertOk();
        $this->assertDatabaseHas('manifestations', ['id' => $manifestacao->id, 'responsavel_id' => $responsavel->id]);

        $this->actingAs($analista, 'sanctum')
            ->patchJson("/api/v1/manifestations/{$manifestacao->id}/classify", ['urgencia' => 'Baixa'])
            ->assertOk()
            ->assertJson(['urgencia' => 'Baixa']);
        $this->assertDatabaseHas('audit_logs', ['acao' => 'reclassificacao', 'entidade_id' => $manifestacao->id]);

        // resposta oficial publicada muda o status pra "Respondida" automaticamente.
        $this->actingAs($analista, 'sanctum')
            ->postJson("/api/v1/manifestations/{$manifestacao->id}/resposta", ['texto' => 'Resposta oficial.', 'publicar' => true])
            ->assertOk()
            ->assertJson(['status' => 'Respondida']);
        $this->assertDatabaseHas('manifestations', ['id' => $manifestacao->id, 'status' => 'Respondida']);
        // de_status precisa ser o status ANTERIOR de verdade (Recebida), não
        // "Respondida" de novo - ver correção em
        // Admin\ManifestationController::resposta (getOriginal() lido depois
        // do save() devolveria o valor já sincronizado, sempre igual ao novo).
        $this->assertDatabaseHas('manifestation_status_history', [
            'manifestation_id' => $manifestacao->id,
            'de_status' => 'Recebida',
            'para_status' => 'Respondida',
            'motivo' => 'Resposta oficial publicada.',
        ]);
    }

    public function test_atendente_adiciona_nota_interna(): void
    {
        $atendente = User::factory()->create(['role' => UserRole::Atendente]);
        $manifestacao = $this->criarManifestacao();

        $this->actingAs($atendente, 'sanctum')
            ->postJson("/api/v1/manifestations/{$manifestacao->id}/notes", ['texto' => 'Nota de acompanhamento.'])
            ->assertCreated();
        $this->assertDatabaseHas('manifestation_notes', ['manifestation_id' => $manifestacao->id, 'autor_id' => $atendente->id]);
    }

    // ---------------------------------------------------------------
    // Dispositivos (admin)
    // ---------------------------------------------------------------

    public function test_admin_lista_rotaciona_e_desativa_dispositivo(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $device = Device::create(['codigo' => 'TOTEM-01', 'nome' => 'Totem Um', 'api_key_hash' => hash('sha256', 'antiga'), 'ativo' => true]);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/devices')
            ->assertOk()
            ->assertJsonMissing(['apiKeyHash' => hash('sha256', 'antiga')]);

        $rotacao = $this->actingAs($admin, 'sanctum')->postJson("/api/v1/devices/{$device->id}/rotate-key");
        $rotacao->assertOk()->assertJsonStructure(['id', 'deviceKey']);
        $this->assertNotSame(hash('sha256', 'antiga'), $device->fresh()->api_key_hash);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/devices/{$device->id}", ['ativo' => false])
            ->assertOk()
            ->assertJson(['ativo' => false]);
        $this->assertDatabaseHas('devices', ['id' => $device->id, 'ativo' => false]);
    }

    // ---------------------------------------------------------------
    // Consulta pública (sem auth)
    // ---------------------------------------------------------------

    public function test_consulta_publica_com_pin_correto(): void
    {
        $servico = app(ProtocoloService::class);
        $pin = '4821';
        $manifestacao = $this->criarManifestacao(['pin_acompanhamento' => $servico->hashPin($pin)]);

        $this->getJson("/api/v1/public/manifestations/{$manifestacao->protocolo}?pin={$pin}")
            ->assertOk()
            ->assertJson(['protocolo' => $manifestacao->protocolo, 'status' => 'Recebida'])
            ->assertJsonStructure(['linhaDoTempo', 'respostaOficial']);
    }

    /** Mesmo erro genérico pra PIN errado E protocolo inexistente - não pode dar pra distinguir os dois (enumeração). */
    public function test_consulta_publica_com_pin_errado_e_protocolo_inexistente_dao_o_mesmo_erro(): void
    {
        $servico = app(ProtocoloService::class);
        $manifestacao = $this->criarManifestacao(['pin_acompanhamento' => $servico->hashPin('1111')]);

        $comPinErrado = $this->getJson("/api/v1/public/manifestations/{$manifestacao->protocolo}?pin=9999");
        $semProtocolo = $this->getJson('/api/v1/public/manifestations/OUV-999999-999999?pin=9999');

        $comPinErrado->assertNotFound()->assertJson(['error' => ['code' => 'NOT_FOUND']]);
        $semProtocolo->assertNotFound()->assertJson(['error' => ['code' => 'NOT_FOUND']]);
        $this->assertSame($comPinErrado->json('error.message'), $semProtocolo->json('error.message'));
    }
}
