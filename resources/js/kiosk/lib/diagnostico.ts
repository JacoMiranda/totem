/**
 * Fatos crus do navegador, para quando algo "não funciona e não dá erro".
 * Sem isso, "o ditado não aparece" é indistinguível de "este navegador não
 * expõe a API" - e a mensagem "use o Chrome" parece errada para quem acha
 * que já está no Chrome.
 */

export function navegadorDetectado(): string {
  const ua = navigator.userAgent;

  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if ('brave' in navigator) return 'Brave';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';

  return 'seu navegador';
}

/** Linha completa de diagnóstico (console/suporte). */
export function diagnosticoNavegador(): string {
  const w = window as unknown as Record<string, unknown>;

  const mr =
    typeof MediaRecorder === 'undefined'
      ? 'sem MediaRecorder'
      : ['audio/webm', 'audio/mp4', 'audio/ogg']
          .filter((t) => MediaRecorder.isTypeSupported?.(t))
          .join(',') || 'nenhum formato';

  return [
    navegadorDetectado(),
    `seguro=${window.isSecureContext}`,
    `mic=${typeof navigator.mediaDevices?.getUserMedia === 'function'}`,
    `gravar: ${mr}`,
    `ditado=${typeof (w.SpeechRecognition ?? w.webkitSpeechRecognition)}`,
  ].join(' · ');
}

/**
 * true em aparelho com toque como ponteiro principal (celular/tablet).
 *
 * Usado para NÃO rodar o reconhecimento de fala (SpeechRecognition) ao
 * mesmo tempo que a gravação (MediaRecorder): no Chrome do Android o
 * microfone é EXCLUSIVO - com o MediaRecorder segurando o mic, o
 * SpeechRecognition inicia, falha e reinicia em loop (o ícone de mic
 * piscando no topo da tela) sem nunca capturar nada. No desktop os dois
 * dividem o mic sem problema.
 */
export function aparelhoDeToque(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  } catch {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }
}
