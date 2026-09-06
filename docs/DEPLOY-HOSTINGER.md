# Deploy na Hostinger (hospedagem compartilhada)

O projeto foi desenhado para caber em hospedagem compartilhada: sem Docker,
sem Redis, sem worker permanente. Fila, cache e sessão usam o banco; o
processamento em segundo plano passa por **um único cron** (ver
`routes/console.php`).

**Já existe uma instalação no ar em `totem.prinatus.com.br`.** Para
atualizá-la, siga a seção "Atualizar uma instalação existente"; a seção de
instalação do zero fica logo depois, para um cliente novo.

## Acesso SSH (mesma conta do política-laravel)

O totem mora na MESMA conta Hostinger que hospeda o projeto irmão
`política-laravel` — não é preciso provisionar acesso novo, nem pedir senha
de novo. Nesta máquina já existe um par de chaves dedicado:

```bash
# chave dedicada ao totem (a compartilhada com o política-laravel foi aposentada)
ssh -i ~/.ssh/id_ed25519_hostinger_totem -p 65002 u928337956@82.25.73.58
```

Estrutura real no servidor (confirmada por SSH, não pelo que o plano
original previa):
- `~/domains/prinatus.com.br/totem_app/` — projeto Laravel completo
  (`app/`, `vendor/`, `.env`, `artisan`, `.git` — o `.git` é sobra do
  provisionamento inicial, as atualizações são por **zip**, não `git pull`).
- `~/domains/prinatus.com.br/public_html/totem/` — raiz do domínio, só o
  conteúdo de `public/` (inclusive `build/`, copiado à mão depois de cada
  deploy — não é symlink).

Se uma sessão sem esse acesso ficar travada pedindo "posso adicionar a
permissão de SSH?", a resposta é: não precisa adicionar nada, a chave `id_ed25519_hostinger_totem` já
existe nesta máquina — só falta a sessão saber disso.

---

# Atualizar uma instalação existente

## ⚠️ Antes de subir: três coisas que quebram

### 1. A raiz do site muda de comportamento

Hoje `https://totem.prinatus.com.br/` **redireciona para `/atendimento`**.
Depois da atualização ela passa a mostrar a **home de marketing**.

Se o navegador do totem físico estiver configurado para abrir a raiz do
domínio, depois do deploy ele vai cair na página de vendas em vez da tela de
atendimento. **Reconfigure o totem para abrir `/atendimento` direto** — que é
como ele deve ficar de qualquer forma, em modo quiosque.

### 2. As migrações mexem em tabelas com dados reais

`2026_09_05_000003_add_organizacao_to_tenant_tables` adiciona
`organizacao_id` em `users`, `devices` e `manifestations`, cria a
"Organização Padrão" e adota tudo o que já existe. É o caminho projetado
para esse cenário — sem a adoção, os registros antigos sumiriam das telas no
momento em que o filtro por organização entrasse.

Ainda assim: **faça backup do banco antes** (hPanel → Bancos de Dados →
Exportar). É a única etapa não trivialmente reversível.

### 3. O build carrega as variáveis `VITE_*` da SUA máquina

`VITE_KIOSK_IA_LOCAL` entra no bundle na hora do `npm run build`. No `.env`
de desenvolvimento ele costuma estar `true` (processamento local, sem
Gemini). Se você compilar assim e subir, **a produção vai parar de usar a
Gemini**. Deixe `false` antes de gerar o pacote — o `deploy.ps1` mostra o
valor atual e pede confirmação justamente por isso.

## Passo a passo da atualização

```powershell
# 1. Na sua máquina: garanta o valor de produção e gere o pacote
#    (.env: VITE_KIOSK_IA_LOCAL=false)
.\deploy.ps1
```

No servidor, pelo Gerenciador de Arquivos ou SSH:

