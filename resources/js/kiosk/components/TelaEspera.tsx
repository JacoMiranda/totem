import { useEffect, useState } from 'react';
import { getDeviceConfig } from '../../shared/deviceConfig';
import { api } from '../lib/api';

/**
 * Tela de espera do totem. O foco é o convite claro pra registrar ("Sua
 * opinião é importante" + botão grande + os quatro tipos de manifestação).
 * Os números de transparência (GET /mural/resumo) entram DEPOIS, no rodapé,
 * discretos - reforçam que a ouvidoria responde, sem roubar a atenção do
 * botão.
 *
 * Tudo é degradável: sem rede / sem dados, o rodapé some. O `<main>` inteiro
 * continua sendo área de toque.
 */
interface Resumo {
  titulo: string;
  empresa: string | null;
  amostraPequena: boolean;
  indicadores: {
    respondidasPct: number | null;
    noPrazoPct: number | null;
    tempoMedioRespostaHoras: number | null;
  };
  elogios: { texto: string; unidade: string | null }[];
}

const TIPOS = [
  { emoji: '😊', rotulo: 'Elogio', cor: '#22c55e' },
  { emoji: '💡', rotulo: 'Sugestão', cor: '#3b82f6' },
  { emoji: '😟', rotulo: 'Reclamação', cor: '#f43f5e' },
  { emoji: '❓', rotulo: 'Dúvida', cor: '#f59e0b' },
];

export function TelaEspera({ onComecar, recusou }: { onComecar: () => void; recusou: boolean }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [elogio, setElogio] = useState(0);
  // A empresa dona do totem: gravada no pareamento (funciona offline) e
  // confirmada pelo /mural/resumo (pega renomeações).
  const empresa = resumo?.empresa ?? getDeviceConfig()?.empresa ?? resumo?.titulo ?? null;

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
    const t = window.setInterval(() => setElogio((v) => (v + 1) % resumo.elogios.length), 8000);

    return () => window.clearInterval(t);
  }, [resumo]);

  const i = resumo?.indicadores;
  const temNumeros = resumo && !resumo.amostraPequena && (i?.respondidasPct != null || i?.noPrazoPct != null);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-b from-sky-50 to-white p-8 cursor-pointer"
      onPointerDown={onComecar}
    >
      <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7 text-center">
        <div className="flex flex-col items-center gap-1 text-blue-700">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📣</span>
            <span className="text-2xl font-extrabold leading-tight">Ouvidoria</span>
          </div>
          {empresa && <span className="text-lg font-bold text-slate-500">{empresa}</span>}
        </div>

        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">Sua opinião é importante!</h1>
          <p className="mt-3 text-lg text-slate-600">Conte pra gente o que você achou do nosso atendimento.</p>
        </div>

        {recusou && (
          <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            Sem a sua concordância não podemos registrar o relato. Se mudar de ideia, é só tocar na tela.
          </p>
        )}

        <button
          type="button"
          onClick={onComecar}
          className="w-full rounded-3xl bg-emerald-600 py-9 text-2xl font-extrabold text-white shadow-xl shadow-emerald-600/30 animate-pulse"
        >
          🎙️ Fazer minha manifestação
        </button>

        <div className="flex w-full justify-around">
          {TIPOS.map((t) => (
            <div key={t.rotulo} className="flex flex-col items-center gap-2">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{ background: `${t.cor}22` }}
              >
                {t.emoji}
              </span>
              <span className="text-xs font-bold text-slate-500">{t.rotulo}</span>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-400">Toque em qualquer lugar para começar — leva menos de 1 minuto.</p>
      </div>

      {temNumeros && (
        <div className="w-full max-w-xl border-t border-slate-200 pt-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Aqui a sua voz é ouvida</p>
          <div className="mt-2 flex justify-center gap-6 text-sm text-slate-500">
            <span>
              <b className="text-emerald-700">{pct(i?.respondidasPct)}</b> respondidas
            </span>
            <span>
              <b className="text-emerald-700">{pct(i?.noPrazoPct)}</b> no prazo
            </span>
            <span>
              <b className="text-emerald-700">{tempo(i?.tempoMedioRespostaHoras)}</b> resposta média
            </span>
          </div>
          {resumo && resumo.elogios.length > 0 && (
            <p className="mt-2 text-xs italic text-slate-400 line-clamp-1">
              “{resumo.elogios[elogio % resumo.elogios.length].texto}”
            </p>
          )}
        </div>
      )}
    </main>
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
