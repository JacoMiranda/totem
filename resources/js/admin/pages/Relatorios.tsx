import { useCallback, useEffect, useState } from 'react';
import { getSentimentEmoji } from '../../shared';
import { BarrasHorizontais, type Fatia, Indicador, LinhaTemporal, type PontoSerie } from '../components/Graficos';
import { api } from '../lib/api';

/**
 * Relatórios (Fase 5). Consome os endpoints já existentes em
 * ReportController: /reports/summary, /timeseries, /sla e /export.
 *
 * Os filtros ficam numa linha só, acima dos gráficos, e valem para TODOS
 * eles - inclusive para o CSV, senão o arquivo exportado não corresponde ao
 * que está na tela.
 */

interface Resumo {
  total: number;
  porCategoria: Record<string, number>;
  porSentimento: Record<string, number>;
  porUrgencia: Record<string, number>;
  porStatus: Record<string, number>;
}

interface Sla {
  tempoMedioResolucaoHoras: number | null;
  backlog: number;
  foraDoSla: number;
  foraDoSlaPorUrgencia: Record<string, number>;
}

type Intervalo = 'day' | 'week' | 'month';

/** Ordem fixa e conhecida do domínio - não deixar o gráfico ordenar por volume. */
const ORDEM_SENTIMENTO = ['Excelente', 'Satisfeito', 'Neutro', 'Preocupado', 'Insatisfeito'];
const ORDEM_URGENCIA = ['Baixa', 'Média', 'Alta', 'Crítica'];
const ORDEM_STATUS = ['Recebida', 'Em triagem', 'Em análise', 'Respondida', 'Concluída', 'Arquivada'];

const SELO_URGENCIA: Record<string, string> = {
  Baixa: '○',
  Média: '◔',
  Alta: '◑',
  Crítica: '●',
};

/** Converte o mapa do backend em fatias, respeitando uma ordem de domínio quando houver. */
function paraFatias(
  mapa: Record<string, number> | undefined,
  ordem?: string[],
  marca?: (rotulo: string) => string,
): Fatia[] {
  const entradas = Object.entries(mapa ?? {});
  const ordenadas = ordem
    ? ordem.filter((k) => k in (mapa ?? {})).map((k) => [k, mapa![k]] as const)
    : entradas.sort((a, b) => b[1] - a[1]);

  return ordenadas.map(([rotulo, valor]) => ({ rotulo, valor, marca: marca?.(rotulo) }));
}

function formatarHoras(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 24) return `${horas}h`;

  return `${(horas / 24).toFixed(1)} dias`;
}

export function Relatorios() {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [intervalo, setIntervalo] = useState<Intervalo>('day');

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [sla, setSla] = useState<Sla | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const filtros = useCallback(() => {
    const p: Record<string, string> = {};
    if (de) p.de = de;
    if (ate) p.ate = ate;

    return p;
  }, [de, ate]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);

    Promise.all([
      api.get('/reports/summary', { params: filtros() }),
      api.get('/reports/timeseries', { params: { ...filtros(), interval: intervalo } }),
      api.get('/reports/sla', { params: filtros() }),
    ])
      .then(([r1, r2, r3]) => {
        if (cancelado) return;
        setResumo(r1.data);
        setSerie(r2.data.serie ?? []);
        setSla(r3.data);
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível carregar os relatórios.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [filtros, intervalo]);

  /**
   * O CSV precisa sair pelo mesmo cliente autenticado (bearer), então baixa
   * como blob em vez de abrir a URL direto - um <a href> não leva o token.
   */
  const exportar = async () => {
    try {
      const { data } = await api.get('/reports/export', {
        params: { ...filtros(), formato: 'csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manifestacoes${de ? `-de-${de}` : ''}${ate ? `-ate-${ate}` : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível exportar o CSV.');
    }
  };

  const limparPeriodo = () => {
    setDe('');
    setAte('');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Relatórios</h1>

        {/* Filtros numa linha só, acima de tudo - valem para os gráficos e para o CSV. */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">De</span>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Até</span>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Agrupar por</span>
            <select
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value as Intervalo)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>
          </label>
          {(de || ate) && (
            <button type="button" onClick={limparPeriodo} className="text-xs font-bold text-slate-500 hover:underline pb-2">
              limpar período
            </button>
          )}
          <button
            type="button"
            onClick={exportar}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-bold transition-colors"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Indicador titulo="Manifestações" valor={resumo?.total ?? 0} detalhe={de || ate ? 'no período' : 'total'} />
            <Indicador titulo="Em aberto" valor={sla?.backlog ?? 0} detalhe="ainda não concluídas" />
            <Indicador
              titulo="Fora do prazo"
              valor={sla?.foraDoSla ?? 0}
              detalhe="passaram do SLA da urgência"
              tom={(sla?.foraDoSla ?? 0) > 0 ? 'critico' : 'neutro'}
            />
            <Indicador
              titulo="Tempo médio"
              valor={formatarHoras(sla?.tempoMedioResolucaoHoras ?? null)}
              detalhe="até concluir"
            />
          </div>

          <LinhaTemporal titulo="Manifestações ao longo do tempo" serie={serie} />

          <div className="grid lg:grid-cols-2 gap-5">
            <BarrasHorizontais titulo="Por teor" fatias={paraFatias(resumo?.porCategoria)} />
            <BarrasHorizontais
              titulo="Por sentimento"
              fatias={paraFatias(resumo?.porSentimento, ORDEM_SENTIMENTO, getSentimentEmoji)}
            />
            <BarrasHorizontais
              titulo="Por urgência"
              fatias={paraFatias(resumo?.porUrgencia, ORDEM_URGENCIA, (u) => SELO_URGENCIA[u] ?? '')}
            />
            <BarrasHorizontais titulo="Por status" fatias={paraFatias(resumo?.porStatus, ORDEM_STATUS)} />
          </div>

          {(sla?.foraDoSla ?? 0) > 0 && (
            <BarrasHorizontais
              titulo="Fora do prazo, por urgência"
              fatias={paraFatias(sla?.foraDoSlaPorUrgencia, ORDEM_URGENCIA, (u) => SELO_URGENCIA[u] ?? '')}
            />
          )}
        </>
      )}
    </div>
  );
}
