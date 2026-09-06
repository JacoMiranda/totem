import { useEffect, useState } from 'react';
import { BarraJornada } from '../components/BarraJornada';
import { fallbackLocalAnalysis } from '../../shared';
import { api, isNetworkError } from '../lib/api';
import { audioParaWav } from '../lib/audioParaWav';
import { aparelhoDeToque, diagnosticoNavegador, navegadorDetectado } from '../lib/diagnostico';
import { IA_LOCAL_APENAS } from '../lib/ia';
import { transcreverAudioOffline } from '../lib/offline/vosk';
import { useReconhecimentoFala } from '../lib/reconhecimentoFala';
import { useAudioRecorder } from '../lib/useAudioRecorder';
import { reportarErro } from '../lib/reportarErro';
import { falarFrase, pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 2 (Relato). O cidadão fala (a MediaRecorder grava) e/ou escreve.
 *
 * Ditado ao vivo (Web Speech API): SÓ no desktop. No Chrome do Android o
 * microfone é exclusivo - rodar SpeechRecognition junto com a MediaRecorder
 * faz o reconhecimento entrar em loop de start/erro/restart sem capturar
 * nada (o ícone de mic piscando no topo). No celular, portanto, a
 * transcrição vem 100% do servidor (Gemini) depois de gravar.
 *
 * Tiers de classificação (ver docs/CAMADA-OFFLINE.md):
 *   0. já tem texto (ditado ou digitado) -> classifica esse texto
 *   1. só áudio -> Gemini transcreve+classifica (pulado se IA_LOCAL_APENAS)
 *   2. só áudio, sem IA -> Vosk (se VOSK_ATIVO) + léxico local
 *   3. nada -> áudio fica salvo pra sincronizar, cidadão digita
 * Nunca bloqueia o cidadão (requisito do totem).
 */
export function Relato() {
  const { transcricao, setTranscricao, aplicarAnalise, setAudio, pularAnalise, audioBlob, irPara } = useJourneyStore();
  const { isRecording, erro: erroMicrofone, iniciar, parar } = useAudioRecorder();
  const ditado = useReconhecimentoFala(setTranscricao);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const usarDitadoAoVivo = ditado.disponivel && !aparelhoDeToque();

  useEffect(() => {
    void falarFrase('relato-instrucao');

    return pararFala;
  }, []);

  useEffect(() => {
    if (erroMicrofone) {
      void falarFrase('relato-sem-microfone');
      reportarErro('microfone', erroMicrofone);
    }
  }, [erroMicrofone]);

  useEffect(() => {
    if (ditado.erro) reportarErro('ditado', ditado.erro);
  }, [ditado.erro]);

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
    const wav = await audioParaWav(blob); // Chrome grava webm/opus, que a Gemini rejeita
    if (!wav.ok) {
      setAviso(`Não consegui preparar o áudio (${wav.motivo}). Escreva o seu relato no campo abaixo.`);
      reportarErro('audio-wav', `${wav.motivo} · blob ${blob.size}b ${blob.type}`);

      return false;
    }

    if (!IA_LOCAL_APENAS) {
      try {
        const form = new FormData();
        form.append('file', wav.blob, wav.nomeArquivo);
        // Áudio pode levar mais que uma chamada de texto: transcrição +
        // classificação + rede móvel. Timeout próprio, maior que o padrão.
        const { data } = await api.post('/ai/transcribe-analyze', form, { timeout: 45_000 });
        aplicarAnalise(data);

        return true;
      } catch (erro) {
        const codigo = (erro as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
        const status = (erro as { response?: { status?: number } })?.response?.status;
        reportarErro('transcricao', `${isNetworkError(erro) ? 'rede/timeout' : `http ${status ?? '?'}`}${codigo ? ` ${codigo}` : ''} · wav ${wav.blob.size}b`);
        setAviso(
          isNetworkError(erro)
            ? 'Sem conexão para transcrever agora - o áudio foi guardado, a equipe transcreve depois. Pode escrever o relato abaixo.'
            : codigo === 'AI_UNAVAILABLE'
              ? 'O serviço de transcrição está fora do ar no momento. O áudio foi guardado; escreva o relato abaixo.'
              : `Não consegui transcrever o áudio${codigo ? ` (${codigo})` : ''}. Escreva o seu relato no campo abaixo.`,
        );
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

    if (!aviso) {
      setAviso('Não consegui transcrever o áudio. Escreva o seu relato no campo abaixo, por favor.');
    }

    return false;
  };

  const alternarGravacao = async () => {
    if (!isRecording) {
      pararFala(); // não gravar a própria locução
      if (usarDitadoAoVivo) setTranscricao(''); // ditado recomeça do zero
      await iniciar();
      // No celular NÃO iniciamos o reconhecimento: disputa de mic com a
      // gravação (ver docstring). A transcrição vem do servidor ao parar.
      if (usarDitadoAoVivo) ditado.iniciar();

      return;
    }

    const textoFala = usarDitadoAoVivo ? ditado.parar() : '';
    const gravado = await parar();

    // Sem áudio E sem texto: o cidadão só encostou no botão. Nada a fazer.
    if (!gravado && !transcricao.trim() && !textoFala.trim()) return;

    if (gravado) setAudio(gravado.blob, gravado.mimeType);
    setProcessando(true);
    void falarFrase('relato-processando');

    // Tier 0: o ditado (ou algo digitado) já deu texto -> só classificar.
    const texto = (textoFala || transcricao).trim();
    let ok: boolean;
    if (texto.length > 5) {
      ok = await analisarTexto(texto);
    } else if (gravado) {
      ok = await processarAudio(gravado.blob);
    } else {
      setAviso('Não entendi o áudio. Escreva o seu relato no campo abaixo, por favor.');
      ok = false;
    }

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

  /**
   * Plano B quando a transcrição falha (Gemini fora do ar, sem Vosk) e o
   * cidadão não quer digitar: o áudio já está gravado e vai junto na
   * sincronização - a equipe ouve e transcreve no painel. O cidadão escolhe
   * o teor/sentimento na tela seguinte.
   */
  const enviarSoAudio = () => {
    pararFala();
    pularAnalise();
    irPara('classificacao');
  };

  const podeEnviarSoAudio = Boolean(audioBlob) && Boolean(aviso) && !processando && transcricao.trim().length < 5;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6 pt-16">
      <BarraJornada />
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-4">
        <h2 className="text-xl font-extrabold text-slate-900">Conte o que aconteceu</h2>
        <p className="text-sm text-slate-500">
          {usarDitadoAoVivo
            ? 'Toque no microfone e fale — o texto aparece sozinho. Ou escreva abaixo.'
            : 'Toque no microfone, fale, e toque de novo para concluir. Ou escreva abaixo.'}
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
              ? 'A gravar — toque para concluir'
              : 'Toque para falar'}
        </p>

        {usarDitadoAoVivo && (
          <p className="text-center text-[11px] text-slate-400">
            Ditado por voz: {ditado.ativo ? 'ativo' : 'pronto'}
          </p>
        )}
        {ditado.erro && usarDitadoAoVivo && (
          <p className="text-center text-xs text-amber-600">{ditado.erro}</p>
        )}
        {erroMicrofone && <p className="text-center text-xs text-amber-600">{erroMicrofone}</p>}

        {((ditado.erro && usarDitadoAoVivo) || erroMicrofone) && (
          <p className="text-center text-[10px] text-slate-400 break-words select-all">
            {diagnosticoNavegador()}
          </p>
        )}

        <textarea
          className="min-h-32 rounded-xl border border-slate-300 p-3 text-sm"
          placeholder={
            usarDitadoAoVivo
              ? 'O que você falar aparece aqui. Também pode escrever ou corrigir.'
              : 'Ou escreva aqui o seu relato…'
          }
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

        {podeEnviarSoAudio && (
          <button
            type="button"
            onClick={enviarSoAudio}
            className="w-full rounded-xl border-2 border-blue-600 py-3 text-sm font-extrabold text-blue-700"
          >
            Enviar sem escrever — a equipe ouve a sua gravação
          </button>
        )}

        <p className="text-center text-[10px] text-slate-300">{navegadorDetectado()}</p>
      </div>
    </main>
  );
}
