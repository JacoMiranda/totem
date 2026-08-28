import { useState } from 'react';
import { fallbackLocalAnalysis } from '../../shared';
import { api, isNetworkError } from '../lib/api';
import { useAudioRecorder } from '../lib/useAudioRecorder';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 2 (Relato) - grava áudio (MediaRecorder, ver useAudioRecorder) OU
 * digita o texto livremente, depois manda pro proxy de IA (device key,
 * `GeminiAiService` no backend). Se a IA estiver indisponível/offline,
 * cai no `fallbackLocalAnalysis` (mesma heurística client-side do
 * protótipo) sempre que já existe texto suficiente - nunca bloqueia o
 * cidadão só porque a rede caiu (requisito central do totem).
 */
export function Relato() {
  const { transcricao, setTranscricao, aplicarAnalise, setAudio, irPara } = useJourneyStore();
  const { isRecording, erro: erroMicrofone, iniciar, parar } = useAudioRecorder();
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const processarComTexto = async (texto: string) => {
    try {
      const { data } = await api.post('/ai/analyze-text', { texto });
      aplicarAnalise(data);
    } catch (erro) {
      const heuristica = fallbackLocalAnalysis(texto);
      aplicarAnalise({ ...heuristica, degraded: true });
      setAviso(
        isNetworkError(erro)
          ? 'Sem conexão no momento - usámos uma classificação local simples. A equipe pode revisar depois.'
          : 'Não foi possível analisar com IA agora - usámos uma classificação local simples.',
      );
    }
  };

  const alternarGravacao = async () => {
    if (!isRecording) {
      await iniciar();

      return;
    }

    const gravado = await parar();
    if (!gravado) return;

    setAudio(gravado.blob, gravado.mimeType);
    setProcessando(true);
    try {
      const form = new FormData();
      form.append('file', gravado.blob, `gravacao.${gravado.mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
      const { data } = await api.post('/ai/transcribe-analyze', form);
      aplicarAnalise(data);
      setProcessando(false);
      irPara('classificacao');

      return;
    } catch (erro) {
      if (transcricao.trim().length > 5) {
        await processarComTexto(transcricao.trim());
        setProcessando(false);
        irPara('classificacao');

        return;
      }

      setAviso(
        isNetworkError(erro)
          ? 'Sem conexão para transcrever automaticamente. O áudio foi guardado e será processado quando a rede voltar - pode também escrever o seu relato abaixo.'
          : 'Não foi possível transcrever automaticamente. Pode escrever o seu relato abaixo.',
      );
    }
    setProcessando(false);
  };

  const continuar = async () => {
    if (transcricao.trim().length < 5) return;
    setProcessando(true);
    await processarComTexto(transcricao.trim());
    setProcessando(false);
    irPara('classificacao');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-4">
        <h2 className="text-xl font-extrabold text-slate-900">Conte o que aconteceu</h2>
        <p className="text-sm text-slate-500">Toque no microfone para falar ou escreva diretamente abaixo.</p>

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
          {processando ? 'A processar…' : isRecording ? 'A gravar - toque para concluir' : 'Toque para gravar'}
        </p>
        {erroMicrofone && <p className="text-center text-xs text-amber-600">{erroMicrofone}</p>}

        <textarea
          className="min-h-32 rounded-xl border border-slate-300 p-3 text-sm"
          placeholder="Ou escreva aqui o seu relato…"
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
