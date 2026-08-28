# Arquitetura

## Visão geral

```
                          ┌─────────────────────────────┐
   TOTEM (kiosk)          │        SERVIDOR (nuvem/VPS)   │
 ┌───────────────┐        │  ┌───────────────────────┐   │
 │ Kiosk PWA     │  HTTPS │  │ API (Fastify + TS)    │   │        ┌──────────┐
 │ - IndexedDB   │◀──────▶│  │ - /manifestations     │◀──┼───────▶│ Gemini   │
 │ - ServiceWkr  │        │  │ - /ai/* (proxy)       │   │        │  API     │
 │ - fila sync   │        │  │ - /auth /reports      │   │        └──────────┘
 └───────────────┘        │  └───────────┬───────────┘   │
                          │              │               │
 ┌───────────────┐        │  ┌───────────▼───────────┐   │
 │ Admin SPA     │◀──────▶│  │ PostgreSQL (Prisma)   │   │
 │ (navegador da │        │  │ Redis (BullMQ)        │   │
 │  equipe)      │        │  │ MinIO/S3 (áudio)      │   │
 └───────────────┘        │  └───────────────────────┘   │
                          │      worker: notificações     │
                          └─────────────────────────────┘
```

## Stack recomendada

| Camada | Escolha | Observação |
|---|---|---|
| Kiosk / Admin | React 18 + Vite + TypeScript + TailwindCSS | Tailwind por build (sem CDN). Router: React Router |
| Estado local kiosk | Dexie (IndexedDB) + Zustand | Fila de sync durável |
| Offline | Workbox (Service Worker) + Background Sync | App shell + retry de envio |
| Backend | Node 20 + Fastify + TypeScript | Alternativa: NestJS |
| ORM | Prisma | Migrations versionadas |
| Banco | PostgreSQL 16 | |
| Cache/Fila | Redis + BullMQ | Notificações, TTS cache, pós-processamento |
| Objeto/áudio | MinIO (dev/on-prem) ou AWS S3 | URLs assinadas, criptografia em repouso |
| Auth | JWT (acesso) + refresh httpOnly, Argon2 | RBAC: admin/analista/atendente/leitor |
| Validação | Zod (compartilhado cliente/servidor) | |
| Proxy reverso/TLS | Caddy ou Traefik | Let's Encrypt |
| Observabilidade | pino + OpenTelemetry + Sentry | |
| Testes | Vitest (unit), Playwright (E2E) | |
| Empacotamento | Docker + Docker Compose | |

## Monorepo

```
totem/
├─ apps/
│  ├─ kiosk/              # PWA do cidadão (tela do totem)
│  │  ├─ src/
│  │  │  ├─ features/     # relato, gravacao, classificacao, conclusao, arquivo-local
│  │  │  ├─ offline/      # dexie db, sync queue, service worker
│  │  │  ├─ audio/        # MediaRecorder, visualizador, TTS player
│  │  │  └─ kiosk/        # tela cheia, timeout de inatividade, watchdog
│  │  └─ vite.config.ts
│  └─ admin/              # painel administrativo
│     └─ src/features/    # auth, manifestacoes, relatorios, dispositivos, notificacoes
├─ services/
│  ├─ api/                # Fastify
│  │  ├─ src/modules/     # manifestations, ai, auth, reports, devices, notifications, public
│  │  ├─ prisma/
│  │  └─ src/plugins/     # cors, rate-limit, auth, logging
│  └─ worker/             # BullMQ workers (notificações, retenção LGPD)
├─ packages/
│  └─ shared/             # enums, zod schemas, DTOs, gerador de protocolo, i18n textos
├─ infra/
│  ├─ docker-compose.yml          # dev: postgres, redis, minio
│  ├─ docker-compose.prod.yml
│  └─ kiosk/                      # scripts de provisionamento do totem
└─ docs/
```

## Sincronização offline-first

### Regras
1. **Escrita local primeiro.** Ao finalizar o registro, o kiosk grava em IndexedDB:
   - `manifestations`: dados + `clientId` (UUID v4) + `syncStatus='pendente'` + `protocolo=null`
   - `audioBlobs`: blob do áudio referenciado por `clientId`
2. **Fila de sync** (`syncQueue`) processada por um worker:
   - `POST /manifestations` com `clientId` → servidor cria (ou retorna existente, idempotente) e devolve `protocolo` canônico.
   - Se houver áudio: `POST /manifestations/:id/audio` (multipart), com retry.
   - Sucesso → `syncStatus='sincronizado'`, guarda `protocolo`, agenda limpeza do blob local após X dias.
   - Falha de rede → backoff exponencial (1s,2s,4s,8s,16s,60s…), permanece `pendente`.
   - Falha 4xx não-recuperável → `syncStatus='erro'`, sinaliza no health do device para intervenção.
