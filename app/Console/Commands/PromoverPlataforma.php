<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Torna um usuário parte do TIME DA PLATAFORMA (nós): remove o vínculo com
 * organização e garante papel admin. A partir daí ele vê o back-office
 * (/admin/plataforma) e, sem organização, enxerga dados de todas as contas
 * (ver App\Models\Scopes\PorOrganizacao). `--reverter` desfaz, colocando de
 * volta numa organização.
 */
class PromoverPlataforma extends Command
{
    protected $signature = 'ouvidoria:promover-plataforma {email} {--reverter : Remove do time da plataforma (precisa de --org)} {--org= : slug ou id da organização ao reverter}';

    protected $description = 'Promove (ou reverte) um usuário para o time da plataforma (back-office)';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();
        if (! $user) {
            $this->error("Usuário não encontrado: {$this->argument('email')}");

            return self::FAILURE;
        }

        if ($this->option('reverter')) {
            $slugOuId = $this->option('org');
            $org = $slugOuId
                ? \App\Models\Organizacao::where('slug', $slugOuId)->orWhere('id', $slugOuId)->first()
                : null;
            if (! $org) {
                $this->error('Passe --org=<slug|id> de uma organização existente pra reverter.');

                return self::FAILURE;
            }
            $user->update(['organizacao_id' => $org->id]);
            $this->info("{$user->email} agora é da organização {$org->nome}.");

            return self::SUCCESS;
        }

        $user->update(['organizacao_id' => null, 'role' => UserRole::Admin]);
        $this->info("{$user->email} agora é do TIME DA PLATAFORMA (admin, sem organização).");
        $this->line('Ele vê /admin/plataforma e dados de todas as contas.');

        return self::SUCCESS;
    }
}
