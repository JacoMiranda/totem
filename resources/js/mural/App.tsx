import { useEffect, useMemo, useRef, useState } from 'react';
import type { MuralDados } from './tipos';

/**
 * Mural público de transparência - a tela que a empresa põe na recepção
 * (docs/MURAL-PUBLICO.md). Sem login: lê o token do caminho (/mural/{token})
 * e puxa GET /api/v1/mural/{token} sozinha, recarregando a cada 2 min.
 *
 * Só percentuais, compromisso e distribuição - nunca volume de
 * manifestações nem contagem de denúncias (o recorte "visão de confiança",
 * ver MuralService). Desenhado pra ser lido de longe numa TV: números
 * grandes, cenas que se alternam, esteira de elogios no topo.
 */
const RECARGA_MS = 120_000;
const TROCA_CENA_MS = 14_000;

const COR = {
  emerald: '#34d399',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  coral: '#fb7185',
  slate: '#94a3b8',
};

function tokenDaUrl(): string {
  return window.location.pathname.replace(/^\/mural\/?/, '').split(/[/?#]/)[0] ?? '';
}

export default function App() {
  const [dados, setDados] = useState<MuralDados | null>(null);
  const [erro, setErro] = useState(false);
  const token = useMemo(tokenDaUrl, []);

  useEffect(() => {
    if (!token) {
      setErro(true);

      return;
    }

    let vivo = true;
    const carregar = async () => {
      try {
        const r = await fetch(`/api/v1/mural/${token}`, { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(String(r.status));
        const json = (await r.json()) as MuralDados;
        if (vivo) {
          setDados(json);
          setErro(false);
        }
      } catch {
        if (vivo && !dados) setErro(true);
      }
    };

    void carregar();
    const t = window.setInterval(carregar, RECARGA_MS);
    const aoVoltar = () => document.visibilityState === 'visible' && void carregar();
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      vivo = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (erro) return <Aviso>Mural indisponível no momento.</Aviso>;
  if (!dados) return <Aviso>Carregando…</Aviso>;

  return <Board dados={dados} />;
}

function Board({ dados }: { dados: MuralDados }) {
  const temClima = dados.distribuicao.length > 0 || dados.clima.positivoPct != null;
  const cenas = dados.amostraPequena || !temClima ? 1 : 2;
  const [cena, setCena] = useState(0);

  useEffect(() => {
    if (cenas < 2) return;
    const t = window.setInterval(() => setCena((c) => (c + 1) % cenas), TROCA_CENA_MS);

    return () => window.clearInterval(t);
  }, [cenas]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-100 flex flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60vmax 40vmax at 15% 0%, rgba(52,211,153,0.12), transparent 60%),' +
            'radial-gradient(50vmax 40vmax at 100% 100%, rgba(56,189,248,0.12), transparent 60%)',
        }}
      />

      <div className="relative flex-1 flex flex-col p-[3.5vmin] gap-[3vmin]">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[1.7vmin] font-bold uppercase tracking-[0.35em] text-emerald-300">Transparência</p>
            <h1 className="text-[5vmin] font-extrabold leading-tight">{dados.titulo}</h1>
          </div>
          <p className="text-[1.7vmin] text-slate-400 text-right leading-relaxed">
            Últimos {dados.janelaDias} dias
            <br />
            atualizado {tempoRelativo(dados.atualizadoEm)}
          </p>
        </header>

        <Esteira elogios={dados.elogios} />

        {dados.amostraPequena && (
          <p className="rounded-2xl bg-slate-800/70 border border-slate-700 p-[2vmin] text-[1.9vmin] text-slate-200">
            Estamos começando a ouvir você. Os primeiros resultados aparecem aqui em breve.
          </p>
        )}

        <div className="relative flex-1">
          <Cena visivel={cena === 0}>
            <CenaIndicadores dados={dados} />
          </Cena>
          {cenas > 1 && (
            <Cena visivel={cena === 1}>
              <CenaClima dados={dados} />
            </Cena>
          )}
        </div>

        {cenas > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: cenas }).map((_, n) => (
              <span
                key={n}
                className={`h-2 rounded-full transition-all ${n === cena ? 'w-8 bg-emerald-300' : 'w-2 bg-slate-600'}`}
              />
            ))}
          </div>
        )}
      </div>

      <Convite />
    </div>
  );
}

