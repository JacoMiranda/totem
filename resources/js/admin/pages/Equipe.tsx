import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Cadastro da equipe da conta (só admin). Aqui se define quem entra no
 * rodízio de distribuição automática de manifestações (`recebeAtribuicao`)
 * e se transfere a carga de uma pessoa para outra.
 */
interface Membro {
  id: number;
  name: string;
  email: string;
  role: string;
  unidade: string | null;
  ativo: boolean;
  recebeAtribuicao: boolean;
}

const PAPEIS = ['leitor', 'atendente', 'analista', 'admin'];

export function Equipe() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [novo, setNovo] = useState({ name: '', email: '', senha: '', role: 'analista' });
  const [transfer, setTransfer] = useState({ de: '', para: '' });

  const carregar = () =>
    api
      .get('/users')
      .then(({ data }) => setMembros(data))
      .catch(() => setErro('Não foi possível carregar a equipe.'));

  useEffect(() => {
    void carregar();
  }, []);

  const patch = async (id: number, campo: Partial<Membro> | { senha: string }) => {
    setErro(null);
    try {
      const body: Record<string, unknown> = {};
      if ('role' in campo) body.role = campo.role;
      if ('ativo' in campo) body.ativo = campo.ativo;
      if ('recebeAtribuicao' in campo) body.recebeAtribuicao = campo.recebeAtribuicao;
      if ('unidade' in campo) body.unidade = campo.unidade;
      if ('senha' in campo) body.senha = campo.senha;
      await api.patch(`/users/${id}`, body);
      await carregar();
    } catch (e) {
      setErro((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Não foi possível salvar.');
    }
  };

  const criar = async () => {
    setErro(null);
    try {
      await api.post('/users', { ...novo, recebeAtribuicao: novo.role === 'analista' });
      setNovo({ name: '', email: '', senha: '', role: 'analista' });
      await carregar();
      setAviso('Funcionário cadastrado.');
    } catch (e) {
      setErro(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Não foi possível cadastrar. Confira e-mail e senha (mín. 8 caracteres).',
      );
    }
  };

  const transferir = async () => {
    if (!transfer.de || !transfer.para) return;
    setErro(null);
    try {
      const { data } = await api.post('/users/transferir-carga', {
        de: Number(transfer.de),
        para: Number(transfer.para),
      });
      setAviso(`${data.movidas} manifestação(ões) transferida(s).`);
      setTransfer({ de: '', para: '' });
    } catch (e) {
      setErro((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Não foi possível transferir.');
    }
  };

  const noRodizio = membros.filter((m) => m.ativo && m.recebeAtribuicao);

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Equipe</h1>
        <p className="text-sm text-slate-500">
          Manifestações novas são distribuídas automaticamente, equilibradas pela carga, entre quem está no rodízio
          ({noRodizio.length} {noRodizio.length === 1 ? 'pessoa' : 'pessoas'}). Cada analista vê as suas em
          &ldquo;Minhas&rdquo; na lista de manifestações.
        </p>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}
      {aviso && <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3">{aviso}</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Papel</th>
              <th className="p-3">Unidade</th>
              <th className="p-3 text-center">Rodízio</th>
              <th className="p-3 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {membros.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="p-3">
                  <p className="font-bold text-slate-800">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </td>
                <td className="p-3">
                  <select
                    value={m.role}
                    onChange={(e) => patch(m.id, { role: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs capitalize"
                  >
                    {PAPEIS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    defaultValue={m.unidade ?? ''}
                    onBlur={(e) => e.target.value !== (m.unidade ?? '') && patch(m.id, { unidade: e.target.value })}
                    placeholder="—"
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  />
                </td>
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={m.recebeAtribuicao}
                    onChange={(e) => patch(m.id, { recebeAtribuicao: e.target.checked })}
                  />
                </td>
                <td className="p-3 text-center">
                  <input type="checkbox" checked={m.ativo} onChange={(e) => patch(m.id, { ativo: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-sm font-extrabold text-slate-800">Cadastrar funcionário</h2>
          <input
            placeholder="Nome"
            value={novo.name}
            onChange={(e) => setNovo({ ...novo, name: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            placeholder="E-mail"
            value={novo.email}
            onChange={(e) => setNovo({ ...novo, email: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="password"
            placeholder="Senha (mín. 8)"
            value={novo.senha}
            onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select
            value={novo.role}
            onChange={(e) => setNovo({ ...novo, role: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm capitalize"
          >
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!novo.name.trim() || !novo.email.trim() || novo.senha.length < 8}
            onClick={criar}
            className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-2 disabled:opacity-40"
          >
            Cadastrar
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-sm font-extrabold text-slate-800">Transferir carga</h2>
          <p className="text-xs text-slate-500">Passa TODAS as manifestações em aberto de uma pessoa para outra.</p>
          <select
            value={transfer.de}
            onChange={(e) => setTransfer({ ...transfer, de: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">De…</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={transfer.para}
            onChange={(e) => setTransfer({ ...transfer, para: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Para…</option>
            {membros
              .filter((m) => String(m.id) !== transfer.de)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!transfer.de || !transfer.para}
            onClick={transferir}
            className="rounded-lg bg-slate-900 text-white text-sm font-bold px-4 py-2 disabled:opacity-40"
          >
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
