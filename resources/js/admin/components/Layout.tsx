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
          <span className="font-extrabold text-slate-900">Ouvidoria Cidadã</span>
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
              <NavLink to="/logs" className={linkClass}>
                Logs
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            {user?.name} · <span className="uppercase text-xs font-bold">{user?.role}</span>
          </span>
          <button type="button" onClick={sair} className="text-rose-600 font-bold text-xs">
            Sair
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
