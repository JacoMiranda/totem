import { useEffect, useMemo, useState } from 'react';
import type { MuralDados } from './tipos';

/**
 * Mural público de transparência - a tela que a empresa põe na recepção
 * (docs/MURAL-PUBLICO.md). Sem login: lê o token do caminho (/mural/{token})
 * e puxa GET /api/v1/mural/{token} sozinha, recarregando a cada 2 min.
 *
 * Layout de dashboard claro: cabeçalho azul, três indicadores com ícone,
 * e três painéis (volume por período, distribuição por teor, clima). Só
 * percentuais e o movimento do canal - nunca fila de problemas nem a
 * palavra "denúncia" (ver MuralService).
 */
const RECARGA_MS = 120_000;

const AZUL = '#2563eb';

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
  const i = dados.indicadores;

  return (
    <div className="min-h-screen flex flex-col bg-[#eef4fb] text-slate-800">
      {/* cabeçalho */}
      <header
        className="flex items-center justify-between gap-4 px-[4vmin] py-[2.4vmin] text-white"
        style={{ background: `linear-gradient(90deg, #1d6fd6, ${AZUL})` }}
      >
        <div className="flex items-center gap-[2vmin]">
          <span className="text-[4vmin]">📣</span>
          <div>
            <p className="text-[1.5vmin] font-bold uppercase tracking-[0.3em] text-blue-100">Transparência</p>
            <h1 className="text-[3.4vmin] font-extrabold leading-tight">{dados.titulo}</h1>
          </div>
        </div>
        <p className="text-right text-[1.6vmin] font-semibold text-blue-100 leading-snug">
          A sua voz faz a diferença 💙
          <br />
          <span className="text-[1.3vmin] font-normal">
            últimos {dados.janelaDias} dias · atualizado {tempoRelativo(dados.atualizadoEm)}
          </span>
        </p>
      </header>

      <Esteira elogios={dados.elogios} />

      <div className="flex-1 flex flex-col gap-[3vmin] p-[4vmin]">
        {dados.amostraPequena && (
          <p className="rounded-2xl bg-white border border-blue-100 p-[2vmin] text-[2vmin] text-slate-600 shadow-sm">
            Estamos começando a ouvir você. Os primeiros resultados aparecem aqui em breve.
          </p>
        )}

        {/* três indicadores */}
        <div className="grid grid-cols-3 gap-[3vmin]">
          <Indicador icone="✓" cor="#22c55e" valor={pct(i.respondidasPct)} rotulo="Respondidas" />
          <Indicador icone="⏱" cor={AZUL} valor={pct(i.noPrazoPct)} rotulo="No prazo" />
          <Indicador icone="📅" cor="#8b5cf6" valor={duracao(i.tempoMedioRespostaHoras)} rotulo="Resposta média" />
        </div>

        {/* três painéis */}
        <div className="grid flex-1 grid-cols-3 gap-[3vmin]">
          <Painel titulo="Manifestações por período">
            <Barras serie={dados.porPeriodo} />
          </Painel>

          <Painel titulo="Por teor">
            <div className="flex h-full items-center justify-center gap-[3vmin]">
              <Rosca fatias={dados.distribuicao} />
              <ul className="flex flex-col gap-[1.8vmin]">
                {dados.distribuicao.map((f) => (
                  <li key={f.chave} className="flex items-center gap-[1.3vmin] text-[2vmin]">
                    <span className="h-[1.8vmin] w-[1.8vmin] rounded-full" style={{ background: COR_TEOR[f.chave] }} />
                    <b className="tabular-nums">{f.pct}%</b>
                    <span className="text-slate-500">{ROTULO_TEOR[f.chave]}</span>
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

      <Convite />
    </div>
  );
}

/* ------------------------------------------------------------- elementos */

function Indicador({ icone, cor, valor, rotulo }: { icone: string; cor: string; valor: string; rotulo: string }) {
  return (
    <div className="flex items-center gap-[3vmin] rounded-2xl bg-white p-[3vmin] shadow-sm border border-blue-50">
      <span
        className="flex h-[9vmin] w-[9vmin] shrink-0 items-center justify-center rounded-full text-[4vmin] font-bold"
        style={{ background: `${cor}1f`, color: cor }}
      >
        {icone}
      </span>
      <div>
        <p className="text-[6vmin] font-extrabold leading-none tabular-nums text-slate-900">{valor}</p>
        <p className="text-[1.8vmin] font-bold uppercase tracking-wide text-slate-400">{rotulo}</p>
      </div>
    </div>
  );
}

function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-[3vmin] shadow-sm border border-blue-50">
      <p className="text-[1.7vmin] font-extrabold uppercase tracking-widest text-slate-400">{titulo}</p>
      <div className="mt-[2vmin] flex-1">{children}</div>
    </div>
  );
}

