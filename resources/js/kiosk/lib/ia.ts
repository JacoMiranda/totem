/**
 * Modo de processamento do relato.
 *
 * `VITE_KIOSK_IA_LOCAL=true` (no .env) → o kiosk NÃO chama a Gemini.
 * Classifica com o léxico local (fallbackLocalAnalysis). Útil enquanto a
 * latência/cota da Gemini não está aceitável, ou pra operação offline.
 *
 * `VITE_KIOSK_VOSK=true` → tenta também transcrever áudio localmente com o
 * Vosk (modelo WASM de ~32 MB). DESLIGADO por padrão: a lib está velha
 * (v0.0.8) e o carregamento pode travar em alguns navegadores. Sem ele, o
 * cidadão digita (ou dita com o reconhecimento nativo do navegador) e o
 * áudio segue guardado pra a equipe transcrever depois.
 */
export const IA_LOCAL_APENAS = import.meta.env.VITE_KIOSK_IA_LOCAL === 'true';

export const VOSK_ATIVO = import.meta.env.VITE_KIOSK_VOSK === 'true';

/** Timeout (ms) das chamadas de IA no cliente - passado esse tempo, cai no local. */
export const IA_TIMEOUT_MS = 20_000;

/** Timeout (ms) pra carregar/rodar o Vosk - nunca deixar pendurar a jornada. */
export const VOSK_TIMEOUT_MS = 15_000;
