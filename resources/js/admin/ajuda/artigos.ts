/**
 * Conteúdo da Central de Ajuda (/admin/ajuda). Estático, versionado no
 * repositório - editar aqui é o jeito de manter o guia atualizado.
 *
 * `publico`:
 *   - 'equipe'  → a equipe do cliente que comprou (aparece pra todos os papéis)
 *   - 'tecnico' → operação/infra da plataforma (só papel admin)
 *
 * `corpo` é uma lista de blocos simples pra não precisar de parser de
 * markdown: `h` (subtítulo), `p` (parágrafo), `ul` (lista), `passos`
 * (lista numerada), `nota` (caixa de destaque), `codigo`.
 */
export type Bloco =
  | { h: string }
  | { p: string }
  | { ul: string[] }
  | { passos: string[] }
  | { nota: string }
  | { codigo: string };

export interface Artigo {
  id: string;
  titulo: string;
  publico: 'equipe' | 'tecnico';
  categoria: string;
  tags: string[];
  corpo: Bloco[];
}

export const ARTIGOS: Artigo[] = [
  // ===================================================== EQUIPE / CLIENTE
  {
    id: 'papeis',
    titulo: 'Papéis da equipe: quem pode fazer o quê',
    publico: 'equipe',
    categoria: 'Primeiros passos',
    tags: ['permissão', 'acesso', 'papel', 'admin', 'analista', 'atendente', 'leitor'],
    corpo: [
      { p: 'Cada pessoa da equipe tem um papel. A hierarquia é: leitor < atendente < analista < admin. Um papel sempre pode fazer tudo do papel abaixo.' },
      {
        ul: [
          'Leitor — vê a lista e o detalhe das manifestações. Não altera nada.',
          'Atendente — muda status e adiciona notas internas.',
          'Analista — atribui responsável, reclassifica, escreve e publica a resposta oficial, ouve o áudio, vê relatórios.',
          'Admin — tudo acima + cadastra a equipe, os totens, o mural, e vê os logs.',
        ],
      },
      { nota: 'O papel é definido em Equipe (menu do painel), só por um admin.' },
    ],
  },
  {
    id: 'perfil',
    titulo: 'Meu perfil: trocar nome e senha',
    publico: 'equipe',
    categoria: 'Primeiros passos',
    tags: ['perfil', 'senha', 'nome', 'trocar senha', 'conta'],
    corpo: [
      { p: 'Clique no seu nome no canto superior direito do painel para abrir "Meu perfil".' },
      {
        ul: [
          'Nome — muda o que aparece pra equipe (e como responsável de manifestações).',
          'Senha — exige a senha atual + a nova (mínimo 8 caracteres).',
        ],
      },
      { nota: 'E-mail e papel não se mudam aqui. Papel é o admin quem define, em Equipe. Esqueceu a senha e não consegue entrar? Um admin redefine pra você em Equipe.' },
    ],
  },
  {
    id: 'primeiro-acesso',
    titulo: 'Primeiro acesso ao painel',
    publico: 'equipe',
    categoria: 'Primeiros passos',
    tags: ['login', 'entrar', 'senha', 'painel'],
    corpo: [
      { passos: [
        'Acesse o endereço do painel (termina em /admin) com o e-mail e a senha que você recebeu.',
        'No primeiro login, troque a senha em algum lugar seguro (o admin pode redefinir a sua senha em Equipe).',
        'O menu do topo muda conforme o seu papel — se não vê "Equipe" ou "Dispositivos", é porque você não é admin.',
      ] },
      { p: 'A sessão expira sozinha depois de algumas horas de inatividade — é só entrar de novo.' },
    ],
  },
  {
    id: 'fluxo-manifestacao',
    titulo: 'Como uma manifestação chega e é distribuída',
    publico: 'equipe',
    categoria: 'Manifestações',
    tags: ['distribuição', 'automático', 'responsável', 'rodízio', 'fila'],
    corpo: [
      { p: 'Quando o cidadão termina no totem, a manifestação entra no painel com status "Recebida", protocolo e a classificação automática (teor, sentimento, urgência).' },
      { p: 'Ela já entra atribuída a alguém: o sistema escolhe quem está com MENOS casos em aberto entre as pessoas que você marcou no rodízio (em Equipe → coluna "Rodízio"). Se ninguém está no rodízio, ela fica sem responsável e alguém precisa atribuir à mão.' },
      { nota: 'Manifestação de urgência Crítica ou teor Denúncia também dispara uma notificação (se o canal de notificação estiver configurado).' },
    ],
  },
  {
    id: 'atender',
    titulo: 'Atender uma manifestação do começo ao fim',
    publico: 'equipe',
    categoria: 'Manifestações',
    tags: ['status', 'resposta', 'nota', 'resolver', 'concluir', 'áudio'],
    corpo: [
      { p: 'Abra a manifestação pelo protocolo na lista. No detalhe você tem tudo:' },
      {
        ul: [
          'Relato — a transcrição e o botão para ouvir o áudio original (analista+).',
          'Reclassificar — corrija teor / sentimento / urgência se a IA errou.',
          'Atribuir responsável — escolha uma pessoa da equipe pelo nome.',
          'Mudar status — Recebida → Em triagem → Em análise → Respondida → Concluída / Arquivada, com um motivo opcional.',
          'Notas internas — o registro da decisão da equipe; o cidadão nunca vê.',
          'Resposta oficial — escreva e marque "Publicar" para o cidadão poder ler pela consulta com protocolo + PIN.',
        ],
      },
      { p: 'Publicar a resposta muda o status para "Respondida" automaticamente. "Concluída" ou "Arquivada" fecha o caso (entra nos indicadores de resolução).' },
    ],
  },
  {
    id: 'minhas',
    titulo: '"Minhas" e "Todas": a sua fila de trabalho',
    publico: 'equipe',
    categoria: 'Manifestações',
    tags: ['fila', 'minhas', 'filtro', 'responsável'],
    corpo: [
      { p: 'Na lista de Manifestações há um botão "Minhas / Todas". Analista e atendente começam vendo só o que é deles ("Minhas"). Admin e leitor começam em "Todas".' },
      { p: 'Em "Todas", o admin ainda pode filtrar por um responsável específico ou por "sem responsável" (as que ninguém pegou).' },
    ],
  },
  {
    id: 'reclassificar',
    titulo: 'Quando a IA classifica errado',
    publico: 'equipe',
    categoria: 'Manifestações',
    tags: ['ia', 'classificação', 'errado', 'corrigir', 'teor', 'sentimento'],
    corpo: [
      { p: 'A classificação automática é um ponto de partida, não a palavra final. Se estiver errada, ajuste em "Reclassificar" no detalhe da manifestação — a mudança fica registrada na linha do tempo.' },
      { p: 'Se a IA estava fora do ar quando a manifestação foi criada, ela vem marcada como "classificação simples" (heurística local). Vale revisar essas com atenção.' },
    ],
  },
  {
    id: 'equipe-cadastro',
    titulo: 'Cadastrar a equipe e configurar o rodízio',
    publico: 'equipe',
    categoria: 'Equipe',
    tags: ['funcionário', 'cadastro', 'rodízio', 'distribuição', 'transferir carga'],
    corpo: [
      { p: 'Menu Equipe (só admin). Ali você:' },
      {
        ul: [
          'Cadastra um funcionário (nome, e-mail, senha, papel).',
          'Liga/desliga o "Rodízio" — quem está ligado recebe manifestações automaticamente. Analistas entram ligados por padrão.',
          'Desativa quem saiu (não some do histórico, só perde o acesso).',
          'Transfere carga — passa TODAS as manifestações em aberto de uma pessoa para outra (útil em férias/desligamento).',
        ],
      },
      { nota: 'Você não consegue rebaixar nem desativar a sua própria conta de admin — isso trancaria o acesso.' },
    ],
  },
  {
    id: 'totens-config',
    titulo: 'Configurar e abrir um totem',
    publico: 'equipe',
    categoria: 'Totens',
    tags: ['dispositivo', 'parear', 'device key', 'abrir totem', 'kiosk'],
    corpo: [
      { p: 'Os totens que você contratou já vêm cadastrados, nomeados a partir da sua empresa (ex.: "LuizaBrok-01-Recepção").' },
      { passos: [
        'Na máquina que vai virar o totem, abra o painel e faça login.',
        'Vá em Dispositivos e clique em "Abrir totem" no dispositivo que essa máquina representa.',
        'O navegador guarda a credencial daquele totem e abre a tela de atendimento. Não precisa repetir — a máquina "vira" aquele totem.',
      ] },
      { p: 'Para trocar o totem daquela máquina: no atendimento, segure 3 segundos o canto inferior direito, digite o PIN de suporte e use "Trocar / re-parear totem" ou "Abrir administração".' },
    ],
  },
  {
    id: 'mural-config',
    titulo: 'O mural de transparência: ligar e configurar',
    publico: 'equipe',
    categoria: 'Mural',
    tags: ['mural', 'transparência', 'tv', 'recepção', 'tema', 'link', 'linha amarela'],
    corpo: [
      { p: 'O mural é uma tela pública (sem login) para uma TV na recepção. Mostra ao seu cliente quanto a ouvidoria responde e resolve — percentuais e tempo de resposta, nunca o volume de reclamações nem denúncias.' },
      { passos: [
        'Menu Mural (só admin) → Ativar. Você recebe um link com um código secreto.',
        'Abra esse link no navegador da TV, em tela cheia.',
        'Escolha a aparência: Claro (branco) ou Escuro (para ambiente com pouca luz).',
        'Em "Como chegar ao totem", diga onde ele fica e, se a instituição usa faixas no chão, qual cor seguir. Em branco = "aqui nesta sala".',
      ] },
      { nota: 'Qualquer pessoa com o link vê o mural. Se ele vazar, gere um link novo — o antigo para na hora.' },
    ],
  },
  {
    id: 'relatorios',
    titulo: 'Relatórios: o que cada número diz',
    publico: 'equipe',
    categoria: 'Relatórios',
    tags: ['relatório', 'gráfico', 'sla', 'prazo', 'backlog', 'métrica'],
    corpo: [
      {
        ul: [
          'Volume no tempo — quantas manifestações por dia/semana/mês. Enxerga sazonalidade ("toda segunda de manhã explode").',
          'Por teor / sentimento / urgência — a distribuição do que chega.',
          'Por status — quantas em cada etapa.',
          'Tempo médio de resolução — da criação até concluir.',
          'Backlog / fora do SLA — quantas estão abertas e quantas já passaram do prazo da sua urgência (Crítica 1 dia, Alta 3, Média 7, Baixa 15).',
        ],
      },
      { p: 'Dá para exportar em CSV para abrir na planilha.' },
    ],
  },
  {
    id: 'cidadao-consulta',
    titulo: 'Como o cidadão acompanha a resposta',
    publico: 'equipe',
    categoria: 'Cidadão e LGPD',
    tags: ['protocolo', 'pin', 'acompanhar', 'consulta', 'cidadão'],
    corpo: [
      { p: 'No fim do atendimento o totem mostra um protocolo e um PIN de 4 dígitos. Com os dois, o cidadão consulta o andamento e lê a resposta oficial quando ela é publicada.' },
      { nota: 'O PIN só aparece uma vez. Se o cidadão perdeu, não dá para recuperar (guardamos só um resumo criptográfico) — ele registra de novo se precisar.' },
    ],
  },
  {
    id: 'lgpd',
    titulo: 'LGPD: consentimento, retenção e exclusão',
    publico: 'equipe',
    categoria: 'Cidadão e LGPD',
    tags: ['lgpd', 'privacidade', 'consentimento', 'anonimizar', 'expurgo', 'dados'],
    corpo: [
      {
        ul: [
          'Consentimento — o totem lê o aviso em voz alta e exige uma escolha ativa "Sim, concordo" / "Não concordo". Sem o sim, nada é registrado.',
          'Identificação é opcional — denúncia não depende de expor quem denuncia.',
          'Retenção — as transcrições ficam criptografadas; há expurgo automático por prazo (configurável).',
          'Exclusão a pedido — o cidadão pode pedir a anonimização/eliminação da própria manifestação usando protocolo + PIN. Manifestações anonimizadas somem dos indicadores do mural.',
        ],
      },
    ],
  },
  {
    id: 'notificacoes',
    titulo: 'Notificações de casos críticos',
    publico: 'equipe',
    categoria: 'Manifestações',
    tags: ['notificação', 'alerta', 'crítica', 'denúncia', 'webhook'],
    corpo: [
      { p: 'Manifestações de urgência Crítica ou teor Denúncia disparam uma notificação para a equipe. O canal (e-mail, webhook, Slack) e quem recebe se configura em Notificações (admin).' },
      { p: 'Sem nenhuma preferência cadastrada, nada é enviado — não há spam por padrão.' },
    ],
  },
  {
    id: 'logs-equipe',
    titulo: 'Quando algo dá errado no totem (Logs)',
    publico: 'equipe',
    categoria: 'Totens',
    tags: ['log', 'erro', 'microfone', 'problema', 'diagnóstico'],
    corpo: [
      { p: 'Menu Logs (admin) mostra as últimas ocorrências do servidor e os erros que o navegador do totem reportou — microfone negado, IA fora do ar, falha ao preparar o áudio.' },
      { p: 'É de diagnóstico, não auditoria: mostra o fim do arquivo, não o histórico completo. Se precisar de ajuda, mande um print dessa tela para o suporte.' },
    ],
  },

  // ================================================= TÉCNICO / PLATAFORMA
  {
    id: 'arquitetura',
    titulo: 'Arquitetura em 1 minuto',
    publico: 'tecnico',
    categoria: 'Arquitetura',
    tags: ['laravel', 'react', 'vite', 'spa', 'gemini', 'sanctum'],
    corpo: [
      { p: 'Um projeto Laravel 13 (PHP 8.4) servindo três SPAs React (Vite): site de marketing em /, totem em /atendimento, painel em /admin, e o mural em /mural/{token}.' },
      {
        ul: [
          'Auth da equipe: Sanctum bearer token. Auth do totem: X-Device-Key (chave por dispositivo).',
          'IA: proxy no backend para a API Gemini — a chave NUNCA vai pro cliente.',
          'Multi-tenant: tudo pendura em organizacoes; um escopo global filtra por organizacao_id.',
          'Banco: SQLite em dev, MySQL em produção. Fila/cache/sessão no banco (hospedagem compartilhada, sem Redis).',
        ],
      },
      { p: 'Detalhes em docs/ARQUITETURA.md e docs/PLANO-SISTEMA-PROFISSIONAL.md.' },
    ],
  },
  {
    id: 'deploy',
    titulo: 'Deploy na Hostinger',
    publico: 'tecnico',
    categoria: 'Deploy',
    tags: ['deploy', 'hostinger', 'ssh', 'build', 'migrate', 'produção'],
    corpo: [
      { passos: [
        '.\\deploy.ps1 — gera dist\\totem-<data>.zip (código + vendor + public/build). O build do front sai daqui: a hospedagem não tem Node.',
        'Envia por scp e, no servidor: unzip, php artisan migrate --force, php artisan db:seed --class=Database\\Seeders\\PlanoSeeder --force, limpar e refazer os caches (config/route/view), copiar public/build para o public_html.',
        'Verificar: /api/v1/health 200, /planos 200, /mural/<token> 200, /atendimento e /admin 200.',
      ] },
      { nota: 'O .env do servidor é independente do local e NÃO vai no pacote. Variáveis novas precisam ser adicionadas à mão no servidor.' },
      { p: 'Passo a passo completo e o log de cada deploy: docs/DEPLOY-HOSTINGER.md.' },
    ],
  },
  {
    id: 'gemini-key',
    titulo: 'Chave da Gemini: erro 401 / "OAuth 2 access token"',
    publico: 'tecnico',
    categoria: 'Problemas comuns',
    tags: ['gemini', 'ia', '401', 'chave', 'api key', 'unauthenticated', 'áudio não transcreve'],
    corpo: [
      { p: 'Sintoma: o totem grava e envia o áudio (aparece em /admin/logs) mas dá 503 AI_UNAVAILABLE; no log do servidor, "GeminiAiService ... status 401 ... Expected OAuth 2 access token".' },
      { p: 'Causa quase sempre: a GEMINI_API_KEY do .env de PRODUÇÃO está desatualizada em relação à local. Os dois ambientes têm .env independentes e o deploy não sobe .env.' },
      { codigo: 'ssh ... "cd domains/.../totem_app && sed -i \'s#^GEMINI_API_KEY=.*#GEMINI_API_KEY=<chave AQ. valida>#\' .env && php artisan config:cache"' },
      { nota: 'Use o formato de chave AQ. (auth key) — não expira. As chaves AIza (padrão) são rejeitadas pelo Google desde set/2026.' },
    ],
  },
  {
    id: 'modo-quiosque',
    titulo: 'Modo quiosque no totem físico',
    publico: 'tecnico',
    categoria: 'Totem físico',
    tags: ['quiosque', 'kiosk', 'fully kiosk', 'chrome', 'assigned access', 'tela cheia', 'pin de suporte'],
    corpo: [
      { p: 'Travar o navegador em tela cheia é função do sistema operacional, não do app:' },
      {
        ul: [
          'Android (tablet): Fully Kiosk Browser (start URL = .../atendimento, lock, auto-reload, detecção de movimento, microfone ON).',
          'Windows (mini-PC): Chrome/Edge com --kiosk, ou Acesso Atribuído do Windows.',
          'iPad: Acesso Guiado.',
        ],
      },
      { p: 'O app soma por cima: painel de suporte (segurar 3s o canto inferior direito → PIN VITE_SUPORTE_PIN → sair da tela cheia, recarregar, abrir administração, re-parear, esvaziar fila), error boundary e reset por inatividade.' },
      { nota: 'TROQUE o VITE_SUPORTE_PIN do default 0000 no build do totem. Detalhes: docs/MODO-QUIOSQUE.md.' },
    ],
  },
  {
    id: 'vosk',
    titulo: 'Transcrição offline (Vosk): quando ligar',
    publico: 'tecnico',
    categoria: 'Totem físico',
    tags: ['vosk', 'offline', 'transcrição', 'sem internet', 'wasm'],
    corpo: [
      { p: 'Por padrão o totem transcreve pela Gemini (servidor). No celular de teste, quando a Gemini cai, o cidadão digita ou usa "Enviar sem escrever".' },
      { p: 'No totem físico vale ligar o Vosk como rede de segurança: VITE_KIOSK_VOSK=true no build + baixar o modelo (~32 MB) com php artisan ouvidoria:baixar-modelo-vosk. Precisão modesta, serve para triagem.' },
      { p: 'VITE_KIOSK_IA_LOCAL=true = nunca chama a Gemini (100% local).' },
    ],
  },
  {
    id: 'demo',
    titulo: 'Empresa-demo para apresentação / vídeo',
    publico: 'tecnico',
    categoria: 'Operação',
    tags: ['demo', 'seed', 'rede aurora', 'apresentação', 'vídeo', 'marketing'],
    corpo: [
      { codigo: 'php artisan ouvidoria:semear-demo --fresh   (--force em produção)' },
      { p: 'Cria a "Rede Aurora": ~170 manifestações em 150 dias, 4 totens, respostas oficiais, equipe (Ana admin + Bruno/Carla analistas), mural já ligado em /mural/demoredeauroraouvidoria. Login demo@aurora.test / demo1234.' },
      { p: 'Roteiro de vídeo pronto para IA: docs/ROTEIRO-VIDEO.md. Roteiro operacional (o que clicar): docs/DEMO-APRESENTACAO.md.' },
    ],
  },
  {
    id: 'logs-tecnico',
    titulo: 'Onde ficam os logs',
    publico: 'tecnico',
    categoria: 'Operação',
    tags: ['log', 'laravel.log', 'kiosk.log', 'monolog', 'debug'],
    corpo: [
      {
        ul: [
          '/admin/logs — tela no painel: fim de storage/logs/laravel.log + os erros do navegador do totem (canal kiosk).',
          'storage/logs/laravel.log — servidor.',
          'storage/logs/kiosk.log — erros reportados pelo navegador do totem (POST /api/v1/client-errors).',
        ],
      },
      { p: 'A tela é diagnóstico (últimas ~500 linhas), não auditoria. Auditoria de ações fica na tabela audit_logs e na linha do tempo de cada manifestação.' },
    ],
  },
  {
    id: 'cron',
    titulo: 'O cron único da Hostinger',
    publico: 'tecnico',
    categoria: 'Operação',
    tags: ['cron', 'agendador', 'schedule', 'fila', 'sla', 'expurgo'],
    corpo: [
      { p: 'A hospedagem compartilhada permite poucos crons — tudo foi concentrado em um agendador a cada minuto:' },
      { codigo: '/usr/bin/php /home/<user>/domains/<dominio>/public_html/totem/artisan schedule:run >> /dev/null 2>&1' },
      { p: 'Ele cobre: fila de notificações, checagem de SLA (de hora em hora) e o expurgo LGPD (de madrugada). Ver routes/console.php.' },
    ],
  },
  {
    id: 'backup',
    titulo: 'Backup e restauração do banco',
    publico: 'tecnico',
    categoria: 'Operação',
    tags: ['backup', 'mysqldump', 'restauração', 'banco'],
    corpo: [
      { p: 'Antes de todo deploy o processo faz um mysqldump em ~/backups_totem/ no servidor. A senha do .env de produção tem caractere que quebra parse_ini_file — pega-se via config() do Laravel e escreve-se um --defaults-extra-file temporário.' },
      { p: 'Restaurar: mysql --defaults-extra-file=... <base> < ~/backups_totem/db-<data>.sql. A Hostinger também mantém backups próprios no hPanel.' },
    ],
  },
  {
    id: 'envs',
    titulo: 'Variáveis de ambiente que importam',
    publico: 'tecnico',
    categoria: 'Deploy',
    tags: ['env', 'variável', 'vite', 'gemini', 'configuração'],
    corpo: [
      {
        ul: [
          'GEMINI_API_KEY / GEMINI_TEXT_MODEL — a IA (só no servidor). Formato AQ.',
          'VITE_SUPORTE_PIN — PIN do painel de suporte do totem. TROCAR do 0000.',
          'VITE_KIOSK_VOSK / VITE_KIOSK_IA_LOCAL — transcrição offline / 100% local.',
          'VITE_HOME_VIDEO — vídeo da home; vazio usa public/midia/apresentacao.mp4, ou um link do YouTube.',
          'VITE_PWA — Service Worker (cacheia o modelo Vosk para offline real).',
        ],
      },
      { nota: 'As VITE_* entram no bundle NA HORA DO BUILD. Mudou uma? Rode npm run build e reenvie public/build.' },
    ],
  },
  {
    id: 'problemas-comuns',
    titulo: 'Problemas comuns e o que checar',
    publico: 'tecnico',
    categoria: 'Problemas comuns',
    tags: ['troubleshooting', 'microfone', 'tela branca', 'csp', 'celular', 'erro'],
    corpo: [
      {
        ul: [
          'Microfone não pega no celular — precisa ser HTTPS (contexto seguro). No Android o ditado ao vivo é desligado de propósito (conflito com a gravação); a transcrição vem do servidor ao parar.',
          'Tela branca no totem — o ErrorBoundary deve mostrar "recomeçar"; se for tela branca de verdade, ver /admin/logs (canal kiosk) e o console do navegador. Service Worker antigo? o app desregistra SW quando VITE_PWA != true.',
          'CSP bloqueando algo — SecurityHeaders.php monta a CSP. Em produção a Hostinger (edge/CDN) às vezes substitui por upgrade-insecure-requests.',
          '/api/v1/* dando 500 em vez de 401 — falta o Accept: application/json; já corrigido em bootstrap/app.php (redirectGuestsTo(null) + shouldRenderJsonWhen).',
        ],
      },
    ],
  },
];
