import { useState } from 'react';
import db from '../lib/db';
import { useJourneyStore, type Etapa } from '../store/journeyStore';

/**
 * Barra de navegação SÓ pra dev/teste. Aparece quando a URL tem `?dev=1`
 * (fica gravado em localStorage pra sobreviver aos re-renders da jornada,
 * já que este SPA não troca a URL entre etapas). O cidadão nunca vê.
 *
 * Serve pra pular entre telas sem refazer o fluxo e pra limpar a fila local
 * durante os testes.
 */
const CHAVE = 'totem:dev';

function devLigado(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('dev')) {
      localStorage.setItem(CHAVE, '1');
    }

    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

const ETAPAS: Etapa[] = ['inicio', 'relato', 'classificacao', 'conclusao'];

export function BarraDev() {
  const [ligado, setLigado] = useState(devLigado);
  const { etapa, irPara } = useJourneyStore();
  const [filaMsg, setFilaMsg] = useState('');

  if (!ligado) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-1 bg-fuchsia-900/90 px-2 py-1 text-[11px] text-white">
      <span className="font-bold uppercase tracking-wide">dev</span>
      {ETAPAS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => irPara(e)}
          className={`rounded px-2 py-1 font-bold ${etapa === e ? 'bg-white text-fuchsia-900' : 'bg-fuchsia-700'}`}
        >
          {e}
        </button>
      ))}
      <button
        type="button"
        onClick={async () => {
          const n = await db.fila.count();
          await db.fila.clear();
          setFilaMsg(`fila limpa (${n})`);
          window.setTimeout(() => setFilaMsg(''), 2000);
        }}
        className="rounded bg-fuchsia-700 px-2 py-1 font-bold"
      >
        limpar fila
      </button>
      {filaMsg && <span className="text-fuchsia-200">{filaMsg}</span>}
      <button
        type="button"
        onClick={() => {
          localStorage.removeItem(CHAVE);
          setLigado(false);
        }}
        className="ml-auto rounded bg-fuchsia-700 px-2 py-1 font-bold"
      >
        ocultar
      </button>
    </div>
  );
}