/** Faixa de incentivo no rodapé - o "agora é a sua vez" que espelha a esteira de elogios no topo. */
function Convite() {
  return (
    <div className="relative z-10 flex items-center gap-[3.5vmin] border-t border-emerald-800/50 bg-gradient-to-r from-emerald-900/50 to-sky-900/40 px-[4vmin] py-[2.5vmin]">
      <Mascote />
      <div>
        <p className="text-[3.4vmin] font-extrabold leading-tight">A sua opinião muda este lugar</p>
        <p className="text-[2.2vmin] text-slate-200">
          Use o totem aqui na recepção e registre a sua manifestação — leva menos de 1 minuto, é só falar.
        </p>
      </div>
      <span className="ml-auto shrink-0 animate-[balanca_2.5s_ease-in-out_infinite] text-[5vmin]">👉</span>
      <style>{`@keyframes balanca{0%,100%{transform:translateX(0)}50%{transform:translateX(1vmin)}}`}</style>
    </div>
  );
}

/** Rostinho amigável em SVG - sem asset externo, escala com a tela. */
function Mascote() {
  return (
    <svg viewBox="0 0 100 100" className="h-[12vmin] w-[12vmin] shrink-0 animate-[flutua_4s_ease-in-out_infinite]">
      <circle cx="50" cy="50" r="46" fill="#34d399" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#0f766e" strokeOpacity="0.35" strokeWidth="3" />
      <circle cx="37" cy="43" r="5.5" fill="#0f172a" />
      <circle cx="63" cy="43" r="5.5" fill="#0f172a" />
      <circle cx="30" cy="58" r="6" fill="#0f766e" fillOpacity="0.4" />
      <circle cx="70" cy="58" r="6" fill="#0f766e" fillOpacity="0.4" />
      <path d="M34 60 Q50 78 66 60" fill="none" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
      <style>{`@keyframes flutua{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.8vmin)}}`}</style>
    </svg>
  );
}

/* ------------------------------------------------------------------ cenas */

function Cena({ visivel, children }: { visivel: boolean; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 transition-all duration-700"
      style={{ opacity: visivel ? 1 : 0, transform: visivel ? 'none' : 'translateY(2vmin)', pointerEvents: visivel ? 'auto' : 'none' }}
    >
      {children}
    </div>
  );
}

function CenaIndicadores({ dados }: { dados: MuralDados }) {
  const i = dados.indicadores;
  const cards = [
    { titulo: 'Manifestações respondidas', valor: i.respondidasPct, cor: COR.emerald },
    { titulo: 'Casos resolvidos', valor: i.resolvidasPct, cor: COR.sky },
    { titulo: 'Respondidas dentro do prazo', valor: i.noPrazoPct, cor: COR.violet },
    { titulo: 'Reclamações já resolvidas', valor: i.reclamacoesResolvidasPct, cor: COR.amber },
  ];

  return (
    <div className="h-full grid grid-cols-2 grid-rows-2 gap-[3vmin]">
      {cards.map((c, n) => (
        <div
          key={c.titulo}
          className="rounded-3xl bg-slate-800/60 border border-slate-700/70 p-[3.5vmin] flex items-center gap-[3.5vmin] animate-[surge_0.7s_ease_backwards]"
          style={{ animationDelay: `${n * 120}ms` }}
        >
          <Anel valor={c.valor} cor={c.cor} />
          <p className="text-[3.4vmin] text-slate-100 leading-tight font-extrabold">{c.titulo}</p>
        </div>
      ))}
      <style>{`@keyframes surge{from{opacity:0;transform:translateY(3vmin) scale(.97)}to{opacity:1}}`}</style>
    </div>
  );
}

