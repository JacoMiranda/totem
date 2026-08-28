/**
 * Espelha app/Enums/*.php do backend Laravel byte-a-byte (mesmo valor
 * acentuado) - qualquer payload trocado entre kiosk/admin e a API tem
 * que bater exatamente com essas strings. Fonte única pros dois apps
 * TS, mesmo espírito de packages/shared/labels.ts do plano original
 * (aqui não precisa de arquivo de labels separado - PHP e TS aceitam
 * acento direto no valor do enum, diferente do Prisma original).
 */

export const SENTIMENTS = ['Excelente', 'Satisfeito', 'Neutro', 'Preocupado', 'Insatisfeito'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const CATEGORIES = ['Elogio', 'Sugestão', 'Dúvida', 'Reclamação', 'Denúncia'] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ['Baixa', 'Média', 'Alta', 'Crítica'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const CHANNELS = ['Totem', 'Web', 'Importação'] as const;
export type Channel = (typeof CHANNELS)[number];

export const MANIFESTATION_STATUSES = [
  'Recebida',
  'Em triagem',
  'Em análise',
  'Respondida',
  'Concluída',
  'Arquivada',
] as const;
export type ManifestationStatus = (typeof MANIFESTATION_STATUSES)[number];

export const REQUERENTE_TYPES = ['person', 'company'] as const;
export type RequerenteType = (typeof REQUERENTE_TYPES)[number];

/** Status de sincronização LOCAL (kiosk/IndexedDB) - nunca vai pro servidor, é só do cliente. */
export const SYNC_STATUSES = ['pendente', 'enviando', 'sincronizado', 'erro'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];
