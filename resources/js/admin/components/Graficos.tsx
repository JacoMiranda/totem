import { useId, useState } from 'react';

/**
 * Gráficos em SVG puro - sem biblioteca. São três formas simples (linha,
 * barra horizontal e número em destaque) e uma lib traria centenas de KB
 * pra desenhar isso.
 *
 * Decisões de cor, seguindo o método de dataviz:
 *  - Cada gráfico tem UMA série (a contagem). Uma cor por barra seria cor
 *    como decoração - anti-padrão. Por isso tudo usa a mesma hue azul
 *    (#2a78d6), validada: passa faixa de luminosidade, croma e contraste
 *    >= 3:1 sobre branco.
 *  - Quem distingue as barras é o RÓTULO, não a cor: o emoji do sentimento
 *    (a mesma linguagem que o cidadão vê no totem) e o selo de urgência.
 *    Uma rampa divergente de 5 cores reprovou no piso de visão normal
 *    (ΔE 12,5 entre o cinza neutro e o vermelho claro) - o emoji separa
 *    melhor que a cor separaria.
 *  - Todo gráfico tem "ver tabela": nenhum dado depende de enxergar o
 *    desenho.
 */

const AZUL = '#2a78d6';
const GRADE = '#e1e0d9';
const EIXO = '#c3c2b7';
const TINTA_FRACA = '#898781';

export interface Fatia {
  rotulo: string;
  valor: number;
  /** Prefixo visual (emoji/selo) - carrega a identidade que a cor não carrega. */
  marca?: string;
}

