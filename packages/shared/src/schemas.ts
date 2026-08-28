import { z } from 'zod';
import { CATEGORIES, CHANNELS, SENTIMENTS, URGENCIES } from './enums';

/**
 * Validação client-side (kiosk/admin) ANTES de enviar pra API - espelha
 * o contrato de docs/API.md. A validação de verdade/autoritativa
 * continua sendo a do backend (Form Requests Laravel); isso aqui só
 * evita mandar payload obviamente inválido e dar feedback mais rápido
 * no totem (útil offline, antes até de tentar a rede).
 */
export const manifestationDraftSchema = z.object({
  clientId: z.string().uuid(),
  criadoEm: z.string().datetime(),
  consentimentoLgpd: z.literal(true), // obrigatório pro canal Totem
  transcricao: z.string().min(1).optional(),
  resumo: z.string().optional(),
  keywords: z.array(z.string()).min(3).max(5).optional(),
  sentimento: z.enum(SENTIMENTS).optional(),
  categoria: z.enum(CATEGORIES).optional(),
  urgencia: z.enum(URGENCIES).optional(),
  temAudio: z.boolean().default(false),
  requerenteType: z.enum(['person', 'company']).optional(),
  requerenteId: z.string().uuid().optional(),
});
export type ManifestationDraft = z.infer<typeof manifestationDraftSchema>;

/** Resposta de POST /ai/transcribe-analyze e /ai/analyze-text (docs/API.md). */
export const aiAnalysisResponseSchema = z.object({
  transcription: z.string().optional(),
  sentiment: z.enum(SENTIMENTS),
  category: z.enum(CATEGORIES),
  urgency: z.enum(URGENCIES),
  summary: z.string(),
  keywords: z.array(z.string()),
  degraded: z.boolean().default(false),
});
export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;

/** Resposta de POST /manifestations (docs/API.md). */
export const manifestationCreatedResponseSchema = z.object({
  id: z.string().uuid(),
  protocolo: z.string(),
  pin: z.string().length(4),
  status: z.string(),
  audioUploadUrl: z.string(),
});
export type ManifestationCreatedResponse = z.infer<typeof manifestationCreatedResponseSchema>;

export const channelSchema = z.enum(CHANNELS);
