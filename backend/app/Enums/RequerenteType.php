<?php

namespace App\Enums;

/**
 * Novo (não estava no plano original) - pedido do usuário: "teremos uma
 * parte para cadastro de pessoas/empresas". Relação polimórfica em
 * `manifestation` (requerente_type/requerente_id) apontando pra `Person`
 * ou `Company` - nula quando a manifestação é anônima (modo padrão do
 * totem, preservado do protótipo).
 */
enum RequerenteType: string
{
    case Person = 'person';
    case Company = 'company';
}
