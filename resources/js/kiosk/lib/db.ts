import Dexie, { type EntityTable } from 'dexie';
import type { SyncStatus } from '../../shared';

/**
 * Fila local de manifestações pendentes de sincronização (IndexedDB via
 * Dexie) - existe pra que a jornada do cidadão NUNCA dependa da rede estar
 * disponível no momento exato do envio (requisito central do totem
 * offline-first, ver docs/ARQUITETURA.md). `clientId` é a chave de
 * idempotência - reenviar o mesmo registro (retry após queda de conexão)
 * nunca cria uma manifestação duplicada no servidor (ver
 * ManifestationController::store).
 */
export interface FilaManifestacao {
  clientId: string;
  payload: Record<string, unknown>;
  audioBlob?: Blob;
  audioMimeType?: string;
  status: SyncStatus;
  id?: string; // uuid da manifestação, só depois de criada no servidor - necessário pro upload do áudio
  protocolo?: string;
  pin?: string;
  erro?: string;
  criadoEm: string;
  tentativas: number;
}

const db = new Dexie('totem-kiosk') as Dexie & {
  fila: EntityTable<FilaManifestacao, 'clientId'>;
};

db.version(1).stores({
  fila: 'clientId, status, criadoEm',
});

export default db;
