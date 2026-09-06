<?php

namespace App\Providers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * RBAC por hierarquia de papel (ver UserRole::atende) - espelha o
     * contrato de docs/API.md ("leitor+", "analista+", "atendente+" por
     * rota). Mesmo estilo de Gates nomeados já usado no política-laravel
     * (Gate::define em closures simples, sem pacote de permissões).
     */
    public function boot(): void
    {
        Gate::define('ver-manifestacoes', fn (User $u) => $u->temPapelMinimo(UserRole::Leitor));
        Gate::define('ver-audio-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Analista));
        Gate::define('mudar-status-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Atendente));
        Gate::define('atribuir-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Analista));
        Gate::define('reclassificar-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Analista));
        Gate::define('adicionar-nota-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Atendente));
        Gate::define('responder-manifestacao', fn (User $u) => $u->temPapelMinimo(UserRole::Analista));
        Gate::define('ver-relatorios', fn (User $u) => $u->temPapelMinimo(UserRole::Analista));

        // Admin-only: gestão de dispositivos, usuários e notificações -
        // não faz parte da hierarquia "leitor+" (são ações de gestão da
        // operação, não de atendimento/análise de manifestação).
        Gate::define('gerenciar-dispositivos', fn (User $u) => $u->role === UserRole::Admin);

        // Parear um totem (listar os dispositivos e pegar a chave de um
        // deles na tela de login do kiosk) NÃO é gestão: é operação de
        // chão, feita por quem instala/liga o totem. Por isso atendente+,
        // e não admin - criar/desativar dispositivo continua admin-only.
        Gate::define('parear-dispositivo', fn (User $u) => $u->temPapelMinimo(UserRole::Atendente));
        Gate::define('gerenciar-usuarios', fn (User $u) => $u->role === UserRole::Admin);
        Gate::define('gerenciar-notificacoes', fn (User $u) => $u->role === UserRole::Admin);
        Gate::define('ver-logs', fn (User $u) => $u->role === UserRole::Admin);
    }
}
