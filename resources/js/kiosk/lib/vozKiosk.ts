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
  | 'consentimento-recusado'
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
  'inicio-consentimento':
    'Concordo que meu relato seja registrado para fins de melhoria do atendimento público, conforme a Lei Geral de Proteção de Dados. Você concorda?',
  'consentimento-recusado': 'Sem a sua concordância não podemos registrar o relato. Obrigado pela sua visita.',
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

/**
 * Geração da locução atual. `falarFrase` faz `await` no manifest antes de
 * tocar; sem este contador, duas chamadas concorrentes passavam as duas
 * pelo `pararFala()` inicial e depois tocavam as duas juntas - a "voz
 * duplicada/com eco". Acontece de verdade no React StrictMode, que monta,
 * desmonta e remonta os efeitos em desenvolvimento.
 */
let geracaoFala = 0;

/** Para qualquer locução em andamento (arquivo estático ou síntese nativa). */
export function pararFala(): void {
  geracaoFala++;
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
 *
 * Resolve quando a locução TERMINA, com `true` se ela chegou ao fim
 * sozinha e `false` se foi INTERROMPIDA (outra fala começou, ou alguém
 * chamou `pararFala`). Quem encadeia falas precisa desse retorno para não
 * continuar a fila depois de um cancelamento - ver `falarSequencia`.
 * Nunca rejeita: falar é sempre um extra.
 */
export async function falarFrase(id: FraseId): Promise<boolean> {
  pararFala();
  const minhaGeracao = geracaoFala;
  const frases = await carregarManifest();
  // Outra locução começou (ou pararFala foi chamado) durante o await:
  // esta virou obsoleta e NÃO deve tocar por cima.
  if (minhaGeracao !== geracaoFala) return false;

  const entrada = frases[id];

  if (entrada) {
    const audio = new Audio(`/audio/kiosk/${entrada.arquivo}`);
    audioAtual = audio;

    await new Promise<void>((resolve) => {
      let terminou = false;
      const encerrar = () => {
        if (terminou) return;
        terminou = true;
        resolve();
      };

      audio.onended = encerrar;
      audio.onerror = encerrar;
      // Interrompida por outra fala: solta quem estava esperando.
      audio.onpause = () => {
        if (minhaGeracao !== geracaoFala) encerrar();
      };

      audio.play().catch(() => {
        audioAtual = null;
        falarComFallbackDoNavegador(entrada.texto);
        encerrar();
      });
    });

    return minhaGeracao === geracaoFala;
  }

  const texto = FALLBACK[id] ?? (id.startsWith('conclusao-') ? FALLBACK['conclusao-online'] : undefined);
  if (texto) falarComFallbackDoNavegador(texto);

  return minhaGeracao === geracaoFala;
}

/**
 * Toca frases em sequência, PARANDO a fila se qualquer uma for
 * interrompida. Sem isso, tocar em "Concordo" no meio das boas-vindas
 * silenciava a fala atual mas deixava a PRÓXIMA da fila começar - e ela
 * então se sobrepunha à locução da tela seguinte (três vozes juntas).
 */
export async function falarSequencia(...ids: FraseId[]): Promise<void> {
  for (const id of ids) {
    if (!(await falarFrase(id))) return;
  }
}

/**
 * Fala a conclusão que menciona categoria + sentimento. Tenta a combinação
 * pré-gerada (`conclusao-{cat}-{sent}`); se faltar, usa a genérica online.
 */
export function falarConclusao(categoria: Category | null, sentimento: Sentiment | null): Promise<boolean> {
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
