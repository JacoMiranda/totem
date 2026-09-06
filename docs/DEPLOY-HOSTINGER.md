# Deploy na Hostinger (hospedagem compartilhada)

O projeto foi desenhado para caber em hospedagem compartilhada: sem Docker,
sem Redis, sem worker permanente. Fila, cache e sessão usam o banco; o
processamento em segundo plano passa por **um único cron** (ver
`routes/console.php`).

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
