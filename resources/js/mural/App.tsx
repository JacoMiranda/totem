import { useEffect, useMemo, useState } from 'react';
import type { MuralDados } from './tipos';

/**
 * Mural público de transparência (docs/MURAL-PUBLICO.md). Sem login: lê o
 * token do caminho (/mural/{token}), puxa GET /api/v1/mural/{token} e
 * recarrega a cada 2 min.
 *
 * Dashboard numa tela só (trava na altura do monitor - `h-screen` +
 * `overflow-hidden`): cabeçalho, três indicadores com ícone e três painéis
 * (volume por semana, teor, sentimento). Tema `claro` ou `escuro` vem do
 * backend (o admin escolhe em /admin/mural) e troca só as variáveis CSS.
 */
const RECARGA_MS = 120_000;
const AZUL = '#3b82f6';

const TEMAS = {
  claro: {
    bg: '#eef4fb',
    card: '#ffffff',
    ink: '#1e293b',
    muted: '#94a3b8',
    trilho: '#eef2f7',
    borda: '#e3ecfb',
    cabecalho: 'linear-gradient(90deg,#1d6fd6,#2563eb)',
    cabecalhoInk: '#ffffff',
    cabecalhoSub: '#bfdbfe',
    conviteBg: 'linear-gradient(90deg,#ecfdf5,#eff6ff)',
    conviteBorda: '#bbf7d0',
  },
  escuro: {
    bg: '#0b1220',
    card: '#131d31',
    ink: '#e8eef9',
    muted: '#7f8ca6',
    trilho: '#22304c',
    borda: '#25324c',
    cabecalho: 'linear-gradient(90deg,#16233f,#1e335f)',
    cabecalhoInk: '#eaf1ff',
    cabecalhoSub: '#93b4e8',
    conviteBg: 'linear-gradient(90deg,#0f2a22,#122544)',
    conviteBorda: '#1f5c47',
  },
};

