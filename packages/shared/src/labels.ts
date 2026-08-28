import type { Sentiment, Urgency } from './enums';

/** Porta fiel de `getSentimentEmoji` do protótipo. */
export function getSentimentEmoji(sentiment: Sentiment | string | undefined): string {
  switch (sentiment) {
    case 'Excelente':
      return '😍';
    case 'Satisfeito':
      return '🙂';
    case 'Neutro':
      return '😐';
    case 'Preocupado':
      return '😟';
    case 'Insatisfeito':
      return '😡';
    default:
      return '💬';
  }
}

/** Porta fiel de `getUrgencyBadgeClass` do protótipo (classes Tailwind). */
export function getUrgencyBadgeClass(urgency: Urgency | string | undefined): string {
  switch (urgency) {
    case 'Crítica':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'Alta':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Média':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
