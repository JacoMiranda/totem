import { useEffect, useState } from 'react';
import { fallbackLocalAnalysis } from '../../shared';
import { api } from '../lib/api';
import { audioParaWav } from '../lib/audioParaWav';
import { diagnosticoNavegador, navegadorDetectado } from '../lib/diagnostico';
import { IA_LOCAL_APENAS } from '../lib/ia';
import { transcreverAudioOffline } from '../lib/offline/vosk';
import { useReconhecimentoFala } from '../lib/reconhecimentoFala';
import { useAudioRecorder } from '../lib/useAudioRecorder';
import { falarFrase, pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 2 (Relato) - o cidadão fala (ditado em tempo real, Web Speech API
 * nativa) e/ou escreve. A MediaRecorder também grava o áudio pra arquivo.
 * Tiers de classificação (ver docs/CAMADA-OFFLINE.md):
 *   0. já tem texto (ditado ou digitado) -> classifica esse texto
 *   1. só áudio -> Gemini transcreve+classifica (pulado se IA_LOCAL_APENAS)
 *   2. só áudio, sem IA -> Vosk (se VOSK_ATIVO) + léxico local
 *   3. nada -> áudio fica salvo pra sincronizar, cidadão digita
 * Nunca bloqueia o cidadão (requisito do totem).
 */
export function Relato() {
  const { transcricao, setTranscricao, aplicarAnalise, setAudio, irPara } = useJourneyStore();
  const { isRecording, erro: erroMicrofone, iniciar, parar } = useAudioRecorder();
  const ditado = useReconhecimentoFala(setTranscricao);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    void falarFrase('relato-instrucao');

    return pararFala;
  }, []);

  useEffect(() => {
    if (erroMicrofone) void falarFrase('relato-sem-microfone');
  }, [erroMicrofone]);

  /** Classifica um texto já conhecido. Devolve true se conseguiu seguir. */
  const analisarTexto = async (texto: string): Promise<boolean> => {
    if (!IA_LOCAL_APENAS) {
      try {
        const { data } = await api.post('/ai/analyze-text', { texto });
        aplicarAnalise(data);

        return true;
      } catch {
        // cai no local
      }
    }

    aplicarAnalise({ ...fallbackLocalAnalysis(texto), degraded: true });
    if (!IA_LOCAL_APENAS) {
      setAviso('IA online indisponível - classificámos localmente. A equipe pode revisar depois.');
    }

    return true;
  };

  /** Transcreve + classifica o áudio gravado. Devolve true se conseguiu seguir. */
  const processarAudio = async (blob: Blob): Promise<boolean> => {
    // Tier 1: Gemini (transcrição + classificação de uma vez).
    if (!IA_LOCAL_APENAS) {
      try {
        const wav = await audioParaWav(blob); // Chrome grava webm/opus, que a Gemini rejeita
        const form = new FormData();
        form.append('file', wav.blob, 'gravacao.wav');
        const { data } = await api.post('/ai/transcribe-analyze', form);
        aplicarAnalise(data);

        return true;
      } catch {
        setAviso('IA online demorou - a transcrever no próprio totem…');
      }
    }

    // Tier 2: transcrição local (Vosk) + classificação por léxico.
    const local = await transcreverAudioOffline(blob);
    const texto = (local && local.length > 2 ? local : transcricao).trim();

    if (texto.length > 5) {
      setTranscricao(texto);
      aplicarAnalise({ ...fallbackLocalAnalysis(texto), degraded: true });

      return true;
    }

    // Tier 3: não deu - o áudio já está salvo pra sincronizar depois.
    setAviso('Não consegui transcrever o áudio. Escreva o seu relato no campo abaixo, por favor.');

    return false;
  };

  const alternarGravacao = async () => {
    if (!isRecording) {
      pararFala(); // não gravar a própria locução
      setTranscricao(''); // ditado começa do zero
      // Ordem importa: a gravação (getUserMedia) primeiro; iniciar o
      // reconhecimento antes disso faz o Chrome abortá-lo por disputa de
      // microfone.
      await iniciar();
      ditado.iniciar(); // transcrição ao vivo (best-effort)

      return;
    }

    const textoFala = ditado.parar();
    const gravado = await parar();
    if (!gravado) return;

    setAudio(gravado.blob, gravado.mimeType);
    setProcessando(true);
    void falarFrase('relato-processando');

    // Tier 0: o ditado (ou algo digitado) já deu texto -> só classificar.
    const texto = (textoFala || transcricao).trim();
    const ok = texto.length > 5 ? await analisarTexto(texto) : await processarAudio(gravado.blob);

    setProcessando(false);
    if (ok) irPara('classificacao');
  };

  const continuar = async () => {
    if (transcricao.trim().length < 5) return;
    setProcessando(true);
    const ok = await analisarTexto(transcricao.trim());
    setProcessando(false);
    if (ok) irPara('classificacao');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-4">
        <h2 className="text-xl font-extrabold text-slate-900">Conte o que aconteceu</h2>
        <p className="text-sm text-slate-500">
          {ditado.disponivel
            ? 'Toque no microfone e fale — o texto aparece sozinho. Ou escreva abaixo.'
            : 'Toque no microfone para gravar, ou escreva o seu relato abaixo.'}
        </p>

        <button
          type="button"
          onClick={alternarGravacao}
          disabled={processando}
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl text-white shadow-lg transition-all disabled:opacity-50 ${
            isRecording ? 'bg-red-600 animate-pulse' : 'bg-blue-600'
          }`}
        >
          {isRecording ? '⏹️' : '🎙️'}
        </button>
        <p className="text-center text-xs font-bold text-slate-500">
          {processando
            ? 'A processar…'
            : isRecording
              ? ditado.ativo
                ? '🔴 A ouvir — pode falar. Toque para concluir.'
                : 'A gravar — toque para concluir'
              : 'Toque para falar'}
        </p>

        {/* Estado do ditado sempre visível: sem isso, "não escreve nada" é
            indistinguível de "o navegador não suporta". Mostra QUAL
            navegador foi detectado - Firefox não implementa a Web Speech
            API, e sem nomeá-lo a mensagem "use o Chrome" parece errada pra
            quem acha que já está no Chrome. */}
        <p className="text-center text-[11px] text-slate-400">
          Ditado por voz:{' '}
          {!ditado.disponivel
            ? `não disponível no ${navegadorDetectado()} — use o Chrome/Edge ou escreva abaixo`
            : ditado.ativo
              ? 'ativo'
              : 'pronto'}
        </p>
        {ditado.erro && <p className="text-center text-xs text-amber-600">{ditado.erro}</p>}
        {erroMicrofone && <p className="text-center text-xs text-amber-600">{erroMicrofone}</p>}

        {(ditado.erro || erroMicrofone) && (
          <p className="text-center text-[10px] text-slate-400 break-words select-all">
            {diagnosticoNavegador()}
          </p>
        )}

        <textarea
          className="min-h-32 rounded-xl border border-slate-300 p-3 text-sm"
          placeholder="O que você falar aparece aqui. Também pode escrever ou corrigir."
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
        />

        {aviso && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{aviso}</p>}

        <button
          type="button"
          disabled={processando || transcricao.trim().length < 5}
          onClick={continuar}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          {processando ? 'A analisar…' : 'Continuar'}
        </button>
      </div>
    </main>
  );
}
