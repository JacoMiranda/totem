import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, MANIFESTATION_STATUSES, SENTIMENTS, URGENCIES, getSentimentEmoji, getUrgencyBadgeClass } from '../../shared';
import { api } from '../lib/api';
import { temPapelMinimo, useAuthStore } from '../lib/authStore';

interface ManifestacaoResumo {
  id: string;
  protocolo: string;
  canal: string;
  sentimento: string | null;
  categoria: string | null;
  urgencia: string;
  status: string;
  resumo: string | null;
  keywords: string[] | null;
  responsavel: { id: number; name: string } | null;
  criadoEm: string;
}

const PAGE_SIZE = 25;

export function ManifestationsList() {
  const { user } = useAuthStore();
  const podeVerTudo = temPapelMinimo(user?.role, 'admin');
  const [dados, setDados] = useState<ManifestacaoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  // Analista/atendente começam vendo só as suas; admin/leitor veem todas.
  const [minhas, setMinhas] = useState(() => temPapelMinimo(user?.role, 'atendente') && !podeVerTudo);
  const [filtros, setFiltros] = useState({ status: '', categoria: '', sentimento: '', urgencia: '', q: '', responsavelId: '' });
  const [equipe, setEquipe] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (podeVerTudo) api.get('/users').then(({ data }) => setEquipe(data)).catch(() => {});
  }, [podeVerTudo]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    const params: Record<string, string | number> = { page: pagina, pageSize: PAGE_SIZE };
    if (minhas) params.minhas = 1;
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    api
      .get('/manifestations', { params })
      .then(({ data }) => {
        if (cancelado) return;
        setDados(data.data);
        setTotal(data.meta.total);
      })
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [pagina, filtros, minhas]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const atualizarFiltro = (campo: keyof typeof filtros, valor: string) => {
    setPagina(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-900">Manifestações</h1>
        {temPapelMinimo(user?.role, 'atendente') && (
          <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm font-bold">
            <button
              type="button"
              onClick={() => { setPagina(1); setMinhas(true); }}
              className={`px-4 py-1.5 ${minhas ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              Minhas
            </button>
            <button
              type="button"
              onClick={() => { setPagina(1); setMinhas(false); }}
              className={`px-4 py-1.5 ${!minhas ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              Todas
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
        {podeVerTudo && !minhas && (
          <select
            value={filtros.responsavelId}
            onChange={(e) => atualizarFiltro('responsavelId', e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Responsável: todos</option>
            <option value="sem">— sem responsável —</option>
            {equipe.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <input
          placeholder="Buscar em transcrição/resumo…"
          value={filtros.q}
          onChange={(e) => atualizarFiltro('q', e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm flex-1 min-w-48"
        />
        <select
          value={filtros.status}
          onChange={(e) => atualizarFiltro('status', e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Status: todos</option>
          {MANIFESTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filtros.categoria}
          onChange={(e) => atualizarFiltro('categoria', e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Teor: todos</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtros.sentimento}
          onChange={(e) => atualizarFiltro('sentimento', e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Sentimento: todos</option>
          {SENTIMENTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filtros.urgencia}
          onChange={(e) => atualizarFiltro('urgencia', e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">Urgência: todas</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="p-3">Protocolo</th>
              <th className="p-3">Resumo</th>
              <th className="p-3">Sentimento</th>
              <th className="p-3">Teor</th>
              <th className="p-3">Urgência</th>
              <th className="p-3">Status</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Recebida em</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="p-3">
                  <Link to={`/manifestacoes/${m.id}`} className="font-mono font-bold text-blue-700">
                    {m.protocolo}
                  </Link>
                </td>
                <td className="p-3 max-w-xs truncate">{m.resumo ?? '—'}</td>
                <td className="p-3">
                  {getSentimentEmoji(m.sentimento ?? undefined)} {m.sentimento ?? '—'}
                </td>
                <td className="p-3">{m.categoria ?? '—'}</td>
                <td className="p-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${getUrgencyBadgeClass(m.urgencia)}`}>
                    {m.urgencia}
                  </span>
                </td>
                <td className="p-3">{m.status}</td>
                <td className="p-3 text-xs text-slate-600">{m.responsavel?.name ?? <span className="text-amber-600">—</span>}</td>
                <td className="p-3 text-xs text-slate-500">{new Date(m.criadoEm).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
            {!carregando && dados.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  Nenhuma manifestação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{total} manifestações no total</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
