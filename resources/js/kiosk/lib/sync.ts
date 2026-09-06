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
/** Além de N tentativas o item para de ser reenviado sozinho (precisa de ação no painel de suporte). */
const MAX_TENTATIVAS = 12;

export async function drenarFila(): Promise<void> {
  const pendentes = await db.fila.where('status').anyOf(['pendente', 'enviando']).toArray();
  // Itens em 'erro' também voltam pra fila algumas vezes: o payload pode ter
  // sido rejeitado por um bug de servidor já corrigido num deploy (ex.: a
  // regra antiga de `keywords` mínimo 3). Não insistir pra sempre.
  const comErro = await db.fila.where('status').equals('erro').toArray();

  for (const item of [...pendentes, ...comErro]) {
    if (item.tentativas >= MAX_TENTATIVAS) continue;
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

    if (!manifestacaoId) {
      const resposta = manifestationCreatedResponseSchema.parse(
        (await api.post('/manifestations', item.payload)).data,
      );
      manifestacaoId = resposta.id;
      // Persiste protocolo/PIN JÁ, antes de tentar o áudio. O registro existe
      // no servidor a partir daqui; se o upload do áudio falhar em seguida, o
      // cidadão ainda recebe o protocolo REAL (não o "PENDENTE-" temporário) e
      // o retry não recria a manifestação (idempotente por clientId de todo
      // jeito, mas assim nem tenta).
      await db.fila.update(item.clientId, {
        id: manifestacaoId,
        protocolo: resposta.protocolo,
        pin: resposta.pin ?? item.pin ?? undefined,
      });
    }

    if (item.audioBlob && manifestacaoId) {
      const form = new FormData();
      const mime = item.audioMimeType ?? item.audioBlob.type ?? 'audio/webm';
      const extensao = mime.includes('mp4') || mime.includes('mpeg') || mime.includes('aac')
        ? 'mp4'
        : mime.includes('ogg')
          ? 'ogg'
          : mime.includes('wav')
            ? 'wav'
            : 'webm';
      form.append('file', item.audioBlob, `gravacao.${extensao}`);
      // Upload de áudio (até ~25 MB) numa conexão de recepção pode passar
      // do timeout curto de IA - dá folga própria.
      await api.post(`/manifestations/${manifestacaoId}/audio`, form, { timeout: 90_000 });
    }

    await db.fila.update(item.clientId, { status: 'sincronizado', audioBlob: undefined });
  } catch (erro) {
    const atual = await db.fila.get(item.clientId);
    const manifestacaoCriada = Boolean(atual?.id);
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao sincronizar.';

    if (isNetworkError(erro)) {
      // sem rede - volta pra "pendente", tenta de novo na próxima janela de conectividade.
      await db.fila.update(item.clientId, { status: 'pendente', tentativas: item.tentativas + 1 });
    } else if (manifestacaoCriada) {
      // A manifestação JÁ foi registrada no servidor - só um passo seguinte
      // (quase sempre o upload do áudio) falhou. Não é perda do relato;
      // continua tentando o áudio, sem recriar nada.
      await db.fila.update(item.clientId, { status: 'pendente', erro: mensagem, tentativas: item.tentativas + 1 });
    } else {
      // Falhou já na criação e não é rede: payload rejeitado (validação etc.).
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
