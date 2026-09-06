# Deploy na Hostinger (hospedagem compartilhada)

O projeto foi desenhado para caber em hospedagem compartilhada: sem Docker,
sem Redis, sem worker permanente. Fila, cache e sessão usam o banco; o
processamento em segundo plano passa por **um único cron** (ver
`routes/console.php`).

**Já existe uma instalação no ar em `totem.prinatus.com.br`.** Para
atualizá-la, siga a seção "Atualizar uma instalação existente"; a seção de
instalação do zero fica logo depois, para um cliente novo.

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

# IA: a chave fica SÓ no servidor (aistudio.google.com/apikey)
GEMINI_API_KEY=<sua chave>
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
