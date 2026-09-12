import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { temPapelMinimo, useAuthStore } from '../lib/authStore';

export function Layout({ children }: { children: ReactNode }) {
  const { user, encerrarSessao } = useAuthStore();
  const navigate = useNavigate();

  const sair = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // segue o logout local mesmo se a chamada falhar (token já pode estar expirado).
    }
    encerrarSessao();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-bold ${isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* href (não NavLink): a home é outra SPA (/), fora do router do /admin. */}
          <a href="/" className="flex items-center gap-2 font-extrabold text-slate-900 hover:text-blue-700" title="Ir para a página inicial">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-slate-900">
              <img src="/midia/simbolo-prinatus.png" alt="Prinatus" className="h-5 w-5" />
            </span>
            Ouvidoria Cidadã
          </a>
          <nav className="flex gap-1">
            <NavLink to="/manifestacoes" className={linkClass}>
              Manifestações
            </NavLink>
            {/* Relatórios exige analista+ no backend (Gate ver-relatorios);
                esconder aqui é só UX - a autorização real é lá. */}
            {temPapelMinimo(user?.role, 'analista') && (
              <NavLink to="/relatorios" className={linkClass}>
                Relatórios
              </NavLink>
            )}
            {temPapelMinimo(user?.role, 'admin') && (
              <NavLink to="/equipe" className={linkClass}>
                Equipe
              </NavLink>
            )}
            {temPapelMinimo(user?.role, 'admin') && (
              <NavLink to="/dispositivos" className={linkClass}>
                Dispositivos
              </NavLink>
            )}
            {temPapelMinimo(user?.role, 'admin') && (
              <NavLink to="/mural" className={linkClass}>
                Mural
              </NavLink>
            )}
            {temPapelMinimo(user?.role, 'admin') && (
              <NavLink to="/pulso" className={linkClass}>
                s-Totem
              </NavLink>
            )}
            {temPapelMinimo(user?.role, 'admin') && (
              <NavLink to="/logs" className={linkClass}>
                Logs
              </NavLink>
            )}
            <NavLink to="/ajuda" className={linkClass}>
              Ajuda
            </NavLink>
            {user?.plataforma && (
              <NavLink to="/plataforma" className={linkClass}>
                Plataforma
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <NavLink to="/perfil" className="text-slate-600 hover:text-slate-900 font-semibold">
            {user?.name} · <span className="uppercase text-xs font-bold">{user?.role}</span>
          </NavLink>
          <button type="button" onClick={sair} className="text-rose-600 font-bold text-xs">
            Sair
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
