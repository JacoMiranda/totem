/**
 * Confirmação sim/não em tela cheia - substitui `window.confirm`, que num
 * totem fica pequeno, sai do estilo e (em modo quiosque) pode nem aparecer.
 * Botões grandes, os dois com área de toque generosa.
 */
interface Props {
  titulo: string;
  descricao?: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  perigo?: boolean;
}

export function ConfirmarModal({
  titulo,
  descricao,
  confirmarLabel = 'Sim',
  cancelarLabel = 'Não',
  onConfirmar,
  onCancelar,
  perigo = false,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl flex flex-col gap-4 text-center">
        <h3 className="text-xl font-extrabold text-slate-900">{titulo}</h3>
        {descricao && <p className="text-sm text-slate-600">{descricao}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-2xl border-2 border-slate-300 py-5 text-lg font-extrabold text-slate-700 hover:bg-slate-50"
          >
            {cancelarLabel}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className={`rounded-2xl py-5 text-lg font-extrabold text-white ${
              perigo ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
