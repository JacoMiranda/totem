import { useEffect, useMemo, useRef, useState } from 'react';
import type { MuralDados } from './tipos';

/**
 * Mural público de transparência - a tela que a empresa põe na recepção
 * (docs/MURAL-PUBLICO.md). Sem login: lê o token do caminho (/mural/{token})
 * e puxa GET /api/v1/mural/{token} sozinha, recarregando a cada 2 min.
 *
 * Só mostra percentuais e compromisso - nunca volume de manifestações nem
 * contagem de denúncias (o recorte "visão de confiança", ver MuralService).
 * Desenhado pra ser lido de longe: números grandes, tema escuro pra TV.
 */
const RECARGA_MS = 120_000;
const ROTACAO_ELOGIO_MS = 11_000;

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
  const { indicadores: i, compromisso: c } = dados;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-[3vmin] gap-[3vmin] overflow-hidden">
      <header className="flex items-end justify-between gap-4 border-b border-slate-800 pb-[2vmin]">
        <div>
          <p className="text-[1.6vmin] font-bold uppercase tracking-[0.3em] text-emerald-400">Transparência</p>
          <h1 className="text-[4.2vmin] font-extrabold leading-tight">{dados.titulo}</h1>
        </div>
        <p className="text-[1.5vmin] text-slate-500 text-right">
          Últimos {dados.janelaDias} dias
          <br />
          atualizado {tempoRelativo(dados.atualizadoEm)}
        </p>
      </header>

      {dados.amostraPequena && (
        <p className="rounded-2xl bg-slate-900 border border-slate-800 p-[2vmin] text-[1.9vmin] text-slate-300">
          Estamos começando a ouvir você. Os primeiros resultados aparecem aqui em breve.
        </p>
      )}

      <div className="flex-1 grid grid-cols-3 gap-[3vmin]">
        <div className="col-span-2 grid grid-cols-2 grid-rows-2 gap-[3vmin]">
          <Anel titulo="Manifestações respondidas" valor={i.respondidasPct} />
          <Anel titulo="Casos resolvidos" valor={i.resolvidasPct} />
          <Anel titulo="Respondidas dentro do prazo" valor={i.noPrazoPct} />
          <Anel titulo="Reclamações já resolvidas" valor={i.reclamacoesResolvidasPct} />
        </div>

        <aside className="rounded-3xl bg-slate-900 border border-slate-800 p-[3vmin] flex flex-col justify-center gap-[3vmin]">
          <p className="text-[1.7vmin] font-bold uppercase tracking-widest text-slate-500">Nosso compromisso</p>

          <Destaque
            numero={i.tempoMedioRespostaHoras == null ? '—' : formatarDuracao(i.tempoMedioRespostaHoras)}
            texto="tempo médio para responder"
          />

          {c.diasSemAtraso > 0 ? (
            <Destaque numero={`${c.diasSemAtraso}`} texto={c.diasSemAtraso === 1 ? 'dia sem atrasos' : 'dias sem atrasos'} />
          ) : (
            <Destaque numero={c.tudoNoPrazo ? '✓' : '—'} texto="acompanhando cada manifestação" />
          )}

          {c.diasOuvindo > 0 && (
            <Destaque numero={`${c.diasOuvindo}`} texto={c.diasOuvindo === 1 ? 'dia ouvindo você' : 'dias ouvindo você'} />
          )}
        </aside>
      </div>

      <Elogios elogios={dados.elogios} />
    </div>
  );
}

function Anel({ titulo, valor }: { titulo: string; valor: number | null }) {
  const pct = valor ?? 0;
  const raio = 42;
  const circ = 2 * Math.PI * raio;
  const traco = circ * (1 - pct / 100);

  return (
    <div className="rounded-3xl bg-slate-900 border border-slate-800 p-[2.5vmin] flex items-center gap-[2.5vmin]">
      <svg viewBox="0 0 100 100" className="h-[16vmin] w-[16vmin] shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={raio} fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-800" />
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={traco}
          className="text-emerald-400 transition-all duration-1000"
        />
      </svg>
      <div>
        <p className="text-[6vmin] font-extrabold leading-none tabular-nums">
          {valor == null ? '—' : `${valor}%`}
        </p>
        <p className="text-[1.9vmin] text-slate-400 mt-[1vmin] leading-snug">{titulo}</p>
      </div>
    </div>
  );
}

function Destaque({ numero, texto }: { numero: string; texto: string }) {
  return (
    <div>
      <p className="text-[5.5vmin] font-extrabold leading-none text-emerald-400 tabular-nums">{numero}</p>
      <p className="text-[1.8vmin] text-slate-400 mt-[0.8vmin] leading-snug">{texto}</p>
    </div>
  );
}

function Elogios({ elogios }: { elogios: MuralDados['elogios'] }) {
  const [i, setI] = useState(0);
  const ref = useRef(0);
  ref.current = elogios.length;

  useEffect(() => {
    if (elogios.length < 2) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % ref.current), ROTACAO_ELOGIO_MS);

    return () => window.clearInterval(t);
  }, [elogios.length]);

  if (elogios.length === 0) return <div className="h-[14vmin]" />;

  const e = elogios[i % elogios.length];

  return (
    <div className="rounded-3xl bg-emerald-950/40 border border-emerald-900/60 p-[3vmin] min-h-[14vmin] flex flex-col justify-center">
      <p className="text-[1.5vmin] font-bold uppercase tracking-widest text-emerald-500">O que dizem de nós</p>
      <p key={i} className="text-[2.6vmin] leading-snug mt-[1vmin] animate-[fade_0.6s_ease]">
        “{e.texto}”
      </p>
      <p className="text-[1.5vmin] text-slate-500 mt-[1vmin]">
        {[e.unidade, formatarData(e.quando)].filter(Boolean).join(' · ')}
      </p>
      <style>{`@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-[3vmin]">
      {children}
    </div>
  );
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
