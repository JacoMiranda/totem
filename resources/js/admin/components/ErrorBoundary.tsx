import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Rede a tela branca do painel. O motivo mais comum de um erro de render
 * aqui é bundle velho: o admin fica aberto numa aba por dias, sai uma
 * versão nova da API e o JS antigo em memória quebra ao ler a resposta
 * ("e.map is not a function"). Um reload resolve — então na primeira vez
 * a gente recarrega sozinho. Se logo em seguida quebrar de novo (bug de
 * verdade, não versão), mostra a mensagem e deixa a pessoa decidir, sem
 * entrar em loop de reload.
 */
const CHAVE_RELOAD = 'admin:auto-reload-ts';
const JANELA_MS = 15_000;

interface State {
  erro: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(_erro: Error, _info: ErrorInfo) {
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CHAVE_RELOAD) || 0);
    } catch {
      /* sessionStorage pode estar bloqueado */
    }

    if (Date.now() - ultima > JANELA_MS) {
      try {
        sessionStorage.setItem(CHAVE_RELOAD, String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl flex flex-col gap-4 text-center">
          <div className="text-5xl">🛠️</div>
          <h2 className="text-xl font-extrabold text-slate-900">Precisamos recarregar o painel</h2>
          <p className="text-sm text-slate-600">
            Provavelmente saiu uma versão nova enquanto esta aba estava aberta. Recarregue para
            continuar de onde parou.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(CHAVE_RELOAD);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-extrabold text-white"
          >
            Recarregar
          </button>
        </div>
      </main>
    );
  }
}
