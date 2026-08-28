import { useCallback, useRef, useState } from 'react';

/**
 * Porta fiel do fluxo de gravação do protótipo (startRecording/
 * stopRecording em cabine_de_ouvidoria_inteligente.html): getUserMedia com
 * echo cancellation/noise suppression/auto gain, MIME type escolhido por
 * suporte (webm > mp4 > ogg), MediaRecorder.start(250) (chunks a cada
 * 250ms). Pré-aquecimento do stream (prewarmedAudioStream do protótipo)
 * fica de fora aqui por simplicidade - reabrir o microfone a cada gravação
 * é aceitável nesta primeira versão.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const escolherMimeType = (): string => {
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg';

    return 'audio/webm';
  };

  const iniciar = useCallback(async () => {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mimeType = escolherMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setErro('Microfone indisponível. Pode digitar o seu relato normalmente.');
    }
  }, []);

  /** Resolve com o blob gravado (ou null se nunca gravou nada) e o mimeType usado. */
  const parar = useCallback((): Promise<{ blob: Blob; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);

        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        resolve(blob.size > 0 ? { blob, mimeType } : null);
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, erro, iniciar, parar };
}
