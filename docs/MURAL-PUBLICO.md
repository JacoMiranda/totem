# Mural público de transparência

Uma tela **sem login** que a empresa põe numa TV na recepção. Mostra ao
cliente dela o quanto a ouvidoria responde e resolve — cria confiança no
canal ("eles realmente lêem e agem"). É o terceiro público do sistema,
separado do totem (`/atendimento`) e do painel interno (`/admin`).

## O que aparece (e o que nunca aparece)

Recorte **"visão de confiança"** (fixo, ver `App\Services\MuralService`).
Janela: últimos 90 dias por data do atendimento.

| Mostra | Não mostra |
|---|---|
| % de manifestações **respondidas** | número absoluto de manifestações |
| % de casos **resolvidos** | contagem crua de reclamações / de denúncias |
| % respondidas **dentro do prazo** (SLA por urgência) | nomes, protocolos, qualquer dado de quem registrou |
| % de **reclamações + denúncias já resolvidas** | a palavra "denúncia" em lugar nenhum do JSON |
| **tempo médio** para responder | filas, backlog, o que está atrasado |
| **dias sem atraso** (sequência) e **dias ouvindo** | |
| **volume por semana** (barras — só o movimento do canal, não a fila) | |
| **distribuição por teor** em % (Elogio / Sugestão / Dúvida / *Reclamação* — Denúncia entra somada em Reclamação, nunca com rótulo próprio) | |
| **sentimento** em 3 faixas (% Positivo / Neutro / Negativo) | |
| **elogios recentes** (resumo higienizado, unidade, mês) — sem duplicatas | |

O `porPeriodo` (barras) é o único bloco com número absoluto — e de
propósito: é o crescimento do uso do canal, não o tamanho do backlog.
Rodapé fixo de **incentivo** ("a sua opinião muda este lugar — use o
totem") com rostinho SVG, e **esteira de elogios** logo abaixo do
cabeçalho.

Amostra pequena (< 5 manifestações na janela): o mural entra em modo
"estamos começando a ouvir você" em vez de mostrar 0%.

Higienização dos elogios: `MuralService::higienizar()` remove o que
pareça CPF, telefone ou e-mail do resumo antes de exibir, e corta em 170
caracteres. O resumo é gerado pela IA (não é a transcrição, que é
cifrada), risco de PII é baixo — mas a régua está lá.

## Aparência

O admin escolhe em `/admin/mural` entre **claro** (dashboard branco,
cabeçalho azul — igual às peças de marketing) e **escuro** (fundo escuro,
pra TV em ambiente com pouca luz). Só troca as variáveis CSS; layout e
dados iguais. Coluna `mural_tema` em `organizacoes`. O dashboard trava na
altura do monitor (`h-screen` + `overflow-hidden`) — cabe numa tela só,
sem rolagem.

O **rodapé** convida a usar o totem e serve de guia de deslocamento:
`mural_totem_local` (ex.: "Recepção do 2º andar") e `mural_linha_cor`
(ex.: "amarela"). Vazios = "use o totem aqui nesta sala". Com linha, o
rodapé mostra "Siga a linha amarela" com a cor e um traço animado. Tudo
editável em `/admin/mural`.

Um atalho `⚙ painel` fica no canto superior direito, quase invisível
(opacidade 10%), acende no hover — pra quem revisa num computador chegar
ao `/admin`. Numa TV de parede (sem mouse) ninguém repara. O **totem não
tem** nada disso: lá o acesso é só pelo painel de suporte com PIN.

## Acesso

**Opt-in.** Desligado por padrão. O admin da conta liga em
`/admin/mural`, define o título e recebe uma URL:

```
https://SEU-DOMINIO/mural/<token de 40 caracteres>
```

O token é **editável** em `/admin/mural` (`minha-empresa`, `recepcao-hu`…)
ou aleatório de 40 caracteres. Na primeira ativação o default é o slug da
organização, se estiver livre; senão, aleatório. Regras: `[a-z0-9-]`,
mínimo 5, único entre todas as contas, e `resumo`/`config`/`token` são
reservados. Quanto mais óbvio o token, menos privado o link (qualquer um
que adivinhe abre). É semi-público de qualquer forma: quem tem o link vê,
e a página tem `<meta robots noindex>`. Se vazar, "gerar aleatório"
(`POST /api/v1/mural/token`) troca o link e o anterior morre na hora.

## Na tela de espera do totem

Os mesmos números aparecem na **tela de espera do próprio totem** (antes
de "Toque para começar"), com um botão grande **"📣 Fazer minha
manifestação"**. A pessoa vê que a empresa responde 90%+ das
manifestações *antes* de registrar a dela — e registra dali mesmo.

- Endpoint: `GET /api/v1/mural/resumo` (device key, no grupo do totem).
  Usa a organização do device, **não depende de `mural_ativo`** (é a
  própria empresa vendo os seus números).
- `resources/js/kiosk/components/TelaEspera.tsx` — versão clara e enxuta
  (3 indicadores + 1 elogio rotativo + o botão). Degrada pra tela simples
  se a chamada falhar (offline).

## Como funciona por dentro

- **Front**: SPA própria em `resources/js/mural/` (entrada no
  `vite.config.ts`), servida por `GET /mural/{any?}` (blade
  `resources/views/mural.blade.php`). Dashboard claro: cabeçalho azul,
  três indicadores com ícone (respondidas / no prazo / resposta média) e
  três painéis (barras de volume por semana, rosca por teor, rosto de
  sentimento). Esteira de elogios abaixo do cabeçalho e faixa de
  incentivo ao totem no rodapé. Tudo em `vmin` pra escalar em qualquer
  TV. Zero asset externo (o mascote é SVG inline). Recarrega sozinha a
  cada 2 min e ao reganhar foco.
- **API pública**: `GET /api/v1/mural/{token}` (grupo `throttle:20,1`,
  junto da consulta pública de protocolo). Resposta cacheada 120s por
  token (`Cache::remember`), invalidada quando o admin salva ou troca o
  token.
- **API admin**: `GET/PATCH /api/v1/mural` e `POST /api/v1/mural/token`
  (auth:sanctum + Gate `gerenciar-mural` = admin). A organização vem do
  usuário logado (`$request->user()->organizacao`).
- **Isolamento**: `MuralService` filtra explicitamente por
  `organizacao_id` (sem usuário logado o `PorOrganizacao` global scope
  é no-op) e ignora manifestações `anonimizado_em` (LGPD).

## Deploy

Nada de especial no `.env`. É só rebuildar o front (a entrada nova do
Vite entra no `public/build`) e rodar as migrations
(`2026_09_06_000001_add_mural_to_organizacoes`).

Na Hostinger, `GET /mural/*` e `GET /api/v1/mural/*` são públicos — o
edge/CDN pode cachear a resposta da API; o `Cache-Control` padrão do
Laravel (`no-store` em respostas sem sessão? não) — se precisar, ajustar
um header na rota. Por ora o cache de 120s no app já segura o volume.

## Números da empresa-demo

`php artisan ouvidoria:semear-demo` liga o mural da "Rede Aurora" num
token fixo (`/mural/demoredeauroraouvidoria`) com ~170 manifestações que
produzem números realistas e bons (~92% respondidas, ~82% resolvidas,
~93% no prazo). Ver [DEMO-APRESENTACAO.md](DEMO-APRESENTACAO.md).
