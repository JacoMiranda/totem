/**
 * Converte o Blob gravado para **WAV PCM 16-bit mono 16 kHz** antes de
 * mandar pra Gemini. Chrome grava `audio/webm;codecs=opus`, que a Gemini
 * NÃO aceita (ela quer wav/mp3/ogg/flac/aac). 16 kHz basta pra fala e
 * mantém o upload pequeno.
 *
 * Se `decodeAudioData` falhar (aconteceu com webm de alguns Android), NÃO
 * adianta mandar o webm rotulado de .wav pro servidor - a Gemini rejeita
 * do mesmo jeito e o erro fica confuso. Devolvemos `{ ok: false }` e quem
 * chama trata como "não deu pra transcrever este áudio".
 */

const TAXA = 16000;

export type ResultadoWav =
  | { ok: true; blob: Blob; nomeArquivo: 'gravacao.wav' }
  | { ok: false; motivo: string };

export async function audioParaWav(blob: Blob): Promise<ResultadoWav> {
  if (!blob || blob.size === 0) {
    return { ok: false, motivo: 'áudio vazio' };
  }

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    return { ok: false, motivo: 'sem AudioContext neste navegador' };
  }

  let ctx: AudioContext | null = null;
  try {
    ctx = new Ctx();
    const bytes = await blob.arrayBuffer();
    // Forma com callbacks: Safari antigo não devolve Promise de decodeAudioData.
    const decodificado = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx!.decodeAudioData(bytes, resolve, reject);
    });

    const pcm = await reamostrarMono(decodificado, TAXA);
    if (pcm.length === 0) {
      return { ok: false, motivo: 'áudio sem amostras' };
    }

    return {
      ok: true,
      blob: new Blob([codificarWav(pcm, TAXA)], { type: 'audio/wav' }),
      nomeArquivo: 'gravacao.wav',
    };
  } catch (e) {
    return { ok: false, motivo: `falha ao decodificar (${(e as Error)?.name ?? 'erro'})` };
  } finally {
    await ctx?.close().catch(() => {});
  }
}

async function reamostrarMono(buffer: AudioBuffer, taxa: number): Promise<Float32Array> {
  if (buffer.sampleRate === taxa && buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offline = new Offline(1, Math.ceil(buffer.duration * taxa), taxa);
  const fonte = offline.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(offline.destination);
  fonte.start();

  return (await offline.startRendering()).getChannelData(0);
}

/** Float32 [-1,1] -> ArrayBuffer de um .wav (header de 44 bytes + PCM 16-bit LE). */
function codificarWav(pcm: Float32Array, taxa: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const escreverTexto = (offset: number, texto: string) => {
    for (let i = 0; i < texto.length; i++) view.setUint8(offset + i, texto.charCodeAt(i));
  };

  escreverTexto(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  escreverTexto(8, 'WAVE');
  escreverTexto(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, taxa, true);
  view.setUint32(28, taxa * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits
  escreverTexto(36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}
