import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reset por inatividade - requisito de totem: o relato (e o áudio, e a
 * identificação) de uma pessoa não pode ficar na tela esperando a próxima.
 *
 * Passado `timeoutMs` sem nenhum toque/tecla, mostra um aviso "ainda está
 * aí?" por `avisoMs`; se ninguém interagir, chama `onTimeout` (tipicamente
 * `reiniciar()`). Qualquer interação zera tudo.
 *
 * Devolve `avisando` (pra tela desenhar o aviso) e `segundos` (contagem
 * regressiva) - a UI fica com quem chama.
 */
export function useInatividade({
  timeoutMs,
  avisoMs,
  onTimeout,
  ativo,
}: {
  timeoutMs: number;
  avisoMs: number;
  onTimeout: () => void;
  ativo: boolean;
}) {
  const [avisando, setAvisando] = useState(false);
  const [segundos, setSegundos] = useState(Math.ceil(avisoMs / 1000));
  const timerAviso = useRef<number | undefined>(undefined);
  const timerFim = useRef<number | undefined>(undefined);
  const contador = useRef<number | undefined>(undefined);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const limpar = useCallback(() => {
    window.clearTimeout(timerAviso.current);
    window.clearTimeout(timerFim.current);
    window.clearInterval(contador.current);
  }, []);

  const rearmar = useCallback(() => {
    limpar();
    setAvisando(false);
    if (!ativo) return;

    timerAviso.current = window.setTimeout(() => {
      setAvisando(true);
      setSegundos(Math.ceil(avisoMs / 1000));
      contador.current = window.setInterval(() => {
        setSegundos((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
      timerFim.current = window.setTimeout(() => {
        limpar();
        setAvisando(false);
        onTimeoutRef.current();
      }, avisoMs);
    }, timeoutMs);
  }, [ativo, avisoMs, timeoutMs, limpar]);

  useEffect(() => {
    rearmar();
    if (!ativo) return undefined;

    const eventos: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    const aoInteragir = () => rearmar();
    eventos.forEach((e) => window.addEventListener(e, aoInteragir, { passive: true }));

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, aoInteragir));
      limpar();
    };
  }, [rearmar, limpar, ativo]);

  return { avisando, segundos, continuar: rearmar };
}
