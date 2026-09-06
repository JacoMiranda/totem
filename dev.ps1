# Sobe o ambiente de desenvolvimento sem depender do `composer` / do `php`
# global (que nesta máquina é o XAMPP 8.2 e não roda o projeto - exige 8.4).
#
# Equivalente ao script "dev" do composer.json, mas:
#  - força o PHP 8.4 do WinGet no PATH desta sessão;
#  - sem `pail` (exige a extensão pcntl, que não existe no PHP do Windows);
#  - mata processos presos nas portas 8001/5173 antes de subir (dev.ps1
#    rodado várias vezes deixava artisan/vite órfãos -> tela em branco);
#  - fixa a porta e o host do Vite (o default cai em [::1] e às vezes troca
#    de porta, aí o Blade aponta pra um servidor que não existe).
#
# Uso:
#   .\dev.ps1          só nesta máquina  -> http://localhost:8001
#   .\dev.ps1 -Rede    acessível na LAN  -> http://<ip-da-máquina>:8001
#
# ATENÇÃO no modo -Rede: microfone e ditado por voz NÃO funcionam em
# http:// fora de localhost. Navegadores só liberam getUserMedia e
# SpeechRecognition em "contexto seguro" (https, ou localhost). Para testar
# a VOZ no celular é preciso HTTPS - ver docs/DEV-LOCAL.md.
#
# Alternativa definitiva pro PATH: nas variáveis de ambiente do usuário,
# mover a pasta do PHP 8.4 e a ~\.config\herd-lite\bin para ANTES de
# C:\xampp\php - aí `php` e `composer` funcionam direto.

param(
    [switch]$Rede
)

$ErrorActionPreference = 'Stop'

$php84 = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if (-not (Test-Path "$php84\php.exe")) {
    Write-Error "PHP 8.4 não encontrado em $php84 - ajuste o caminho neste script."
}
$env:PATH = "$php84;$env:USERPROFILE\.config\herd-lite\bin;$env:PATH"

# Libera as portas de quem ficou preso de uma execução anterior.
foreach ($porta in 8001, 5173) {
    Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            Write-Host "Encerrando processo preso na porta $porta (PID $_)" -ForegroundColor Yellow
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
}

if ($Rede) {
    # IP da LAN: a primeira IPv4 privada de um adaptador ativo que não seja
    # loopback nem virtual (WSL/Hyper-V criam 172.x que o celular não alcança).
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).Status -eq 'Up' -and
            (Get-NetAdapter -InterfaceIndex $_.InterfaceIndex -ErrorAction SilentlyContinue).InterfaceDescription -notmatch 'Hyper-V|WSL|Virtual|Loopback'
        } |
        Select-Object -First 1 -ExpandProperty IPAddress

    if (-not $ip) { Write-Error 'Não achei o IP da rede local. Rode `ipconfig` e use .\dev.ps1 sem -Rede.' }

    $hostServe = '0.0.0.0'   # aceita conexões de qualquer interface
    $hostVite = $ip          # o hot file precisa de um IP que o CELULAR alcance
    $urlBase = "http://${ip}:8001"

    # O plugin do Laravel monta as URLs dos assets a partir do APP_URL.
    # Sem isso, o celular receberia links apontando para "localhost" - que,
    # no celular, é o próprio celular.
    $env:APP_URL = $urlBase

    Write-Host ''
    Write-Host "  No celular (mesma rede Wi-Fi):" -ForegroundColor Cyan
    Write-Host "    Home    $urlBase/" -ForegroundColor White
    Write-Host "    Painel  $urlBase/admin" -ForegroundColor White
    Write-Host "    Totem   $urlBase/atendimento" -ForegroundColor White
    Write-Host ''
    Write-Host "  Microfone/ditado NAO funcionam por http fora de localhost." -ForegroundColor Yellow
    Write-Host "  Navegar e ver as telas funciona; falar, nao. Ver docs/DEV-LOCAL.md." -ForegroundColor Yellow

    # O firewall do Windows bloqueia as portas por padrão. Criar a regra
    # exige elevação, então só avisamos se ela não existir.
    if (-not (Get-NetFirewallRule -DisplayName 'Totem dev (8001/5173)' -ErrorAction SilentlyContinue)) {
        Write-Host ''
        Write-Host "  Se o celular nao conectar, libere o firewall (PowerShell como Administrador):" -ForegroundColor Yellow
        Write-Host "    New-NetFirewallRule -DisplayName 'Totem dev (8001/5173)' -Direction Inbound -Protocol TCP -LocalPort 8001,5173 -Action Allow -Profile Private" -ForegroundColor DarkGray
    }
    Write-Host ''
}
else {
    $hostServe = '127.0.0.1'
    $hostVite = '127.0.0.1'
    Write-Host "kiosk: http://localhost:8001/atendimento" -ForegroundColor Green
}

# Nota: `php artisan serve` (servidor embutido do PHP) é SINGLE-THREADED no
# Windows - `PHP_CLI_SERVER_WORKERS` não funciona aqui ("forking is not
# supported on this platform"). Enquanto uma requisição lenta roda, as
# outras esperam. As chamadas de IA foram tuneladas pra ~2-4s
# (gemini-flash-lite-latest) justamente por isso; se ainda incomodar, use
# WSL, Herd ou Octane/FrankenPHP.

Write-Host "PHP: $(php -r 'echo PHP_VERSION;')" -ForegroundColor Green

npx concurrently -c "#93c5fd,#fb7185,#fdba74" `
    "php artisan serve --host=$hostServe --port=8001" `
    "php artisan queue:listen --tries=1 --timeout=0" `
    "npm run dev -- --host $hostVite --strictPort" `
    --names=server,queue,vite --kill-others-on-fail
