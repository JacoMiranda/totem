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

  return [
    navegadorDetectado(),
    `SpeechRecognition=${typeof w.SpeechRecognition}`,
    `webkit=${typeof w.webkitSpeechRecognition}`,
    `seguro=${window.isSecureContext}`,
    `origem=${window.location.origin}`,
  ].join(' · ');
}
