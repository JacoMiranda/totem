<?php

namespace App\Enums;

enum NotifStatus: string
{
    case Pendente = 'pendente';
    case Enviada = 'enviada';
    case Falha = 'falha';
}