3. **Sem edição concorrente.** Manifestação do totem é imutável após envio; o admin só altera *status/atribuição/resposta* (campos que o totem nunca escreve). Conflito real ≈ inexistente → last-write-wins do lado servidor para esses campos.
4. **Protocolo exibido ao cidadão**: enquanto offline, mostrar "Protocolo provisório: recibo local `#{clientId curto}` — o número oficial e o PIN de acompanhamento chegam quando o totem sincronizar". Alternativa: gerar protocolo determinístico com prefixo do device (`OUV-{deviceCode}-{AAAAMMDD}-{seqLocal}`) e o servidor apenas valida/registra — decidir na Fase 1.

### PIN de acompanhamento
Gerado pelo servidor no momento do registro (ou pelo device com HMAC do `clientId` + segredo do device). Mostrado na tela de conclusão e no comprovante. Necessário para a consulta pública.

## IA (proxy Gemini)

- Endpoints em `services/api/src/modules/ai/`.
- Chave: `GEMINI_API_KEY` só no ambiente do servidor.
- Modelos (do protótipo): `gemini-2.5-flash-preview-09-2025` (texto/análise), `gemini-2.5-flash-preview-tts` (voz). Centralizar em config; permitir troca por variável de ambiente. **Antes de mexer nos modelos/parâmetros, consultar a skill `claude-api` só se migrar para Claude; para Gemini, validar os IDs na doc oficial do Google.**
- `responseSchema` idêntico ao do protótipo (ver `MIGRACAO-DO-PROTOTIPO.md`).
- Cache de TTS: chave = `sha256(texto + voz)`, valor em MinIO/Redis, TTL longo (frases fixas de boas-vindas etc.).
- Degradação: em falha, `{ degraded: true }` → kiosk aplica `fallbackLocalAnalysis` e TTS do navegador (`speechSynthesis`).

## Segurança

- Nenhum segredo no bundle cliente. `.env` fora do versionamento; `.env.example` documentado.
- CORS restrito às origens do kiosk e do admin.
- Rate limit por IP e por device key.
- Validação Zod em todo input; limite de tamanho de upload de áudio (ex.: 25 MB / 5 min).
- Headers de segurança (helmet), CSP estrita no admin e no kiosk.
- Auth: senhas com Argon2id; tokens de acesso ~15 min; refresh rotativo; logout revoga refresh.
- Device API key: escopo apenas `manifestations:create` + `ai:invoke`.
- Auditoria imutável de mudanças de status e de acessos a áudio/PII.
- Backup: `pg_dump` diário + versionamento de bucket; teste de restore mensal.

## LGPD (resumo operacional)

- **Base legal**: execução de política pública / exercício regular de direitos (definir com jurídico).
- **Consentimento**: tela inicial do atendimento explica o tratamento e pede aceite antes de gravar.
- **Minimização**: não coletar nome/CPF salvo se o cidadão optar por se identificar.
- **Retenção**: áudio expurgado/anonimizado após N dias (config, sugestão 90); transcrição mantida com PII mascarada após o encerramento.
- **Direitos do titular**: endpoint/admin para exportar e para eliminar por protocolo+PIN.
- **Segurança**: criptografia em repouso (áudio + transcrição), acesso mínimo, logs de acesso.

## Deploy do totem (kiosk)

- SO: Windows 11 IoT/Pro ou Linux (Debian) com autologin em usuário restrito.
- Navegador: Chromium `--kiosk --app=https://totem.orgao.gov.br --incognito --disable-pinch --overscroll-history-navigation=0`.
- Watchdog: serviço que reinicia o Chromium se travar/fechar; reboot noturno agendado.
- Rede: preferir cabo; Wi-Fi como fallback. Tolerar queda (offline-first cobre).
- Atualização: PWA via Service Worker (novo deploy → prompt de update no próximo idle).
- Lockdown: desabilitar teclado físico exceto quando necessário, bloquear USB, esconder barra de tarefas, desativar atalhos (Alt+F4, Ctrl+W, Win).
- Inatividade: 60–90 s sem toque → volta à tela inicial, limpa formulário e `stopAllAudioPlayback()`.
- Fallback de exibição: se o backend estiver inacessível no boot, abrir mesmo assim (PWA em cache) e operar offline.
