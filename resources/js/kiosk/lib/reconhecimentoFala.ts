import { useCallback, useEffect, useRef, useState } from 'react';
import { navegadorDetectado } from './diagnostico';

/**
 * Ditado em tempo real com a Web Speech API nativa do navegador
 * (`SpeechRecognition` / `webkitSpeechRecognition`). Zero dependência, zero
 * modelo pra baixar, resultado ao vivo enquanto a pessoa fala.
 *
 * Cuidados aprendidos na marra:
 *  - Chrome encerra o reconhecimento sozinho depois de um silêncio, MESMO
 *    com `continuous = true` -> `onend` religa enquanto o cidadão não
 *    tocou em "concluir" (`querAtivoRef`).
 *  - `onerror` NÃO pode ser silencioso: sem o código do erro
 *    ('not-allowed', 'network', 'audio-capture', 'no-speech'...) não dá pra
 *    diagnosticar nada. Ele vai pro estado `erro`, que a tela mostra.
 *  - Firefox não implementa: `disponivel` fica false e a UI cai no "digite".
 *
 * É sempre um EXTRA: a MediaRecorder segue gravando o áudio pra arquivo,
 * e o cidadão pode digitar.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function construtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function ditadoDisponivel(): boolean {
  return construtor() !== undefined;
}

/** Mensagem legível pro cidadão a partir do código de erro da API. */
function explicar(codigo?: string): string {
  switch (codigo) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permissão de microfone negada para o ditado.';
    case 'audio-capture':
      return 'Microfone não encontrado.';
    case 'network':
      return 'Sem rede para o ditado (o Chrome usa um serviço online).';
    case 'no-speech':
      return 'Não ouvi nada. Fale mais perto do microfone.';
    case 'aborted':
      return 'Ditado interrompido.';
    default:
      return `Ditado indisponível (${codigo ?? 'erro desconhecido'}).`;
  }
}

/**
 * @param aoTexto recebe o texto acumulado (final + parcial) a cada
 *   atualização - ligue direto no setter do textarea/store.
 */
export function useReconhecimentoFala(aoTexto: (texto: string) => void) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const querAtivoRef = useRef(false);
  const aoTextoRef = useRef(aoTexto);
  aoTextoRef.current = aoTexto;

  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const criarESubir = useCallback(() => {
    const Ctor = construtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setAtivo(true);
      setErro(null);
    };

    rec.onresult = (e) => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += alt + ' ';
        else parcial += alt;
      }
      aoTextoRef.current((finalRef.current + parcial).trim());
    };

    rec.onerror = (e) => {
      console.warn('[ditado] erro:', e?.error);
      // 'no-speech'/'aborted' são normais no meio da fala - o onend religa.
      if (e?.error !== 'no-speech' && e?.error !== 'aborted') {
        querAtivoRef.current = false;
        setErro(explicar(e?.error));
      }
    };

    rec.onend = () => {
      setAtivo(false);
      // Chrome corta sozinho no silêncio: religa enquanto ainda queremos ouvir.
      if (querAtivoRef.current) {
        setTimeout(() => {
          if (querAtivoRef.current) criarESubir();
        }, 250);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.warn('[ditado] start falhou:', e);
      querAtivoRef.current = false;
      setErro('Não foi possível iniciar o ditado.');
      setAtivo(false);
    }
  }, []);

  const iniciar = useCallback(() => {
    if (!construtor()) {
      setErro(`${navegadorDetectado()} não tem ditado por voz — abra no Chrome/Edge ou escreva o relato abaixo.`);

      return;
    }
    finalRef.current = '';
    setErro(null);
    querAtivoRef.current = true;
    criarESubir();
  }, [criarESubir]);

  /** Para e devolve só o texto FINAL reconhecido. */
  const parar = useCallback((): string => {
    querAtivoRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setAtivo(false);

    return finalRef.current.trim();
  }, []);

  useEffect(
    () => () => {
      querAtivoRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    },
    [],
  );

  return { ativo, erro, iniciar, parar, disponivel: ditadoDisponivel() };
}
