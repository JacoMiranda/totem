<?php

namespace App\Enums;

/**
 * Ciclo de vida de uma conta de cliente. `Trial` é uma conta real, criada
 * pelo próprio cliente na home, com validade - por isso é status e não um
 * booleano: expirar um trial é a mesma operação de suspender uma conta.
 */
enum OrganizacaoStatus: string
{
    case Trial = 'trial';
    case Ativa = 'ativa';
    case Suspensa = 'suspensa';

    /** Só contas nestes status conseguem operar totens. */
    public function operante(): bool
    {
        return $this === self::Trial || $this === self::Ativa;
    }
}
