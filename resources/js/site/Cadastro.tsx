import { useEffect, useMemo, useState } from 'react';
import { codigoDoTotem } from '../shared/nomeTotem';
import {
  type Plano,
  type RespostaCadastro,
  cadastrar,
  entregarSessaoAoPainel,
  mensagemErro,
} from './api';

/**
 * Formulário de cadastro. O diferencial aqui é a PRÉ-VISUALIZAÇÃO: à medida
 * que o cliente digita o nome da empresa e o local de cada totem, ele já vê
 * o código que cada um vai receber (LuizaBrok-01-Recepcao). Assim ninguém
 * descobre a convenção de nomes só depois de criar a conta.
 */
export function Cadastro({ planos, planoInicial }: { planos: Plano[]; planoInicial: Plano | null }) {
  const [empresa, setEmpresa] = useState('');
  const [documento, setDocumento] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [planoSlug, setPlanoSlug] = useState('');
  const [locais, setLocais] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<RespostaCadastro | null>(null);

  // Primeiro plano disponível como padrão; a escolha feita nos cards manda.
  useEffect(() => {
    if (planoInicial) setPlanoSlug(planoInicial.slug);
    else if (!planoSlug && planos.length > 0) setPlanoSlug(planos[0].slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoInicial, planos]);

  const plano = useMemo(() => planos.find((p) => p.slug === planoSlug) ?? null, [planos, planoSlug]);
  const quantidade = plano?.limiteDispositivos ?? 0;

  const definirLocal = (indice: number, valor: string) => {
    setLocais((atual) => {
      const copia = [...atual];
      copia[indice] = valor;

      return copia;
    });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await cadastrar({
        empresa: empresa.trim(),
        documento: documento.trim() || undefined,
        responsavel: responsavel.trim(),
        email: email.trim(),
        senha,
        planoSlug,
        locais: Array.from({ length: quantidade }, (_, i) => locais[i] ?? ''),
      });
      entregarSessaoAoPainel(resposta);
      setSucesso(resposta);
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível criar a conta agora.'));
    } finally {
      setEnviando(false);
    }
  };

  // ------------------------------------------------------------- sucesso
  if (sucesso) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-2xl flex flex-col gap-5">
        <div className="text-center">
          <div className="text-5xl">✅</div>
          <h3 className="mt-3 text-2xl font-extrabold text-slate-900">Conta criada!</h3>
          <p className="mt-1 text-sm text-slate-600">
            {sucesso.organizacao.nome} · plano {sucesso.organizacao.plano.nome}
            {sucesso.organizacao.trialExpiraEm && (
              <> · teste até {new Date(sucesso.organizacao.trialExpiraEm).toLocaleDateString('pt-BR')}</>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Seus totens já estão criados
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {sucesso.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-mono font-bold text-slate-900">{d.codigo}</span>
                <span className="text-slate-500 text-xs">{d.unidade ?? 'sem local definido'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-bold">Para colocar um totem no ar:</p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-blue-800">
            <li>Abra <span className="font-mono">/atendimento</span> na máquina que vai ser o totem</li>
            <li>Entre com o e-mail e a senha que você acabou de criar</li>
            <li>Toque no totem da lista — aquela máquina vira aquele totem</li>
          </ol>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href="/admin"
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white py-4 text-center font-extrabold transition-colors"
          >
            Ir para o painel
          </a>
          <a
            href="/atendimento"
            className="rounded-2xl border-2 border-slate-200 hover:border-slate-300 py-4 text-center font-extrabold text-slate-700 transition-colors"
          >
            Configurar um totem
          </a>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- formulário
  return (
    <form onSubmit={enviar} className="rounded-3xl bg-white p-8 shadow-2xl flex flex-col gap-5">
      {erro && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{erro}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <Campo rotulo="Nome da empresa ou órgão" obrigatorio>
          <input
            required
            minLength={2}
            className={estiloInput}
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Luiza Brok"
          />
        </Campo>
        <Campo rotulo="CNPJ (opcional)">
          <input
            className={estiloInput}
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="00.000.000/0001-00"
          />
        </Campo>
        <Campo rotulo="Seu nome" obrigatorio>
          <input
            required
            minLength={2}
            className={estiloInput}
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
          />
        </Campo>
        <Campo rotulo="E-mail" obrigatorio>
          <input
            required
            type="email"
            autoComplete="email"
            className={estiloInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Senha (mínimo 8 caracteres)" obrigatorio>
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            className={estiloInput}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Plano" obrigatorio>
          <select className={estiloInput} value={planoSlug} onChange={(e) => setPlanoSlug(e.target.value)}>
            {planos.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nome} — {p.limiteDispositivos} {p.limiteDispositivos === 1 ? 'totem' : 'totens'}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {quantidade > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Onde cada totem vai ficar <span className="font-medium normal-case">(opcional)</span>
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {Array.from({ length: quantidade }, (_, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  className={`${estiloInput} sm:flex-1`}
                  value={locais[i] ?? ''}
                  onChange={(e) => definirLocal(i, e.target.value)}
                  placeholder={i === 0 ? 'Recepção' : `Local do totem ${i + 1}`}
                />
                {/* Pré-visualização do nome que o backend vai gerar. */}
                <span className="font-mono text-xs text-slate-500 sm:w-64 sm:text-right truncate">
                  {codigoDoTotem(empresa || 'SuaEmpresa', i + 1, locais[i])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando || planos.length === 0}
        className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white py-4 font-extrabold text-base disabled:opacity-40 transition-colors"
      >
        {enviando ? 'Criando a sua conta…' : 'Criar conta e provisionar totens'}
      </button>

      <p className="text-center text-xs text-slate-500">
        Ao criar a conta você concorda com o tratamento dos dados conforme a LGPD.
      </p>
    </form>
  );
}

const estiloInput =
  'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all';

function Campo({
  rotulo,
  obrigatorio,
  children,
}: {
  rotulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
        {rotulo}
        {obrigatorio && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
