import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * Back-office da plataforma (só time comercial/suporte — usuário sem
 * organização). Duas abas: Contas (clientes) e Pacotes.
 */
interface OrgLinha {
  id: string;
  nome: string;
  slug: string;
  documento: string | null;
  status: string;
  operante: boolean;
  trialExpiraEm: string | null;
  plano: { id: string; nome: string; slug: string; limite_dispositivos: number } | null;
  totens: number;
  manifestacoes: number;
  usuarios: number;
  criadaEm: string | null;
}

interface PlanoLinha {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  limiteDispositivos: number;
  precoCentavos: number | null;
  precoFormatado: string | null;
  trialDias: number;
  ativo: boolean;
  recursos: string[];
  contas: number;
}

const STATUS_COR: Record<string, string> = {
  ativa: 'bg-emerald-100 text-emerald-800',
  trial: 'bg-blue-100 text-blue-800',
  suspensa: 'bg-rose-100 text-rose-800',
};

export function Plataforma() {
  const [aba, setAba] = useState<'contas' | 'pacotes'>('contas');
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Plataforma</h1>
        <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm font-bold">
          {(['contas', 'pacotes'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAba(v)}
              className={`px-4 py-1.5 capitalize ${aba === v ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {aba === 'contas' ? <Contas /> : <Pacotes />}
    </div>
  );
}

function Contas() {
  const [orgs, setOrgs] = useState<OrgLinha[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    const t = setTimeout(() => {
      api
        .get('/plataforma/organizacoes', { params })
        .then(({ data }) => setOrgs(data))
        .finally(() => setCarregando(false));
    }, 250);

    return () => clearTimeout(t);
  }, [q, status]);

  return (
    <>
      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CNPJ ou slug…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm flex-1 min-w-48"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Status: todos</option>
          <option value="ativa">Ativa</option>
          <option value="trial">Trial</option>
          <option value="suspensa">Suspensa</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Pacote</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Totens</th>
              <th className="p-3 text-center">Manif.</th>
              <th className="p-3">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/plataforma/${o.id}`} className="font-bold text-blue-700">
                    {o.nome}
                  </Link>
                  <p className="text-xs text-slate-400">{o.documento ?? o.slug}</p>
                </td>
                <td className="p-3">
                  {o.plano ? `${o.plano.nome} · ${o.plano.limite_dispositivos} totens` : <span className="text-amber-600">sem pacote</span>}
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COR[o.status] ?? 'bg-slate-100'}`}>
                    {o.status}
                  </span>
                  {o.status === 'trial' && o.trialExpiraEm && (
                    <span className="ml-1 text-[11px] text-slate-400">até {new Date(o.trialExpiraEm).toLocaleDateString('pt-BR')}</span>
                  )}
                </td>
                <td className="p-3 text-center tabular-nums">
                  {o.totens}
                  {o.plano ? <span className="text-slate-400">/{o.plano.limite_dispositivos}</span> : null}
                </td>
                <td className="p-3 text-center tabular-nums">{o.manifestacoes}</td>
                <td className="p-3 text-xs text-slate-500">{o.criadaEm ? new Date(o.criadaEm).toLocaleDateString('pt-BR') : '—'}</td>
              </tr>
            ))}
            {!carregando && orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{orgs.length} contas</p>
    </>
  );
}

function Pacotes() {
  const [planos, setPlanos] = useState<PlanoLinha[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = () => api.get('/plataforma/planos').then(({ data }) => setPlanos(data));
  useEffect(() => {
    void carregar();
  }, []);

  const salvar = async (id: string, patch: Partial<PlanoLinha>) => {
    setMsg(null);
    try {
      const body: Record<string, unknown> = {};
      if (patch.nome !== undefined) body.nome = patch.nome;
      if (patch.descricao !== undefined) body.descricao = patch.descricao;
      if (patch.limiteDispositivos !== undefined) body.limiteDispositivos = patch.limiteDispositivos;
      if (patch.precoCentavos !== undefined) body.precoCentavos = patch.precoCentavos;
      if (patch.trialDias !== undefined) body.trialDias = patch.trialDias;
      if (patch.ativo !== undefined) body.ativo = patch.ativo;
      if (patch.recursos !== undefined) body.recursos = patch.recursos;
      await api.patch(`/plataforma/planos/${id}`, body);
      await carregar();
      setMsg('Pacote atualizado.');
    } catch {
      setMsg('Não foi possível salvar.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {msg && <p className="rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm p-3">{msg}</p>}
      {planos.map((p) => (
        <PacoteCard key={p.id} plano={p} onSalvar={(patch) => salvar(p.id, patch)} />
      ))}
    </div>
  );
}

function PacoteCard({ plano, onSalvar }: { plano: PlanoLinha; onSalvar: (p: Partial<PlanoLinha>) => void }) {
  const [nome, setNome] = useState(plano.nome);
  const [limite, setLimite] = useState(String(plano.limiteDispositivos));
  const [preco, setPreco] = useState(plano.precoCentavos != null ? String(plano.precoCentavos / 100) : '');
  const [trial, setTrial] = useState(String(plano.trialDias));
  const [recursos, setRecursos] = useState(plano.recursos.join('\n'));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="text-lg font-extrabold text-slate-900 border-b border-transparent focus:border-slate-300 outline-none" />
        <span className="text-xs text-slate-400">{plano.contas} {plano.contas === 1 ? 'conta usa' : 'contas usam'}</span>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
          Limite de totens
          <input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
          Preço (R$/mês) — vazio = sob consulta
          <input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
          Dias de trial
          <input type="number" value={trial} onChange={(e) => setTrial(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-normal" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
        Recursos (um por linha — aparecem na home)
        <textarea value={recursos} onChange={(e) => setRecursos(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal min-h-24" />
      </label>
      <button
        type="button"
        onClick={() =>
          onSalvar({
            nome: nome.trim(),
            limiteDispositivos: Number(limite),
            precoCentavos: preco.trim() === '' ? null : Math.round(Number(preco) * 100),
            trialDias: Number(trial),
            recursos: recursos.split('\n').map((r) => r.trim()).filter(Boolean),
          })
        }
        className="self-start rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-2"
      >
        Salvar pacote
      </button>
    </div>
  );
}