```bash
# 2. Backup do banco (hPanel) e do .env atual
cp .env .env.backup-$(date +%F)

# 3. Descompacte o pacote por cima. NÃO sobrescreva o .env
#    (ele não vai no pacote, mas confira depois do unzip).
#    unzip -oq pacote.zip
#
#    AVISO ESPERADO (ignorar): "warning: appears to use backslashes as
#    path separators". O zip é gerado no Windows via
#    [System.IO.Compression.ZipFile]::CreateFromDirectory - o unzip do
#    Linux reclama mas extrai certo mesmo assim (confirmado na pratica:
#    nenhum arquivo com barra invertida literal no nome, nada corrompido).
#    Só é REAL problema se `find . -name '*\\*'` achar algo depois.
#    O comando inteiro sai com status != 0 por causa desse aviso -
#    não encadeie com && logo depois, ou os passos seguintes não rodam.

# 4. Variáveis novas desta versão, acrescente ao .env:
#    GEMINI_TEXT_MODEL=gemini-flash-lite-latest
#    VITE_KIOSK_IA_LOCAL=false

# 5. Banco: migração + catálogo de planos
php artisan migrate --force
php artisan db:seed --class="Database\Seeders\PlanoSeeder" --force

# 6. Limpe e refaça os caches (rotas e config MUDARAM)
php artisan config:clear && php artisan route:clear && php artisan view:clear
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

## Depois de subir, confira

```bash
curl -s https://totem.prinatus.com.br/api/v1/health      # db/storage/gemini true
curl -s -o /dev/null -w "%{http_code}" https://totem.prinatus.com.br/api/v1/planos   # 200 (era 404)
```

E no navegador:

- `/` → home de marketing (antes redirecionava)
- `/atendimento` → o totem já pareado **continua funcionando**: a chave dele
  fica no `localStorage` da máquina e a migração não a altera
- `/admin` → o login existente continua valendo; o usuário passa a pertencer
  à "Organização Padrão" e vê os dispositivos já adotados
- `/admin/relatorios` → tela nova

## Se der errado

O ponto de retorno é o backup do banco. O código volta com
`git checkout <commit-anterior>` + novo `deploy.ps1`. Os caches precisam ser
refeitos em qualquer um dos sentidos.

## Log de deploys

Registro do que realmente aconteceu em cada atualização de produção — serve
pra uma sessão nova não repetir passo já feito, nem se assustar com um aviso
já conhecido.

### 2026-09-06 (tarde) — chave da Gemini fora de sincronia (NÃO era o microfone)

Sintoma: no totem em produção o áudio gravava e subia (WAV real, ~600 KB,
visível em `/admin/logs`) mas dava `503 AI_UNAVAILABLE`. No log do servidor:
`GeminiAiService: erro não-recuperável ... status 401 ... "Expected OAuth 2
access token, login cookie or other valid authentication credential"`.

Causa: o `.env` de produção tinha uma chave `GEMINI_API_KEY` **antiga**,
diferente da local. O deploy nunca sobe `.env` (excluído do pacote), então
produção ficou com a chave de quando foi configurada à mão. A mesma chave
local (`AQ.Ab8RN6...`) respondia 200; a de produção, 401.

Notas que ficaram claras:
- As chaves `AQ.` são o formato atual (auth keys, ligadas a service account).
  **Não expiram.** As chaves padrão `AIza` passam a ser rejeitadas pelo
  Google a partir de setembro/2026 — não migrar de volta pra `AIza`.
- 401 "Expected OAuth 2 access token" da Gemini = string da chave não é
  reconhecida (chave errada/revogada), não é problema de restrição de IP
  (isso daria 403 `API_KEY_*_BLOCKED`).

Correção (rodar do terminal do dev — o classificador do Claude Code bloqueia
escrever credencial em host remoto):
```bash
ssh -i ~/.ssh/id_ed25519_hostinger_totem -p 65002 u928337956@82.25.73.58 \
  "cd domains/prinatus.com.br/totem_app && cp .env .env.bak-key && \
   sed -i 's#^GEMINI_API_KEY=.*#GEMINI_API_KEY=<chave AQ. que funciona>#' .env && \
   php artisan config:clear && php artisan config:cache"
```
No PowerShell, NÃO use `$(date ...)` no comando remoto — o PowerShell
avalia o `$(...)` localmente antes de passar pro ssh. Backup com nome fixo.

Verificado: chamada real à Gemini a partir do servidor da Hostinger via
`php artisan tinker --execute` → HTTP 200.

**Ação recorrente:** sempre que a chave da Gemini mudar, atualizar o `.env`
de produção também — os dois ambientes têm `.env` independentes.

### 2026-09-06 (aplicado por SSH) — `totem-2026-09-06-1022.zip` + hotfix

