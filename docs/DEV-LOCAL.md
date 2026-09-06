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
