import { create } from 'zustand';
import type { Category, Sentiment, Urgency } from '../../shared';

/**
 * Estado da jornada do cidadão (Início -> Relato -> Classificação ->
 * Conclusão) - espelha `currentManifestation`/`currentStep` do protótipo,
 * mas como um store React em vez de globais soltas no `window`.
 */
export type Etapa = 'inicio' | 'relato' | 'classificacao' | 'conclusao';

export interface Requerente {
  type: 'person' | 'company';
  id: string;
  label: string;
}

interface JourneyState {
  etapa: Etapa;
  clientId: string;
  consentimentoLgpd: boolean;
  requerente: Requerente | null;
  transcricao: string;
  resumo: string;
  keywords: string[];
  sentimento: Sentiment | null;
  categoria: Category | null;
  urgencia: Urgency;
  degraded: boolean;
  audioBlob: Blob | null;
  audioMimeType: string | null;
  protocolo: string | null;
  pin: string | null;

  irPara: (etapa: Etapa) => void;
  setConsentimento: (v: boolean) => void;
  setRequerente: (r: Requerente | null) => void;
  setTranscricao: (v: string) => void;
  aplicarAnalise: (analise: {
    transcription?: string;
    sentiment: Sentiment;
    category: Category;
    urgency: Urgency;
    summary: string;
    keywords: string[];
    degraded: boolean;
  }) => void;
  setClassificacaoManual: (campo: 'sentimento' | 'categoria' | 'urgencia', valor: string) => void;
  setAudio: (blob: Blob, mimeType: string) => void;
  concluir: (protocolo: string, pin: string | null) => void;
  reiniciar: () => void;
}

const estadoInicial = {
  etapa: 'inicio' as Etapa,
  clientId: crypto.randomUUID(),
  consentimentoLgpd: false,
  requerente: null,
  transcricao: '',
  resumo: '',
  keywords: [] as string[],
  sentimento: null,
  categoria: null,
  urgencia: 'Média' as Urgency,
  degraded: false,
  audioBlob: null,
  audioMimeType: null,
  protocolo: null,
  pin: null,
};

export const useJourneyStore = create<JourneyState>((set) => ({
  ...estadoInicial,

  irPara: (etapa) => set({ etapa }),
  setConsentimento: (v) => set({ consentimentoLgpd: v }),
  setRequerente: (requerente) => set({ requerente }),
  setTranscricao: (transcricao) => set({ transcricao }),
  aplicarAnalise: (analise) =>
    set((state) => ({
      // `transcription` só vem preenchido no fluxo de áudio - no fluxo de
      // texto digitado manualmente o campo nem existe na resposta, e o
      // texto já escrito pelo cidadão não pode ser apagado por engano.
      transcricao: analise.transcription ?? state.transcricao,
      sentimento: analise.sentiment,
      categoria: analise.category,
      urgencia: analise.urgency,
      resumo: analise.summary,
      keywords: analise.keywords,
      degraded: analise.degraded,
    })),
  setClassificacaoManual: (campo, valor) =>
    set((state) => {
      if (campo === 'sentimento') return { ...state, sentimento: valor as Sentiment };
      if (campo === 'categoria') return { ...state, categoria: valor as Category };

      return { ...state, urgencia: valor as Urgency };
    }),
  setAudio: (audioBlob, audioMimeType) => set({ audioBlob, audioMimeType }),
  concluir: (protocolo, pin) => set({ protocolo, pin, etapa: 'conclusao' }),
  reiniciar: () => set({ ...estadoInicial, clientId: crypto.randomUUID() }),
}));
