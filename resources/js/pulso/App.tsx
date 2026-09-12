import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api';
import Painel from './Painel';

type Valor = 'positivo' | 'neutro' | 'negativo';
type Tela = 'carregando' | 'pergunta' | 'obrigado' | 'expirada' | 'invalida' | 'erro';

interface EstadoSessao {
  perguntas: string[];
  passoAtual: number;
  concluida: boolean;
  expirada: boolean;
  expiraEm: string;
}

const OPCOES: { valor: Valor; emoji: string; rotulo: string; cor: string }[] = [
  { valor: 'positivo', emoji: '😊', rotulo: 'Gostei', cor: '#16a34a' },
  { valor: 'neutro', emoji: '😐', rotulo: 'Neutro', cor: '#d97706' },
  { valor: 'negativo', emoji: '😟', rotulo: 'Não gostei', cor: '#dc2626' },
];

/**
 * s-Totem (era "Pulso Rápido"): alternativa ao totem físico pra quem não
 * tem tablet/led - um QR impresso abre isto no celular do cliente.
 * `/pulso/{token}` (fixo, impresso) redireciona pro servidor pra
 * `/pulso/s/{hash}` (uma sessão por abertura, ver PulsoWebController) - o
 * hash na URL é o que este componente lê e usa em toda chamada. Sem
 * login, sem device key: é público por design, só o hash identifica a
 * sessão.
 *
 * Mesmo bundle serve o painel público (`/s-totem/{token}`, ver Painel.tsx)
 * - é o mesmo produto, só uma tela pensada pra TV/tablet em vez de celular.
 */
function hashDaUrl(): string {
  const partes = window.location.pathname.split('/').filter(Boolean);

  return partes[partes.length - 1] ?? '';
}

export default function App() {
  // Decidido uma vez, no carregamento da página - não é uma rota client-
  // side que muda durante a vida deste componente.
  if (window.location.pathname.startsWith('/s-totem/')) {
    return <Painel />;
  }

  return <FluxoResposta />;
}

function FluxoResposta() {
  const hash = useMemo(hashDaUrl, []);
  const [tela, setTela] = useState<Tela>('carregando');
  const [perguntas, setPerguntas] = useState<string[]>([]);
  const [passo, setPasso] = useState(0);
  const [expiraEm, setExpiraEm] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const travouRef = useRef(false);

  useEffect(() => {
    if (!hash) {
      setTela('invalida');

      return;
    }
    api
      .get<EstadoSessao>(`/pulso/s/${hash}`)
      .then(({ data }) => {
        setPerguntas(data.perguntas);
        setPasso(data.passoAtual);
        setExpiraEm(new Date(data.expiraEm).getTime());
        if (data.concluida) setTela('obrigado');
        else if (data.expirada) setTela('expirada');
        else setTela('pergunta');
      })
      .catch(() => setTela('invalida'));
  }, [hash]);

  // O prazo de verdade é aplicado no servidor (410 em qualquer resposta
  // fora do tempo) - isto só evita deixar a pessoa tocando num link morto.
  useEffect(() => {
    if (tela !== 'pergunta' || expiraEm == null) return;
    const restante = expiraEm - Date.now();
    if (restante <= 0) {
      setTela('expirada');

      return;
    }
    const t = window.setTimeout(() => setTela('expirada'), restante);

    return () => window.clearTimeout(t);
  }, [tela, expiraEm]);

  const responder = async (valor: Valor) => {
    if (travouRef.current || enviando) return;
    travouRef.current = true;
    setEnviando(true);
    try {
      const { data } = await api.post(`/pulso/s/${hash}/respostas`, { valor });
      if (data.concluida) {
        setTela('obrigado');
      } else {
        setPasso((p) => p + 1);
      }
    } catch (err) {
      const codigo = axios.isAxiosError(err)
        ? (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code
        : null;
      if (codigo === 'CONCLUIDA') setTela('obrigado');
      else if (codigo === 'EXPIRADA') setTela('expirada');
      else setTela('erro');
    } finally {
      setEnviando(false);
      travouRef.current = false;
    }
  };

  if (tela === 'carregando') {
    return <Tela>{null}</Tela>;
  }

  if (tela === 'invalida') {
    return (
      <Tela emoji="🔗">
        <h1 className="text-xl font-extrabold text-slate-900">Link inválido</h1>
        <p className="text-sm text-slate-500 mt-2">
          Este QR não existe mais ou foi desativado. Fale com o estabelecimento.
        </p>
      </Tela>
    );
  }

  if (tela === 'expirada') {
    return (
      <Tela emoji="⏱️">
        <h1 className="text-xl font-extrabold text-slate-900">O tempo acabou</h1>
        <p className="text-sm text-slate-500 mt-2">
          Passou muito tempo desde que você abriu o QR. Escaneie de novo pra registrar sua opinião.
        </p>
      </Tela>
    );
  }

  if (tela === 'erro') {
    return (
      <Tela emoji="🛠️">
        <h1 className="text-xl font-extrabold text-slate-900">Não deu pra enviar</h1>
        <p className="text-sm text-slate-500 mt-2">Verifique a conexão e tente novamente.</p>
      </Tela>
    );
  }

  if (tela === 'obrigado') {
    return (
      <Tela emoji="✅">
        <h1 className="text-xl font-extrabold text-slate-900">Obrigado pela sua opinião!</h1>
        <p className="text-sm text-slate-500 mt-2">Já pode fechar esta aba.</p>
      </Tela>
    );
  }

  const pergunta = perguntas[passo];

  return (
    <main className="min-h-screen flex flex-col bg-white p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        {passo === 0 && (
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Você tem 3 minutos para responder
          </p>
        )}
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{pergunta}</h1>
        <p className="text-sm text-slate-400">Toque em como você se sentiu</p>
      </div>

      <div className="flex flex-col gap-4 pb-4">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={enviando}
            onClick={() => responder(o.valor)}
            className="flex items-center gap-4 rounded-3xl p-6 text-left transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ background: `${o.cor}14`, border: `2px solid ${o.cor}33` }}
          >
            <span className="text-5xl">{o.emoji}</span>
            <span className="text-lg font-extrabold" style={{ color: o.cor }}>
              {o.rotulo}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-slate-300">
        {passo + 1} de {perguntas.length}
      </p>
    </main>
  );
}

function Tela({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="max-w-xs text-center">
        {emoji && <div className="text-5xl mb-3">{emoji}</div>}
        {children}
      </div>
    </main>
  );
}
