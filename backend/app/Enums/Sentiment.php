<?php

namespace App\Enums;

/**
 * Preservado do protótipo (`cabine_de_ouvidoria_inteligente.html`) - ver
 * docs/MODELO-DADOS.md. Diferente do Prisma original (que não aceita
 * acento no NOME do enum, exigindo um arquivo de labels à parte), o
 * PHP backed enum guarda o rótulo acentuado direto no VALUE - o nome do
 * case só precisa ser um identificador PHP válido (sem acento).
 */
enum Sentiment: string
{
    case Excelente = 'Excelente';
    case Satisfeito = 'Satisfeito';
    case Neutro = 'Neutro';
    case Preocupado = 'Preocupado';
    case Insatisfeito = 'Insatisfeito';
}
