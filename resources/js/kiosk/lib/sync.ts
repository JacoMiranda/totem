import { manifestationCreatedResponseSchema } from '../../shared';
import db, { type FilaManifestacao } from './db';
import { api, isNetworkError } from './api';

/**
 * Drena a fila local (Dexie) - tenta enviar cada manifestação `pendente`
 * ou `erro` de novo. Erro de REDE (offline) deixa o registro como está pra
 * tentar de novo depois (não é uma falha real, é a rede indisponível);
 * qualquer outra resposta (4xx/5xx de verdade) marca `erro` e para de
 * insistir automaticamente nesse item - evita loop de retry infinito
 * contra um payload que o servidor rejeita de propósito (ex.: validação).
 */
export async function drenarFila(): Promise<void> {
  const pendentes = await db.fila.where('status').anyOf(['pendente', 'enviando']).toArray();

  for (const item of pendentes) {
    await enviarItem(item);
  }
}

/**
 * Envia UM item específico da fila agora (usado pela Conclusão logo após
 * criar o registro local - dá a chance de mostrar protocolo/PIN de verdade
 * na hora, sem esperar o próximo ciclo de 30s, quando a rede está
 * disponível). Devolve o item atualizado (já refletindo sucesso/pendência).
 */
export async function sincronizarUm(clientId: string): Promise<FilaManifestacao> {
  const item = await db.fila.get(clientId);
  if (!item) throw new Error(`Item ${clientId} não encontrado na fila local.`);

  await enviarItem(item);

  return (await db.fila.get(clientId)) ?? item;
}

async function enviarItem(item: FilaManifestacao): Promise<void> {
  await db.fila.update(item.clientId, { status: 'enviando' });

  try {
    let manifestacaoId = item.id;
    let protocolo = item.protocolo;
    let pin = item.pin;

    if (!manifestacaoId) {
      const resposta = manifestationCreatedResponseSchema.parse(
        (await api.post('/manifestations', item.payload)).data,
      );
      manifestacaoId = resposta.id;
      protocolo = resposta.protocolo;
      pin = resposta.pin ?? item.pin;
    }

    if (item.audioBlob && manifestacaoId) {
      const form = new FormData();
      const extensao = (item.audioMimeType ?? 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
      form.append('file', item.audioBlob, `gravacao.${extensao}`);
      await api.post(`/manifestations/${manifestacaoId}/audio`, form);
    }

    await db.fila.update(item.clientId, {
      status: 'sincronizado',
      id: manifestacaoId,
      protocolo,
      pin: pin ?? undefined,
      audioBlob: undefined,
    });
  } catch (erro) {
    if (isNetworkError(erro)) {
      // sem rede - volta pra "pendente", tenta de novo na próxima janela de conectividade.
      await db.fila.update(item.clientId, { status: 'pendente', tentativas: item.tentativas + 1 });
    } else {
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao sincronizar.';
      await db.fila.update(item.clientId, { status: 'erro', erro: mensagem, tentativas: item.tentativas + 1 });
    }
  }
}

let intervalo: ReturnType<typeof setInterval> | undefined;

/** Dispara a drenagem ao voltar a conexão e periodicamente (30s) enquanto o kiosk estiver aberto. */
export function iniciarSincronizacaoEmSegundoPlano(): () => void {
  window.addEventListener('online', drenarFila);
  intervalo = setInterval(drenarFila, 30_000);
  void drenarFila();

  return () => {
    window.removeEventListener('online', drenarFila);
    if (intervalo) clearInterval(intervalo);
  };
}
