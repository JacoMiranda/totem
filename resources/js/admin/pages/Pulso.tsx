import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Pontos de coleta do "Pulso Rápido" - QR impresso pro estabelecimento que
 * não tem tablet/totem: o cliente escaneia, responde 2-3 perguntas com 3
 * carinhas cada, pronto. Gate `gerenciar-pulso` (ver AppServiceProvider),
 * admin-only, escopado à própria conta.
 */
interface Ponto {
  id: string;
  nome: string;
  unidade: string | null;
  perguntas: string[];
  ativo: boolean;
  token: string;
  url: string;
}

interface Resumo {
  total: number;
  porPergunta: Record<string, { total: number; positivo: number; neutro: number; negativo: number }>;
}

const PERGUNTAS_PADRAO = 'Atendimento, Produto/Serviço';

export function Pulso() {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('');
  const [novasPerguntas, setNovasPerguntas] = useState(PERGUNTAS_PADRAO);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = () =>
    api
      .get('/pulso-pontos')
      .then(({ data }) => setPontos(data))
      .catch(() => setErro('Não foi possível carregar os pontos.'))
      .finally(() => setCarregando(false));

  useEffect(() => {
    void carregar();
  }, []);

  const criar = async () => {
    setErro(null);
    try {
      const perguntas = novasPerguntas
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 4);
      await api.post('/pulso-pontos', {
        nome: novoNome,
        unidade: novaUnidade.trim() || undefined,
        ...(perguntas.length > 0 ? { perguntas } : {}),
      });
      setNovoNome('');
      setNovaUnidade('');
      setNovasPerguntas(PERGUNTAS_PADRAO);
      carregar();
    } catch {
      setErro('Não foi possível cadastrar o ponto. Confira o nome e as perguntas.');
    }
  };

  const alternarAtivo = async (p: Ponto) => {
    await api.patch(`/pulso-pontos/${p.id}`, { ativo: !p.ativo });
    carregar();
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Pulso Rápido</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sem tablet ou totem na unidade? Imprima o QR de um ponto e cole no balcão - o cliente
          escaneia pelo celular, toca em 3 carinhas por pergunta e pronto. Cada abertura vale por 3
          minutos e só pode ser usada uma vez.
        </p>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-2 items-end">
        <label className="text-xs font-bold text-slate-500 flex-1 min-w-40">
          Nome do ponto
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="QR balcão"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-500 flex-1 min-w-32">
          Unidade (opcional)
          <input
            value={novaUnidade}
            onChange={(e) => setNovaUnidade(e.target.value)}
            placeholder="Loja Centro"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-500 flex-[2] min-w-56">
          Perguntas (separadas por vírgula, até 4)
          <input
            value={novasPerguntas}
            onChange={(e) => setNovasPerguntas(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!novoNome.trim()}
          onClick={criar}
          className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-40"
        >
          Cadastrar
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {!carregando && pontos.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum ponto cadastrado ainda.</p>
        )}
        {pontos.map((p) => (
          <CardPonto
            key={p.id}
            ponto={p}
            aberto={expandido === p.id}
            onToggleAberto={() => setExpandido((v) => (v === p.id ? null : p.id))}
            onAlternarAtivo={() => alternarAtivo(p)}
          />
        ))}
      </div>
    </div>
  );
}

function CardPonto({
  ponto,
  aberto,
  onToggleAberto,
  onAlternarAtivo,
}: {
  ponto: Ponto;
  aberto: boolean;
  onToggleAberto: () => void;
  onAlternarAtivo: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    if (!aberto) return;
    QRCode.toDataURL(ponto.url, { width: 220, margin: 1 }).then(setQr);
    api.get(`/pulso-pontos/${ponto.id}/resumo`).then(({ data }) => setResumo(data));
  }, [aberto, ponto.id, ponto.url]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggleAberto} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="font-extrabold text-slate-900">
            {ponto.nome} {ponto.unidade && <span className="text-slate-400 font-normal">· {ponto.unidade}</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{ponto.perguntas.join(' · ')}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ponto.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
          {ponto.ativo ? 'ativo' : 'desativado'}
        </span>
      </button>

      {aberto && (
        <div className="border-t border-slate-100 p-4 flex flex-wrap gap-6">
          <div className="flex flex-col items-center gap-2">
            {qr && <img src={qr} alt={`QR code de ${ponto.nome}`} className="rounded-lg border border-slate-200" />}
            <a href={ponto.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline break-all">
              {ponto.url}
            </a>
            <button type="button" onClick={onAlternarAtivo} className="text-xs text-rose-600 underline">
              {ponto.ativo ? 'Desativar ponto' : 'Reativar ponto'}
            </button>
          </div>

          <div className="flex-1 min-w-48">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Últimos 30 dias</p>
            {!resumo || resumo.total === 0 ? (
              <p className="text-sm text-slate-400">Sem respostas ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(resumo.porPergunta).map(([pergunta, c]) => (
                  <div key={pergunta} className="text-sm">
                    <p className="font-bold text-slate-700">
                      {pergunta} <span className="text-slate-400 font-normal">({c.total})</span>
                    </p>
                    <div className="flex gap-3 text-xs mt-0.5">
                      <span className="text-emerald-700">😊 {c.positivo}</span>
                      <span className="text-amber-700">😐 {c.neutro}</span>
                      <span className="text-rose-700">😟 {c.negativo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