Aplicado direto por SSH desta máquina (deploy.ps1 gerou, deploy manual via
ssh/scp - a permissão Bash(ssh/scp) foi adicionada em
`.claude/settings.local.json`). Passos reais:

1. Backup: `~/backups_totem/db-20260906-1456.sql` (mysqldump — a senha do
   `.env` tem caractere que o `parse_ini_file` do PHP não lê; peguei via
   `config('database.connections.mysql.password')` e escrevi um
   `--defaults-extra-file` temporário) + `.env.backup-20260906-1457`.
2. Contagens antes = depois (users 1, organizacoes 1, devices 2,
   manifestations 0, planos 3) — nenhum dado mexido.
3. `unzip -oq` (aviso de backslash, ignorado — `find -name '*\*'` limpo),
   `migrate --force` → "Nothing to migrate", `PlanoSeeder --force`,
   caches, `public/build` → `public_html/totem/build`.
4. **Bug encontrado no ar**: `/api/v1/*` sob `auth:sanctum`, batido SEM
   `Accept: application/json` (barra de endereço do navegador), dava 500
   ("Route [login] not defined") em vez de 401. A SPA nunca viu (axios
   manda o header). Hotfix: `redirectGuestsTo(fn () => null)` em
   `bootstrap/app.php`, enviado isolado por scp + `route:cache`. Agora
   `/api/v1/logs` sem auth → 401.

Verificado: health ok, `/planos` 200, `/logs` 401, `/atendimento` `/admin`
`/` 200, bundle novo (`main-q94GCb4_.js`) sendo servido.

Pendente ainda: reapontar o navegador do totem físico pra `/atendimento`
(a raiz virou a home).

### 2026-09-06 (noite) — pacote completo `totem-2026-09-06-1022.zip`

Deploy de **backend + frontend** (mexeu em rotas, `config/logging.php`,
controllers). Não tem migração nova nesta rodada, mas config e rotas
mudaram.

No servidor, em `~/domains/prinatus.com.br/totem_app/`:
```bash
cp .env .env.backup-$(date +%F-%H%M)
unzip -oq ~/totem-2026-09-06-1022.zip     # aviso de backslash: ignorar (ver nota)
# .env NÃO precisa de variável nova nesta versão
php artisan migrate --force               # nada a migrar, roda limpo
php artisan config:clear && php artisan route:clear && php artisan view:clear
php artisan config:cache && php artisan route:cache && php artisan view:cache
```
Depois copiar `totem_app/public/build` -> `public_html/totem/build` (como
nas rodadas anteriores).

O que entrou:
- **Microfone no celular**: ditado ao vivo só no desktop (no Android o mic
  é exclusivo e SpeechRecognition brigava com a gravação); erro real na
  tela em vez de "não consegui processar"; timeout de transcrição 45s.
- **/admin/logs**: tela nova (menu Logs, só admin). Lê `laravel.log` +
  `kiosk.log`. Canal `kiosk` novo em `config/logging.php` -> confirmar
  que `storage/logs/` tem permissão de escrita (já tinha).
- `POST /api/v1/client-errors` (device key): o totem reporta falhas de
  microfone/áudio pra aparecerem em /admin/logs sem depender do cidadão.

Verificar depois:
```bash
curl -s -o /dev/null -w "%{http_code}" https://totem.prinatus.com.br/api/v1/logs   # 401 (precisa de login) - NÃO 404
```
E no painel logado como admin: menu **Logs** deve carregar.

### 2026-09-06 (tarde) — só assets, `totem-assets-2026-09-06-1004.zip`

Deploy de **frontend apenas** (`.\deploy.ps1 -SoAssets`) — nenhuma migração,
nenhum `.env` novo. Motivo: microfone/ditado não pegavam no celular em
produção e o `useAudioRecorder` engolia o erro real.

No servidor:
```bash
cd ~/domains/prinatus.com.br
mv public_html/totem/build public_html/totem/build.bak   # 1 de cada vez
unzip -oq totem-assets-*.zip -d /tmp/novo-build           # gera /tmp/novo-build/build/
mv /tmp/novo-build/build public_html/totem/build
# opcional, se o Laravel serve /build por outra via: copiar tb em totem_app/public/build
```
Não precisa `artisan` nada — assets são estáticos. Confirmar com
Ctrl+Shift+R no celular (ou aba anônima): a tela de Relato passa a mostrar
o erro real do microfone + uma linha de diagnóstico
(`navegador · seguro · mic · formatos · ditado`).