function CenaClima({ dados }: { dados: MuralDados }) {
  const { clima, compromisso: c, indicadores: i } = dados;

  return (
    <div className="h-full grid grid-cols-2 gap-[3vmin]">
      <div className="rounded-3xl bg-slate-800/60 border border-slate-700/70 p-[3.5vmin] flex flex-col">
        <p className="text-[2.1vmin] font-extrabold uppercase tracking-widest text-slate-300">O que as pessoas trazem</p>
        <div className="flex-1 flex items-center justify-center gap-[4vmin]">
          <Rosca fatias={dados.distribuicao} />
          <ul className="flex flex-col gap-[2.4vmin]">
            {dados.distribuicao.map((f) => (
              <li key={f.chave} className="flex items-center gap-[1.8vmin] text-[2.8vmin]">
                <span className="text-[3.4vmin]">{EMOJI_TEOR[f.chave]}</span>
                <span className="font-extrabold tabular-nums w-[8vmin]">{f.pct}%</span>
                <span className="text-slate-300">{ROTULO_TEOR[f.chave]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-[3vmin]">
        <div className="rounded-3xl bg-slate-800/60 border border-slate-700/70 p-[3.5vmin]">
          <p className="text-[2.1vmin] font-extrabold uppercase tracking-widest text-slate-300">Como as pessoas chegam</p>
          <BarraClima clima={clima} />
        </div>
        <div className="flex-1 rounded-3xl bg-slate-800/60 border border-slate-700/70 p-[3vmin] flex flex-col justify-center gap-[2.5vmin]">
          <Numeral
            cor={COR.sky}
            numero={i.tempoMedioRespostaHoras == null ? '—' : formatarDuracao(i.tempoMedioRespostaHoras)}
            texto="tempo médio para responder"
          />
          {c.diasSemAtraso > 0 && (
            <Numeral
              cor={COR.emerald}
              numero={`${c.diasSemAtraso}`}
              texto={c.diasSemAtraso === 1 ? 'dia sem atrasos' : 'dias sem atrasos'}
            />
          )}
          {c.diasOuvindo > 0 && (
            <Numeral
              cor={COR.violet}
              numero={`${c.diasOuvindo}`}
              texto={c.diasOuvindo === 1 ? 'dia ouvindo você' : 'dias ouvindo você'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- elementos */

function Anel({ valor, cor }: { valor: number | null; cor: string }) {
  const pct = useContador(valor ?? 0);
  const r = 42;
  const circ = 2 * Math.PI * r;

  return (
    <svg viewBox="0 0 100 100" className="h-[19vmin] w-[19vmin] shrink-0">
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#334155" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
      </g>
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize="27" fontWeight="800">
        {valor == null ? '—' : `${pct}%`}
      </text>
    </svg>
  );
}

function Rosca({ fatias }: { fatias: MuralDados['distribuicao'] }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-[22vmin] w-[22vmin] -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#334155" strokeWidth="14" />
      {fatias.map((f) => {
        const len = (f.pct / 100) * circ;
        const el = (
          <circle
            key={f.chave}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={COR_TEOR[f.chave]}
            strokeWidth="14"
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-acc}
          />
        );
        acc += len;

        return el;
      })}
    </svg>
  );
}

function BarraClima({ clima }: { clima: MuralDados['clima'] }) {
  const faixas = [
    { pct: clima.positivoPct ?? 0, cor: COR.emerald, emoji: '😊', rotulo: 'tranquilas' },
    { pct: clima.neutroPct ?? 0, cor: COR.slate, emoji: '😐', rotulo: 'neutras' },
    { pct: clima.atentoPct ?? 0, cor: COR.amber, emoji: '🤔', rotulo: 'preocupadas' },
  ].filter((f) => f.pct > 0);

  return (
    <div className="mt-[2.5vmin] flex flex-col gap-[2.5vmin]">
      <div className="flex h-[5vmin] w-full overflow-hidden rounded-full">
        {faixas.map((f) => (
          <div key={f.rotulo} style={{ width: `${f.pct}%`, background: f.cor }} className="transition-all duration-700" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-[4vmin] gap-y-[1vmin]">
        {faixas.map((f) => (
          <span key={f.rotulo} className="text-[2.5vmin] text-slate-200">
            {f.emoji} <b className="tabular-nums">{f.pct}%</b> <span className="text-slate-400">{f.rotulo}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Numeral({ numero, texto, cor }: { numero: string; texto: string; cor: string }) {
  return (
    <div>
      <p className="text-[6vmin] font-extrabold leading-none tabular-nums" style={{ color: cor }}>
        {numero}
      </p>
      <p className="text-[2.4vmin] text-slate-300 mt-[1vmin] leading-snug font-semibold">{texto}</p>
    </div>
  );
}

function Esteira({ elogios }: { elogios: MuralDados['elogios'] }) {
  if (elogios.length === 0) return <div className="h-[2vmin]" />;

  // Base repetida até ter corpo suficiente; a esteira mostra a base 2x e
  // volta pro começo em -50% (emenda sem salto).
  let base = [...elogios];
  while (base.length < 6) base = [...base, ...elogios];
  const fila = [...base, ...base];
  const dur = base.length * 8;

  return (
    <div className="relative z-10 -mx-[3.5vmin] flex items-stretch border-y border-slate-700/60 bg-slate-800/60 backdrop-blur">
      <span className="flex shrink-0 items-center bg-emerald-900/70 px-[3vmin] py-[2vmin] text-[1.9vmin] font-extrabold uppercase tracking-widest text-emerald-200">
        O que dizem de nós
      </span>
      <div className="flex flex-1 items-center overflow-hidden">
        <div
          className="flex shrink-0 items-center gap-[6vmin] whitespace-nowrap pl-[4vmin] text-[3vmin]"
          style={{ animation: `desliza ${dur}s linear infinite` }}
        >
          {fila.map((e, n) => (
            <span key={n} className="flex shrink-0 items-baseline gap-[1.6vmin]">
              <span className="text-[3.4vmin] text-emerald-300">“</span>
              <span>{e.texto}</span>
              <span className="text-[1.9vmin] text-slate-500">
                {[e.unidade, formatarData(e.quando)].filter(Boolean).join(' · ')}
              </span>
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes desliza{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center text-[3vmin]">{children}</div>
  );
}

/* ---------------------------------------------------------------- helpers */

const EMOJI_TEOR: Record<string, string> = { Elogio: '💚', Sugestão: '💡', Dúvida: '❓', Reclamação: '🛠️' };
const ROTULO_TEOR: Record<string, string> = {
  Elogio: 'elogios',
  Sugestão: 'sugestões',
  Dúvida: 'dúvidas',
  Reclamação: 'pontos a melhorar',
};
const COR_TEOR: Record<string, string> = {
  Elogio: COR.emerald,
  Sugestão: COR.sky,
  Dúvida: COR.violet,
  Reclamação: COR.coral,
};

/** Anima 0 -> alvo em ~900ms quando o valor muda. */
function useContador(alvo: number): number {
  const [v, setV] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 900);
      setV(Math.round((1 - (1 - t) ** 3) * alvo));
      if (t < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(raf.current);
  }, [alvo]);

  return v;
}

function formatarDuracao(horas: number): string {
  if (horas < 24) return `${horas}h`;
  const dias = horas / 24;
  return Number.isInteger(dias) ? `${dias} dias` : `${dias.toFixed(1).replace('.', ',')} dias`;
}

function tempoRelativo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : 'há mais de um dia';
}

function formatarData(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
