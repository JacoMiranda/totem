<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Organizacao;
use App\Models\PulsoPonto;
use App\Models\PulsoResposta;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pulso Rápido: QR impresso sem totem/tablet - 1 toque em 3 carinhas por
 * pergunta, sessão de 3 min, single-use (ver PulsoService).
 */
class PulsoApiTest extends TestCase
{
    use RefreshDatabase;

    private function org(array $attrs = []): Organizacao
    {
        return Organizacao::create(array_merge([
            'nome' => 'Padaria Teste',
            'slug' => 'PadariaTeste'.Str::random(4),
            'status' => OrganizacaoStatus::Ativa,
        ], $attrs));
    }

    private function admin(Organizacao $org): User
    {
        return User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]);
    }

    private function ponto(Organizacao $org, array $attrs = []): PulsoPonto
    {
        return PulsoPonto::withoutGlobalScopes()->create(array_merge([
            'organizacao_id' => $org->id,
            'nome' => 'QR balcão',
            'perguntas' => ['Atendimento', 'Produto/Serviço'],
            'token' => Str::lower(Str::random(10)),
            'ativo' => true,
        ], $attrs));
    }

    public function test_admin_cria_ponto_com_perguntas_padrao(): void
    {
        $org = $this->org();
        Sanctum::actingAs($this->admin($org));

        $r = $this->postJson('/api/v1/pulso-pontos', ['nome' => 'QR balcão']);

        $r->assertCreated()
            ->assertJsonPath('nome', 'QR balcão')
            ->assertJsonPath('perguntas', ['Atendimento', 'Produto/Serviço'])
            ->assertJsonPath('ativo', true);
        $this->assertNotEmpty($r->json('token'));
        $this->assertStringContainsString('/pulso/'.$r->json('token'), $r->json('url'));
    }

    public function test_token_do_ponto_traz_o_nome_da_empresa(): void
    {
        $org = $this->org(['slug' => 'PadariaDoZe'.Str::random(4)]);
        Sanctum::actingAs($this->admin($org));

        $r = $this->postJson('/api/v1/pulso-pontos', ['nome' => 'QR balcão']);

        $this->assertStringStartsWith('padariadoze', $r->json('token'));
    }

    public function test_admin_edita_nome_unidade_e_perguntas(): void
    {
        $org = $this->org();
        $ponto = $this->ponto($org, ['nome' => 'Nome antigo']);
        Sanctum::actingAs($this->admin($org));

        $r = $this->patchJson("/api/v1/pulso-pontos/{$ponto->id}", [
            'nome' => 'Nome novo',
            'unidade' => 'Unidade nova',
            'perguntas' => ['Só uma pergunta'],
        ]);

        $r->assertOk()
            ->assertJsonPath('nome', 'Nome novo')
            ->assertJsonPath('unidade', 'Unidade nova')
            ->assertJsonPath('perguntas', ['Só uma pergunta']);
    }

    public function test_atendente_nao_gerencia_pontos(): void
    {
        $org = $this->org();
        Sanctum::actingAs(User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Atendente]));

        $this->postJson('/api/v1/pulso-pontos', ['nome' => 'QR balcão'])->assertForbidden();
    }

    public function test_admin_so_ve_pontos_da_propria_organizacao(): void
    {
        $a = $this->org();
        $b = $this->org();
        $this->ponto($a, ['nome' => 'Ponto A']);
        $this->ponto($b, ['nome' => 'Ponto B']);

        Sanctum::actingAs($this->admin($a));
        $r = $this->getJson('/api/v1/pulso-pontos');

        $r->assertOk()->assertJsonCount(1);
        $this->assertSame('Ponto A', $r->json('0.nome'));
    }

    public function test_escanear_o_qr_gera_sessao_e_redireciona(): void
    {
        $org = $this->org();
        $ponto = $this->ponto($org);

        $r = $this->get("/pulso/{$ponto->token}");

        $r->assertRedirect();
        $this->assertMatchesRegularExpression('#/pulso/s/[a-zA-Z0-9]{40}$#', $r->headers->get('Location'));
    }

    public function test_qr_desativado_ou_inexistente_da_404(): void
    {
        $org = $this->org();
        $this->ponto($org, ['token' => 'desativado123', 'ativo' => false]);

        $this->get('/pulso/desativado123')->assertNotFound();
        $this->get('/pulso/nao-existe-nada')->assertNotFound();
    }

    private function abrirSessao(PulsoPonto $ponto): string
    {
        $location = $this->get("/pulso/{$ponto->token}")->headers->get('Location');

        return Str::afterLast($location, '/');
    }

    public function test_fluxo_completo_de_respostas_conclui_e_invalida_a_sessao(): void
    {
        $org = $this->org();
        $ponto = $this->ponto($org, ['perguntas' => ['Atendimento', 'Produto']]);
        $hash = $this->abrirSessao($ponto);

        $estado = $this->getJson("/api/v1/pulso/s/{$hash}");
        $estado->assertOk()
            ->assertJsonPath('passoAtual', 0)
            ->assertJsonPath('concluida', false)
            ->assertJsonPath('perguntas', ['Atendimento', 'Produto']);

        $r1 = $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => 'positivo']);
        $r1->assertOk()->assertJsonPath('concluida', false)->assertJsonPath('proximaPergunta', 'Produto');

        $r2 = $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => 'negativo']);
        $r2->assertOk()->assertJsonPath('concluida', true)->assertJsonPath('proximaPergunta', null);

        $this->assertSame(2, PulsoResposta::withoutGlobalScopes()->where('pulso_ponto_id', $ponto->id)->count());
        $this->assertSame(
            'Atendimento',
            PulsoResposta::withoutGlobalScopes()->where('valor', 'positivo')->first()?->pergunta,
        );

        // sessão concluída não aceita mais nada - nem reabrindo a mesma aba.
        $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => 'positivo'])
            ->assertStatus(410)
            ->assertJsonPath('error.code', 'CONCLUIDA');
    }

    public function test_sessao_expira_em_3_minutos(): void
    {
        $org = $this->org();
        $ponto = $this->ponto($org);
        $hash = $this->abrirSessao($ponto);

        $this->travel(181)->seconds();

        $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => 'positivo'])
            ->assertStatus(410)
            ->assertJsonPath('error.code', 'EXPIRADA');

        $this->getJson("/api/v1/pulso/s/{$hash}")->assertJsonPath('expirada', true);
    }

    public function test_hash_inexistente_da_404(): void
    {
        $this->getJson('/api/v1/pulso/s/'.Str::random(40))->assertNotFound();
    }

    public function test_resumo_agrega_por_pergunta(): void
    {
        $org = $this->org();
        $ponto = $this->ponto($org, ['perguntas' => ['Atendimento']]);

        foreach (['positivo', 'positivo', 'negativo'] as $valor) {
            $hash = $this->abrirSessao($ponto);
            $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => $valor]);
        }

        Sanctum::actingAs($this->admin($org));
        $r = $this->getJson("/api/v1/pulso-pontos/{$ponto->id}/resumo");

        $r->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('porPergunta.Atendimento.total', 3)
            ->assertJsonPath('porPergunta.Atendimento.positivo', 2)
            ->assertJsonPath('porPergunta.Atendimento.negativo', 1);
    }

    public function test_admin_nao_ve_resumo_de_ponto_de_outra_organizacao(): void
    {
        $a = $this->org();
        $b = $this->org();
        $ponto = $this->ponto($b);

        Sanctum::actingAs($this->admin($a));

        $this->getJson("/api/v1/pulso-pontos/{$ponto->id}/resumo")->assertNotFound();
    }

    public function test_painel_publico_desligado_por_padrao_e_liga_com_token_da_empresa(): void
    {
        $org = $this->org(['slug' => 'RedeExemplo'.Str::random(4)]);
        Sanctum::actingAs($this->admin($org));

        $this->getJson('/api/v1/s-totem-painel')->assertOk()->assertJsonPath('ativo', false)->assertJsonPath('token', null);

        $r = $this->patchJson('/api/v1/s-totem-painel', ['ativo' => true]);
        $r->assertOk()->assertJsonPath('ativo', true);
        $this->assertStringStartsWith('redeexemplo', $r->json('token'));
        $this->assertStringContainsString($r->json('token'), $r->json('url'));
    }

    public function test_painel_publico_agrega_todos_os_pontos_ativos(): void
    {
        $org = $this->org();
        $a = $this->ponto($org, ['nome' => 'Ponto A', 'perguntas' => ['Atendimento']]);
        $b = $this->ponto($org, ['nome' => 'Ponto B', 'perguntas' => ['Atendimento']]);
        $this->ponto($org, ['nome' => 'Ponto inativo', 'ativo' => false]);

        foreach ([$a, $b] as $ponto) {
            $hash = $this->abrirSessao($ponto);
            $this->postJson("/api/v1/pulso/s/{$hash}/respostas", ['valor' => 'positivo']);
        }

        Sanctum::actingAs($this->admin($org));
        $this->patchJson('/api/v1/s-totem-painel', ['ativo' => true]);
        $token = $this->getJson('/api/v1/s-totem-painel')->json('token');

        $r = $this->getJson("/api/v1/s-totem/{$token}");

        $r->assertOk()->assertJsonPath('totalRespostas', 2);
        $nomes = collect($r->json('pontos'))->pluck('nome');
        $this->assertTrue($nomes->contains('Ponto A'));
        $this->assertTrue($nomes->contains('Ponto B'));
        $this->assertFalse($nomes->contains('Ponto inativo'));
    }

    public function test_painel_publico_desativado_da_404(): void
    {
        $org = $this->org();
        $this->getJson('/api/v1/s-totem/qualquer-coisa')->assertNotFound();

        Sanctum::actingAs($this->admin($org));
        $token = $this->patchJson('/api/v1/s-totem-painel', ['ativo' => true])->json('token');
        $this->patchJson('/api/v1/s-totem-painel', ['ativo' => false]);

        $this->getJson("/api/v1/s-totem/{$token}")->assertNotFound();
    }
}
