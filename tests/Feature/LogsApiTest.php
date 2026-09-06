<?php

namespace Tests\Feature;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Organizacao;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LogsApiTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(UserRole $papel): User
    {
        $org = Organizacao::create(['nome' => 'Org', 'slug' => Str::random(6), 'status' => OrganizacaoStatus::Ativa]);

        return User::create([
            'organizacao_id' => $org->id,
            'name' => 'Fulano',
            'email' => Str::random(8).'@x.test',
            'password' => Hash::make('password'),
            'role' => $papel,
            'ativo' => true,
        ]);
    }

    protected function tearDown(): void
    {
        File::delete(storage_path('logs/laravel.log'));
        parent::tearDown();
    }

    public function test_so_admin_le_logs(): void
    {
        Sanctum::actingAs($this->usuario(UserRole::Analista));
        $this->getJson('/api/v1/logs')->assertForbidden();

        Sanctum::actingAs($this->usuario(UserRole::Admin));
        $this->getJson('/api/v1/logs')->assertOk();
    }

    public function test_parseia_entradas_e_filtra_por_nivel(): void
    {
        File::put(storage_path('logs/laravel.log'), implode("\n", [
            '[2026-09-06 10:00:00] production.INFO: subiu tudo',
            '[2026-09-06 10:01:00] production.ERROR: deu ruim no pagamento',
            '#0 /app/x.php(1): algo()',
            '#1 {main}',
            '[2026-09-06 10:02:00] production.WARNING: quase deu ruim',
        ])."\n");

        Sanctum::actingAs($this->usuario(UserRole::Admin));

        $r = $this->getJson('/api/v1/logs?nivel=warning');
        $r->assertOk();
        $niveis = collect($r->json('entradas'))->pluck('nivel')->all();
        $this->assertContains('error', $niveis);
        $this->assertContains('warning', $niveis);
        $this->assertNotContains('info', $niveis);

        $erro = collect($r->json('entradas'))->firstWhere('nivel', 'error');
        $this->assertSame('deu ruim no pagamento', $erro['mensagem']);
        $this->assertStringContainsString('#0 /app/x.php', $erro['detalhe']);
        $this->assertSame('servidor', $erro['origem']);
    }

    public function test_erro_do_totem_cai_no_canal_kiosk_e_aparece_nos_logs(): void
    {
        $org = Organizacao::create(['nome' => 'Org', 'slug' => Str::random(6), 'status' => OrganizacaoStatus::Ativa]);
        $chave = 'k-'.Str::random(20);
        Device::withoutGlobalScopes()->create([
            'organizacao_id' => $org->id,
            'codigo' => 'TOTEM-X',
            'nome' => 'Totem X',
            'api_key_hash' => hash('sha256', $chave),
            'ativo' => true,
        ]);

        $this->postJson('/api/v1/client-errors', [
            'contexto' => 'microfone',
            'mensagem' => 'Permissão de microfone negada',
            'diagnostico' => 'Chrome · seguro=true',
        ], ['X-Device-Key' => $chave])->assertOk();

        Sanctum::actingAs($this->usuario(UserRole::Admin));
        $r = $this->getJson('/api/v1/logs?nivel=debug');

        $doTotem = collect($r->json('entradas'))->firstWhere('origem', 'totem');
        $this->assertNotNull($doTotem);
        $this->assertStringContainsString('microfone', $doTotem['mensagem']);
    }

    public function test_client_errors_exige_device_key(): void
    {
        $this->postJson('/api/v1/client-errors', ['contexto' => 'x', 'mensagem' => 'y'])
            ->assertUnauthorized();
    }
}
