/**
 * Converte o Blob gravado (Chrome grava `audio/webm;codecs=opus`, que a API
 * Gemini NÃO aceita - ela quer wav/mp3/ogg/flac/aac) para WAV PCM 16-bit
 * mono 16 kHz. 16 kHz basta pra fala e mantém o upload pequeno. É também a
 * taxa que o Vosk usa, então a mesma decodificação serve pros dois.
 *
 * Se a decodificação falhar (formato exótico), devolve o blob original -
 * o backend ainda tenta, e os tiers de fallback cobrem o resto.
 */

const TAXA = 16000;

export async function audioParaWav(blob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const ctx = new AudioContext();
    const decodificado = await ctx.decodeAudioData(await blob.arrayBuffer());
    await ctx.close();

    const pcm = await reamostrarMono(decodificado, TAXA);

    return { blob: new Blob([codificarWav(pcm, TAXA)], { type: 'audio/wav' }), mimeType: 'audio/wav' };
  } catch {
    return { blob, mimeType: blob.type || 'audio/webm' };
  }
}

async function reamostrarMono(buffer: AudioBuffer, taxa: number): Promise<Float32Array> {
  if (buffer.sampleRate === taxa && buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const offline = new OfflineAudioContext(1, Math.ceil(buffer.duration * taxa), taxa);
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
