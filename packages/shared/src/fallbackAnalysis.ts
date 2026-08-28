import type { Category, Sentiment, Urgency } from './enums';

export interface AnaliseFallback {
  sentiment: Sentiment;
  category: Category;
  urgency: Urgency;
  summary: string;
  keywords: string[];
}

/**
 * Porta fiel de `fallbackLocalAnalysis` do protótipo
 * (cabine_de_ouvidoria_inteligente.html) - heurística por palavra-chave
 * usada quando a IA (Gemini) está indisponível (`degraded: true`).
 * NÃO reescrever/"melhorar" a lógica aqui sem comparar com o original -
 * é intencionalmente simples, só um fallback, não uma segunda análise.
 */
export function fallbackLocalAnalysis(text: string): AnaliseFallback {
  const lower = text.toLowerCase();
  let sentiment: Sentiment = 'Neutro';
  let category: Category = 'Sugestão';
  let urgency: Urgency = 'Média';

  if (['excelente', 'ótimo', 'parabéns', 'obrigado', 'perfeito'].some((w) => lower.includes(w))) {
    sentiment = 'Excelente';
    category = 'Elogio';
    urgency = 'Baixa';
  } else if (['péssimo', 'mau', 'ruim', 'problema', 'demora', 'falta'].some((w) => lower.includes(w))) {
    sentiment = 'Insatisfeito';
    category = 'Reclamação';
    urgency = 'Alta';
  } else if (['denúncia', 'crime', 'corrupção', 'urgente', 'irregular'].some((w) => lower.includes(w))) {
    sentiment = 'Preocupado';
    category = 'Denúncia';
    urgency = 'Crítica';
  } else if (['como', 'onde', 'quando', 'dúvida'].some((w) => lower.includes(w))) {
    sentiment = 'Neutro';
    category = 'Dúvida';
    urgency = 'Baixa';
  }

  return {
    sentiment,
    category,
    urgency,
    summary: `${text.slice(0, 110)}...`,
    keywords: ['cidadão', 'serviço-público'],
  };
}
