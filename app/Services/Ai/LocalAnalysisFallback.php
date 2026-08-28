<?php

namespace App\Services\Ai;

/**
 * Porta fiel de `fallbackLocalAnalysis` do protótipo
 * (cabine_de_ouvidoria_inteligente.html) / resources/js/shared/fallbackAnalysis.ts -
 * heurística por palavra-chave usada quando a Gemini está indisponível
 * (`degraded: true` na resposta, ver docs/API.md). Intencionalmente simples -
 * NÃO é uma segunda análise, só evita que o cidadão fique sem nenhuma
 * classificação quando a IA cai.
 */
class LocalAnalysisFallback
{
    /**
     * @return array{sentiment: string, category: string, urgency: string, summary: string, keywords: string[]}
     */
    public function analisar(string $texto): array
    {
        $lower = mb_strtolower($texto);

        $sentiment = 'Neutro';
        $category = 'Sugestão';
        $urgency = 'Média';

        if ($this->contemAlguma($lower, ['excelente', 'ótimo', 'parabéns', 'obrigado', 'perfeito'])) {
            $sentiment = 'Excelente';
            $category = 'Elogio';
            $urgency = 'Baixa';
        } elseif ($this->contemAlguma($lower, ['péssimo', 'mau', 'ruim', 'problema', 'demora', 'falta'])) {
            $sentiment = 'Insatisfeito';
            $category = 'Reclamação';
            $urgency = 'Alta';
        } elseif ($this->contemAlguma($lower, ['denúncia', 'crime', 'corrupção', 'urgente', 'irregular'])) {
            $sentiment = 'Preocupado';
            $category = 'Denúncia';
            $urgency = 'Crítica';
        } elseif ($this->contemAlguma($lower, ['como', 'onde', 'quando', 'dúvida'])) {
            $sentiment = 'Neutro';
            $category = 'Dúvida';
            $urgency = 'Baixa';
        }

        return [
            'sentiment' => $sentiment,
            'category' => $category,
            'urgency' => $urgency,
            'summary' => mb_substr($texto, 0, 110).'...',
            'keywords' => ['cidadão', 'serviço-público'],
        ];
    }

    /** @param string[] $palavras */
    private function contemAlguma(string $texto, array $palavras): bool
    {
        foreach ($palavras as $palavra) {
            if (str_contains($texto, $palavra)) {
                return true;
            }
        }

        return false;
    }
}
