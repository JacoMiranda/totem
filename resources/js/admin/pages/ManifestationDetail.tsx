import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CATEGORIES, MANIFESTATION_STATUSES, SENTIMENTS, URGENCIES, getSentimentEmoji, getUrgencyBadgeClass } from '../../shared';
import { api } from '../lib/api';
import { temPapelMinimo, useAuthStore } from '../lib/authStore';

interface Detalhe {
  id: string;
  protocolo: string;
  canal: string;
  sentimento: string | null;
  categoria: string | null;
  urgencia: string;
  status: string;
  resumo: string | null;
  keywords: string[] | null;
  criadoEm: string;
  transcricao: string | null;
  device: { id: string; codigo: string; nome: string } | null;
  responsavel: { id: number; name: string } | null;
  respostaOficial: string | null;
  respostaPublicadaEm: string | null;
  temAudio: boolean;
  linhaDoTempo: { deStatus: string | null; paraStatus: string; autor: string | null; motivo: string | null; em: string }[];
  notas: { id: string; texto: string; autor: string; em: string }[];
}

export function ManifestationDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [dado, setDado] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const [novoStatus, setNovoStatus] = useState('');
  const [motivo, setMotivo] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [equipe, setEquipe] = useState<{ id: number; name: string; recebeAtribuicao: boolean; ativo: boolean }[]>([]);
  const [novaNota, setNovaNota] = useState('');
  const [respostaTexto, setRespostaTexto] = useState('');
  const [publicarResposta, setPublicarResposta] = useState(false);

  const recarregar = () => {
    setCarregando(true);
    api
      .get(`/manifestations/${id}`)
      .then(({ data }) => {
        setDado(data);
        setNovoStatus(data.status);
        setRespostaTexto(data.respostaOficial ?? '');
      })
      .finally(() => setCarregando(false));
  };

  useEffect(recarregar, [id]);

  useEffect(() => {
    if (temPapelMinimo(user?.role, 'analista')) {
      api.get('/users').then(({ data }) => setEquipe(data)).catch(() => {});
    }
  }, [user?.role]);

  const executar = async (acao: () => Promise<unknown>, mensagemSucesso: string) => {
    setAviso(null);
    try {
      await acao();
      setAviso(mensagemSucesso);
      recarregar();
    } catch {
      setAviso('Não foi possível concluir a ação.');
    }
  };

  const baixarAudio = async () => {
    const resposta = await api.get(`/manifestations/${id}/audio`, { responseType: 'blob' });
    const url = URL.createObjectURL(resposta.data);
    window.open(url, '_blank');
  };

  if (carregando) return <p className="text-slate-500">Carregando…</p>;
  if (!dado) return <p className="text-rose-600">Manifestação não encontrada.</p>;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900 font-mono">{dado.protocolo}</h1>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getUrgencyBadgeClass(dado.urgencia)}`}>
          {dado.urgencia}
        </span>
      </div>

      {aviso && <p className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-2">{aviso}</p>}

      <div className="grid grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase text-slate-500">Relato</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{dado.transcricao ?? '(sem transcrição)'}</p>
          {dado.keywords && dado.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dado.keywords.map((k) => (
                <span key={k} className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg">
                  #{k}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Canal: {dado.canal} · Recebida em {new Date(dado.criadoEm).toLocaleString('pt-BR')}
            {dado.device && ` · ${dado.device.nome}`}
          </p>
          {dado.temAudio && temPapelMinimo(user?.role, 'analista') && (
            <button type="button" onClick={baixarAudio} className="self-start text-sm text-blue-700 underline">
              🎧 Ouvir áudio original
            </button>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase text-slate-500">Classificação</h2>
          <p className="text-sm">
            {getSentimentEmoji(dado.sentimento ?? undefined)} {dado.sentimento ?? '—'} · {dado.categoria ?? '—'}
          </p>
          <p className="text-sm">Status atual: <strong>{dado.status}</strong></p>
          <p className="text-sm">Responsável: {dado.responsavel?.name ?? 'não atribuído'}</p>

          {temPapelMinimo(user?.role, 'analista') && (
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 mt-1">
              <label className="text-xs font-bold text-slate-500">Reclassificar</label>
              <div className="flex gap-2 flex-wrap">
                <select
                  defaultValue=""
                  onChange={(e) =>
                    e.target.value &&
                    executar(() => api.patch(`/manifestations/${id}/classify`, { sentimento: e.target.value }), 'Sentimento atualizado.')
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">sentimento…</option>
                  {SENTIMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue=""
                  onChange={(e) =>
                    e.target.value &&
                    executar(() => api.patch(`/manifestations/${id}/classify`, { categoria: e.target.value }), 'Teor atualizado.')
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">teor…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  defaultValue=""
                  onChange={(e) =>
                    e.target.value &&
                    executar(() => api.patch(`/manifestations/${id}/classify`, { urgencia: e.target.value }), 'Urgência atualizada.')
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">urgência…</option>
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <label className="text-xs font-bold text-slate-500 mt-1">Atribuir responsável</label>
              <div className="flex gap-2">
                <select
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs flex-1"
                >
                  <option value="">escolher…</option>
                  {equipe
                    .filter((m) => m.ativo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.recebeAtribuicao ? '' : ' (fora do rodízio)'}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!responsavelId}
                  onClick={() => executar(() => api.patch(`/manifestations/${id}/assign`, { responsavelId }), 'Responsável atribuído.')}
                  className="rounded-lg bg-blue-600 text-white text-xs font-bold px-3 py-1 disabled:opacity-40"
                >
                  Atribuir
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {temPapelMinimo(user?.role, 'atendente') && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase text-slate-500">Mudar status</h2>
          <div className="flex gap-2 flex-wrap">
            <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
              {MANIFESTATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (opcional)"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => executar(() => api.patch(`/manifestations/${id}/status`, { status: novoStatus, motivo: motivo || undefined }), 'Status atualizado.')}
              className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1"
            >
              Salvar
            </button>
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase text-slate-500">Linha do tempo</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {dado.linhaDoTempo.map((h, i) => (
            <li key={i} className="text-slate-600">
              <span className="font-bold">{h.paraStatus}</span>
              {h.deStatus && <span className="text-slate-400"> (de {h.deStatus})</span>} — {new Date(h.em).toLocaleString('pt-BR')}
              {h.autor && ` · ${h.autor}`}
              {h.motivo && <span className="italic"> — {h.motivo}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase text-slate-500">Notas internas</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {dado.notas.map((n) => (
            <li key={n.id} className="bg-slate-50 rounded-lg p-2">
              <p>{n.texto}</p>
              <p className="text-xs text-slate-400">
                {n.autor} · {new Date(n.em).toLocaleString('pt-BR')}
              </p>
            </li>
          ))}
          {dado.notas.length === 0 && <li className="text-slate-400">Sem notas.</li>}
        </ul>

        {temPapelMinimo(user?.role, 'atendente') && (
          <div className="flex gap-2 mt-1">
            <input
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
              placeholder="Nova nota interna…"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm flex-1"
            />
            <button
              type="button"
              disabled={!novaNota.trim()}
              onClick={() =>
                executar(async () => {
                  await api.post(`/manifestations/${id}/notes`, { texto: novaNota });
                  setNovaNota('');
                }, 'Nota adicionada.')
              }
              className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1 disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        )}
      </section>

      {temPapelMinimo(user?.role, 'analista') && (
        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase text-slate-500">Resposta oficial</h2>
          <textarea
            value={respostaTexto}
            onChange={(e) => setRespostaTexto(e.target.value)}
            className="rounded-lg border border-slate-300 p-2 text-sm min-h-24"
            placeholder="Resposta ao cidadão…"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={publicarResposta} onChange={(e) => setPublicarResposta(e.target.checked)} />
            Publicar (fica visível na consulta pública por protocolo + PIN)
          </label>
          <button
            type="button"
            disabled={!respostaTexto.trim()}
            onClick={() =>
              executar(
                () => api.post(`/manifestations/${id}/resposta`, { texto: respostaTexto, publicar: publicarResposta }),
                publicarResposta ? 'Resposta publicada.' : 'Resposta salva (não publicada).',
              )
            }
            className="self-start rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-40"
          >
            Salvar resposta
          </button>
        </section>
      )}
    </div>
  );
}
