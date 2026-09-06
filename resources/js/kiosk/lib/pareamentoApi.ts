import axios from 'axios';
import { IA_TIMEOUT_MS } from './ia';

/**
 * Cliente HTTP do PAREAMENTO (tela de login do totem) - separado do `api`
 * do atendimento porque usa credenciais da EQUIPE (bearer do Sanctum), não
 * a device key.
 *
 * O token de equipe vive só em memória e é descartado assim que o totem é
 * pareado: um totem é uma máquina pública, deixar credencial de
 * funcionário no localStorage seria entregar o painel a quem passar na
 * frente. O que fica gravado é apenas a device key (escopo restrito:
 * criar manifestação + invocar IA).
 */
const pareamento = axios.create({ baseURL: '/api/v1', timeout: IA_TIMEOUT_MS });

let token: string | null = null;

pareamento.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

export interface UsuarioPareamento {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DevicePareavel {
  id: string;
  codigo: string;
  nome: string;
  unidade: string | null;
  ativo: boolean;
  ultimaSyncEm: string | null;
}

export async function entrar(email: string, senha: string): Promise<UsuarioPareamento> {
  const { data } = await pareamento.post('/auth/login', { email, senha });
  token = data.accessToken;

  return data.user as UsuarioPareamento;
}

export async function listarDevicesPareaveis(): Promise<DevicePareavel[]> {
  const { data } = await pareamento.get('/devices/pareaveis');

  return data as DevicePareavel[];
}

export async function parearDevice(id: string): Promise<{ codigo: string; nome: string; deviceKey: string }> {
  const { data } = await pareamento.post(`/devices/${id}/pair`);

  return data;
}

/** Invalida o token de equipe no servidor e esquece na memória. */
export async function sairPareamento(): Promise<void> {
  try {
    if (token) await pareamento.post('/auth/logout');
  } catch {
    /* não bloqueia o pareamento se o logout falhar */
  } finally {
    token = null;
  }
}

/** Mensagem legível de um erro de pareamento. */
export function mensagemErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    if (!erro.response) return 'Sem conexão com o servidor. Verifique a rede do totem.';
    const data = erro.response.data as
      | { message?: string; errors?: Record<string, string[]>; error?: { message?: string } }
      | undefined;

    return (
      data?.error?.message ??
      Object.values(data?.errors ?? {})[0]?.[0] ??
      data?.message ??
      padrao
    );
  }

  return padrao;
}
