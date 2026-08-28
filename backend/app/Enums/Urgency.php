<?php

namespace App\Enums;

enum Urgency: string
{
    case Baixa = 'Baixa';
    case Media = 'Média';
    case Alta = 'Alta';
    case Critica = 'Crítica';
}
