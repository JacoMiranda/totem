<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Organizacao;
use App\Models\Plano;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Back-office da plataforma - só usuário SEM organização (time comercial). */
class PlataformaApiTest extends TestCase
{
    use RefreshDatabase;

    private function plano(string $slug): Plano
    {
        return Plano::create([
            'slug' => $slug, 'nome' => ucfirst($slug), 'limite_dispositivos' => 3, 'trial_dias' => 0, 'ordem' => 1,
        ]);
    }

    private function org(?Plano $plano = null): Organizacao
    {
        return Organizacao::create([
            'nome' => 'Cliente '.Str::random(4),
            'slug' => 'C'.Str::random(5),
            'status' => OrganizacaoStatus::Trial,
            'plano_id' => $plano?->id,
        ]);
    }

    private function timePlataforma(): User
    {
        return User::factory()->create(['organizacao_id' => null, 'role' => UserRole::Admin]);
    }

    public function test_admin_de_cliente_nao_acessa_o_back_office(): void
    {
        $org = $this->org();
        Sanctum::actingAs(User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin]));

        $this->getJson('/api/v1/plataforma/organizacoes')->assertForbidden();
    }

    public function test_time_da_plataforma_lista_as_contas_com_pacote_e_contagens(): void
    {
        $essencial = $this->plano('essencial');
        $org = $this->org($essencial);
        Device::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id, 'codigo' => 'T-1', 'nome' => 'T', 'api_key_hash' => hash('sha256', 'k'), 'ativo' => true,
        ]);
        User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Analista]);

        Sanctum::actingAs($this->timePlataforma());
        $r = $this->getJson('/api/v1/plataforma/organizacoes');

        $r->assertOk();
        $linha = collect($r->json())->firstWhere('id', $org->id);
        $this->assertSame('essencial', $linha['plano']['slug']);
        $this->assertSame(1, $linha['totens']);
        $this->assertSame(1, $linha['usuarios']);
        $this->assertSame('trial', $linha['status']);
    }

    public function test_troca_o_plano_e_suspende_a_conta(): void
    {
        $p1 = $this->plano('essencial');
        $p2 = $this->plano('profissional');
        $org = $this->org($p1);

        Sanctum::actingAs($this->timePlataforma());

        $this->patchJson("/api/v1/plataforma/organizacoes/{$org->id}", [
            'planoId' => $p2->id,
            'status' => 'suspensa',
        ])->assertOk()->assertJsonPath('status', 'suspensa')->assertJsonPath('planoId', $p2->id);

        $org->refresh();
        $this->assertSame($p2->id, $org->plano_id);
        $this->assertFalse($org->operante());
    }

    public function test_redefine_a_senha_do_admin_da_conta(): void
    {
        $org = $this->org();
        $admin = User::factory()->create(['organizacao_id' => $org->id, 'role' => UserRole::Admin, 'email' => 'cliente@x.test']);

        Sanctum::actingAs($this->timePlataforma());
        $r = $this->postJson("/api/v1/plataforma/organizacoes/{$org->id}/resetar-senha-admin")->assertOk();

        $senha = $r->json('senhaTemporaria');
        $this->assertNotEmpty($senha);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check($senha, $admin->fresh()->password));
    }

    public function test_edita_um_pacote(): void
    {
        $p = $this->plano('essencial');
        Sanctum::actingAs($this->timePlataforma());

        $this->patchJson("/api/v1/plataforma/planos/{$p->id}", [
            'limiteDispositivos' => 10,
            'precoCentavos' => 29900,
            'recursos' => ['10 totens', 'Suporte prioritário'],
        ])->assertOk()
            ->assertJsonPath('limiteDispositivos', 10)
            ->assertJsonPath('precoFormatado', 'R$ 299,00');

        $this->assertSame(['10 totens', 'Suporte prioritário'], $p->fresh()->recursos);
    }
}
