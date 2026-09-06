<?php

namespace Database\Seeders;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Models\Device;
use App\Models\Organizacao;
use App\Models\Plano;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Dados de conveniência pra desenvolvimento LOCAL - NÃO rodar em produção
 * (device key e senha fixas e públicas). Chamado pelo DatabaseSeeder só
 * quando app()->environment('local'), ou à mão:
 *   php artisan db:seed --class=Database\\Seeders\\DevSeeder
 */
class DevSeeder extends Seeder
{
    /** Device key crua pra colar na tela de configuração do totem em dev. */
    public const DEVICE_KEY = 'dev-totem-key';

    public function run(): void
    {
        $this->call(PlanoSeeder::class);

        // Conta de cliente de exemplo - sem organização o usuário seria
        // tratado como equipe da PLATAFORMA e enxergaria todas as contas
        // (ver App\Models\Scopes\PorOrganizacao).
        $organizacao = Organizacao::updateOrCreate(
            ['slug' => 'TotemDev'],
            [
                'nome' => 'Totem Dev',
                'plano_id' => Plano::where('slug', 'profissional')->value('id'),
                'status' => OrganizacaoStatus::Ativa,
            ],
        );

        $admin = User::updateOrCreate(
            ['email' => 'admin@totem.test'],
            [
                'organizacao_id' => $organizacao->id,
                'name' => 'Admin de Desenvolvimento',
                'password' => Hash::make('password'),
                'role' => UserRole::Admin,
                'ativo' => true,
                'email_verified_at' => now(),
            ],
        );

        $device = Device::withoutGlobalScopes()->updateOrCreate(
            ['codigo' => 'TOTEM-DEV-01'],
            [
                'organizacao_id' => $organizacao->id,
                'nome' => 'Totem - Desenvolvimento',
                'unidade' => 'Recepção (dev)',
                'api_key_hash' => hash('sha256', self::DEVICE_KEY),
                'ativo' => true,
            ],
        );

        $this->command->info('== Dados de desenvolvimento ==');
        $this->command->line("  Organização:   {$organizacao->nome} ({$organizacao->slug})");
        $this->command->line("  Painel admin:  {$admin->email}  /  password");
        $this->command->line("  Totem  código: {$device->codigo}");
        $this->command->line('  Totem  nome:   '.$device->nome);
        $this->command->line('  Totem  key:    '.self::DEVICE_KEY);

        $this->call(ManifestacoesDemoSeeder::class);
    }
}
