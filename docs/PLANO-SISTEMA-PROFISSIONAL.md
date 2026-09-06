# Ouvidoria Cidadã — Plano de Transformação em Sistema Profissional

> Documento de planejamento. Objetivo: partir do protótipo `cabine_de_ouvidoria_inteligente.html`
> (HTML único, Tailwind CDN, dados em memória, `apiKey` vazia injetada em runtime no navegador —
> chamada de IA feita direto do cliente para o Google) e chegar a um
> **sistema full-stack de produção** para operação em **totem/kiosk**, com **armazenamento local
> offline-first + sincronização com banco remoto**, **proxy seguro de IA (Gemini)**, **painel
> administrativo**, **relatórios/métricas**, **acompanhamento público por protocolo** e **notificações**.

Ler junto com:
- [`ARQUITETURA.md`](ARQUITETURA.md) — stack, monorepo, sync offline, segurança, deploy do totem
- [`MODELO-DADOS.md`](MODELO-DADOS.md) — schema do banco e enums
- [`API.md`](API.md) — contrato dos endpoints
- [`MIGRACAO-DO-PROTOTIPO.md`](MIGRACAO-DO-PROTOTIPO.md) — de onde sai cada pedaço do HTML atual

---

## 1. Decisões já tomadas (input do cliente)

| Tema | Decisão |
|---|---|
| Alcance | Full-stack completo (backend + banco + painel admin + auth + proxy de IA) |
| Persistência | **Offline-first**: armazenamento local no totem **+ sincronização** com banco remoto |
| Implantação | **Totem / Kiosk** (navegador em tela cheia em hardware dedicado) |
| IA | Manter **Gemini**, mas com a **chave no backend** (proxy). Hoje a chamada sai do navegador com `apiKey` injetada em runtime; em produção o cliente nunca deve ver a chave |
| Gestão | Painel administrativo, Relatórios e métricas, Acompanhamento pelo cidadão, Notificações |

## 2. Decisões em aberto (resolver no início da próxima sessão)

1. **Framework de frontend**: recomendação **React + Vite + TypeScript** (bom para o painel admin;
   kiosk funciona bem como PWA). Alternativas: Vue 3, Svelte.
2. **Framework de backend**: recomendação **Fastify + TypeScript + Prisma**. Alternativa: NestJS
   (mais estrutura/boilerplate, bom se o time crescer).
3. **Banco**: recomendação **PostgreSQL**. 
4. **Armazenamento de áudio**: **S3-compatível (MinIO on-prem ou AWS S3)**. Alternativa inicial: disco local do servidor.
5. **Fila assíncrona** (notificações, pós-processamento): **BullMQ + Redis**. Pode entrar só na Fase 8.
6. **Hospedagem do backend**: VPS própria com Docker Compose vs. nuvem gerenciada. 
7. **Shell do kiosk**: Chrome/Chromium em `--kiosk` (mais simples) vs. **Electron** (mais controle, auto-update, acesso a hardware). Recomendação: começar com Chromium kiosk + PWA; migrar para Electron só se precisar.
8. **Autenticação do totem**: token de dispositivo (device API key) emitido pelo admin.
9. **LGPD**: definir base legal, prazo de retenção de áudio/transcrição, política de anonimização, encarregado (DPO).
10. **Identidade visual**: manter paleta azul atual ou adotar identidade do órgão contratante.

## 3. Princípios do sistema

- **O cidadão nunca perde uma manifestação.** Tudo é gravado localmente antes de qualquer chamada de rede; a sincronização é um processo de fundo com fila e retry.
- **O totem funciona sem internet.** IA e sync degradam com elegância; classificação manual e fallback local continuam disponíveis.
- **Segredos só no servidor.** Nenhuma chave de API, credencial ou string de conexão no bundle do cliente.
- **Enums estáveis e compartilhados.** Sentimento, categoria e urgência vêm de um único pacote (`packages/shared`) usado por kiosk, admin e API.
- **Auditável.** Toda mudança de status de manifestação é registrada com autor, timestamp e motivo.
- **Acessível.** Alvo WCAG 2.1 AA: alvos de toque grandes, contraste, leitura por voz, navegação por teclado, suporte a `prefers-reduced-motion`.

## 4. Enums canônicos (preservados do protótipo)

