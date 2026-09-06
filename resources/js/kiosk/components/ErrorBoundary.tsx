import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportarErro } from '../lib/reportarErro';

/**
 * Se uma tela da jornada quebrar, o totem NÃO pode ficar com tela branca em
 * modo quiosque (sem barra de endereço, sem F5). Mostra uma mensagem calma,
 * reporta o erro pro painel (/admin/logs via /client-errors) e oferece
 * recarregar. O `PainelSuporte` continua montado ao lado deste boundary, então
 * o gesto de canto pra manutenção segue funcionando mesmo nesta tela.
 */
interface State {
  erro: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    reportarErro('render', `${erro.message} · ${info.componentStack?.slice(0, 300) ?? ''}`);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl flex flex-col gap-4 text-center">
          <div className="text-6xl">🛠️</div>
          <h2 className="text-xl font-extrabold text-slate-900">Tivemos um problema nesta tela</h2>
          <p className="text-sm text-slate-600">
            O atendimento não foi perdido. Um atendente já foi avisado automaticamente. Você pode tentar de novo.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-extrabold text-white"
          >
            Recomeçar
          </button>
        </div>
      </main>
    );
  }
}
