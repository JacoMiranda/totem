import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Configuração do mural público de transparência (docs/MURAL-PUBLICO.md).
 * Só admin (Gate `gerenciar-mural`). Liga/desliga, edita o título e entrega
 * o link (com token secreto) pra colocar numa TV na recepção.
 */
interface Config {
  ativo: boolean;
  titulo: string | null;
  tituloEfetivo: string;
  tema: 'claro' | 'escuro';
  token: string | null;
  url: string | null;
}

export function Mural() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [titulo, setTitulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = () =>
    api
      .get('/mural')
      .then(({ data }) => {
        setCfg(data);
        setTitulo(data.titulo ?? '');
      })
      .catch(() => setErro('Não foi possível carregar a configuração do mural.'));

  useEffect(() => {
    void carregar();
  }, []);

  const salvar = async (patch: { ativo?: boolean; tema?: 'claro' | 'escuro' }) => {
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.patch('/mural', {
        ativo: patch.ativo ?? cfg?.ativo ?? false,
        titulo: titulo.trim() || null,
        ...(patch.tema ? { tema: patch.tema } : {}),
      });
      setCfg(data);
    } catch {
      setErro('Não foi possível salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const regenerar = async () => {
    if (!window.confirm('Gerar um link novo? O link atual para de funcionar imediatamente.')) return;
    setSalvando(true);
    try {
      const { data } = await api.post('/mural/token');
      setCfg(data);
    } finally {
      setSalvando(false);
    }
  };

  const copiar = async () => {
    if (!cfg?.url) return;
    await navigator.clipboard.writeText(cfg.url);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1500);
  };

  if (!cfg) {
    return <p className="text-sm text-slate-500">{erro ?? 'Carregando…'}</p>;
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Mural de transparência</h1>
        <p className="text-sm text-slate-500">
          Uma tela pública, sem login, pra colocar numa TV na recepção. Mostra ao seu cliente o quanto a
          ouvidoria responde e resolve — percentuais e tempo de resposta, nunca o volume de reclamações nem
          denúncias.
        </p>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-900">{cfg.ativo ? 'Mural ativo' : 'Mural desativado'}</p>
          <p className="text-sm text-slate-500">
            {cfg.ativo ? 'O link abaixo está no ar.' : 'Ative para gerar o link público.'}
          </p>
        </div>
        <button
          type="button"
          disabled={salvando}
          onClick={() => salvar({ ativo: !cfg.ativo })}
          className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
            cfg.ativo ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {cfg.ativo ? 'Desativar' : 'Ativar'}
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase text-slate-500">Título na tela</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={() => cfg.ativo && salvar({})}
          placeholder={cfg.tituloEfetivo}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="text-[11px] text-slate-400">Em branco usa “{cfg.tituloEfetivo}”.</span>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase text-slate-500">Aparência</span>
        <div className="flex gap-2">
          {(['claro', 'escuro'] as const).map((tm) => (
            <button
              key={tm}
              type="button"
              onClick={() => salvar({ tema: tm })}
              className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-bold capitalize ${
                cfg.tema === tm ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'
              }`}
            >
              {tm === 'claro' ? '☀️ Claro' : '🌙 Escuro'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">Escuro combina com TVs em ambiente com pouca luz.</span>
      </div>

      {cfg.url && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-slate-500">Link do mural</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
              {cfg.url}
            </code>
            <button type="button" onClick={copiar} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-bold">
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            <a
              href={cfg.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
            >
              Abrir
            </a>
          </div>
          <p className="text-[11px] text-slate-500">
            Qualquer pessoa com este link vê o mural. Trate como semi-público — não indexa em busca, mas é
            acessível. Se vazar, gere um link novo.
          </p>
          <button type="button" onClick={regenerar} disabled={salvando} className="self-start text-xs font-bold text-blue-700 underline">
            Gerar link novo
          </button>
        </div>
      )}
    </div>
  );
}