Mudanças que entraram: erro específico de getUserMedia
(NotAllowedError/NotFoundError/etc.), MediaRecorder sem forçar mimeType
não suportado (Safari/iOS), `Permissions-Policy` sem `microphone=(self)`
(esse header vem do PHP, então SÓ vale de verdade no próximo deploy de
backend — no -SoAssets ele não muda).

### 2026-09-06 — pacote `totem-2026-09-06-0015.zip`

Feito via SSH (sessão do política-laravel, acesso já existente - ver seção
"Acesso SSH" no topo deste arquivo). Passos executados, na ordem:

1. Backup ANTES de mexer em qualquer coisa:
   `~/backups_totem/totem_app_backup_20260906_042649.tar.gz` (sem `vendor/`)
   e `~/backups_totem/totem_db_backup_20260906_042649.sql` (mysqldump),
   mais `.env.backup-antes-do-deploy` dentro do próprio `totem_app/`.
   Ficam no servidor, sem rotação automática - apagar manualmente quando
   não precisar mais.
2. `unzip -oq` do pacote por cima de `totem_app/` (aviso de backslash
   apareceu e foi ignorado, ver nota acima - conferido, nada corrompido).
3. **Achado real, não estava nos passos originais deste guia**: o `.env`
   de produção ainda tinha `GEMINI_TEXT_MODEL=gemini-2.5-flash` (modelo
   descontinuado pelo Google, confirmado pelo comentário em
   `config/services.php`). Corrigido pra `gemini-flash-lite-latest`
   (o valor default do próprio `config/services.php` de qualquer forma -
   se isso quebrar nesta conta de novo, vale conferir esse valor ANTES
   de suspeitar de código). `VITE_KIOSK_IA_LOCAL=false` também
   adicionado (não existia ainda no `.env` de produção).
4. `migrate --force` (rodou limpo, incluindo a de organização) +
   `PlanoSeeder --force`.
5. `config:clear/route:clear/view:clear/cache:clear` seguido de
   `config:cache/route:cache/view:cache`.
6. `build/` copiado de `totem_app/public/build` pra
   `public_html/totem/build` (backup do antigo como `build.bak`, sem
   timestamp - só existe um de cada vez, próximo deploy sobrescreve).
7. Conferido: `/api/v1/health` → `{"status":"ok","db":true,"storage":true,"gemini":true}`,
   `/api/v1/planos` → 200, `/`, `/atendimento`, `/admin` → 200.

**Pendente, não feito nesta rodada**: reconfigurar o navegador do totem
físico pra abrir `/atendimento` direto (ver aviso #1 no topo deste arquivo -
a raiz do site agora é a home de marketing, não redireciona mais sozinha).

---

# Instalação do zero (cliente novo)

## 0. Antes de tudo: PHP 8.4

**Requisito duro.** O `composer.lock` resolve o stack Symfony em versões que
exigem `php >= 8.4` — com 8.3 a aplicação nem inicia (`platform_check.php`
aborta). Confira no hPanel em **Avançado → Configuração PHP**.

Se a sua conta só oferecer 8.3, o projeto em si é compatível (o
`composer.json` pede `^8.3`); o que trava é a resolução do lock. Regenere
localmente para 8.3 e faça commit do lock novo:

```powershell
composer config platform.php 8.3.0
composer update
php artisan test        # confirme que continua verde antes de subir
```

## 1. O que NÃO vai pelo git

Estes estão no `.gitignore` e precisam chegar ao servidor de outro jeito:

| Pasta | Como resolver |
|---|---|
| `vendor/` | `composer install --no-dev --optimize-autoloader` via SSH. Sem SSH, gere local e envie por FTP. |
| `public/build/` | **Gere local** (`npm run build`) e envie. Hospedagem compartilhada não tem Node. |
| `.env` | Criar direto no servidor (ver passo 3). |
| `public/models/vosk/` | Só se for ligar o Vosk (`VITE_KIOSK_VOSK=true`). Está desligado por padrão. |

O `.\deploy.ps1` monta um `.zip` com tudo pronto para subir pelo Gerenciador
de Arquivos.

