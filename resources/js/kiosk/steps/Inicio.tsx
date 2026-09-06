import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { falarFrase, falarSequencia, pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 1 (Início). Sequência pensada para quem não lê bem — tudo é falado:
 *
 *   1. Tela em espera: "Toque para começar" (o autoplay do navegador só
 *      libera depois de um gesto, então a fala começa no primeiro toque).
 *   2. Toque -> fala as boas-vindas e, em seguida, LÊ o texto do
 *      consentimento LGPD por inteiro.
 *   3. Aparecem duas opções GRANDES: "Sim, concordo" / "Não concordo".
 *
 * O consentimento é obrigatório e explícito - não é checkbox pré-marcado,
 * é uma escolha ativa entre dois botões (LGPD art. 8º: consentimento
 * informado e inequívoco). Identificar-se continua opcional.
 */
export function Inicio() {
  const { setConsentimento, requerente, setRequerente, irPara } = useJourneyStore();
  const [iniciado, setIniciado] = useState(false);
  const [recusou, setRecusou] = useState(false);
  const [falando, setFalando] = useState(false);
  const [mostrarIdentificacao, setMostrarIdentificacao] = useState(false);
  const [tipo, setTipo] = useState<'person' | 'company'>('person');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abriuRef = useRef(false);

  useEffect(() => pararFala, []);

  /**
   * Boas-vindas + leitura do consentimento, encadeadas. `falarSequencia`
   * aborta a fila se a fala for interrompida - se o cidadão tocar em
   * "Concordo" no meio, nada mais é falado por cima da próxima tela.
   */
  const falarAbertura = async () => {
    setFalando(true);
    await falarSequencia('boas-vindas', 'inicio-consentimento');
    setFalando(false);
  };

  const comecar = () => {
    if (abriuRef.current) return;
    abriuRef.current = true;
    setIniciado(true);
    setRecusou(false);
    void falarAbertura();
  };

  /**
   * Pode ser tocado a qualquer momento, inclusive no meio da leitura: a
   * fala é interrompida na hora e a jornada segue. Prender o botão até o
   * áudio acabar obrigaria todo mundo a ouvir ~25s de texto legal a cada
   * atendimento; o consentimento é informado porque a pessoa TEM ACESSO ao
   * conteúdo (texto na tela + botão "Ouvir novamente"), não porque foi
   * forçada a ouvir tudo.
   */
  const aceitar = () => {
    pararFala();
    setFalando(false);
    setConsentimento(true);
    irPara('relato');
  };

  const recusar = async () => {
    pararFala(); // corta a leitura em andamento antes do aviso de recusa
    setFalando(false);
    setConsentimento(false);
    setRecusou(true);
    setIniciado(false);
    abriuRef.current = false;
    setMostrarIdentificacao(false);
    setRequerente(null);
    await falarFrase('consentimento-recusado');
  };

  const identificar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      if (tipo === 'person') {
        const { data } = await api.post('/people', { nome, cpf: documento });
        setRequerente({ type: 'person', id: data.id, label: data.nome });
      } else {
        const { data } = await api.post('/companies', { razaoSocial: nome, cnpj: documento });
        setRequerente({ type: 'company', id: data.id, label: data.razaoSocial });
      }
      setMostrarIdentificacao(false);
    } catch {
      setErro('Não foi possível confirmar os dados agora. Pode seguir anônimo e tentar se identificar depois.');
    } finally {
      setEnviando(false);
    }
  };

  // ---------------------------------------------------------------- espera
  if (!iniciado) {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6 cursor-pointer"
        onPointerDown={comecar}
      >
        <div className="w-full max-w-lg text-center flex flex-col items-center gap-6">
          <div className="text-7xl">🏛️</div>
          <h1 className="text-3xl font-extrabold text-slate-900">Ouvidoria Cidadã</h1>

          {recusou && (
            <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              Sem a sua concordância não podemos registrar o relato. Se mudar de ideia, é só tocar na tela.
            </p>
          )}

          <button
            type="button"
            onClick={comecar}
            className="w-full max-w-md rounded-3xl bg-blue-600 py-10 text-2xl font-extrabold text-white shadow-xl animate-pulse"
          >
            Toque para começar
          </button>
          <p className="text-sm text-slate-500">O seu relato ajuda a melhorar o atendimento público.</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------- consentimento (LGPD)
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-5">
        <header className="text-center">
          <div className="text-4xl">🏛️</div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Antes de começar</h1>
        </header>

        {/* Identificação é opcional e vem ANTES do aceite, porque o texto do
            consentimento fala em "se eu optar por me identificar acima". */}
        {requerente ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl p-3 flex items-center justify-between">
            <span>Identificado(a) como {requerente.label}</span>
            <button type="button" className="underline text-xs" onClick={() => setRequerente(null)}>
              remover
            </button>
          </div>
        ) : mostrarIdentificacao ? (
          <div className="text-left flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTipo('person')}
                className={`flex-1 rounded-lg py-2 ${tipo === 'person' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`}
              >
                Pessoa física
              </button>
              <button
                type="button"
                onClick={() => setTipo('company')}
                className={`flex-1 rounded-lg py-2 ${tipo === 'company' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`}
              >
                Empresa
              </button>
            </div>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={tipo === 'person' ? 'Nome completo' : 'Razão social'}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={tipo === 'person' ? 'CPF' : 'CNPJ'}
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
            {erro && <p className="text-xs text-rose-600">{erro}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={enviando || !nome.trim() || !documento.trim()}
                onClick={identificar}
                className="flex-1 rounded-lg bg-blue-600 text-white text-sm font-bold py-2 disabled:opacity-40"
              >
                {enviando ? 'Confirmando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarIdentificacao(false)}
                className="rounded-lg border border-slate-300 text-sm font-bold py-2 px-4"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarIdentificacao(true)}
            className="text-sm text-blue-700 underline self-center"
          >
            Desejo me identificar (opcional)
          </button>
        )}

        {/* Texto lido em voz alta por `inicio-consentimento` - manter os dois
            em sintonia (config/kiosk_audio.php). */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <p className="text-base text-slate-800 leading-relaxed">
            Concordo que meu relato seja registrado para fins de melhoria do atendimento público, conforme a
            Lei Geral de Proteção de Dados (LGPD). Meus dados de identificação são opcionais e só ficam
            vinculados se eu optar por me identificar acima.
          </p>
          {/* Enquanto lê, o mesmo botão vira "parar": dá controle ao cidadão
              sem trancar a jornada esperando o áudio acabar. */}
          <button
            type="button"
            onClick={() => {
              if (falando) {
                pararFala();
                setFalando(false);

                return;
              }
              setFalando(true);
              void falarFrase('inicio-consentimento').then(() => setFalando(false));
            }}
            className="mt-3 text-sm font-bold text-blue-700 underline"
          >
            {falando ? '⏸ Parar leitura' : '🔊 Ouvir novamente'}
          </button>
        </div>

        <p className="text-center text-sm font-bold text-slate-700">Você concorda?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={aceitar}
            className="rounded-3xl bg-emerald-600 hover:bg-emerald-700 py-8 text-xl font-extrabold text-white shadow-lg transition-all"
          >
            ✓ Sim, concordo
          </button>
          <button
            type="button"
            onClick={recusar}
            className="rounded-3xl bg-white border-2 border-slate-300 hover:bg-slate-50 py-8 text-xl font-extrabold text-slate-700 shadow-sm transition-all"
          >
            ✕ Não concordo
          </button>
        </div>
      </div>
    </main>
  );
}
