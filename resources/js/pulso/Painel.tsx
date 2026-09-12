import { useEffect, useState } from 'react';
import { api } from './lib/api';

/**
 * Painel público do s-Totem: a "tela de LED simples" pensada pro pequeno
 * estabelecimento - fica ligada numa TV/tablet na recepção mostrando o
 * quantitativo de likes/neutro/deslikes de todos os pontos ativos. Nos
 * moldes do mural (recarrega sozinho, público, sem login), bem mais
 * simples (sem tendência temporal, só o quantitativo por carinha).
 */
const RECARGA_MS = 120_000;

interface StatPergunta {
  total: number;
  positivoPct: number | null;
  neutroPct: number | null;
  negativoPct: number | null;
}

interface StatPonto {
  nome: string;
  unidade: string | null;
  perguntas: string[];
  porPergunta: Record<string, StatPergunta>;
}

interface PainelDados {
  titulo: string;
  atualizadoEm: string;
  janelaDias: number;
  totalRespostas: number;
  pontos: StatPonto[];
}

function tokenDaUrl(): string {
  const partes = window.location.pathname.split('/').filter(Boolean);

  return partes[partes.length - 1] ?? '';
}

export default function Painel() {
  const [dados, setDados] = useState<PainelDados | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  useEffect(() => {
    const token = tokenDaUrl();
    let vivo = true;

    const carregar = () => {
      api
        .get<PainelDados>(`/s-totem/${token}`)
        .then(({ data }) => vivo && setDados(data))
        .catch(() => vivo && setIndisponivel(true));
    };

    carregar();
    const t = window.setInterval(carregar, RECARGA_MS);

    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, []);

  if (indisponivel) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-8">
        <div className="max-w-sm text-center">
          <div className="text-5xl mb-3">📺</div>
          <h1 className="text-xl font-extrabold text-slate-900">Painel indisponível</h1>
          <p className="text-sm text-slate-500 mt-2">Este link não existe mais ou foi desativado.</p>
        </div>
      </main>
    );
  }

  if (!dados) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{dados.titulo}</h1>
          <p className="text-sm text-slate-500 mt-1">Últimos {dados.janelaDias} dias · {dados.totalRespostas} respostas</p>
        </div>
        <p className="text-xs text-slate-400">Atualizado às {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR')}</p>
      </header>

      {dados.pontos.length === 0 ? (
        <p className="text-center text-slate-400 py-16">Nenhum ponto ativo ainda.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {dados.pontos.map((ponto) => (
            <div key={ponto.nome} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <p className="font-extrabold text-slate-900 text-lg">{ponto.nome}</p>
              {ponto.unidade && <p className="text-xs text-slate-400 mb-4">{ponto.unidade}</p>}

              <div className="flex flex-col gap-4 mt-3">
                {ponto.perguntas.map((pergunta) => (
                  <BarraPergunta key={pergunta} pergunta={pergunta} stat={ponto.porPergunta[pergunta]} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function BarraPergunta({ pergunta, stat }: { pergunta: string; stat?: StatPergunta }) {
  if (!stat || stat.total === 0) {
    return (
      <div>
        <p className="text-sm font-bold text-slate-700">{pergunta}</p>
        <p className="text-xs text-slate-400 mt-1">Sem respostas ainda</p>
      </div>
    );
  }

  const positivo = stat.positivoPct ?? 0;
  const neutro = stat.neutroPct ?? 0;
  const negativo = stat.negativoPct ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-700">{pergunta}</p>
        <p className="text-[11px] text-slate-400">{stat.total} respostas</p>
      </div>
      <div className="mt-2 h-3 w-full rounded-full overflow-hidden flex bg-slate-100">
        <div style={{ width: `${positivo}%`, background: '#16a34a' }} />
        <div style={{ width: `${neutro}%`, background: '#d97706' }} />
        <div style={{ width: `${negativo}%`, background: '#dc2626' }} />
      </div>
      <div className="mt-1.5 flex gap-3 text-xs">
        <span className="text-emerald-700 font-bold">😊 {positivo}%</span>
        <span className="text-amber-700 font-bold">😐 {neutro}%</span>
        <span className="text-rose-700 font-bold">😟 {negativo}%</span>
      </div>
    </div>
  );
}
