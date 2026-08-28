<?php

namespace App\Enums;

/** Recebida -> Em triagem -> Em análise -> Respondida -> Concluída / Arquivada. */
enum ManifestationStatus: string
{
    case Recebida = 'Recebida';
    case EmTriagem = 'Em triagem';
    case EmAnalise = 'Em análise';
    case Respondida = 'Respondida';
    case Concluida = 'Concluída';
    case Arquivada = 'Arquivada';
}
