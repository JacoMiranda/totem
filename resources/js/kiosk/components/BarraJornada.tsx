import { useState } from 'react';
import { pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';
import { ConfirmarModal } from './ConfirmarModal';

/**
 * Barra fixa no topo das telas da jornada (Relato, Classificação): deixa o
 * cidadão VOLTAR um passo ou CANCELAR o atendimento inteiro. Sem isto, quem
 * se enganou (ou só quis testar o totem) não tinha saída a não ser ir até o
 * fim ou esperar o reset por inatividade.
 *
 * "Cancelar" pede confirmação e chama `reiniciar()` - limpa transcrição,
 * áudio, identificação: tudo. "Voltar" é diреto (não perde nada).
 */
interface Props {
  /** Passo pra onde "Voltar" leva. Omitido = sem botão voltar. */
  voltarPara?: 'inicio' | 'relato' | 'classificacao';
}

export function BarraJornada({ voltarPara }: Props) {
  const { irPara, reiniciar } = useJourneyStore();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-white/80 px-4 py-2 backdrop-blur border-b border-slate-200">
        {voltarPara ? (
          <button
            type="button"
            onClick={() => {
              pararFala();
              irPara(voltarPara);
            }}
            className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            ← Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"
        >
          ✕ Cancelar atendimento
        </button>
      </div>

      {confirmando && (
        <ConfirmarModal
          titulo="Cancelar este atendimento?"
          descricao="O que você falou ou escreveu será apagado e a tela volta ao início."
          confirmarLabel="Sim, cancelar"
          cancelarLabel="Continuar o relato"
          perigo
          onConfirmar={() => {
            pararFala();
            setConfirmando(false);
            reiniciar();
          }}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </>
  );
}
