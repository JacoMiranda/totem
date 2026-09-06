import { useCallback, useEffect, useRef, useState } from 'react';
import { navegadorDetectado } from './diagnostico';

/**
 * Gravação de áudio com MediaRecorder. Grava o arquivo que vai pro arquivo
 * (e pra transcrição server-side, quando a Gemini está ligada).
 *
 * Cuidados de compatibilidade aprendidos na marra:
 *  - Safari/iOS: `new MediaRecorder(stream, { mimeType: 'audio/webm' })`
 *    LANÇA se o tipo não é suportado. Então só passamos `mimeType` quando
 *    algum é de fato suportado; senão deixamos o navegador escolher.
 *  - O erro do getUserMedia NÃO pode ser engolido: sem o `name` do
 *    DOMException ('NotAllowedError', 'NotFoundError', 'SecurityError'...)
 *    "o microfone não funciona no celular" é impossível de diagnosticar.
 *    Ele vira mensagem na tela.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  /** Retorna um mimeType suportado ou '' (deixa o navegador decidir). */
  const escolherMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    for (const t of ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/aac']) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }

    return '';
  };

  const explicar = (e: unknown): string => {
    const nome = (e as DOMException)?.name;
    switch (nome) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Permissão de microfone negada. Toque no cadeado da barra de endereço e permita o microfone.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Nenhum microfone encontrado neste aparelho.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'O microfone está em uso por outro aplicativo. Feche os outros e tente de novo.';
      case 'NotSupportedError':
        return `${navegadorDetectado()} não suporta gravação de áudio aqui. Escreva o seu relato no campo abaixo.`;
      default:
        if (!window.isSecureContext) {
          return 'A gravação só funciona em conexão segura (https). Escreva o seu relato abaixo.';
        }

        return `Não consegui usar o microfone (${nome ?? 'erro desconhecido'}). Escreva o seu relato abaixo.`;
    }
  };

  const iniciar = useCallback(async () => {
    setErro(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErro(
        window.isSecureContext
          ? `${navegadorDetectado()} não expõe o microfone. Escreva o seu relato abaixo.`
          : 'A gravação só funciona em conexão segura (https). Escreva o seu relato abaixo.',
      );

      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      setErro(explicar(e));

      return;
    }

    streamRef.current = stream;

    try {
      const mimeType = escolherMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setErro(explicar(e));
    }
  }, []);

  /** Resolve com o blob gravado (ou null se nunca gravou nada) e o mimeType usado. */
  const parar = useCallback((): Promise<{ blob: Blob; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        resolve(null);

        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);
        resolve(blob.size > 0 ? { blob, mimeType } : null);
      };
      recorder.stop();
    });
  }, []);

  // Se a tela sumir no meio da gravação (cidadão cancelou o atendimento,
  // reset por inatividade, painel de suporte), a MediaStream tem que ser
  // fechada - senão o microfone fica preso e o indicador do celular não
  // apaga.
  useEffect(() => {
    return () => {
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== 'inactive') rec.stop();
      } catch {
        /* ok */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { isRecording, erro, iniciar, parar };
}
