# Rodar localmente (Windows)

## Pré-requisitos

- **PHP 8.4** — o `php` do PATH nesta máquina é o XAMPP 8.2 e **não roda** o projeto.
  O 8.4 do WinGet fica em
  `C:\Users\jaco-\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe`.
- **Composer** — `~\.config\herd-lite\bin\composer.phar` (não está no PATH).
- Node/npm.

Solução definitiva: no `Path` do usuário (Variáveis de Ambiente), colocar a pasta
do PHP 8.4 e `~\.config\herd-lite\bin` **antes** de `C:\xampp\php`.

## Subir o ambiente

```powershell
.\dev.ps1
```

Faz: força o PHP 8.4 no PATH da sessão, mata processos presos nas portas 8001/5173,
sobe `artisan serve` (8001) + `queue:listen` + Vite (`127.0.0.1:5173`, fixo). Sem
`pail` (precisa de `pcntl`, indisponível no PHP do Windows) — logs em
`storage\logs\laravel.log`.

- **Kiosk:** http://localhost:8001/atendimento
- **Painel admin:** http://localhost:8001/admin

## Acessar do celular (mesma rede Wi-Fi)

```powershell
.\dev.ps1 -Rede
```

O script detecta o IP da máquina na LAN, sobe o `artisan serve` em `0.0.0.0`,
aponta o Vite e o `APP_URL` para esse IP e imprime os endereços. No celular,
use `http://<ip>:8001`.

Se não conectar, o firewall do Windows está bloqueando. Num PowerShell **como
Administrador**:

```powershell
New-NetFirewallRule -DisplayName 'Totem dev (8001/5173)' -Direction Inbound `
  -Protocol TCP -LocalPort 8001,5173 -Action Allow -Profile Private
```

### ⚠️ Microfone e ditado não funcionam por HTTP no celular

Navegadores só liberam `getUserMedia` (gravação) e `SpeechRecognition` (ditado)
em **contexto seguro**: `https://` ou `localhost`. Um IP de rede em `http://`
não é contexto seguro — as telas abrem e dá para navegar, mas **falar não
funciona**, e é assim em qualquer site, não é bug do projeto.

Para testar a **voz** num celular, escolha um:

| Como | O que fazer |
|---|---|
| **Túnel HTTPS** (mais simples) | `cloudflared tunnel --url http://localhost:8001` ou `ngrok http 8001` — devolve uma URL `https://…` que funciona em qualquer aparelho, inclusive iPhone. Ajuste `APP_URL` para essa URL antes de subir o Vite. |
| **Flag do Chrome no Android** | `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → adicione `http://192.168.0.7:8001` → *Enabled* → reinicie o Chrome. Só Android/Chrome. |
| **Certificado local** | `mkcert` + servir por HTTPS. Mais trabalhoso; vale quando virar rotina. |

No **totem de verdade** isso não é problema: em produção ele roda em HTTPS, e
em desenvolvimento na própria máquina `localhost` já é contexto seguro.

## Primeiro setup do banco

```powershell
php artisan migrate --seed      # ou: php artisan db:seed --class=Database\Seeders\DevSeeder
```

O `DevSeeder` (só em `local`) cria:

| | |
|---|---|
| **Painel admin** | `admin@totem.test` / `password` |
| **Totem criado** | `TOTEM-DEV-01` — "Totem - Desenvolvimento" |
| **Organização** | Totem Dev (plano Profissional) |
| **Dados de exemplo** | 60 manifestações nos últimos 60 dias, para o painel e os relatórios terem o que mostrar |

### Empresa-demo completa (apresentação / vídeo)

```powershell
php artisan ouvidoria:semear-demo --fresh
```

Cria a "Rede Aurora": ~170 manifestações em 150 dias, 4 totens, respostas
oficiais, e o **mural público** já ligado em `/mural/demoredeauroraouvidoria`.
Login: `demo@aurora.test` / `demo1234`. Ver [DEMO-APRESENTACAO.md](DEMO-APRESENTACAO.md).

## Primeiro acesso ao kiosk (pareamento)

A primeira tela do kiosk é de **login**, não de digitar chave:

1. Abra `http://localhost:8001/atendimento`
2. Entre com `admin@totem.test` / `password`
3. Aparece a lista dos totens — **clique no que esta máquina vai ser**

Pronto. A device key é emitida pelo servidor nesse momento (`POST /devices/{id}/pair`),
guardada no `localStorage`, e o token da equipe é descartado — nada de credencial
de funcionário parada num totem público.

Pra reconfigurar: DevTools → Application → Local Storage → apagar `totem:device-config`.

## Transcrição offline (Vosk)

```powershell
php artisan ouvidoria:baixar-modelo-vosk    # 1x - baixa o modelo pt-BR (~32 MB)
```

Ver [CAMADA-OFFLINE.md](CAMADA-OFFLINE.md).

## Locução do totem

```powershell
php artisan ouvidoria:gerar-audios-kiosk     # gera os WAV das frases fixas
```

Ver [LOCUCAO-KIOSK.md](LOCUCAO-KIOSK.md).

## Testes

```powershell
php artisan test     # backend (PHPUnit)
npm test             # frontend (Vitest) - lógica em resources/js/shared/
npm run typecheck
```