## 2. Estrutura no servidor

A raiz do domínio precisa apontar para **`public/`**, nunca para a raiz do
projeto — senão `.env`, `vendor/` e `storage/` ficam acessíveis pela web.

No hPanel: **Sites → Gerenciar → Avançado → Alterar pasta raiz** para
`public_html/totem/public` (ou o caminho onde você colocou o projeto).

## 3. `.env` de produção

Crie no servidor a partir do `.env.example` e ajuste:

```dotenv
APP_NAME="Ouvidoria Cidadã"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://seudominio.com.br

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=<banco criado no hPanel>
DB_USERNAME=<usuário do banco>
DB_PASSWORD=<senha>

# Fila, cache e sessão no banco: não há Redis nem worker permanente aqui.
QUEUE_CONNECTION=database
CACHE_STORE=database
SESSION_DRIVER=database

# IA: a chave fica SÓ no servidor (aistudio.google.com/apikey).
# Use o formato AQ. (auth key) - NÃO expira. AIza (chave padrão) é rejeitada
# pelo Google a partir de set/2026. Este .env é independente do .env local:
# ao trocar a chave, atualizar OS DOIS (ver "Log de deploys" 2026-09-06 tarde).
GEMINI_API_KEY=<sua chave AQ.>
GEMINI_TEXT_MODEL=gemini-flash-lite-latest
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts

# Kiosk: false = usa a Gemini; true = só processamento local
VITE_KIOSK_IA_LOCAL=false

MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USERNAME=<e-mail criado no hPanel>
MAIL_PASSWORD=<senha>
MAIL_ENCRYPTION=ssl
```

> As variáveis `VITE_*` entram no bundle **na hora do build**. Mudou uma
> delas? Rode `npm run build` de novo e reenvie `public/build/`.

Depois:

```bash
php artisan key:generate --force
```

## 4. Banco

```bash
php artisan migrate --force
php artisan db:seed --class="Database\Seeders\PlanoSeeder" --force
```

O `PlanoSeeder` é **obrigatório**: sem ele a home não tem planos para
exibir e o cadastro não funciona. O `DevSeeder` (admin de teste, totem de
exemplo, 60 manifestações fictícias) **não deve rodar em produção** — ele já
é chamado só quando `APP_ENV=local`.

## 5. Ajustes finais

```bash
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
chmod -R 775 storage bootstrap/cache
```

Refaça os `:cache` a cada deploy que mude `.env`, rotas ou views.

## 6. O cron (um só)

A hospedagem compartilhada permite poucos crons; todo o processamento em
segundo plano foi concentrado num agendador só. Em **Avançado → Trabalhos
Cron**, a cada minuto:

```
/usr/bin/php /home/<usuario>/domains/<dominio>/public_html/totem/artisan schedule:run >> /dev/null 2>&1
```

Ele cobre: fila de notificações, checagem de SLA (de hora em hora) e o
expurgo LGPD (de madrugada). Ver `routes/console.php` — usa
`Schedule::call()` + `Artisan::call()` em vez de `Schedule::command()`
porque `proc_open`/`exec` costumam estar desabilitados nesse tipo de conta.

## 7. HTTPS não é opcional

Ative o SSL grátis no hPanel e force HTTPS. **Sem HTTPS o totem não
funciona**: navegadores só liberam microfone (`getUserMedia`) e ditado
(`SpeechRecognition`) em contexto seguro.

## 8. Primeiro acesso

1. `https://seudominio.com.br/` — home, cria a primeira conta pelo cadastro
2. `https://seudominio.com.br/admin` — painel
3. `https://seudominio.com.br/atendimento` — abrir na máquina do totem

## Limitações conhecidas nesse ambiente

- **Sem worker permanente.** A fila é drenada pelo cron a cada minuto, então
  uma notificação pode levar até ~1 min para sair. Aceitável para alerta
  operacional.
- **`php artisan serve` não existe aqui** — quem serve é o Apache/LiteSpeed
  da Hostinger apontando para `public/`.
- **Áudio das frases fixas** (`public/audio/kiosk/*.wav`, ~4 MB) vai pelo
  git normalmente. Para gerar novos é preciso rodar
  `ouvidoria:gerar-audios-kiosk` numa máquina com a chave Gemini.
