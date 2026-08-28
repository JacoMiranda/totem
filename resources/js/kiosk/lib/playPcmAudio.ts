/**
 * Porta fiel de `playPcmAudio`/`speakWithBrowserFallback` do protótipo -
 * decodifica o PCM 16-bit mono em base64 devolvido por POST /ai/tts
 * (ver GeminiAiService::textoParaFala) e toca via Web Audio API. Se a
 * chamada de TTS falhar (offline/indisponível), cai na síntese de voz
 * NATIVA do navegador (`speechSynthesis`) - sempre em português.
 */
export function playPcmAudio(base64Data: string, sampleRate = 24000): void {
  try {
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass({ sampleRate });
    const audioBuffer = audioContext.createBuffer(1, int16Array.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i++) {
      channelData[i] = int16Array[i] / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  } catch {
    // silencioso - falar é um extra, nunca deve travar a jornada.
  }
}

export function falarComFallbackDoNavegador(texto: string): void {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = 'pt-BR';
  window.speechSynthesis.speak(utterance);
}
