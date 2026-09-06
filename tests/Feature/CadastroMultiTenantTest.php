<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\Organizacao;
use App\Models\Plano;
use App\Models\User;
use Database\Seeders\PlanoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Cadastro self-service (home) + isolamento entre contas.
 *
 * O teste de isolamento é o mais importante do arquivo: se o scope por
 * organização falhar, um cliente vê as manifestações de outro - o pior
 * defeito possível neste produto.
 */
class CadastroMultiTenantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanoSeeder::class);
    }

    private function payload(array $extra = []): array
    {
        return [
            'empresa' => 'Luiza Brok',
            'responsavel' => 'Luiza',
            'email' => Str::random(8).'@luizabrok.test',
            'senha' => 'senha-super-segura',
            'planoSlug' => 'profissional', // 5 totens
            ...$extra,
        ];
    }

    public function test_planos_sao_publicos_e_preco_indefinido_vem_nulo(): void
    {
        $r = $this->getJson('/api/v1/planos');

        $r->assertOk();
        $r->assertJsonCount(3);
        $r->assertJsonPath('0.slug', 'teste');
        // Preços ainda não definidos: nulo em vez de número inventado.
        $this->assertNull($r->json('1.precoCentavos'));
        $this->assertNull($r->json('1.precoFormatado'));
    }

    public function test_cadastro_cria_conta_usuario_e_totens_nomeados(): void
    {
        $r = $this->postJson('/api/v1/auth/register', $this->payload());

        $r->assertCreated();
        $r->assertJsonPath('organizacao.nome', 'Luiza Brok');
        $r->assertJsonPath('organizacao.slug', 'LuizaBrok');
        $this->assertNotEmpty($r->json('accessToken'));

        // 5 totens do plano Profissional, nomeados LuizaBrok-01..05
        $codigos = collect($r->json('devices'))->pluck('codigo')->all();
        $this->assertCount(5, $codigos);
        $this->assertSame(
            ['LuizaBrok-01', 'LuizaBrok-02', 'LuizaBrok-03', 'LuizaBrok-04', 'LuizaBrok-05'],
            $codigos,
        );
    }

    public function test_local_informado_entra_no_codigo_e_na_unidade(): void
    {
        $r = $this->postJson('/api/v1/auth/register', $this->payload([
            'planoSlug' => 'essencial', // 2 totens
            'locais' => ['Recepção', 'Triagem'],
        ]));

        $r->assertCreated();
        // Código sem acento (vai pra URL/log/CSV); unidade preserva o acento.
        $r->assertJsonPath('devices.0.codigo', 'LuizaBrok-01-Recepcao');
        $r->assertJsonPath('devices.0.unidade', 'Recepção');
        $r->assertJsonPath('devices.1.codigo', 'LuizaBrok-02-Triagem');
    }

    public function test_plano_teste_vira_conta_trial_com_validade(): void
    {
        $r = $this->postJson('/api/v1/auth/register', $this->payload(['planoSlug' => 'teste']));

        $r->assertCreated();
        $r->assertJsonPath('organizacao.status', 'trial');
        $r->assertJsonCount(1, 'devices');
        $this->assertNotNull($r->json('organizacao.trialExpiraEm'));

        $org = Organizacao::where('slug', 'LuizaBrok')->firstOrFail();
        $this->assertTrue($org->operante());
    }

    public function test_empresas_com_mesmo_nome_nao_colidem(): void
    {
        $this->postJson('/api/v1/auth/register', $this->payload(['planoSlug' => 'essencial']))->assertCreated();
        $r = $this->postJson('/api/v1/auth/register', $this->payload(['planoSlug' => 'essencial']));

        $r->assertCreated();
        $r->assertJsonPath('organizacao.slug', 'LuizaBrok2');
        $this->assertSame('LuizaBrok2-01', $r->json('devices.0.codigo'));
    }

    public function test_email_ja_cadastrado_e_rejeitado(): void
    {
        $dados = $this->payload(['planoSlug' => 'teste', 'email' => 'Maria@Empresa.test']);
        $this->postJson('/api/v1/auth/register', $dados)->assertCreated();

        // Mesmo e-mail, mesma caixa.
        $this->postJson('/api/v1/auth/register', $dados)
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        // E com caixa diferente também - senão vira conta duplicada (ou 500).
        $this->postJson('/api/v1/auth/register', $this->payload([
            'planoSlug' => 'teste',
            'email' => 'maria@empresa.test',
        ]))->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_a_chave_do_totem_nao_vaza_no_cadastro(): void
    {
        $r = $this->postJson('/api/v1/auth/register', $this->payload(['planoSlug' => 'teste']));

        $r->assertCreated();
        // A key só é emitida no pareamento, na máquina que vira o totem.
        $r->assertJsonMissingPath('devices.0.deviceKey');
        $this->assertStringNotContainsString('api_key', $r->getContent());
    }

    // ------------------------------------------------------------ isolamento

    /** @return array{0: Organizacao, 1: User, 2: Device} */
    private function contaCom(string $nome, string $slug): array
    {
        $org = Organizacao::create([
            'nome' => $nome,
            'slug' => $slug,
            'plano_id' => Plano::where('slug', 'essencial')->value('id'),
            'status' => OrganizacaoStatus::Ativa,
        ]);

        $user = User::create([
            'organizacao_id' => $org->id,
            'name' => 'Dono '.$nome,
            'email' => Str::random(8).'@teste.test',
            'password' => Hash::make('password'),
            'role' => UserRole::Admin,
            'ativo' => true,
        ]);

        $device = Device::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id,
            'codigo' => $slug.'-01',
            'nome' => $nome.' 01',
            'api_key_hash' => hash('sha256', Str::random(32)),
            'ativo' => true,
        ]);

        Manifestation::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id,
            'protocolo' => 'OUV-202609-'.random_int(100000, 999999),
            'client_id' => (string) Str::uuid(),
            'device_id' => $device->id,
            'canal' => 'Totem',
            'transcricao' => 'Relato de '.$nome,
            'sentimento' => 'Neutro',
            'categoria' => 'Sugestão',
            'urgencia' => 'Média',
            'status' => 'Recebida',
            'consentimento_lgpd' => true,
            'criado_em' => now(),
        ]);

        return [$org, $user, $device];
    }

    public function test_um_cliente_nao_ve_dados_do_outro(): void
    {
        [$orgA, $userA] = $this->contaCom('Empresa A', 'EmpresaA');
        [, , $deviceB] = $this->contaCom('Empresa B', 'EmpresaB');

        Sanctum::actingAs($userA);

        // Lista de totens: só os da própria conta.
        $totens = $this->getJson('/api/v1/devices/pareaveis')->assertOk()->json();
        $this->assertCount(1, $totens);
        $this->assertSame('EmpresaA-01', $totens[0]['codigo']);

        // Manifestações: idem - e a que sobrou é mesmo a da conta A.
        $manifestacoes = $this->getJson('/api/v1/manifestations')->assertOk()->json('data');
        $this->assertCount(1, $manifestacoes);
        $daContaA = Manifestation::withoutGlobalScopes()->where('organizacao_id', $orgA->id)->firstOrFail();
        $this->assertSame($daContaA->id, $manifestacoes[0]['id']);

        // E não consegue parear um totem da outra conta nem sabendo o id.
        $this->postJson("/api/v1/devices/{$deviceB->id}/pair")->assertNotFound();
    }

    public function test_equipe_da_plataforma_enxerga_todas_as_contas(): void
    {
        $this->contaCom('Empresa A', 'EmpresaA');
        $this->contaCom('Empresa B', 'EmpresaB');

        // Usuário SEM organização = equipe da plataforma.
        $plataforma = User::create([
            'organizacao_id' => null,
            'name' => 'Suporte da Plataforma',
            'email' => 'suporte@plataforma.test',
            'password' => Hash::make('password'),
            'role' => UserRole::Admin,
            'ativo' => true,
        ]);
        Sanctum::actingAs($plataforma);

        $this->assertCount(2, $this->getJson('/api/v1/devices/pareaveis')->assertOk()->json());
    }

    public function test_manifestacao_criada_pelo_totem_herda_a_organizacao_do_device(): void
    {
        [$org, , $device] = $this->contaCom('Empresa A', 'EmpresaA');
        $chave = 'chave-'.Str::random(20);
        $device->update(['api_key_hash' => hash('sha256', $chave)]);

        $r = $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
            'transcricao' => 'Fila enorme na recepção.',
            'sentimento' => 'Insatisfeito',
            'categoria' => 'Reclamação',
            'urgencia' => 'Alta',
        ], ['X-Device-Key' => $chave]);

        $r->assertCreated();
        $criada = Manifestation::withoutGlobalScopes()->where('protocolo', $r->json('protocolo'))->firstOrFail();
        $this->assertSame($org->id, $criada->organizacao_id);
    }
}
