<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\Organizacao;
use App\Models\User;
use App\Services\AtribuidorDeManifestacoes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Cadastro de equipe + distribuição automática de manifestações. */
class EquipeEAtribuicaoTest extends TestCase
{
    use RefreshDatabase;

    private Organizacao $org;

    protected function setUp(): void
    {
        parent::setUp();
        $this->org = Organizacao::create(['nome' => 'X', 'slug' => 'X'.Str::random(4), 'status' => OrganizacaoStatus::Ativa]);
    }

    private function membro(UserRole $role, bool $rodizio): User
    {
        return User::factory()->create([
            'organizacao_id' => $this->org->id,
            'role' => $role,
            'ativo' => true,
            'recebe_atribuicao' => $rodizio,
        ]);
    }

    private function device(): array
    {
        $chave = 'k-'.Str::random(16);
        Device::withoutGlobalScopes()->create([
            'organizacao_id' => $this->org->id,
            'codigo' => 'T-'.Str::random(5),
            'nome' => 'T',
            'api_key_hash' => hash('sha256', $chave),
            'ativo' => true,
        ]);

        return [$chave];
    }

    /** Reclamação de propósito: só o que é negativo entra no fluxo/distribuição (o resto conclui sozinho). */
    private function criarManifestacao(string $chave): string
    {
        return $this->postJson('/api/v1/manifestations', [
            'clientId' => (string) Str::uuid(),
            'criadoEm' => now()->toIso8601String(),
            'consentimentoLgpd' => true,
            'transcricao' => 'Relato de teste sobre o atendimento.',
            'sentimento' => 'Insatisfeito',
            'categoria' => 'Reclamação',
            'urgencia' => 'Média',
        ], ['X-Device-Key' => $chave])->json('id');
    }

    public function test_manifestacao_nova_e_distribuida_equilibrada_entre_o_rodizio(): void
    {
        $ana = $this->membro(UserRole::Analista, rodizio: true);
        $bruno = $this->membro(UserRole::Analista, rodizio: true);
        $this->membro(UserRole::Analista, rodizio: false); // fora do rodízio
        [$chave] = $this->device();

        $ids = collect(range(1, 6))->map(fn () => $this->criarManifestacao($chave));

        $porResponsavel = Manifestation::withoutGlobalScopes()->whereIn('id', $ids)
            ->get()->groupBy('responsavel_id')->map->count();

        $this->assertEqualsCanonicalizing([$ana->id, $bruno->id], $porResponsavel->keys()->all());
        $this->assertSame(3, $porResponsavel[$ana->id]);
        $this->assertSame(3, $porResponsavel[$bruno->id]);
    }

    public function test_sem_ninguem_no_rodizio_fica_sem_responsavel(): void
    {
        $this->membro(UserRole::Analista, rodizio: false);
        [$chave] = $this->device();

        $id = $this->criarManifestacao($chave);

        $this->assertNull(Manifestation::withoutGlobalScopes()->find($id)->responsavel_id);
    }

    public function test_admin_cadastra_funcionario_e_liga_no_rodizio(): void
    {
        $admin = $this->membro(UserRole::Admin, rodizio: false);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/users', [
            'name' => 'Nova Analista',
            'email' => 'nova@x.test',
            'senha' => 'segredo123',
            'role' => 'analista',
        ])->assertCreated()->assertJsonPath('recebeAtribuicao', true);

        $this->assertDatabaseHas('users', ['email' => 'nova@x.test', 'organizacao_id' => $this->org->id, 'recebe_atribuicao' => true]);
    }

    public function test_analista_nao_gerencia_equipe(): void
    {
        Sanctum::actingAs($this->membro(UserRole::Analista, rodizio: true));

        $this->getJson('/api/v1/users')->assertForbidden();
    }

    public function test_transferir_carga_move_so_as_abertas(): void
    {
        $de = $this->membro(UserRole::Analista, rodizio: true);
        $para = $this->membro(UserRole::Analista, rodizio: true);
        $admin = $this->membro(UserRole::Admin, rodizio: false);
        [$chave] = $this->device();

        $aberta = Manifestation::withoutGlobalScopes()->find($this->criarManifestacao($chave));
        $aberta->update(['responsavel_id' => $de->id, 'status' => 'Em análise']);
        $fechada = Manifestation::withoutGlobalScopes()->find($this->criarManifestacao($chave));
        $fechada->update(['responsavel_id' => $de->id, 'status' => 'Concluída']);

        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/users/transferir-carga', ['de' => $de->id, 'para' => $para->id])
            ->assertOk()->assertJsonPath('movidas', 1);

        $this->assertSame($para->id, $aberta->fresh()->responsavel_id);
        $this->assertSame($de->id, $fechada->fresh()->responsavel_id);
    }

    public function test_lista_minhas_filtra_pelo_responsavel_logado(): void
    {
        $ana = $this->membro(UserRole::Analista, rodizio: true);
        $bruno = $this->membro(UserRole::Analista, rodizio: true);
        [$chave] = $this->device();

        Manifestation::withoutGlobalScopes()->find($this->criarManifestacao($chave))->update(['responsavel_id' => $ana->id]);
        Manifestation::withoutGlobalScopes()->find($this->criarManifestacao($chave))->update(['responsavel_id' => $bruno->id]);

        Sanctum::actingAs($ana);
        $r = $this->getJson('/api/v1/manifestations?minhas=1');
        $r->assertOk();
        $this->assertCount(1, $r->json('data'));
        $this->assertSame($ana->id, $r->json('data.0.responsavel.id'));
    }
}
