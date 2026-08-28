<?php

namespace App\Enums;

/**
 * RBAC da equipe - ver Gates em AppServiceProvider (mesmo padrão de
 * Gate::define do política-laravel, mas aqui parametrizado por
 * hierarquia de papel em vez de um número de nível fixo por rota).
 * Hierarquia (docs/API.md usa notação "leitor+"/"analista+" etc.):
 * leitor < atendente < analista < admin.
 */
enum UserRole: string
{
    case Admin = 'admin';
    case Analista = 'analista';
    case Atendente = 'atendente';
    case Leitor = 'leitor';

    private function nivel(): int
    {
        return match ($this) {
            self::Leitor => 0,
            self::Atendente => 1,
            self::Analista => 2,
            self::Admin => 3,
        };
    }

    /** true se este papel é igual ou "maior" que $minimo na hierarquia (ex: Admin->atende(Analista) === true). */
    public function atende(self $minimo): bool
    {
        return $this->nivel() >= $minimo->nivel();
    }
}