- **Sentimento**: `Excelente`, `Satisfeito`, `Neutro`, `Preocupado`, `Insatisfeito`
- **Categoria**: `Elogio`, `Sugestão`, `Dúvida`, `Reclamação`, `Denúncia`
- **Urgência**: `Baixa`, `Média`, `Alta`, `Crítica`
- **Status da manifestação (novo)**: `Recebida` → `Em triagem` → `Em análise` → `Respondida` → `Concluída` / `Arquivada`
  - Manifestação **não-negativa** (elogio, ou dúvida/sugestão sem sentimento ruim e sem urgência Alta/Crítica) já é criada **`Concluída`** — a equipe só trata o que é negativo. Ver `ManifestationController::naoRequerTratamento`.
  - Evolução futura (outra etapa): pra Dúvida, direcionar o cidadão a um FAQ por palavra-chave.
- **Canal**: `Totem`, `Web`, `Importação`
- **Status de sincronização (local)**: `pendente`, `enviando`, `sincronizado`, `erro`

## 5. Roadmap por fases

Cada fase entrega algo verificável. Estimativas são ordens de grandeza para 1–2 devs.

### Fase 0 — Fundação (≈ 1 semana)
- Monorepo (pnpm workspaces ou Turborepo): `apps/kiosk`, `apps/admin`, `services/api`, `packages/shared`, `infra/`.
- Tooling: TypeScript estrito, ESLint, Prettier, Vitest, Husky + lint-staged.
- `packages/shared`: enums, schemas Zod das manifestações, tipos de DTO, gerador de protocolo.
- `docker-compose.yml` com Postgres + Redis + MinIO para dev.
- CI (GitHub Actions ou similar): lint + typecheck + test + build.
- Extrair CSS/animações e textos do HTML atual para o novo projeto.

### Fase 1 — Backend core + modelo de dados (≈ 1–2 semanas)
- Prisma schema conforme [`MODELO-DADOS.md`](MODELO-DADOS.md) + migrations.
- API Fastify: healthcheck, config, CORS, rate limit, logger (pino), validação Zod.
- `POST /manifestations` (idempotente por `clientId` UUID), `GET /manifestations/:protocolo`.
- Upload de áudio: `POST /manifestations/:id/audio` (multipart) → armazenamento S3/MinIO.
- Geração de protocolo canônico no servidor: `OUV-{AAAA}{MM}-{sequência}` + prefixo de dispositivo opcional.
- Testes de integração com banco efêmero.

### Fase 2 — Proxy de IA (Gemini) (≈ 1 semana)
- `POST /ai/transcribe-analyze`: recebe áudio (ou texto), backend chama Gemini com a chave do servidor, aplica o `responseSchema` (transcription, sentiment, category, urgency, summary, keywords), retorna JSON normalizado.
- `POST /ai/analyze-text`: só texto (equivale a `triggerManualAnalysis`).
- `POST /ai/tts`: texto → áudio PCM/base64 (equivale a `speakTextDirectly`), com cache por hash de texto+voz.
- Retry com backoff exponencial **no servidor** (portar `fetchWithRetry`).
- Rate limiting e limite de tamanho de payload por dispositivo. Timeout e circuit breaker.
- Fallback: se Gemini falhar, retornar `degraded: true` e o kiosk usa `fallbackLocalAnalysis`.

### Fase 3 — Kiosk PWA offline-first (≈ 2–3 semanas)
- Reescrever a UI do protótipo em componentes (mesma jornada: Início → Relato → Classificação → Conclusão → Arquivo).
- Tailwind via build (remover CDN). Extrair `pulse`, `soundwave`, `breathe` para CSS do projeto.
- IndexedDB (Dexie): stores `manifestations`, `audioBlobs`, `syncQueue`.
- Service Worker (Workbox): app shell offline, Background Sync para a fila.
- Fluxo de envio: grava local → tenta IA (online) → salva manifestação local com `syncStatus=pendente` → worker de sync envia para a API → baixa protocolo canônico → atualiza registro local.
- Gravação de áudio: portar `MediaRecorder` + pré-aquecimento de microfone + visualizador de ondas + timer + descartar/regravar.
- Reconhecimento de fala do navegador como legenda ao vivo (opcional, best-effort).
- Modo quiosque: tela cheia, sem menu, timeout de inatividade que volta à tela inicial e limpa o formulário, bloqueio de gestos de saída.
- Tela de "arquivo" do totem passa a mostrar **apenas os registros locais recentes daquele dispositivo** (não o banco inteiro) — histórico completo é no painel admin.
- Health do dispositivo: status de rede, fila de sync pendente, status do microfone, versão do app.

