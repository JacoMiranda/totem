# Contrato da API (rascunho)

Base: `/api/v1`. JSON. Erros no formato `{ error: { code, message, details? } }`.
Auth: `Authorization: Bearer <accessToken>` (equipe) **ou** `X-Device-Key: <deviceKey>` (totem, escopo restrito).

## Autenticação (equipe)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | `{ email, senha }` → `{ accessToken, user }` + cookie `refresh` httpOnly |
| POST | `/auth/refresh` | usa cookie → novo `accessToken` |
| POST | `/auth/logout` | revoga refresh |
| GET | `/auth/me` | usuário atual |

## Manifestações — totem / criação

### POST `/manifestations`  (device key)
Idempotente por `clientId`. Se já existe, retorna o registro existente com `200`.
```jsonc
// request
{
  "clientId": "uuid-v4",
  "criadoEm": "2026-08-27T14:03:00Z",
  "consentimentoLgpd": true,
  "transcricao": "…",
  "resumo": "…",
  "keywords": ["fila", "espera"],
  "sentimento": "Insatisfeito",
  "categoria": "Reclamacao",
  "urgencia": "Alta",
  "temAudio": true
}
// response 201
{
  "id": "uuid",
  "protocolo": "OUV-202608-000123",
  "pin": "4821",                // mostrado uma única vez
  "status": "Recebida",
  "audioUploadUrl": "/api/v1/manifestations/uuid/audio"  // ou URL S3 assinada
}
```

### POST `/manifestations/:id/audio`  (device key)
`multipart/form-data` campo `file`. Limite configurável (ex.: 25 MB). Retorna `{ ok: true, audioObjectKey }`.

## IA (proxy) — device key

### POST `/ai/transcribe-analyze`
`multipart` (`file` = áudio) **ou** JSON `{ texto }`. Backend chama Gemini com `responseSchema`:
```jsonc
{
  "transcription": "string",
  "sentiment": "Excelente|Satisfeito|Neutro|Preocupado|Insatisfeito",
  "category":  "Elogio|Sugestão|Dúvida|Reclamação|Denúncia",
  "urgency":   "Baixa|Média|Alta|Crítica",
  "summary": "string",
  "keywords": ["string"],
  "degraded": false          // true se caiu no fallback
}
```

### POST `/ai/analyze-text`
`{ texto }` → mesmo shape sem `transcription`. (equivale a `triggerManualAnalysis`)

### POST `/ai/tts`
`{ texto, voz?: "Aoede" }` → `{ audioBase64, mimeType, sampleRate, cached }`. (equivale a `speakTextDirectly`)

## Manifestações — painel (bearer, RBAC)

| Método | Rota | Papel | Descrição |
|---|---|---|---|
| GET | `/manifestations` | leitor+ | filtros: `categoria,sentimento,urgencia,status,deviceId,de,ate,q,page,pageSize,sort` |
| GET | `/manifestations/:id` | leitor+ | detalhe + histórico + notas |
| GET | `/manifestations/:id/audio` | analista+ | URL assinada; registra em `audit_log` |
| PATCH | `/manifestations/:id/status` | atendente+ | `{ status, motivo }` |
| PATCH | `/manifestations/:id/assign` | analista+ | `{ responsavelId }` |
| PATCH | `/manifestations/:id/classify` | analista+ | `{ sentimento?, categoria?, urgencia? }` (auditado) |
| POST | `/manifestations/:id/notes` | atendente+ | `{ texto }` nota interna |
| POST | `/manifestations/:id/resposta` | analista+ | `{ texto, publicar: bool }` |

## Consulta pública (sem auth)

### GET `/public/manifestations/:protocolo?pin=XXXX`
Rate-limited. Retorna só o seguro:
```jsonc
{
  "protocolo": "OUV-202608-000123",
  "status": "Em análise",
  "recebidoEm": "…",
  "linhaDoTempo": [ { "status": "Recebida", "em": "…" }, { "status": "Em triagem", "em": "…" } ],
  "respostaOficial": "…" | null
}
```
Erros genéricos (não revelar se o protocolo existe).

## Dispositivos (admin)

| GET | `/devices` | lista + `ultimaSyncEm`, `versaoApp`, pendências |
| POST | `/devices` | `{ codigo, nome, unidade }` → `{ deviceKey }` (uma vez) |
| POST | `/devices/:id/rotate-key` | nova key |
| PATCH | `/devices/:id` | ativar/desativar |

## Relatórios (analista+)

| GET | `/reports/summary?de&ate&unidade` | totais por categoria/sentimento/urgência/status |
| GET | `/reports/timeseries?metric&interval&de&ate` | série temporal |
| GET | `/reports/sla?de&ate` | tempo médio de resolução, backlog, urgências fora do SLA |
| GET | `/reports/export?formato=csv\|pdf&…` | download |

## Notificações (admin)

| GET | `/notifications` | log de envios |
| POST | `/notifications/test` | dispara evento de teste |
| GET/PUT | `/notification-prefs` | preferências do usuário/unidade |

## Health

| GET | `/health` | `{ status, db, redis, storage, gemini }` |
| GET | `/health/devices` | (admin) totems e última sincronização |

## Códigos de erro comuns
`AUTH_REQUIRED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `RATE_LIMITED`, `AI_UNAVAILABLE`, `PAYLOAD_TOO_LARGE`, `IDEMPOTENT_REPLAY` (não é erro — 200 com corpo existente).
