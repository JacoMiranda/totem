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
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  definirSessao: (token: string, user: AdminUser) => void;
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
  encerrarSessao: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
