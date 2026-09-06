import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/authStore';

/**
 * Perfil da própria pessoa: editar o nome e trocar a senha (exige a senha
 * atual). E-mail e papel não se mexem aqui — papel é o admin em Equipe.
 */
export function Perfil() {
  const { user, atualizarUsuario } = useAuthStore();
  const [nome, setNome] = useState(user?.name ?? '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvarNome = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      const { data } = await api.patch('/auth/me', { name: nome.trim() });
      atualizarUsuario(data);
      setMsg({ tipo: 'ok', texto: 'Nome atualizado.' });
    } catch {
      setMsg({ tipo: 'erro', texto: 'Não foi possível salvar o nome.' });
    } finally {
      setSalvando(false);
    }
  };

  const trocarSenha = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await api.patch('/auth/me', { senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setMsg({ tipo: 'ok', texto: 'Senha alterada.' });
    } catch (e) {
      const erros = (e as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors;
      setMsg({ tipo: 'erro', texto: erros?.senhaAtual?.[0] ?? erros?.novaSenha?.[0] ?? 'Não foi possível trocar a senha.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Meu perfil</h1>
        <p className="text-sm text-slate-500">
          {user?.email} · <span className="uppercase text-xs font-bold">{user?.role}</span>
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-xl border text-sm p-3 ${
            msg.tipo === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {msg.texto}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-slate-500">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={salvando || !nome.trim() || nome.trim() === user?.name}
          onClick={salvarNome}
          className="self-start rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-2 disabled:opacity-40"
        >
          Salvar nome
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase text-slate-500">Trocar senha</span>
        <input
          type="password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          placeholder="Senha atual"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Nova senha (mín. 8)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={salvando || !senhaAtual || novaSenha.length < 8}
          onClick={trocarSenha}
          className="self-start rounded-lg bg-slate-900 text-white text-sm font-bold px-4 py-2 disabled:opacity-40"
        >
          Trocar senha
        </button>
      </div>
    </div>
  );
}
