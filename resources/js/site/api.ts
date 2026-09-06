import axios from 'axios';

/** Cliente da home: só endpoints públicos (catálogo de planos e cadastro). */
const api = axios.create({ baseURL: '/api/v1', timeout: 20_000 });

export interface Plano {
  slug: string;
  nome: string;
  descricao: string | null;
  limiteDispositivos: number;
  precoCentavos: number | null;
  precoFormatado: string | null;
  trialDias: number;
  recursos: string[];
}

export interface DeviceCriado {
  id: string;
  codigo: string;
  nome: string;
  unidade: string | null;
}

export interface RespostaCadastro {
  accessToken: string;
  // `users` usa id auto-incremento (não UUID como as demais tabelas).
  user: { id: number; name: string; email: string; role: string };
  organizacao: {
    id: string;
    nome: string;
    slug: string;
    status: string;
    trialExpiraEm: string | null;
    plano: { slug: string; nome: string; limiteDispositivos: number };
  };
  devices: DeviceCriado[];
}

export async function carregarPlanos(): Promise<Plano[]> {
  const { data } = await api.get('/planos');

  return data as Plano[];
}

export interface DadosCadastro {
  empresa: string;
  documento?: string;
  responsavel: string;
  email: string;
  senha: string;
  planoSlug: string;
  locais: string[];
}

export async function cadastrar(dados: DadosCadastro): Promise<RespostaCadastro> {
  const { data } = await api.post('/auth/register', dados);

  return data as RespostaCadastro;
}

/**
 * Entrega a sessão recém-criada ao painel (`/admin`), que lê esta mesma
 * chave do localStorage. Mesma origem, então o handoff é direto e o cliente
 * não precisa digitar a senha de novo logo após criá-la.
 */
export function entregarSessaoAoPainel(resposta: RespostaCadastro): void {
  try {
    localStorage.setItem(
      'totem:admin-session',
      JSON.stringify({ token: resposta.accessToken, user: resposta.user }),
    );
  } catch {
    // Se o navegador bloquear o storage, o cliente só faz login normalmente.
  }
}

/** Extrai a mensagem útil de um erro de validação/rede da API. */
export function mensagemErro(erro: unknown, padrao: string): string {
  if (axios.isAxiosError(erro)) {
    if (!erro.response) return 'Sem conexão com o servidor. Tente novamente.';
    if (erro.response.status === 429) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';

    const data = erro.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;

    return Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message ?? padrao;
  }

  return padrao;
}
