import { useEffect, useState } from 'react';
import { Cadastro } from './Cadastro';
import { type Plano, carregarPlanos } from './api';

/**
 * Vídeo de apresentação. Por padrão toca o arquivo local
 * (public/midia/apresentacao.mp4). Se `VITE_HOME_VIDEO` estiver definido
 * (ID ou URL do YouTube), embuti o player do YouTube - útil quando o
 * arquivo ficar grande demais pra servir do próprio site.
 */
function VideoApresentacao() {
  const bruto = (import.meta.env.VITE_HOME_VIDEO ?? '').trim();
  const idYoutube = bruto.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(bruto) ? bruto : '');

  return (
    <div className="mt-12 max-w-3xl mx-auto rounded-3xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-900/10 bg-black aspect-video">
      {idYoutube ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${idYoutube}`}
          title="Como funciona o totem de ouvidoria"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          className="w-full h-full object-cover"
          controls
          preload="metadata"
          poster="/midia/recepcao-totem.png"
        >
          <source src="/midia/apresentacao.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}

/**
 * Home de marketing + cadastro self-service. O totem físico continua
 * abrindo direto em /atendimento; esta página é para quem está avaliando
 * o produto.
 */
export default function App() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoEscolhido, setPlanoEscolhido] = useState<Plano | null>(null);
  const [erroPlanos, setErroPlanos] = useState(false);

  useEffect(() => {
    carregarPlanos()
      .then(setPlanos)
      .catch(() => setErroPlanos(true));
  }, []);

  const irParaCadastro = (plano: Plano) => {
    setPlanoEscolhido(plano);
    requestAnimationFrame(() => document.getElementById('cadastro')?.scrollIntoView({ behavior: 'smooth' }));
  };

  const planoTeste = planos.find((p) => p.trialDias > 0);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="text-2xl">🏛️</span> Ouvidoria Cidadã
          </a>
          <nav className="flex items-center gap-2 sm:gap-5 text-sm font-semibold">
            <a href="#como-funciona" className="hidden sm:inline text-slate-600 hover:text-slate-900">
              Como funciona
            </a>
            <a href="#planos" className="hidden sm:inline text-slate-600 hover:text-slate-900">
              Planos
            </a>
            <a href="/admin" className="text-slate-600 hover:text-slate-900">
              Entrar
            </a>
            <a
              href="#cadastro"
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 transition-colors"
            >
              Criar conta
            </a>
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold px-3 py-1.5">
            🎙️ Atendimento por voz · sem fila, sem formulário
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
            O cidadão fala.
            <br />
            <span className="text-blue-600">O sistema entende.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Um totem de ouvidoria que ouve, transcreve e classifica a manifestação sozinho — e entrega tudo
            organizado para a sua equipe resolver.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#cadastro"
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-base font-extrabold shadow-lg shadow-blue-600/25 transition-all"
            >
              {planoTeste ? `Testar grátis por ${planoTeste.trialDias} dias` : 'Criar minha conta'}
            </a>
            <a
              href="/atendimento"
              className="rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 px-8 py-4 text-base font-extrabold text-slate-700 transition-all"
            >
              Ver o totem funcionando
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Conta de teste descartável. Sem cartão de crédito.
          </p>

          <VideoApresentacao />
        </div>
      </section>

      {/* -------------------------------------------------- como funciona */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center">Como funciona</h2>
        <p className="mt-3 text-center text-slate-600">Três passos, nenhum treinamento necessário.</p>

        <ol className="mt-12 grid md:grid-cols-3 gap-6">
          {[
            {
              n: '1',
              icone: '🎙️',
              titulo: 'O cidadão fala',
              texto:
                'Toca na tela e conta o que aconteceu. O totem lê as instruções em voz alta — quem não lê bem também é atendido.',
            },
            {
              n: '2',
              icone: '🧠',
              titulo: 'O sistema classifica',
              texto:
                'A fala vira texto e é classificada por teor (elogio, reclamação, denúncia...), sentimento e urgência. O cidadão confirma antes de enviar.',
            },
            {
              n: '3',
              icone: '📊',
              titulo: 'A equipe resolve',
              texto:
                'Tudo chega no painel com protocolo, prioridade e histórico. O cidadão acompanha pelo número do protocolo.',
            },
          ].map((p) => (
            <li key={p.n} className="rounded-3xl border border-slate-200 p-7 hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center">
                  {p.n}
                </span>
                <span className="text-3xl">{p.icone}</span>
              </div>
              <h3 className="mt-4 font-extrabold text-slate-900 text-lg">{p.titulo}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------- na recepção */}
      <section className="max-w-6xl mx-auto px-5 pb-4">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center">Assim fica na recepção</h2>
        <p className="mt-3 text-center text-slate-600 max-w-2xl mx-auto">
          O totem (ou a cabine, para mais privacidade) na entrada, e uma TV com o painel de transparência à
          vista de todos.
        </p>
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <figure className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg shadow-slate-900/5">
            <img
              src="/midia/recepcao-totem.png"
              alt="Totem de ouvidoria na recepção, com o painel de transparência numa TV ao fundo"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </figure>
          <figure className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg shadow-slate-900/5">
            <img
              src="/midia/recepcao-cabine.png"
              alt="Cabine de manifestação fechada para mais privacidade, e a recepção acompanhando os indicadores"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </figure>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Imagens ilustrativas.</p>
      </section>

      {/* ---------------------------------------------------- benefícios */}
      <section className="bg-slate-50 border-y border-slate-200 mt-16">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="text-3xl font-extrabold text-slate-900 text-center">Por que um totem de voz</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              ['🗣️', 'Acessível de verdade', 'Quem não lê ou não escreve bem consegue registrar sozinho. Todas as instruções são faladas.'],
              ['⚡', 'Registro em menos de um minuto', 'Sem formulário longo, sem cadastro obrigatório. Falar é mais rápido que digitar.'],
              ['🕵️', 'Anônimo por padrão', 'Identificar-se é opcional. Denúncias não dependem de expor quem denuncia.'],
              ['📡', 'Funciona sem internet', 'Se a rede cair, o totem continua atendendo e sincroniza sozinho quando voltar. Nada se perde.'],
              ['🔒', 'Conforme a LGPD', 'Consentimento explícito e falado, retenção com prazo e expurgo automático, acesso auditado.'],
              ['📈', 'Decisão com dado', 'Relatórios por categoria, sentimento e urgência mostram o que realmente trava o atendimento.'],
            ].map(([icone, titulo, texto]) => (
              <div key={titulo} className="rounded-3xl bg-white border border-slate-200 p-6">
                <span className="text-3xl">{icone}</span>
                <h3 className="mt-3 font-extrabold text-slate-900">{titulo}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- planos */}
      <section id="planos" className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center">Planos</h2>
        <p className="mt-3 text-center text-slate-600">Escolha quantos totens você precisa. Dá para mudar depois.</p>

        {erroPlanos ? (
          <p className="mt-10 text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-md mx-auto">
            Não consegui carregar os planos agora. Recarregue a página em instantes.
          </p>
        ) : (
          <div className="mt-12 grid md:grid-cols-3 gap-6 items-start">
            {planos.map((plano) => (
              <div
                key={plano.slug}
                className={`rounded-3xl border-2 p-7 flex flex-col gap-4 ${
                  plano.trialDias > 0 ? 'border-blue-500 shadow-lg shadow-blue-600/10' : 'border-slate-200'
                }`}
              >
                {plano.trialDias > 0 && (
                  <span className="self-start rounded-full bg-blue-600 text-white text-[11px] font-extrabold px-3 py-1">
                    COMECE POR AQUI
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{plano.nome}</h3>
                  <p className="text-sm text-slate-600 mt-1">{plano.descricao}</p>
                </div>

                <div>
                  {/* Preços ainda não definidos: dizemos isso, em vez de
                      exibir um número que não existe. */}
                  {plano.precoFormatado ? (
                    <span className="text-3xl font-extrabold text-slate-900">{plano.precoFormatado}</span>
                  ) : plano.trialDias > 0 ? (
                    <span className="text-3xl font-extrabold text-slate-900">Grátis</span>
                  ) : (
                    <span className="text-2xl font-extrabold text-slate-500">Sob consulta</span>
                  )}
                  <span className="block text-xs text-slate-500 mt-1">
                    {plano.limiteDispositivos} {plano.limiteDispositivos === 1 ? 'totem' : 'totens'}
                  </span>
                </div>

                <ul className="flex flex-col gap-2 text-sm text-slate-700">
                  {plano.recursos.map((r) => (
                    <li key={r} className="flex gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => irParaCadastro(plano)}
                  className={`mt-auto rounded-2xl py-3.5 font-extrabold text-sm transition-colors ${
                    plano.trialDias > 0
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {plano.trialDias > 0 ? 'Testar grátis' : 'Escolher'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- cadastro */}
      <section id="cadastro" className="bg-slate-900 py-20">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl font-extrabold text-white text-center">Criar a sua conta</h2>
          <p className="mt-3 text-center text-slate-400">
            Os totens já saem nomeados e prontos para parear.
          </p>
          <div className="mt-10">
            <Cadastro planos={planos} planoInicial={planoEscolhido} />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span>🏛️ Ouvidoria Cidadã</span>
          <div className="flex gap-5">
            {/* "Acompanhar protocolo" volta aqui quando a página pública
                existir (Fase 6) - o endpoint já existe, a tela não. Link
                para 404 é pior que link ausente. */}
            <a href="/admin" className="hover:text-slate-800">
              Entrar no painel
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
