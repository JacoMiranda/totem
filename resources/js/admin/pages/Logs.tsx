import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Logs do servidor (`laravel.log`) + erros vindos do navegador do totem
 * (canal `kiosk`, alimentado por ClientErrorController). Só admin
 * (gate `ver-logs` no backend).
 *
 * É de diagnóstico, não auditoria: mostra o fim do arquivo, não o
 * histórico completo, e não guarda nada no banco.
 */

interface Entrada {
  hora: string;
  origem: 'servidor' | 'totem';
  ambiente: string;
  nivel: string;
  mensagem: string;
  detalhe: string | null;
}

const COR_NIVEL: Record<string, string> = {
  emergency: 'bg-rose-100 text-rose-800',
  alert: 'bg-rose-100 text-rose-800',
  critical: 'bg-rose-100 text-rose-800',
  error: 'bg-rose-100 text-rose-800',
  warning: 'bg-amber-100 text-amber-800',
  notice: 'bg-blue-100 text-blue-800',
  info: 'bg-slate-100 text-slate-700',
  debug: 'bg-slate-100 text-slate-500',
};

export function Logs() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [niveis, setNiveis] = useState<string[]>([]);
  const [nivel, setNivel] = useState('warning');
  const [linhas, setLinhas] = useState(200);
  const [auto, setAuto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  const carregar = useCallback(() => {
    setErro(null);
    api
      .get('/logs', { params: { nivel, linhas } })
      .then(({ data }) => {
        setEntradas(data.entradas);
        setNiveis(data.niveis);
      })
      .catch((e) => setErro(e?.response?.status === 403 ? 'Sem permissão para ver os logs.' : 'Não foi possível carregar os logs.'))
      .finally(() => setCarregando(false));
  }, [nivel, linhas]);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current);
    if (auto) timer.current = window.setInterval(carregar, 10_000);

    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [auto, carregar]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Logs</h1>
          <p className="text-sm text-slate-500">
            Servidor + erros do navegador do totem. Últimas ocorrências, não o histórico completo.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Nível mínimo</span>
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm capitalize"
            >
              {(niveis.length ? niveis : ['debug', 'info', 'warning', 'error']).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Linhas</span>
            <select
              value={linhas}
              onChange={(e) => setLinhas(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {[100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 pb-1.5">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            atualizar sozinho
          </label>
          <button
            type="button"
            onClick={carregar}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-bold transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : entradas.length === 0 ? (
        <p className="rounded-xl bg-white border border-slate-200 p-6 text-center text-slate-400">
          Nada neste nível. Baixe o filtro para <strong>info</strong> ou <strong>debug</strong> para ver mais.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="p-3 w-40">Quando</th>
                <th className="p-3 w-24">Origem</th>
                <th className="p-3 w-24">Nível</th>
                <th className="p-3">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e, i) => (
                <tr
                  key={i}
                  onClick={() => setAberta(aberta === i ? null : i)}
                  className={`border-t border-slate-100 align-top ${e.detalhe ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                >
                  <td className="p-3 whitespace-nowrap text-xs text-slate-500">{e.hora}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        e.origem === 'totem' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {e.origem}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${COR_NIVEL[e.nivel] ?? 'bg-slate-100 text-slate-600'}`}>
                      {e.nivel}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-slate-800 break-words">{e.mensagem}</span>
                    {e.detalhe && aberta === i && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 text-slate-100 text-[11px] p-3 whitespace-pre-wrap">
                        {e.detalhe}
                      </pre>
                    )}
                    {e.detalhe && aberta !== i && (
                      <span className="ml-2 text-[11px] text-blue-600">ver detalhe</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
