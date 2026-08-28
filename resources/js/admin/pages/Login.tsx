import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/authStore';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const definirSessao = useAuthStore((s) => s.definirSessao);
  const navigate = useNavigate();

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      definirSessao(data.accessToken, data.user);
      navigate('/manifestacoes', { replace: true });
    } catch {
      setErro('E-mail ou senha inválidos.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl flex flex-col gap-4">
        <h1 className="text-xl font-extrabold text-slate-900">Ouvidoria Cidadã — Painel</h1>

        <label className="text-xs font-bold text-slate-600 uppercase">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-xs font-bold text-slate-600 uppercase">
          Senha
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {erro && <p className="text-xs text-rose-600">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
