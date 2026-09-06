import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Tela de espera do totem. Além de "toque para começar", mostra os números
 * de transparência da própria empresa (GET /mural/resumo) - a pessoa vê que
 * a ouvidoria responde ANTES de registrar, e um botão bem destacado pra
 * fazer a manifestação dali mesmo.
 *
 * Tudo é degradável: sem rede / sem dados, cai na tela simples. O `<main>`
 * inteiro continua sendo área de toque.
 */
interface Resumo {
  titulo: string;
  amostraPequena: boolean;
  indicadores: {
    respondidasPct: number | null;
    noPrazoPct: number | null;
    tempoMedioRespostaHoras: number | null;
  };
  elogios: { texto: string; unidade: string | null }[];
}

export function TelaEspera({ onComecar, recusou }: { onComecar: () => void; recusou: boolean }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [elogio, setElogio] = useState(0);

  useEffect(() => {
    let vivo = true;
    api
      .get('/mural/resumo')
      .then(({ data }) => vivo && setResumo(data))
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!resumo || resumo.elogios.length < 2) return;
    const t = window.setInterval(() => setElogio((v) => (v + 1) % resumo.elogios.length), 7000);

    return () => window.clearInterval(t);
  }, [resumo]);

  const i = resumo?.indicadores;
  const temNumeros = resumo && !resumo.amostraPequena && (i?.respondidasPct != null || i?.noPrazoPct != null);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50 p-6 cursor-pointer"
      onPointerDown={onComecar}
    >
      <div className="w-full max-w-2xl text-center flex flex-col items-center gap-6">
        <div className="text-6xl">🏛️</div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            {resumo?.titulo ?? 'Ouvidoria Cidadã'}
          </h1>
          <p className="text-lg text-emerald-800 font-semibold mt-1">Aqui a sua voz é ouvida.</p>
        </div>

        {recusou && (
          <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            Sem a sua concordância não podemos registrar o relato. Se mudar de ideia, é só tocar na tela.
          </p>
        )}

        {temNumeros && (
          <div className="grid grid-cols-3 gap-3 w-full">
            <Indicador valor={pct(i?.respondidasPct)} rotulo="respondidas" />
            <Indicador valor={pct(i?.noPrazoPct)} rotulo="no prazo" />
            <Indicador valor={tempo(i?.tempoMedioRespostaHoras)} rotulo="resposta média" />
          </div>
        )}

        {resumo && resumo.elogios.length > 0 && (
          <p className="text-sm text-slate-500 italic min-h-10 px-4 transition-opacity">
            “{resumo.elogios[elogio % resumo.elogios.length].texto}”
          </p>
        )}

        <button
          type="button"
          onClick={onComecar}
          className="w-full max-w-lg rounded-3xl bg-emerald-600 py-10 text-2xl font-extrabold text-white shadow-xl animate-pulse"
        >
          📣 Fazer minha manifestação
        </button>
        <p className="text-sm text-slate-500">Toque em qualquer lugar para começar — leva menos de 1 minuto.</p>
      </div>
    </main>
  );
}

function Indicador({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div className="rounded-2xl bg-white border border-emerald-100 shadow-sm p-3">
      <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">{valor}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</p>
    </div>
  );
}

function pct(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`;
}

function tempo(horas: number | null | undefined): string {
  if (horas == null) return '—';
  if (horas < 24) return `${horas}h`;
  const d = Math.round(horas / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}
