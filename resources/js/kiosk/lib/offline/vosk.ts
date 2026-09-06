import type { Model } from 'vosk-browser';
import { VOSK_ATIVO, VOSK_TIMEOUT_MS } from '../ia';

/**
 * Transcrição de fala OFFLINE (sem IA de nuvem) com Vosk — usada como
 * fallback quando o kiosk está sem conexão ou a Gemini falha. Ver
 * docs/CAMADA-OFFLINE.md.
 *
 * O modelo pt-BR (~32 MB) fica em /models/vosk/ (baixado por
 * `php artisan ouvidoria:baixar-modelo-vosk`, cacheado pelo Service Worker).
 * A lib `vosk-browser` roda um build WASM do Kaldi num Web Worker; o
 * `import()` é dinâmico pra não pesar 5+ MB no bundle principal do kiosk.
 *
 * Regra do totem: transcrever é um EXTRA. Qualquer falha aqui devolve
 * `null` e o fluxo segue (o áudio já está salvo pra sincronizar depois).
 */

const MODELO_URL = '/models/vosk/vosk-model-small-pt-0.3.tar.gz';
const TAXA_ALVO = 16000; // Vosk espera 16 kHz mono

let modeloPromise: Promise<Model | null> | null = null;

/** Rejeita/resolve com `alternativa` se `p` não terminar em `ms`. */
function comLimite<T>(p: Promise<T>, ms: number, alternativa: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(alternativa), ms)),
  ]);
}

/**
 * Carrega (uma vez) o modelo Vosk - só se `VOSK_ATIVO`. Tem timeout duro:
 * a lib às vezes trava sem erro no carregamento, e nada no totem pode
 * ficar pendurado esperando.
 */
export function precarregarVosk(): Promise<Model | null> {
  if (!VOSK_ATIVO) return Promise.resolve(null);

  if (!modeloPromise) {
    modeloPromise = comLimite(
      (async () => {
        try {
          const { createModel } = await import('vosk-browser');

          return await createModel(MODELO_URL, -1 /* logLevel: silencioso */);
        } catch (erro) {
          console.warn('[vosk] modelo indisponível:', erro);

          return null;
        }
      })(),
      VOSK_TIMEOUT_MS,
      null,
    );
  }

  return modeloPromise;
}

/** true se o modelo já está carregado e pronto (não dispara download). */
export function voskPronto(): boolean {
  return modeloPromise !== null;
}

/** Reamostra o áudio decodificado para 16 kHz mono Float32. */
async function paraMono16k(decodificado: AudioBuffer): Promise<Float32Array> {
  if (decodificado.sampleRate === TAXA_ALVO && decodificado.numberOfChannels === 1) {
    return decodificado.getChannelData(0);
  }

  const amostras = Math.ceil(decodificado.duration * TAXA_ALVO);
  const offline = new OfflineAudioContext(1, amostras, TAXA_ALVO);
  const fonte = offline.createBufferSource();
  fonte.buffer = decodificado;
  fonte.connect(offline.destination);
  fonte.start();
  const renderizado = await offline.startRendering();

  return renderizado.getChannelData(0);
}

/**
 * Transcreve um Blob de áudio gravado (webm/opus/mp4/wav). Devolve o texto
 * ou `null` se o Vosk não estiver disponível ou algo falhar.
 */
export async function transcreverAudioOffline(blob: Blob): Promise<string | null> {
  if (!VOSK_ATIVO) return null;
  const modelo = await precarregarVosk();
  if (!modelo) return null;

  return comLimite(transcrever(modelo, blob), VOSK_TIMEOUT_MS, null);
}

async function transcrever(modelo: Model, blob: Blob): Promise<string | null> {

  let audioContext: AudioContext | null = null;

  try {
    audioContext = new AudioContext();
    const decodificado = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const pcm = await paraMono16k(decodificado);

    const recognizer = new modelo.KaldiRecognizer(TAXA_ALVO);
    const partes: string[] = [];

    const textoFinal = new Promise<string>((resolve) => {
      recognizer.on('result', (msg) => {
        const t = (msg as { result?: { text?: string } }).result?.text?.trim();
        if (t) partes.push(t);
      });

      // Sem evento "acabou" no Vosk: alimentamos tudo, pedimos o resultado
      // final e damos um tempo curto pra ele chegar antes de resolver.
      setTimeout(() => resolve(partes.join(' ').trim()), 400);
    });

    // Alimenta em blocos (~0,25 s) — acceptWaveformFloat aceita Float32.
    const bloco = TAXA_ALVO / 4;
    for (let i = 0; i < pcm.length; i += bloco) {
      recognizer.acceptWaveformFloat(pcm.subarray(i, i + bloco), TAXA_ALVO);
    }
    recognizer.retrieveFinalResult();

    const texto = await textoFinal;
    recognizer.remove();

    return texto || null;
  } catch (erro) {
    console.warn('[vosk] falha ao transcrever offline:', erro);

    return null;
  } finally {
    await audioContext?.close().catch(() => {});
  }
}
