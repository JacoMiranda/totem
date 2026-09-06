# Fase 10 — Multi-tenant / Portal do cliente

> **Fundação implementada em 2026-09-05.** Veja a seção "Status" para o que
> já existe e o que falta.

## Decisões

| Tema | Decisão |
|---|---|
| Liberação de totens | **Só pela equipe da plataforma.** O cliente se cadastra livremente, mas os totens só funcionam depois que a equipe cria/libera os slots (após a compra do pacote). |
| Pareamento do totem | **Todas as formas**, sem nunca digitar a chave de 48 chars: (a) abrir pelo portal (token de sessão), (b) código de 6 dígitos, (c) **QR code** — a pessoa aponta a câmera do celular, cai numa URL que ativa o login/pareamento. |
| Acessibilidade / offline no pareamento | Ver seção "Boas práticas" abaixo — pesquisar e aplicar. |
| Estrutura web | **Portal do cliente + back-office separado.** O painel admin atual (Fase 4) vira o Portal do Cliente (com escopo de organização). Back-office novo e enxuto para a equipe da plataforma gerir organizações/pacotes/suporte. |

## Status

### Feito

- **Pareamento pelo kiosk** — `SetupScreen.tsx` + `pareamentoApi.ts` +
  `GET /devices/pareaveis` + `POST /devices/{id}/pair` (gate
  `parear-dispositivo`, atendente+). Substituiu a digitação manual da key.
- **Organizações (tenants)** — tabelas `organizacoes` e `planos`;
  `organizacao_id` em `users`, `devices` e `manifestations`. A migração cria a
  "Organização Padrão" e adota o que já existia.
- **Escopo por organização** — `App\Models\Scopes\PorOrganizacao` (global scope
  em `Device` e `Manifestation`). Usuário sem organização = equipe da
  plataforma e enxerga tudo. Coberto por `CadastroMultiTenantTest`.
- **Cadastro self-service** — `POST /auth/register` cria organização + primeiro
  usuário + provisiona os totens do pacote. `GET /planos` é o catálogo público.
- **Nomeação automática** — `App\Services\NomeadorDeTotens`: "Luiza Brok" + 3
  totens => `LuizaBrok-01`, `-02`, `-03`; com local => `LuizaBrok-01-Recepcao`.
  `codigo` é ASCII (vai pra URL/log/CSV), `nome`/`unidade` preservam o acento.
  Espelho client-side em `resources/js/shared/nomeTotem.ts` (só pré-visualização).
- **Home de marketing** — `resources/js/site/` na raiz `/`: hero, como funciona,
  benefícios, planos vindos da API e formulário de cadastro com pré-visualização
  dos nomes dos totens. Handoff de sessão pro painel via `totem:admin-session`.

### Falta

- Back-office da plataforma (gerir organizações/pacotes/suporte).
- Pareamento por **código de 6 dígitos** e por **QR code**.
- Papéis separados: plataforma (`super-admin`/`suporte`) vs cliente
  (`gestor`/`operador`) — hoje ambos usam a mesma hierarquia `UserRole`.
- Preços/cobrança (planos estão com `preco_centavos` nulo = "sob consulta").
- Verificação de e-mail no cadastro; expurgo de contas trial vencidas.
- Cota de IA por organização (um cliente não pode estourar a cota de todos).

## Modelo de dados (novo)

- **`organizacoes`**: id, nome, documento (CNPJ), plano, status (`ativa`/`suspensa`), criado_em.
- **`users`** ganha `organizacao_id` (nulo = equipe da plataforma) e separa papéis:
  - Plataforma: `super-admin`, `suporte`.
  - Cliente: `gestor`, `operador`, `leitor` (os atuais `admin/analista/atendente/leitor` migram para cá).
- **`devices`** ganha `organizacao_id` (obrigatório) e `status`: `provisionado` → `pareado` → `ativo` / `inativo`.
- **`planos`** (catálogo): nome, limite_dispositivos, recursos. Ou só `limite_dispositivos` na org + slots criados manualmente pela equipe.
- **`device_pairings`**: device_id, tipo (`portal`/`codigo`/`qr`), token_hash / codigo (6 dígitos), expira_em, usado_em, criado_por. TTL curto (~15 min), uso único, rate-limited.

## Escopo por organização

- **Global scope** de Eloquent em `Manifestation`, `Device`, `NotificationLog`, `AuditLog`, reports — filtra por `auth()->user()->organizacao_id`.
- Equipe da plataforma (org nula) ignora o scope (ver todas) — via Gate/policy explícita.
- Migração: criar "Organização Padrão", vincular todos os `devices`/`users`/`manifestations` existentes.

## Fluxo de pareamento (substitui a SetupScreen atual)

1. Equipe da plataforma cria a org + provisiona os devices ("Recepção I", "Recepção II") após a compra.
2. Cliente loga no **Portal** → "Meus totens" (grid: nome, status, última sync, botão **Abrir** e **Parear**).
3. Parear, três caminhos:
   - **Portal**: clica "Abrir Recepção I" no próprio totem → portal chama `POST /devices/{id}/pairing` → recebe token de uso único → abre `/atendimento?pair=<token>` → o kiosk troca por device key, guarda em localStorage, redireciona para `/atendimento` limpo.
   - **Código 6 dígitos**: portal gera código; no totem, tela "Digite o código" → `POST /devices/pair {codigo}` → device key.
   - **QR code**: portal/back-office mostra QR com a URL `https://portal.../parear/<token>`; a pessoa abre no celular, faz login, confirma o totem → o totem (fazendo polling curto ou via canal) recebe a key. Ou o QR é exibido NO totem e escaneado pelo gestor já logado no celular, que confirma.
4. Feito uma vez, o totem nunca mais pede nada (chave no localStorage; `clearDeviceConfig` só no "desparear").

## Boas práticas a aplicar (acessibilidade + falta de conexão)

Pesquisar e documentar antes de implementar:
- **Pareamento resiliente a rede instável**: token com TTL generoso, retry idempotente, estado "aguardando confirmação" claro, funcionar em 3G ruim (payloads mínimos).
- **QR**: alto contraste, tamanho mínimo, texto alternativo com o código/URL digitável embaixo (nunca só o QR), instrução falada (TTS já existe no kiosk).
- **Feedback de status de rede** persistente no totem (online/offline/sincronizando + fila pendente) — WCAG: não depender só de cor.
- **Kiosk offline-first**: o pareamento por código deve poder ser validado contra um cache local assinado se o device já foi visto antes (re-pareamento offline).
- Alvos de toque grandes, timeout de inatividade, navegação por teclado, `prefers-reduced-motion`, leitor de tela.

## Impacto nas fases já feitas

- Fase 4 (painel): toda listagem/detalhe passa a ser org-scoped; adicionar cadastro self-service + verificação de e-mail.
- Fase 5 (relatórios): agregações por org.
- Fase 7 (notificações): destinatários e preferências por org.
- Fase 2 (IA proxy): rate limit / cota por org (evitar um cliente estourar a cota Gemini de todos). Possível cobrança por uso.
