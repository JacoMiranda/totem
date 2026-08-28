<?php

namespace App\Enums;

enum Category: string
{
    case Elogio = 'Elogio';
    case Sugestao = 'Sugestão';
    case Duvida = 'Dúvida';
    case Reclamacao = 'Reclamação';
    case Denuncia = 'Denúncia';
}