function Barras({ serie }: { serie: MuralDados['porPeriodo'] }) {
  const max = Math.max(1, ...serie.map((s) => s.total));

  return (
    <div className="flex h-full items-end gap-[0.8vmin]">
      {serie.map((s, n) => (
        <div key={n} className="flex flex-1 flex-col items-center justify-end gap-[0.6vmin]">
          <div
            className="w-full rounded-t"
            style={{ height: `${(s.total / max) * 100}%`, minHeight: s.total ? '4px' : 0, background: AZUL }}
            title={`${s.rotulo}: ${s.total}`}
          />
          {n % 2 === 0 && <span className="text-[1.1vmin] text-slate-400">{s.rotulo}</span>}
        </div>
      ))}
    </div>
  );
}

function Rosca({ fatias }: { fatias: MuralDados['distribuicao'] }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-[20vmin] w-[20vmin] -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="16" />
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
      <span className="text-[13vmin] leading-none" style={{ filter: `drop-shadow(0 4px 8px ${cor}44)` }}>
        {rosto}
      </span>
      <ul className="flex flex-col gap-[2vmin] text-[2.3vmin]">
        <li className="flex items-center gap-[1.4vmin]">
          <span className="h-[1.8vmin] w-[1.8vmin] rounded-full bg-emerald-500" />
          <b className="tabular-nums">{clima.positivoPct ?? 0}%</b> <span className="text-slate-500">Positivo</span>
        </li>
        <li className="flex items-center gap-[1.4vmin]">
          <span className="h-[1.8vmin] w-[1.8vmin] rounded-full bg-slate-400" />
          <b className="tabular-nums">{clima.neutroPct ?? 0}%</b> <span className="text-slate-500">Neutro</span>
        </li>
        <li className="flex items-center gap-[1.4vmin]">
          <span className="h-[1.8vmin] w-[1.8vmin] rounded-full bg-amber-500" />
          <b className="tabular-nums">{clima.atentoPct ?? 0}%</b> <span className="text-slate-500">Negativo</span>
        </li>
      </ul>
    </div>
  );
}

function Esteira({ elogios }: { elogios: MuralDados['elogios'] }) {
  if (elogios.length === 0) return null;

  let base = [...elogios];
  while (base.length < 6) base = [...base, ...elogios];
  const fila = [...base, ...base];
  const dur = base.length * 8;

  return (
    <div className="flex items-stretch border-b border-blue-100 bg-white">
      <span className="flex shrink-0 items-center bg-blue-600 px-[3vmin] py-[1.4vmin] text-[1.4vmin] font-extrabold uppercase tracking-widest text-white">
        O que dizem de nós
      </span>
      <div className="flex flex-1 items-center overflow-hidden">
        <div
          className="flex shrink-0 items-center gap-[6vmin] whitespace-nowrap pl-[4vmin] text-[2vmin] text-slate-600"
          style={{ animation: `desliza ${dur}s linear infinite` }}
        >
          {fila.map((e, n) => (
            <span key={n} className="flex shrink-0 items-baseline gap-[1.2vmin]">
              <span className="text-blue-500">“</span>
              <span>{e.texto}</span>
              <span className="text-[1.4vmin] text-slate-400">
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

function Convite() {
  return (
    <div className="flex items-center gap-[3vmin] border-t border-emerald-200 bg-gradient-to-r from-emerald-50 to-blue-50 px-[4vmin] py-[2.2vmin]">
      <Mascote />
      <div>
        <p className="text-[3vmin] font-extrabold leading-tight text-slate-900">A sua opinião muda este lugar</p>
        <p className="text-[2vmin] text-slate-600">
          Use o totem aqui na recepção e registre a sua manifestação — leva menos de 1 minuto, é só falar.
        </p>
      </div>
      <span className="ml-auto shrink-0 animate-[balanca_2.5s_ease-in-out_infinite] text-[5vmin]">👉</span>
      <style>{`@keyframes balanca{0%,100%{transform:translateX(0)}50%{transform:translateX(1vmin)}}`}</style>
    </div>
  );
}

function Mascote() {
  return (
    <svg viewBox="0 0 100 100" className="h-[11vmin] w-[11vmin] shrink-0 animate-[flutua_4s_ease-in-out_infinite]">
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
  return (
    <div className="min-h-screen bg-[#eef4fb] text-slate-500 flex items-center justify-center text-[3vmin]">
      {children}
    </div>
  );
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