function tokenDaUrl(): string {
  return window.location.pathname.replace(/^\/mural\/?/, '').split(/[/?#]/)[0] ?? '';
}

export default function App() {
  const [dados, setDados] = useState<MuralDados | null>(null);
  const [erro, setErro] = useState(false);
  const token = useMemo(tokenDaUrl, []);

  useEffect(() => {
    if (!token) return setErro(true);

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
  const t = TEMAS[dados.tema] ?? TEMAS.claro;
  const i = dados.indicadores;

  const vars = {
    '--bg': t.bg,
    '--card': t.card,
    '--ink': t.ink,
    '--muted': t.muted,
    '--trilho': t.trilho,
    '--borda': t.borda,
  } as React.CSSProperties;

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ ...vars, background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* cabeçalho */}
      <header
        className="flex shrink-0 items-center justify-between gap-4 px-[4vmin] py-[2vmin]"
        style={{ background: t.cabecalho, color: t.cabecalhoInk }}
      >
        <div className="flex items-center gap-[2vmin]">
          <span className="text-[3.6vmin]">📣</span>
          <div>
            <p className="text-[1.4vmin] font-bold uppercase tracking-[0.3em]" style={{ color: t.cabecalhoSub }}>
              Transparência
            </p>
            <h1 className="text-[3.2vmin] font-extrabold leading-tight">{dados.titulo}</h1>
          </div>
        </div>
        <p className="text-right text-[1.5vmin] font-semibold leading-snug" style={{ color: t.cabecalhoSub }}>
          A sua voz faz a diferença 💙
          <br />
          <span className="text-[1.2vmin] font-normal">
            últimos {dados.janelaDias} dias · atualizado {tempoRelativo(dados.atualizadoEm)}
          </span>
        </p>
      </header>

      <Esteira elogios={dados.elogios} escuro={dados.tema === 'escuro'} />

      <div className="flex min-h-0 flex-1 flex-col gap-[2.5vmin] p-[3vmin]">
        {dados.amostraPequena && (
          <p className="shrink-0 rounded-2xl border p-[1.6vmin] text-[1.8vmin]" style={{ background: 'var(--card)', borderColor: 'var(--borda)', color: 'var(--muted)' }}>
            Estamos começando a ouvir você. Os primeiros resultados aparecem aqui em breve.
          </p>
        )}

        {/* três indicadores */}
        <div className="grid shrink-0 grid-cols-3 gap-[2.5vmin]">
          <Indicador icone="✓" cor="#22c55e" valor={pct(i.respondidasPct)} rotulo="Respondidas" />
          <Indicador icone="⏱" cor={AZUL} valor={pct(i.noPrazoPct)} rotulo="No prazo" />
          <Indicador icone="📅" cor="#8b5cf6" valor={duracao(i.tempoMedioRespostaHoras)} rotulo="Resposta média" />
        </div>

        {/* três painéis */}
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[2.5vmin]">
          <Painel titulo="Manifestações por período">
            <Barras serie={dados.porPeriodo} />
          </Painel>

          <Painel titulo="Por teor">
            <div className="flex h-full items-center justify-center gap-[3vmin]">
              <Rosca fatias={dados.distribuicao} />
              <ul className="flex flex-col gap-[1.6vmin]">
                {dados.distribuicao.map((f) => (
                  <li key={f.chave} className="flex items-center gap-[1.2vmin] text-[1.9vmin]">
                    <span className="h-[1.7vmin] w-[1.7vmin] rounded-full" style={{ background: COR_TEOR[f.chave] }} />
                    <b className="tabular-nums">{f.pct}%</b>
                    <span style={{ color: 'var(--muted)' }}>{ROTULO_TEOR[f.chave]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Painel>

          <Painel titulo="Por sentimento">
            <Sentimento clima={dados.clima} />
          </Painel>
        </div>
      </div>

      <Convite bg={t.conviteBg} borda={t.conviteBorda} />
    </div>
  );
}

/* ------------------------------------------------------------- elementos */

function Indicador({ icone, cor, valor, rotulo }: { icone: string; cor: string; valor: string; rotulo: string }) {
  return (
    <div
      className="flex items-center gap-[2.5vmin] rounded-2xl border p-[2.5vmin] shadow-sm"
      style={{ background: 'var(--card)', borderColor: 'var(--borda)' }}
    >
      <span
        className="flex h-[8vmin] w-[8vmin] shrink-0 items-center justify-center rounded-full text-[3.6vmin] font-bold"
        style={{ background: `${cor}22`, color: cor }}
      >
        {icone}
      </span>
      <div>
        <p className="text-[5.4vmin] font-extrabold leading-none tabular-nums">{valor}</p>
        <p className="text-[1.7vmin] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          {rotulo}
        </p>
      </div>
    </div>
  );
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-col rounded-2xl border p-[2.5vmin] shadow-sm"
      style={{ background: 'var(--card)', borderColor: 'var(--borda)' }}
    >
      <p className="shrink-0 text-[1.6vmin] font-extrabold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        {titulo}
      </p>
      <div className="mt-[1.8vmin] min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Barras({ serie }: { serie: MuralDados['porPeriodo'] }) {
  const max = Math.max(1, ...serie.map((s) => s.total));
  // No máximo ~10 barras: junta semanas de 2 em 2 se vier muita coisa.
  const dados = serie.length > 10 ? juntarPares(serie) : serie;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 items-end gap-[1vmin]">
        {dados.map((s, n) => (
          <div key={n} className="flex h-full flex-1 flex-col items-center justify-end gap-[0.6vmin]">
            <span className="text-[1.4vmin] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {s.total}
            </span>
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(6, (s.total / max) * 100)}%`,
                background: `linear-gradient(180deg, ${AZUL}, #60a5fa)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-[1vmin] flex shrink-0 gap-[1vmin]">
        {dados.map((s, n) => (
          <span key={n} className="flex-1 text-center text-[1.2vmin]" style={{ color: 'var(--muted)' }}>
            {n % 2 === 0 ? s.rotulo : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function juntarPares(serie: MuralDados['porPeriodo']): MuralDados['porPeriodo'] {
  const out: MuralDados['porPeriodo'] = [];
  for (let i = 0; i < serie.length; i += 2) {
    const a = serie[i];
    const b = serie[i + 1];
    out.push({ rotulo: a.rotulo, total: a.total + (b?.total ?? 0) });
  }

  return out;
}

function Rosca({ fatias }: { fatias: MuralDados['distribuicao'] }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-[19vmin] w-[19vmin] -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--trilho)" strokeWidth="16" />
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
            strokeWidth="16"
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

function Sentimento({ clima }: { clima: MuralDados['clima'] }) {
  const pos = clima.positivoPct ?? 0;
  const neg = clima.atentoPct ?? 0;
  const [rosto, cor] = pos >= neg + 15 ? ['😄', '#22c55e'] : pos >= neg ? ['🙂', AZUL] : ['😐', '#f59e0b'];

  return (
    <div className="flex h-full items-center justify-center gap-[3vmin]">
      <span className="text-[12vmin] leading-none" style={{ filter: `drop-shadow(0 4px 10px ${cor}55)` }}>
        {rosto}
      </span>
      <ul className="flex flex-col gap-[1.8vmin] text-[2.1vmin]">
        <li className="flex items-center gap-[1.3vmin]">
          <span className="h-[1.7vmin] w-[1.7vmin] rounded-full bg-emerald-500" />
          <b className="tabular-nums">{clima.positivoPct ?? 0}%</b> <span style={{ color: 'var(--muted)' }}>Positivo</span>
        </li>
        <li className="flex items-center gap-[1.3vmin]">
          <span className="h-[1.7vmin] w-[1.7vmin] rounded-full bg-slate-400" />
          <b className="tabular-nums">{clima.neutroPct ?? 0}%</b> <span style={{ color: 'var(--muted)' }}>Neutro</span>
        </li>
        <li className="flex items-center gap-[1.3vmin]">
          <span className="h-[1.7vmin] w-[1.7vmin] rounded-full bg-amber-500" />
          <b className="tabular-nums">{clima.atentoPct ?? 0}%</b> <span style={{ color: 'var(--muted)' }}>Negativo</span>
        </li>
      </ul>
    </div>
  );
}

/**
 * Carrossel de elogios: UM por vez, parado ~9s pra dar tempo de ler, com
 * troca por fade. Muito mais legível numa TV do que texto rolando - e
 * deixa a fonte grande em qualquer tamanho de tela.
 */
const TROCA_ELOGIO_MS = 15000;

function Esteira({ elogios, escuro }: { elogios: MuralDados['elogios']; escuro: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (elogios.length < 2) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % elogios.length), TROCA_ELOGIO_MS);

    return () => window.clearInterval(t);
  }, [elogios.length]);

  if (elogios.length === 0) return null;
  const e = elogios[i % elogios.length];

  return (
    <div
      className="flex shrink-0 items-stretch border-b"
      style={{ background: 'var(--card)', borderColor: 'var(--borda)' }}
    >
      <span className="flex shrink-0 items-center bg-blue-600 px-[3vmin] text-[1.9vmin] font-extrabold uppercase tracking-widest text-white">
        O que dizem
        <br />
        de nós
      </span>

      <div className="relative flex flex-1 items-center overflow-hidden px-[4vmin] py-[2.4vmin]">
        <div key={i} className="animate-[trocaElogio_0.6s_ease] w-full">
          <p
            className="text-[3.5vmin] font-medium leading-snug line-clamp-2"
            style={{ color: escuro ? '#dbe6f6' : '#334155' }}
          >
            <span className="text-blue-400">“</span>
            {e.texto}
            <span className="text-blue-400">”</span>
          </p>
          <p className="mt-[1vmin] text-[1.9vmin]" style={{ color: 'var(--muted)' }}>
            {[e.unidade, formatarData(e.quando)].filter(Boolean).join(' · ')}
          </p>
        </div>

        {elogios.length > 1 && (
          <div className="absolute bottom-[1.2vmin] right-[4vmin] flex gap-[0.8vmin]">
            {elogios.map((_, n) => (
              <span
                key={n}
                className="h-[0.9vmin] rounded-full transition-all"
                style={{
                  width: n === i % elogios.length ? '3vmin' : '0.9vmin',
                  background: n === i % elogios.length ? AZUL : 'var(--trilho)',
                }}
              />
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes trocaElogio{from{opacity:0;transform:translateX(2vmin)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Convite({ bg, borda }: { bg: string; borda: string }) {
  return (
    <div className="flex shrink-0 items-center gap-[3vmin] border-t px-[4vmin] py-[1.8vmin]" style={{ background: bg, borderColor: borda }}>
      <Mascote />
      <div>
        <p className="text-[2.8vmin] font-extrabold leading-tight">A sua opinião muda este lugar</p>
        <p className="text-[1.9vmin]" style={{ color: 'var(--muted)' }}>
          Use o totem aqui na recepção e registre a sua manifestação — leva menos de 1 minuto, é só falar.
        </p>
      </div>
      <span className="ml-auto shrink-0 animate-[balanca_2.5s_ease-in-out_infinite] text-[4.5vmin]">👉</span>
      <style>{`@keyframes balanca{0%,100%{transform:translateX(0)}50%{transform:translateX(1vmin)}}`}</style>
    </div>
  );
}

function Mascote() {
  return (
    <svg viewBox="0 0 100 100" className="h-[10vmin] w-[10vmin] shrink-0 animate-[flutua_4s_ease-in-out_infinite]">
      <circle cx="50" cy="50" r="46" fill="#22c55e" />
      <circle cx="37" cy="43" r="5.5" fill="#0f172a" />
      <circle cx="63" cy="43" r="5.5" fill="#0f172a" />
      <circle cx="30" cy="58" r="6" fill="#15803d" fillOpacity="0.5" />
      <circle cx="70" cy="58" r="6" fill="#15803d" fillOpacity="0.5" />
      <path d="M34 60 Q50 78 66 60" fill="none" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
      <style>{`@keyframes flutua{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.8vmin)}}`}</style>
    </svg>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen items-center justify-center bg-[#eef4fb] text-[3vmin] text-slate-500">{children}</div>;
}

/* ---------------------------------------------------------------- helpers */

const ROTULO_TEOR: Record<string, string> = {
  Elogio: 'Elogios',
  Sugestão: 'Sugestões',
  Dúvida: 'Dúvidas',
  Reclamação: 'Reclamações',
};
const COR_TEOR: Record<string, string> = {
  Elogio: '#22c55e',
  Sugestão: '#f59e0b',
  Dúvida: '#3b82f6',
  Reclamação: '#8b5cf6',
};

function pct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function duracao(horas: number | null): string {
  if (horas == null) return '—';
  if (horas < 24) return `${horas}h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

function tempoRelativo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : 'há mais de um dia';
}

function formatarData(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
