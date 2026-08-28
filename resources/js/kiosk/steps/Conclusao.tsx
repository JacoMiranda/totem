import { useEffect } from 'react';
import { api } from '../lib/api';
import { falarComFallbackDoNavegador, playPcmAudio } from '../lib/playPcmAudio';
import { useJourneyStore } from '../store/journeyStore';

const PENDENTE_PREFIXO = 'PENDENTE-';

/**
 * Etapa 4 (Conclusão) - mostra o protocolo (e o PIN, se a criação foi
 * síncrona) e fala uma confirmação (TTS via Gemini, com fallback pra
 * síntese nativa do navegador se a IA/rede não responder). Se o protocolo
 * começa com `PENDENTE-` (ver Classificacao.confirmarEEnviar), a
 * manifestação ainda está na fila local aguardando conexão - o cidadão
 * recebe um identificador local válido MESMO offline, e o protocolo real
 * chega depois via sincronização em segundo plano (ver sync.ts) - fora do
 * alcance desta tela, que já terá sido fechada.
 */
export function Conclusao() {
  const { protocolo, pin, sentimento, categoria, reiniciar } = useJourneyStore();
  const pendente = protocolo?.startsWith(PENDENTE_PREFIXO) ?? false;

  useEffect(() => {
    const mensagem = pendente
      ? 'Seu relato foi guardado neste totem e será enviado assim que a conexão voltar. Obrigado.'
      : `Identificámos o seu relato como ${categoria ?? 'registrado'}, com sentimento ${sentimento ?? 'neutro'}. Obrigado pela sua participação.`;

    (async () => {
      try {
        const { data } = await api.post('/ai/tts', { texto: mensagem });
        playPcmAudio(data.audioBase64, data.sampleRate);
      } catch {
        falarComFallbackDoNavegador(mensagem);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl flex flex-col gap-4 text-center">
        <div className="text-6xl">{pendente ? '⏳' : '✅'}</div>
        <h2 className="text-2xl font-extrabold text-slate-900">
          {pendente ? 'Guardado - será enviado em breve' : 'Relato registado com sucesso'}
        </h2>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase">Protocolo</p>
          <p className="text-lg font-mono font-extrabold text-slate-900">{protocolo}</p>
        </div>

        {pin && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-700 uppercase">PIN de acompanhamento (anote agora)</p>
            <p className="text-2xl font-mono font-extrabold text-blue-900">{pin}</p>
            <p className="text-[11px] text-blue-700 mt-1">
              Este código não será mostrado novamente. Use-o com o protocolo para consultar o andamento.
            </p>
          </div>
        )}

        {pendente && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Este número é local e temporário. O protocolo definitivo (e o PIN) serão gerados quando este totem
            reconectar - guarde a data e o horário do seu atendimento como referência.
          </p>
        )}

        <button
          type="button"
          onClick={reiniciar}
          className="mt-2 w-full rounded-xl bg-blue-600 py-4 text-base font-extrabold text-white"
        >
          Concluir
        </button>
      </div>
    </main>
  );
}
