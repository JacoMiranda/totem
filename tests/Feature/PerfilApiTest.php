<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** PATCH /auth/me — a pessoa edita o próprio nome e senha. */
class PerfilApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_atualiza_o_proprio_nome(): void
    {
        $u = User::factory()->create(['name' => 'Antigo']);
        Sanctum::actingAs($u);

        $this->patchJson('/api/v1/auth/me', ['name' => 'Novo Nome'])
            ->assertOk()
            ->assertJsonPath('name', 'Novo Nome');

        $this->assertSame('Novo Nome', $u->fresh()->name);
    }

    public function test_troca_a_senha_com_a_senha_atual_correta(): void
    {
        $u = User::factory()->create(['password' => Hash::make('atual12345')]);
        Sanctum::actingAs($u);

        $this->patchJson('/api/v1/auth/me', ['senhaAtual' => 'atual12345', 'novaSenha' => 'novasenha123'])
            ->assertOk();

        $this->assertTrue(Hash::check('novasenha123', $u->fresh()->password));
    }

    public function test_senha_atual_errada_e_rejeitada(): void
    {
        $u = User::factory()->create(['password' => Hash::make('atual12345')]);
        Sanctum::actingAs($u);

        $this->patchJson('/api/v1/auth/me', ['senhaAtual' => 'errada', 'novaSenha' => 'novasenha123'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('senhaAtual');

        $this->assertTrue(Hash::check('atual12345', $u->fresh()->password));
    }

    public function test_nao_muda_email_nem_papel(): void
    {
        $u = User::factory()->create(['email' => 'eu@x.test', 'role' => 'atendente']);
        Sanctum::actingAs($u);

        $this->patchJson('/api/v1/auth/me', ['email' => 'outro@x.test', 'role' => 'admin', 'name' => 'X'])->assertOk();

        $u->refresh();
        $this->assertSame('eu@x.test', $u->email);
        $this->assertSame('atendente', $u->role->value);
    }
}
