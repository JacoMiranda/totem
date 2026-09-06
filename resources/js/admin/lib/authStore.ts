import { create } from 'zustand';

/**
 * RBAC do painel - espelha App\Enums\UserRole::atende() do backend
 * (leitor < atendente < analista < admin). A checagem AQUI é só de UX
 * (esconder botões que dariam 403) - a autorização de verdade é sempre a
 * do backend (Gates em AppServiceProvider), nunca confiar só nisto.
 */
const NIVEL: Record<string, number> = { leitor: 0, atendente: 1, analista: 2, admin: 3 };

export function temPapelMinimo(role: string | undefined, minimo: string): boolean {
  if (!role) return false;

  return (NIVEL[role] ?? -1) >= (NIVEL[minimo] ?? 99);
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  unidade: string | null;
  plataforma?: boolean;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  definirSessao: (token: string, user: AdminUser) => void;
  atualizarUsuario: (user: AdminUser) => void;
  encerrarSessao: () => void;
}

const STORAGE_KEY = 'totem:admin-session';

function lerSessaoPersistida(): { token: string | null; user: AdminUser | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };

    return JSON.parse(raw);
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...lerSessaoPersistida(),
  definirSessao: (token, user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  atualizarUsuario: (user) =>
    set((s) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: s.token, user }));

      return { user };
    }),
  encerrarSessao: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));

/**
 * Mantém a sessão em sincronia com o localStorage:
 *
 *  - `storage`: outra aba fez logout (removeu a chave) -> esta aba também sai.
 *  - `pageshow` com `persisted`: a página voltou do bfcache do navegador
 *    (seta voltar/avançar) com o estado JS congelado. Se o localStorage já
 *    não tem sessão, o token em memória está obsoleto - limpa e o
 *    ProtectedRoute manda pro login.
 *  - `visibilitychange`: a aba ficou visível de novo depois de um logout
 *    em outra aba, sem navegação nenhuma.
 */
if (typeof window !== 'undefined') {
  const revalidar = () => {
    const persistida = lerSessaoPersistida();
    if (!persistida.token && useAuthStore.getState().token) {
      useAuthStore.setState({ token: null, user: null });
    }
  };

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) revalidar();
  });
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) revalidar();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revalidar();
  });
}