/** Número em destaque: quando a resposta é UM valor, gráfico nenhum ajuda. */
export function Indicador({
  titulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  titulo: string;
  valor: string | number;
  detalhe?: string;
  tom?: 'neutro' | 'atencao' | 'critico';
}) {
  const cor =
    tom === 'critico' ? 'text-rose-700' : tom === 'atencao' ? 'text-amber-700' : 'text-slate-900';

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-3xl font-extrabold tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

/** Barras horizontais - comparação de magnitude entre poucas categorias nomeadas. */
export function BarrasHorizontais({ titulo, fatias }: { titulo: string; fatias: Fatia[] }) {
  const [tabela, setTabela] = useState(false);
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const maximo = Math.max(1, ...fatias.map((f) => f.valor));

  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-slate-900">{titulo}</h3>
        <button
          type="button"
          onClick={() => setTabela((v) => !v)}
          className="text-xs font-bold text-blue-700 hover:underline"
        >
          {tabela ? 'ver gráfico' : 'ver tabela'}
        </button>
      </header>

      {fatias.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Sem dados no período.</p>
      ) : tabela ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-2 font-bold">Item</th>
              <th className="pb-2 font-bold text-right">Total</th>
              <th className="pb-2 font-bold text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {fatias.map((f) => (
              <tr key={f.rotulo} className="border-t border-slate-100">
                <td className="py-1.5">
                  {f.marca} {f.rotulo}
                </td>
                <td className="py-1.5 text-right tabular-nums font-bold">{f.valor}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">
                  {total > 0 ? Math.round((f.valor / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {fatias.map((f) => (
            <li key={f.rotulo} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-sm text-slate-700 truncate" title={f.rotulo}>
                {f.marca && <span className="mr-1">{f.marca}</span>}
                {f.rotulo}
              </span>
              <span className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                <span
                  className="block h-full rounded-md transition-all"
                  style={{ width: `${Math.max(2, (f.valor / maximo) * 100)}%`, background: AZUL }}
                  title={`${f.rotulo}: ${f.valor}`}
                />
              </span>
              <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
                {f.valor}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface PontoSerie {
  periodo: string;
  total: number;
}

/**
 * Linha de volume no tempo. Série única, então não leva legenda - o título
 * já diz o que é. Tem crosshair + tooltip no hover: um gráfico em HTML é
 * interativo por natureza.
 */
export function LinhaTemporal({ titulo, serie }: { titulo: string; serie: PontoSerie[] }) {
  const [tabela, setTabela] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  const clip = useId();

  const L = 44;
  const R = 12;
  const T = 12;
  const B = 28;
  const W = 720;
  const H = 240;
  const larguraPlot = W - L - R;
  const alturaPlot = H - T - B;

  const maximo = Math.max(1, ...serie.map((p) => p.total));
  const passo = serie.length > 1 ? larguraPlot / (serie.length - 1) : 0;
  const x = (i: number) => L + (serie.length > 1 ? i * passo : larguraPlot / 2);
  const y = (v: number) => T + alturaPlot - (v / maximo) * alturaPlot;

  const marcasY = [0, 0.5, 1].map((f) => Math.round(maximo * f));
  const caminho = serie.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.total)}`).join(' ');

  const rotuloCurto = (periodo: string) =>
    periodo.length === 7 ? periodo : periodo.slice(8) + '/' + periodo.slice(5, 7);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-slate-900">{titulo}</h3>
        <button
          type="button"
          onClick={() => setTabela((v) => !v)}
          className="text-xs font-bold text-blue-700 hover:underline"
        >
          {tabela ? 'ver gráfico' : 'ver tabela'}
        </button>
      </header>

      {serie.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Sem dados no período.</p>
      ) : tabela ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="pb-2 font-bold">Período</th>
              <th className="pb-2 font-bold text-right">Manifestações</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.periodo} className="border-t border-slate-100">
                <td className="py-1.5">{p.periodo}</td>
                <td className="py-1.5 text-right tabular-nums font-bold">{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[36rem]"
            role="img"
            aria-label={`${titulo}: ${serie.length} períodos, máximo de ${maximo}`}
            onMouseLeave={() => setAtivo(null)}
          >
            <defs>
              <clipPath id={clip}>
                <rect x={L} y={T} width={larguraPlot} height={alturaPlot} />
              </clipPath>
            </defs>

            {/* grade recessiva */}
            {marcasY.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRADE} strokeWidth={1} />
                <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={TINTA_FRACA}>
                  {v}
                </text>
              </g>
            ))}
            <line x1={L} x2={W - R} y1={T + alturaPlot} y2={T + alturaPlot} stroke={EIXO} strokeWidth={1} />

            <path d={caminho} fill="none" stroke={AZUL} strokeWidth={2} strokeLinejoin="round" clipPath={`url(#${clip})`} />

            {serie.map((p, i) => (
              <circle key={p.periodo} cx={x(i)} cy={y(p.total)} r={ativo === i ? 5 : 3.5} fill={AZUL} stroke="#fff" strokeWidth={2} />
            ))}

            {/* rótulos do eixo x: só as pontas e o meio, pra não colidir */}
            {serie.map((p, i) =>
              i === 0 || i === serie.length - 1 || i === Math.floor(serie.length / 2) ? (
                <text key={p.periodo} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={TINTA_FRACA}>
                  {rotuloCurto(p.periodo)}
                </text>
              ) : null,
            )}

            {/* crosshair + faixas de captura (alvo maior que a marca) */}
            {ativo !== null && (
              <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={T + alturaPlot} stroke={EIXO} strokeWidth={1} strokeDasharray="3 3" />
            )}
            {serie.map((p, i) => (
              <rect
                key={`hit-${p.periodo}`}
                x={x(i) - Math.max(12, passo / 2)}
                y={T}
                width={Math.max(24, passo)}
                height={alturaPlot}
                fill="transparent"
                onMouseEnter={() => setAtivo(i)}
              />
            ))}
          </svg>

          <p className="mt-1 text-xs text-slate-500 h-4">
            {ativo !== null && (
              <>
                <strong className="text-slate-800">{serie[ativo].periodo}</strong> ·{' '}
                {serie[ativo].total} {serie[ativo].total === 1 ? 'manifestação' : 'manifestações'}
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
