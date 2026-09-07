<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pareamento pela tela de login do KIOSK (SetupScreen.tsx): a equipe entra
 * com as próprias credenciais, lista os totens e escolhe qual esta máquina
 * vai ser. A device key é EMITIDA no pareamento (só guardamos o hash, ela
 * não é recuperável) e a anterior deixa de valer.
 */
class PareamentoTotemTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(UserRole $papel): User
    {
        return User::create([
            'name' => 'Fulano',
            'email' => Str::random(8).'@totem.test',
            'password' => Hash::make('password'),
            'role' => $papel,
            'ativo' => true,
        ]);
    }

    private function device(array $attrs = []): array
    {
        $chave = 'chave-antiga-'.Str::random(16);
        $device = Device::create([
            'codigo' => 'TOTEM-'.Str::upper(Str::random(4)),
            'nome' => 'Recepção I',
            'unidade' => 'Sede',
            'api_key_hash' => hash('sha256', $chave),
            'ativo' => true,
            ...$attrs,
        ]);

        return [$device, $chave];
    }

    public function test_atendente_lista_totens_pareaveis(): void
    {
        [$device] = $this->device();
        Sanctum::actingAs($this->usuario(UserRole::Atendente));

        $r = $this->getJson('/api/v1/devices/pareaveis');

        $r->assertOk();
        $r->assertJsonCount(1);
        $r->assertJsonPath('0.codigo', $device->codigo);
        $r->assertJsonPath('0.nome', 'Recepção I');
        // a lista do seletor NUNCA expõe hash de chave
        $r->assertJsonMissingPath('0.api_key_hash');
    }

    public function test_leitor_nao_pode_parear(): void
    {
        $this->device();
        Sanctum::actingAs($this->usuario(UserRole::Leitor));

        $this->getJson('/api/v1/devices/pareaveis')->assertForbidden();
    }

    public function test_sem_autenticacao_e_rejeitado(): void
    {
        $this->getJson('/api/v1/devices/pareaveis')->assertUnauthorized();
    }

    public function test_parear_emite_chave_nova_e_revoga_a_anterior(): void
    {
        $org = \App\Models\Organizacao::create([
            'nome' => 'Prefeitura de Testelândia',
            'slug' => 'testelandia-'.Str::random(5),
            'status' => \App\Enums\OrganizacaoStatus::Ativa,
        ]);
        [$device, $chaveAntiga] = $this->device(['organizacao_id' => $org->id]);
        Sanctum::actingAs($this->usuario(UserRole::Atendente));

        $r = $this->postJson("/api/v1/devices/{$device->id}/pair");

        $r->assertOk();
        $novaChave = $r->json('deviceKey');
        $this->assertNotEmpty($novaChave);
        $this->assertNotSame($chaveAntiga, $novaChave);
        $r->assertJsonPath('codigo', $device->codigo);
        $r->assertJsonPath('empresa', $device->organizacao->nome);

        // a chave nova vale...
        $this->assertSame(
            hash('sha256', $novaChave),
            $device->fresh()->api_key_hash,
        );

        // ...e a antiga não autentica mais no endpoint do totem
        $this->postJson('/api/v1/ai/analyze-text', ['texto' => 'qualquer coisa'], ['X-Device-Key' => $chaveAntiga])
            ->assertUnauthorized();
    }

    public function test_nao_pareia_device_desativado(): void
    {
        [$device] = $this->device(['ativo' => false]);
        Sanctum::actingAs($this->usuario(UserRole::Atendente));

        $r = $this->postJson("/api/v1/devices/{$device->id}/pair");

        $r->assertStatus(422);
        $r->assertJsonPath('error.code', 'DEVICE_INATIVO');
    }
}