### Fase 4 — Autenticação + Painel administrativo (≈ 2–3 semanas)
- Auth: e-mail + senha (Argon2), JWT de acesso curto + refresh token httpOnly, RBAC.
- Papéis: `admin`, `analista`, `atendente`, `leitor`.
- Gestão de dispositivos (totems): cadastro, device API key, revogação, última sincronização.
- Painel: lista de manifestações com filtros (categoria, sentimento, urgência, status, período, dispositivo, texto), paginação/virtualização.
- Detalhe da manifestação: transcrição, resumo, keywords, player de áudio, linha do tempo de status.
- Ações: mudar status, atribuir responsável, adicionar nota interna, registrar resposta ao cidadão, reclassificar.
- Trilha de auditoria por manifestação e global.

### Fase 5 — Relatórios e métricas (≈ 1–2 semanas)
- Endpoints de agregação: volume por categoria/sentimento/urgência/status, série temporal, tempo médio de resolução, backlog, SLA de urgência.
- Dashboard com gráficos (seguir a skill `dataviz` quando for construir).
- Exportação: CSV e PDF (relatório gerencial mensal). 
- Filtros por período e por dispositivo/unidade.

### Fase 6 — Acompanhamento público pelo cidadão (≈ 1 semana)
- Página pública `/acompanhar`: consulta por número de protocolo + verificação leve (ex.: PIN de 4 dígitos gerado no fim do atendimento e impresso/mostrado).
- Mostra status atual, data de cada mudança e a resposta oficial quando publicada — **sem** expor notas internas nem dados de outras pessoas.
- Rate limiting agressivo e proteção contra enumeração de protocolos.

### Fase 7 — Notificações (≈ 1 semana)
- Worker (BullMQ) dispara em eventos: manifestação `Crítica` ou `Denúncia` recebida, SLA estourado, nova manifestação atribuída.
- Canais: e-mail (SMTP/SES) e webhook configurável (ex.: Teams/Slack/sistema do órgão).
- Preferências de notificação por usuário e por unidade. Log de envios e re-tentativa.

### Fase 8 — Hardening, LGPD, observabilidade (≈ 2 semanas)
- LGPD: tela de consentimento no início do atendimento, política de retenção (job que expurga/anônima áudio e PII após N dias), export/eliminação a pedido, criptografia em repouso do áudio e da transcrição, minimização de dados.
- Segurança: headers (helmet), CSP, CSRF nos fluxos de cookie, verificação de dependências, pentest básico, backup automatizado do Postgres + MinIO e teste de restauração.
- Observabilidade: logs estruturados centralizados, métricas (Prometheus/OpenTelemetry), alertas de erro (Sentry), dashboard de saúde dos totems.
- Testes E2E (Playwright) da jornada do cidadão e dos fluxos críticos do admin.

### Fase 9 — Deploy e operação do totem (≈ 1–2 semanas)
- Backend: Docker Compose (api, worker, postgres, redis, minio, reverse proxy Caddy/Traefik com TLS) ou Kubernetes se necessário.
- Kiosk: imagem/provisionamento do SO (Windows ou Linux), autologin, Chromium em `--kiosk --app=<url>`, watchdog que reinicia o navegador, atualização do PWA por Service Worker, desativar USB/atalhos, protetor de tela institucional.
- Runbook de operação: o que fazer se o totem ficar offline, como trocar hardware, como ler a fila de sync presa.
- Rollout piloto em 1 totem antes de escalar.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Totem offline por longos períodos | Fila local durável (IndexedDB), sem limite prático; alerta no admin quando um device não sincroniza há X horas |
| Colisão de número de protocolo entre totem e servidor | Cliente usa `clientId` UUID; protocolo humano só é atribuído pelo servidor no sync; envio idempotente |
| Custo/latência/limite da API Gemini | Cache de TTS, rate limit por device, backoff, fallback local, orçamento mensal monitorado |
| Áudio com voz = dado pessoal sensível | Criptografia em repouso, retenção curta, acesso auditado, consentimento explícito |
| Vazamento da chave de IA | Chave só no backend, rotação periódica, escopo mínimo |
| Perda de dados no servidor | Backup diário + teste de restore + réplica |

## 7. Como retomar na próxima sessão

1. Abrir este `docs/` e confirmar as **decisões em aberto** da seção 2.
2. Rodar a **Fase 0** (scaffolding do monorepo) — pedir: "implemente a Fase 0 do PLANO-SISTEMA-PROFISSIONAL".
3. Manter `cabine_de_ouvidoria_inteligente.html` como referência viva até a Fase 3 concluir a paridade de UI; depois arquivar em `docs/legado/`.
4. Seguir as skills do repositório quando aplicável (`dataviz` para gráficos, `run` para subir o app, `code-review` antes de fechar cada fase).
