import { diagnosticoNavegador } from './diagnostico';

/**
 * Manda um erro do navegador do totem pro servidor (canal `kiosk`, visível
 * em /admin/logs). É best-effort: se a própria chamada falhar, engole -
 * relatar um erro nunca pode gerar outro que atrapalhe o cidadão.
 *
 * Não usa o `api` (axios) de propósito: aquele tem interceptors e timeout
 * pensados pro fluxo normal; aqui queremos o mínimo, com `keepalive` pra
 * sair mesmo se a página estiver sendo fechada.
 */
export function reportarErro(contexto: string, mensagem: string): void {
  try {
    const deviceKey = JSON.parse(localStorage.getItem('totem:device-config') ?? '{}')?.deviceKey;
    if (!deviceKey) return;

    void fetch('/api/v1/client-errors', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': deviceKey },
      body: JSON.stringify({
        contexto: contexto.slice(0, 80),
        mensagem: mensagem.slice(0, 500),
        diagnostico: diagnosticoNavegador(),
      }),
    }).catch(() => {});
  } catch {
    /* nunca propaga */
  }
}
