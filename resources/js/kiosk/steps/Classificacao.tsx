import { useEffect, useState } from 'react';
import {
  CATEGORIES,
  SENTIMENTS,
  URGENCIES,
  getSentimentEmoji,
  getUrgencyBadgeClass,
} from '../../shared';
import { BarraJornada } from '../components/BarraJornada';
import db from '../lib/db';
import { sincronizarUm } from '../lib/sync';
import { falarFrase, pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 3 (Classificação) - confirma/ajusta o resultado da IA (ou da
 * heurística local, se `degraded`) antes de enviar de verdade. Grava
 * sempre na fila local (Dexie) primeiro - mesmo com rede disponível -
 * pra que o envio nunca dependa só do sucesso imediato da chamada de rede
 * (offline-first de verdade, não só um "tenta e se falhar avisa").
 */
export function Classificacao() {
  const state = useJourneyStore();
  const { transcricao, resumo, keywords, sentimento, categoria, urgencia, degraded, setClassificacaoManual } = state;
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void falarFrase('classificacao-instrucao');

    return pararFala;
  }, []);

  const confirmarEEnviar = async () => {
    setEnviando(true);

    // Higieniza as keywords: sem vazias/duplicadas, no máximo 8 (o servidor
    // rejeita acima disso). A IA e o fallback local às vezes repetem termos.
    const keywords = [...new Set(state.keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 8);

    const payload = {
      clientId: state.clientId,
      criadoEm: new Date().toISOString(),
      consentimentoLgpd: state.consentimentoLgpd,
      transcricao: state.transcricao || undefined,
      resumo: state.resumo || undefined,
      keywords: keywords.length ? keywords : undefined,
      sentimento: state.sentimento ?? undefined,
      categoria: state.categoria ?? undefined,
      urgencia: state.urgencia,
      temAudio: Boolean(state.audioBlob),
      requerenteType: state.requerente?.type,
      requerenteId: state.requerente?.id,
    };

    await db.fila.put({
      clientId: state.clientId,
      payload,
      audioBlob: state.audioBlob ?? undefined,
      audioMimeType: state.audioMimeType ?? undefined,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      tentativas: 0,
    });

    const item = await sincronizarUm(state.clientId);
    state.concluir(item.protocolo ?? `PENDENTE-${state.clientId.slice(0, 8).toUpperCase()}`, item.pin ?? null);
    setEnviando(false);
  };

  const semTexto = !resumo && !transcricao;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 pt-16">
      <BarraJornada voltarPara="relato" />
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-4">
        <h2 className="text-xl font-extrabold text-slate-900">Confirme a classificação</h2>

        {degraded && !semTexto && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            A IA não estava disponível - usámos uma classificação simples. Ajuste abaixo se necessário.
          </p>
        )}

        {semTexto && (
          <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2">
            🎙️ Sua gravação foi guardada e será ouvida pela equipe. Escolha abaixo o teor e o sentimento do seu
            relato.
          </p>
        )}

        {!semTexto && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
            {resumo || transcricao}
          </div>
        )}

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.map((k) => (
              <span key={k} className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg">
                #{k}
              </span>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Sentimento</p>
          <div className="flex flex-wrap gap-2">
            {SENTIMENTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setClassificacaoManual('sentimento', s)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  sentimento === s ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                }`}
              >
                {getSentimentEmoji(s)} {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Teor</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClassificacaoManual('categoria', c)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  categoria === c ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Urgência</p>
          <div className="flex flex-wrap gap-2">
            {URGENCIES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setClassificacaoManual('urgencia', u)}
                className={`rounded-xl border px-3 py-2 text-sm ${getUrgencyBadgeClass(u)} ${
                  urgencia === u ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={enviando || !sentimento || !categoria}
          onClick={confirmarEEnviar}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          {enviando ? 'A enviar…' : 'Confirmar e enviar'}
        </button>
      </div>
    </main>
  );
}
