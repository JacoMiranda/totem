<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\Organizacao;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Mural público de transparência (docs/MURAL-PUBLICO.md). */
class MuralApiTest extends TestCase
{
    use RefreshDatabase;

    private function org(array $attrs = []): Organizacao
    {
        return Organizacao::create(array_merge([
            'nome' => 'Empresa X',
            'slug' => 'EmpresaX'.Str::random(4),
            'status' => OrganizacaoStatus::Ativa,
        ], $attrs));
    }

    private function manifestacao(Organizacao $org, array $attrs = []): Manifestation
    {
        $device = Device::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id,
            'codigo' => 'T-'.Str::random(6),
            'nome' => 'Totem',
            'unidade' => 'Recepção',
            'api_key_hash' => hash('sha256', Str::random(10)),
            'ativo' => true,
        ]);

        return Manifestation::withoutGlobalScopes()->create(array_merge([
            'organizacao_id' => $org->id,
            'protocolo' => 'OUV-'.now()->format('Ym').'-'.random_int(100000, 999999),
            'client_id' => (string) Str::uuid(),
            'pin_acompanhamento' => hash('sha256', '1234'),
            'canal' => 'Totem',
            'device_id' => $device->id,
            'categoria' => 'Reclamação',
            'sentimento' => 'Insatisfeito',
            'urgencia' => 'Média',
            'status' => 'Concluída',
            'consentimento_lgpd' => true,
            'criado_em' => now()->subDays(10),
            'resposta_publicada_em' => now()->subDays(8),
            'atualizado_em' => now()->subDays(7),
        ], $attrs));
    }

    public function test_mural_desativado_ou_inexistente_da_404(): void
    {
        $this->getJson('/api/v1/mural/naoexisteesse')->assertNotFound();

        $org = $this->org(['mural_ativo' => false, 'mural_token' => 'tokendesativado1']);
        $this->getJson('/api/v1/mural/tokendesativado1')->assertNotFound();
    }

    public function test_mural_ativo_devolve_indicadores(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'tokenpublicoaqui1', 'mural_titulo' => 'Ouvidoria X']);
        $this->manifestacao($org);
        $this->manifestacao($org, ['categoria' => 'Elogio', 'sentimento' => 'Excelente', 'resumo' => 'Ótimo atendimento no caixa.']);

        $r = $this->getJson('/api/v1/mural/tokenpublicoaqui1');

        $r->assertOk();
        $r->assertJsonPath('titulo', 'Ouvidoria X');
        $r->assertJsonStructure([
            'indicadores' => ['respondidasPct', 'resolvidasPct', 'noPrazoPct', 'reclamacoesResolvidasPct'],
            'compromisso' => ['tudoNoPrazo', 'diasSemAtraso', 'diasOuvindo'],
            'distribuicao' => [['chave', 'pct']],
            'clima' => ['positivoPct', 'neutroPct', 'atentoPct'],
            'elogios',
        ]);
        $this->assertSame(100, $r->json('indicadores.respondidasPct'));
        // Distribuição usa "Reclamação" (Denúncia entra somada, nunca com rótulo próprio).
        $this->assertNotContains('Denúncia', array_column($r->json('distribuicao'), 'chave'));
    }

    public function test_mural_nao_expoe_volume_nem_denuncia(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'semvolumeaqui123']);
        $this->manifestacao($org, ['categoria' => 'Denúncia', 'urgencia' => 'Crítica']);

        $corpo = $this->getJson('/api/v1/mural/semvolumeaqui123')->json();

        $flat = json_encode($corpo);
        $this->assertStringNotContainsStringIgnoringCase('denúncia', $flat);
        $this->assertArrayNotHasKey('total', $corpo['indicadores']);
    }

    public function test_isolamento_entre_organizacoes(): void
    {
        $a = $this->org(['mural_ativo' => true, 'mural_token' => 'orgaaaaaaaaaa1']);
        $b = $this->org(['mural_ativo' => true, 'mural_token' => 'orgbbbbbbbbbb1']);

        // A: respondida. B: aberta e vencida.
        $this->manifestacao($a);
        $this->manifestacao($b, ['status' => 'Recebida', 'resposta_publicada_em' => null, 'criado_em' => now()->subDays(40)]);

        $this->assertSame(100, $this->getJson('/api/v1/mural/orgaaaaaaaaaa1')->json('indicadores.respondidasPct'));
        $this->assertSame(0, $this->getJson('/api/v1/mural/orgbbbbbbbbbb1')->json('indicadores.respondidasPct'));
    }

    public function test_totem_ve_o_resumo_pela_device_key_mesmo_com_mural_desligado(): void
    {
        $org = $this->org(['mural_ativo' => false]);
        $chave = 'chave-'.Str::random(16);
        Device::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id,
            'codigo' => 'TOTEM-RESUMO',
            'nome' => 'Totem',
            'unidade' => 'Recepção',
            'api_key_hash' => hash('sha256', $chave),
            'ativo' => true,
        ]);
        $this->manifestacao($org);

        $this->getJson('/api/v1/mural/resumo', ['X-Device-Key' => $chave])
            ->assertOk()
            ->assertJsonStructure(['titulo', 'indicadores' => ['respondidasPct'], 'elogios']);

        $this->getJson('/api/v1/mural/resumo')->assertUnauthorized();
    }

    public function test_admin_liga_o_mural_e_recebe_link(): void
    {
        $org = $this->org();
        $admin = User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $r = $this->patchJson('/api/v1/mural', ['ativo' => true, 'titulo' => 'Fale Conosco']);

        $r->assertOk();
        $r->assertJsonPath('ativo', true);
        $this->assertNotNull($r->json('token'));
        $this->assertStringContainsString('/mural/'.$r->json('token'), $r->json('url'));

        $this->getJson('/api/v1/mural/'.$r->json('token'))->assertOk()->assertJsonPath('titulo', 'Fale Conosco');
    }

    public function test_analista_nao_gerencia_o_mural(): void
    {
        $org = $this->org();
        $analista = User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Analista]);
        Sanctum::actingAs($analista);

        $this->getJson('/api/v1/mural')->assertForbidden();
        $this->patchJson('/api/v1/mural', ['ativo' => true])->assertForbidden();
    }

    public function test_mural_com_pin_exige_o_codigo(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'commpinaqui123', 'mural_pin' => '4821']);
        $this->manifestacao($org);

        // Sem PIN: devolve só o "trave-se", sem dados.
        $r = $this->getJson('/api/v1/mural/commpinaqui123');
        $r->assertOk()->assertJsonPath('exigePin', true)->assertJsonMissing(['indicadores']);

        // PIN errado.
        $this->getJson('/api/v1/mural/commpinaqui123?pin=0000')
            ->assertOk()->assertJsonPath('exigePin', true)->assertJsonPath('pinInvalido', true);

        // PIN certo: dados completos.
        $this->getJson('/api/v1/mural/commpinaqui123?pin=4821')
            ->assertOk()->assertJsonPath('exigePin', false)->assertJsonStructure(['indicadores']);
    }

    public function test_admin_define_e_remove_o_pin_do_mural(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'pinadmin12345']);
        Sanctum::actingAs(User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]));

        $this->patchJson('/api/v1/mural', ['ativo' => true, 'pin' => '123456'])
            ->assertOk()->assertJsonPath('pinDefinido', true);
        $this->assertSame('123456', $org->fresh()->mural_pin);

        $this->patchJson('/api/v1/mural', ['ativo' => true, 'pin' => 'abc'])->assertStatus(422);

        $this->patchJson('/api/v1/mural', ['ativo' => true, 'pin' => null])
            ->assertOk()->assertJsonPath('pinDefinido', false);
    }

    public function test_admin_personaliza_o_token_do_mural(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'aleatoriolongo123']);
        $admin = User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $r = $this->patchJson('/api/v1/mural', ['ativo' => true, 'token' => 'minha-empresa']);
        $r->assertOk()->assertJsonPath('token', 'minha-empresa');
        $this->assertStringEndsWith('/mural/minha-empresa', $r->json('url'));

        // O link antigo ainda resolve por 48h (grace), com o aviso.
        $this->getJson('/api/v1/mural/aleatoriolongo123')->assertOk()->assertJsonPath('linkMudando', true);
        $this->getJson('/api/v1/mural/minha-empresa')->assertOk()->assertJsonPath('linkMudando', false);

        // Passado o prazo, o link antigo morre.
        $this->travel(49)->hours();
        $this->getJson('/api/v1/mural/aleatoriolongo123')->assertNotFound();
        $this->getJson('/api/v1/mural/minha-empresa')->assertOk();
        $this->travelBack();

        // curto demais, caractere inválido, ou palavra reservada = 422
        $this->patchJson('/api/v1/mural', ['ativo' => true, 'token' => 'ab'])->assertStatus(422);
        $this->patchJson('/api/v1/mural', ['ativo' => true, 'token' => 'Com Espaço'])->assertStatus(422);
        $this->patchJson('/api/v1/mural', ['ativo' => true, 'token' => 'resumo'])->assertStatus(422);
    }

    public function test_token_personalizado_nao_colide_entre_organizacoes(): void
    {
        $a = $this->org(['mural_ativo' => true, 'mural_token' => 'jatomado123']);
        $b = $this->org();
        $admin = User::factory()->create(['organizacao_id' => $b->id, 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $this->patchJson('/api/v1/mural', ['ativo' => true, 'token' => 'jatomado123'])->assertStatus(422);
    }

    public function test_regenerar_token_da_grace_de_48h_ao_anterior(): void
    {
        $org = $this->org(['mural_ativo' => true, 'mural_token' => 'tokenoriginal123']);
        $admin = User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]);
        Sanctum::actingAs($admin);

        $r = $this->postJson('/api/v1/mural/token')->assertOk();
        $novo = $r->json('token');
        $this->assertNotSame('tokenoriginal123', $novo);
        $this->assertSame('tokenoriginal123', $r->json('linkAnterior.token'));

        // Antigo ainda funciona por 48h (com aviso); o novo, normal.
        $this->getJson('/api/v1/mural/tokenoriginal123')->assertOk()->assertJsonPath('linkMudando', true);
        $this->getJson('/api/v1/mural/'.$novo)->assertOk()->assertJsonPath('linkMudando', false);

        $this->travel(49)->hours();
        $this->getJson('/api/v1/mural/tokenoriginal123')->assertNotFound();
        $this->travelBack();
    }
}
