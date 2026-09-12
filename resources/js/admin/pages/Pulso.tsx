import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * s-Totem (era "Pulso Rápido") - QR impresso pro estabelecimento que não
 * tem tablet/totem: o cliente escaneia, responde 2-3 perguntas com 3
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

  const excluir = async (p: Ponto) => {
    if (!window.confirm(`Excluir "${p.nome}"? O QR impresso para de funcionar e o histórico de respostas dele some. Não dá pra desfazer.`)) return;
    await api.delete(`/pulso-pontos/${p.id}`);
    carregar();
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">s-Totem</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sem tablet ou totem na unidade? Imprima o QR de um ponto e cole no balcão - o cliente
          escaneia pelo celular, toca em 3 carinhas por pergunta e pronto. Cada abertura vale por 3
          minutos e só pode ser usada uma vez.
        </p>
      </div>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      <PainelPublico />

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
            onExcluir={() => excluir(p)}
            onSalvo={carregar}
          />
        ))}
      </div>
    </div>
  );
}

interface PainelConfig {
  ativo: boolean;
  token: string | null;
  url: string | null;
}

/** A "tela de LED" do pitch original: 1 link por empresa, agregando todos os pontos ativos. */
function PainelPublico() {
  const [cfg, setCfg] = useState<PainelConfig | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => api.get('/s-totem-painel').then(({ data }) => setCfg(data));

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    if (cfg?.url) QRCode.toDataURL(cfg.url, { width: 160, margin: 1 }).then(setQr);
    else setQr(null);
  }, [cfg?.url]);

  const alternar = async () => {
    setSalvando(true);
    try {
      const { data } = await api.patch('/s-totem-painel', { ativo: !cfg?.ativo });
      setCfg(data);
    } finally {
      setSalvando(false);
    }
  };

  const regenerar = async () => {
    if (!window.confirm('O link atual do painel deixa de funcionar. Continuar?')) return;
    const { data } = await api.post('/s-totem-painel/token');
    setCfg(data);
  };

  if (!cfg) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-56">
        <p className="font-extrabold text-slate-900">Painel público (TV/tablet na recepção)</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Mostra o quantitativo de todos os pontos ativos juntos - pra deixar ligado numa tela.
        </p>
        {cfg.url && (
          <a href={cfg.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline break-all block mt-2">
            {cfg.url}
          </a>
        )}
      </div>

      {cfg.ativo && qr && <img src={qr} alt="QR do painel público" className="rounded-lg border border-slate-200" />}

      <div className="flex flex-col gap-2 items-end">
        <button
          type="button"
          disabled={salvando}
          onClick={alternar}
          className={`rounded-lg text-xs font-bold px-3 py-1.5 disabled:opacity-40 ${cfg.ativo ? 'bg-slate-100 text-slate-700' : 'bg-blue-600 text-white'}`}
        >
          {cfg.ativo ? 'Desligar painel' : 'Ligar painel'}
        </button>
        {cfg.ativo && (
          <button type="button" onClick={regenerar} className="text-xs text-rose-600 underline">
            Gerar novo link
          </button>
        )}
      </div>
    </div>
  );
}

function CardPonto({
  ponto,
  aberto,
  onToggleAberto,
  onAlternarAtivo,
  onExcluir,
  onSalvo,
}: {
  ponto: Ponto;
  aberto: boolean;
  onToggleAberto: () => void;
  onAlternarAtivo: () => void;
  onExcluir: () => void;
  onSalvo: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(ponto.nome);
  const [unidade, setUnidade] = useState(ponto.unidade ?? '');
  const [perguntas, setPerguntas] = useState(ponto.perguntas.join(', '));
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    QRCode.toDataURL(ponto.url, { width: 220, margin: 1 }).then(setQr);
    api.get(`/pulso-pontos/${ponto.id}/resumo`).then(({ data }) => setResumo(data));
  }, [aberto, ponto.id, ponto.url]);

  // Se a lista recarregar (outro card salvou, etc.) e este card não estiver
  // em edição, mantém os campos sincronizados com o que veio do servidor.
  useEffect(() => {
    if (editando) return;
    setNome(ponto.nome);
    setUnidade(ponto.unidade ?? '');
    setPerguntas(ponto.perguntas.join(', '));
  }, [editando, ponto.nome, ponto.unidade, ponto.perguntas]);

  const salvar = async () => {
    setErroEdicao(null);
    setSalvando(true);
    try {
      const listaPerguntas = perguntas
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 4);
      await api.patch(`/pulso-pontos/${ponto.id}`, {
        nome,
        unidade: unidade.trim() || null,
        ...(listaPerguntas.length > 0 ? { perguntas: listaPerguntas } : {}),
      });
      setEditando(false);
      onSalvo();
    } catch {
      setErroEdicao('Não foi possível salvar. Confira o nome e as perguntas.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 gap-3">
        <button type="button" onClick={onToggleAberto} className="flex-1 text-left min-w-0">
          <p className="font-extrabold text-slate-900 truncate">
            {ponto.nome} {ponto.unidade && <span className="text-slate-400 font-normal">· {ponto.unidade}</span>}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{ponto.perguntas.join(' · ')}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando((v) => !v);
            if (!aberto) onToggleAberto();
          }}
          className="text-xs font-bold text-blue-700 shrink-0"
        >
          {editando ? 'Cancelar' : 'Editar'}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${ponto.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
          {ponto.ativo ? 'ativo' : 'desativado'}
        </span>
      </div>

      {aberto && editando && (
        <div className="border-t border-slate-100 p-4 flex flex-col gap-3">
          {erroEdicao && <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2">{erroEdicao}</p>}
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-bold text-slate-500 flex-1 min-w-40">
              Nome do ponto
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-bold text-slate-500 flex-1 min-w-32">
              Unidade (opcional)
              <input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="text-xs font-bold text-slate-500">
            Perguntas (separadas por vírgula, até 4)
            <input
              value={perguntas}
              onChange={(e) => setPerguntas(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={salvando || !nome.trim()}
              onClick={salvar}
              className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-40"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {aberto && !editando && (
        <div className="border-t border-slate-100 p-4 flex flex-wrap gap-6">
          <div className="flex flex-col items-center gap-2">
            {qr && <img src={qr} alt={`QR code de ${ponto.nome}`} className="rounded-lg border border-slate-200" />}
            <a href={ponto.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline break-all">
              {ponto.url}
            </a>
            <button type="button" onClick={onAlternarAtivo} className="text-xs text-rose-600 underline">
              {ponto.ativo ? 'Desativar ponto' : 'Reativar ponto'}
            </button>
            <button type="button" onClick={onExcluir} className="text-xs text-rose-600 underline">
              Excluir ponto
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
