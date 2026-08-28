# Modelo de Dados

Banco: PostgreSQL. ORM: Prisma. Todos os IDs internos são `uuid`. Timestamps em UTC.

## Enums

```prisma
enum Sentiment   { Excelente Satisfeito Neutro Preocupado Insatisfeito }
enum Category    { Elogio Sugestao Duvida Reclamacao Denuncia }        // rótulos PT-BR na UI via shared
enum Urgency     { Baixa Media Alta Critica }
enum Channel     { Totem Web Importacao }
enum Manifestation_Status {
  Recebida
  EmTriagem
  EmAnalise
  Respondida
  Concluida
  Arquivada
}
enum UserRole    { admin analista atendente leitor }
enum NotifChannel { email webhook }
enum NotifStatus  { pendente enviada falha }
```

> Observação: os enums do Prisma não aceitam acentos; o mapeamento para os rótulos exibidos
> (`Sugestão`, `Dúvida`, `Reclamação`, `Denúncia`, `Média`, `Crítica`, `Em triagem`, ...) fica em
> `packages/shared/labels.ts`, fonte única para kiosk, admin e relatórios.

## Tabelas

### manifestation
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| protocolo | text UNIQUE | `OUV-AAAA MM-NNNNNN`; gerado no servidor |
| client_id | uuid UNIQUE | gerado no totem; chave de idempotência do sync |
| pin_acompanhamento | text | hash (nunca em texto puro) para consulta pública |
| canal | Channel | `Totem` |
| device_id | uuid FK → device | nulo se Web |
| transcricao | text (cifrada em repouso) | |
| resumo | text | |
| keywords | text[] | 3–5 itens |
| sentimento | Sentiment | |
| categoria | Category | |
| urgencia | Urgency | default `Media` |
| status | Manifestation_Status | default `Recebida` |
| responsavel_id | uuid FK → user | nulo |
| resposta_oficial | text | publicada ao cidadão quando preenchida |
| resposta_publicada_em | timestamptz | |
| audio_object_key | text | chave no bucket; nulo se só texto |
| audio_mime | text | |
| audio_duracao_seg | int | |
| consentimento_lgpd | boolean | obrigatório para `Totem` |
| origem_ip | inet | nulo em totem |
| criado_em | timestamptz | data do atendimento (vem do device) |
| recebido_em | timestamptz | quando a API registrou (sync) |
| atualizado_em | timestamptz | |
| anonimizado_em | timestamptz | preenchido pelo job de retenção |

Índices: `(categoria)`, `(status)`, `(urgencia)`, `(criado_em)`, `(device_id)`, GIN em `keywords`, busca full-text em `resumo`/`transcricao`.

### manifestation_status_history
| id | uuid PK |
| manifestation_id | uuid FK |
| de_status | Manifestation_Status (nulo na criação) |
| para_status | Manifestation_Status |
| autor_id | uuid FK → user (nulo = sistema) |
| motivo | text |
| criado_em | timestamptz |

### manifestation_note (notas internas — nunca públicas)
| id | uuid PK | manifestation_id FK | autor_id FK | texto | criado_em |

### device (totem)
| id | uuid PK |
| codigo | text UNIQUE | ex.: `TOTEM-CENTRO-01` |
| nome | text |
| unidade | text |
| api_key_hash | text | escopo restrito |
| ativo | boolean |
| ultima_sync_em | timestamptz |
| versao_app | text |
| criado_em / atualizado_em |

### user (equipe)
| id | uuid PK | nome | email UNIQUE | senha_hash (Argon2id) | papel UserRole | ativo | unidade | criado_em | ultimo_login_em |

### refresh_token
| id | uuid PK | user_id FK | token_hash | expira_em | revogado_em | user_agent | ip |

### notification
| id | uuid PK | manifestation_id FK (nulo) | tipo (text: `critica_recebida`,`sla_estourado`,`atribuida`) | canal NotifChannel | destino | payload jsonb | status NotifStatus | tentativas int | enviada_em | criado_em |

### notification_pref
| id | uuid PK | user_id FK | tipo | canal | destino | ativo |

### audit_log
| id | uuid PK | ator_id FK (nulo=sistema/device) | device_id FK (nulo) | acao text | entidade text | entidade_id uuid | metadados jsonb | ip inet | criado_em |
> Registrar aqui: acesso a áudio, export de dados, login, alteração de device, reclassificação.

### ai_cache (TTS e análises reaproveitáveis)
| id | uuid PK | chave text UNIQUE (sha256) | tipo (`tts`\|`analyze`) | object_key/text | criado_em | expira_em |

### protocol_sequence
| ano_mes text PK (`AAAA-MM`) | ultimo int |
> Usada em transação para gerar o número sequencial do protocolo.

## Retenção / LGPD (job diário no worker)
- `audio_object_key`: apagar do bucket e anular campo quando `criado_em < now() - RETENCAO_AUDIO_DIAS` e `status IN (Concluida, Arquivada)`.
- `transcricao`: aplicar máscara de PII (regex CPF/telefone/e-mail/nome próprio) após encerramento + `RETENCAO_TRANSCRICAO_DIAS`.
- Marcar `anonimizado_em`.
- Nunca apagar métricas agregadas (contagens já materializadas em `report_daily`).

### report_daily (materialização para dashboards rápidos)
| dia date | unidade text | categoria Category | sentimento Sentiment | urgencia Urgency | status Manifestation_Status | total int |
PK composta. Atualizada por trigger ou job.
