import type { Category, Sentiment } from '../../shared';
import { api } from './api';
import { falarComFallbackDoNavegador, playPcmAudio } from './playPcmAudio';

/**
 * Locução do totem em duas pistas:
 *
 *  - `falarFrase(id)` — frases FIXAS da jornada. Toca o WAV pré-gerado em
 *    /audio/kiosk/ (ver config/kiosk_audio.php + `ouvidoria:gerar-audios-kiosk`).
 *    Instantâneo, offline, custo zero. Se o arquivo faltar, cai no texto de
 *    fallback abaixo via síntese nativa do navegador.
 *  - `falarTexto(texto)` — conteúdo DINÂMICO (ex.: ler o resumo do relato do
 *    próprio cidadão). Vai pro POST /ai/tts (com cache no backend) e, se
 *    falhar, síntese nativa.
 *
 * Regra do protótipo mantida: falar é sempre um extra - nunca lança, nunca
 * bloqueia a jornada.
 */

export type FraseId =
  | 'boas-vindas'
  | 'inicio-consentimento'
  | 'relato-instrucao'
  | 'relato-gravando'
  | 'relato-processando'
  | 'relato-sem-microfone'
  | 'classificacao-instrucao'
  | 'conclusao-online'
  | 'conclusao-offline'
  | `conclusao-${string}-${string}`;

/** Texto de reserva p/ síntese do navegador quando o WAV não existe (ex.: `gerar-audios-kiosk` ainda não rodou). */
const FALLBACK: Partial<Record<string, string>> = {
  'boas-vindas': 'Olá! Seja bem-vindo à Ouvidoria Cidadã. Toque na tela para começar o seu relato.',
  'inicio-consentimento': 'Antes de começar, confirme que concorda com o registro do seu relato.',
  'relato-instrucao': 'Toque no microfone e conte o que aconteceu. Se preferir, pode escrever no campo abaixo.',
  'relato-gravando': 'Pode falar. Toque novamente no microfone quando terminar.',
  'relato-processando': 'Um momento, estou a processar o seu relato.',
  'relato-sem-microfone': 'Não consegui usar o microfone. Escreva o seu relato no campo abaixo, por favor.',
  'classificacao-instrucao': 'Confira a classificação do seu relato e ajuste se for necessário.',
  'conclusao-online': 'O seu relato foi registrado com sucesso. Obrigado pela sua participação.',
  'conclusao-offline': 'O seu relato foi guardado neste totem e será enviado assim que a conexão voltar. Obrigado.',
};

const CATEGORIA_SLUG: Record<Category, string> = {
  Elogio: 'elogio',
  Sugestão: 'sugestao',
  Dúvida: 'duvida',
  Reclamação: 'reclamacao',
  Denúncia: 'denuncia',
};

const SENTIMENTO_SLUG: Record<Sentiment, string> = {
  Excelente: 'excelente',
  Satisfeito: 'satisfeito',
  Neutro: 'neutro',
  Preocupado: 'preocupado',
  Insatisfeito: 'insatisfeito',
};

type ManifestEntry = { arquivo: string; texto: string };
type Manifest = { frases: Record<string, ManifestEntry> };

let manifestPromise: Promise<Manifest['frases']> | null = null;
let audioAtual: HTMLAudioElement | null = null;

function carregarManifest(): Promise<Manifest['frases']> {
  if (!manifestPromise) {
    manifestPromise = fetch('/audio/kiosk/manifest.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('sem manifest'))))
      .then((m: Manifest) => m.frases ?? {})
      .catch(() => ({}));
  }

  return manifestPromise;
}

/** Para qualquer locução em andamento (arquivo estático ou síntese nativa). */
export function pararFala(): void {
  if (audioAtual) {
    audioAtual.pause();
    audioAtual.currentTime = 0;
    audioAtual = null;
  }
  window.speechSynthesis?.cancel();
}

/**
 * Toca uma frase fixa. DEVE ser chamada a partir de um gesto do usuário na
 * primeira vez (política de autoplay dos navegadores) - por isso a frase de
 * boas-vindas dispara no primeiro toque da tela inicial.
 */
export async function falarFrase(id: FraseId): Promise<void> {
  pararFala();
  const frases = await carregarManifest();
  const entrada = frases[id];

  if (entrada) {
    const audio = new Audio(`/audio/kiosk/${entrada.arquivo}`);
    audioAtual = audio;
    audio.play().catch(() => {
      audioAtual = null;
      falarComFallbackDoNavegador(entrada.texto);
    });

    return;
  }

  const texto = FALLBACK[id] ?? (id.startsWith('conclusao-') ? FALLBACK['conclusao-online'] : undefined);
  if (texto) falarComFallbackDoNavegador(texto);
}

/**
 * Fala a conclusão que menciona categoria + sentimento. Tenta a combinação
 * pré-gerada (`conclusao-{cat}-{sent}`); se faltar, usa a genérica online.
 */
export function falarConclusao(categoria: Category | null, sentimento: Sentiment | null): Promise<void> {
  if (categoria && sentimento) {
    return falarFrase(`conclusao-${CATEGORIA_SLUG[categoria]}-${SENTIMENTO_SLUG[sentimento]}` as FraseId);
  }

  return falarFrase('conclusao-online');
}

/** Locução de texto dinâmico (conteúdo do cidadão) - via /ai/tts, com fallback nativo. */
export async function falarTexto(texto: string): Promise<void> {
  pararFala();
  try {
    const { data } = await api.post('/ai/tts', { texto });
    playPcmAudio(data.audioBase64, data.sampleRate);
  } catch {
    falarComFallbackDoNavegador(texto);
  }
}
