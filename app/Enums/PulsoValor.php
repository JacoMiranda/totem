<?php

namespace App\Enums;

/**
 * As 3 carinhas do Pulso Rápido (QR sem totem/tablet, ver PulsoService).
 * Deliberadamente só 3 valores - é uma enquete de 1 toque, não uma
 * manifestação classificada (isso é o Manifestation normal).
 */
enum PulsoValor: string
{
    case Positivo = 'positivo';
    case Neutro = 'neutro';
    case Negativo = 'negativo';
}
