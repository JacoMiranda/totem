import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Detalhe {
  id: string;
  nome: string;
  slug: string;
  documento: string | null;
  status: string;
  trialExpiraEm: string | null;
  planoId: string | null;
  criadaEm: string | null;
  usuarios: { id: number; name: string; email: string; role: string; ativo: boolean; ultimoLoginEm: string | null }[];
  devices: { id: string; codigo: string; nome: string; unidade: string | null; ativo: boolean; ultimaSyncEm: string | null }[];
}

interface PlanoOpcao {
  id: string;
  nome: string;
  limiteDispositivos: number;
}

export function PlataformaOrg() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<Detalhe | null>(null);
  const [planos, setPlanos] = useState<PlanoOpcao[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [senhaTemp, setSenhaTemp] = useState<{ email: string; senha: string } | null>(null);

  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');

  const carregar = () =>
    api.get(`/plataforma/organizacoes/${id}`).then(({ data }) => {
      setOrg(data);
      setNome(data.nome);
      setDoc(data.documento ?? '');
    });

  useEffect(() => {
    void carregar();
    api.get('/plataforma/planos').then(({ data }) => setPlanos(data));
  }, [id]);

  const salvar = async (patch: Record<string, unknown>) => {
    setMsg(null);
    try {
      const { data } = await api.patch(`/plataforma/organizacoes/${id}`, patch);
      setOrg(data);
      setMsg({ ok: true, texto: 'Salvo.' });
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg({ ok: false, texto: m ?? 'Não foi possível salvar.' });
    }
  };

  const resetarSenha = async () => {
    if (!window.confirm('Redefinir a senha do admin desta conta? A senha atual dele para de funcionar.')) return;
    try {
      const { data } = await api.post(`/plataforma/organizacoes/${id}/resetar-senha-admin`);
      setSenhaTemp({ email: data.email, senha: data.senhaTemporaria });
    } catch {
      setMsg({ ok: false, texto: 'Não foi possível redefinir.' });
    }
  };

  if (!org) return <p className="text-sm text-slate-500">Carregando…</p>;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link to="/plataforma" className="text-sm font-bold text-blue-700">
        ← Contas
      </Link>
      <h1 className="text-2xl font-extrabold text-slate-900">{org.nome}</h1>

      {msg && (
        <p className={`rounded-xl border text-sm p-3 ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {msg.texto}
        </p>
      )}

      {/* cadastro */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase text-slate-500">Cadastro</span>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome.trim() !== org.nome && salvar({ nome: nome.trim() })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          CNPJ / documento
          <input value={doc} onChange={(e) => setDoc(e.target.value)} onBlur={() => doc !== (org.documento ?? '') && salvar({ documento: doc || null })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800" />
        </label>
        <p className="text-[11px] text-slate-400">slug <code>{org.slug}</code> · cadastro {org.criadaEm ? new Date(org.criadaEm).toLocaleDateString('pt-BR') : '—'}</p>
      </div>

      {/* pacote + status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase text-slate-500">Pacote e status</span>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Pacote
            <select value={org.planoId ?? ''} onChange={(e) => salvar({ planoId: e.target.value || null })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800">
              <option value="">— sem pacote —</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.limiteDispositivos} totens)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Status
            <select value={org.status} onChange={(e) => salvar({ status: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800">
              <option value="ativa">Ativa</option>
              <option value="trial">Trial</option>
              <option value="suspensa">Suspensa (totens param)</option>
            </select>
          </label>
        </div>
        {org.status === 'trial' && (
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Trial expira em
            <input
              type="date"
              value={org.trialExpiraEm ? org.trialExpiraEm.slice(0, 10) : ''}
              onChange={(e) => salvar({ trialExpiraEm: e.target.value || null })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 self-start"
            />
          </label>
        )}
      </div>

      {/* usuários */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-500">Usuários ({org.usuarios.length})</span>
          <button type="button" onClick={resetarSenha} className="text-xs font-bold text-blue-700 underline">
            Redefinir senha do admin
          </button>
        </div>
        {senhaTemp && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
            Senha temporária de <b>{senhaTemp.email}</b>: <code className="font-bold select-all">{senhaTemp.senha}</code>
            <br />
            <span className="text-xs">Passe pro cliente por um canal seguro. Não será mostrada de novo.</span>
          </p>
        )}
        <ul className="flex flex-col gap-1 text-sm">
          {org.usuarios.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 text-slate-700">
              <span className="font-semibold">{u.name}</span>
              <span className="text-slate-400">{u.email}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">{u.role}</span>
              {!u.ativo && <span className="text-[11px] text-rose-600">inativo</span>}
              <span className="text-[11px] text-slate-400 ml-auto">
                {u.ultimoLoginEm ? `entrou ${new Date(u.ultimoLoginEm).toLocaleDateString('pt-BR')}` : 'nunca entrou'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* totens */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-2">
        <span className="text-xs font-bold uppercase text-slate-500">Totens ({org.devices.length})</span>
        <ul className="flex flex-col gap-1 text-sm">
          {org.devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-slate-700">
              <code className="font-bold">{d.codigo}</code>
              <span className="text-slate-400">{d.unidade ?? d.nome}</span>
              {!d.ativo && <span className="text-[11px] text-rose-600">inativo</span>}
              <span className="text-[11px] text-slate-400 ml-auto">
                {d.ultimaSyncEm ? `sync ${new Date(d.ultimaSyncEm).toLocaleString('pt-BR')}` : 'sem sync'}
              </span>
            </li>
          ))}
          {org.devices.length === 0 && <li className="text-slate-400">Nenhum totem.</li>}
        </ul>
      </div>
    </div>
  );
}
