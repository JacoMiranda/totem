# Sobe o ambiente de desenvolvimento sem depender do `composer` / do `php`
# global (que nesta máquina é o XAMPP 8.2 e não roda o projeto - exige 8.4).
#
# Equivalente ao script "dev" do composer.json, mas:
#  - força o PHP 8.4 do WinGet no PATH desta sessão;
#  - sem `pail` (exige a extensão pcntl, que não existe no PHP do Windows);
#  - mata processos presos nas portas 8001/5173 antes de subir (dev.ps1
#    rodado várias vezes deixava artisan/vite órfãos -> tela em branco);
#  - fixa o Vite em 127.0.0.1:5173 (o default cai em [::1] e às vezes
#    troca de porta, aí o Blade aponta pra um servidor que não existe).
#
# Uso:  .\dev.ps1     |  kiosk: http://localhost:8001/atendimento
#
# Alternativa definitiva: no PATH do Windows (variáveis de ambiente do
# usuário), mover a pasta do PHP 8.4 e a ~\.config\herd-lite\bin para ANTES
# de C:\xampp\php - aí `php` e `composer` funcionam direto.

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

# Nota: `php artisan serve` (servidor embutido do PHP) é SINGLE-THREADED no
# Windows - `PHP_CLI_SERVER_WORKERS` não funciona aqui ("forking is not
# supported on this platform"). Enquanto uma requisição lenta roda, as
# outras esperam. As chamadas de IA foram tuneladas pra ~2-4s
# (gemini-flash-lite-latest) justamente por isso; se ainda incomodar, use
# WSL, Herd ou Octane/FrankenPHP.

Write-Host "PHP: $(php -r 'echo PHP_VERSION;')  |  kiosk: http://localhost:8001/atendimento" -ForegroundColor Green

npx concurrently -c "#93c5fd,#fb7185,#fdba74" `
    "php artisan serve --port=8001" `
    "php artisan queue:listen --tries=1 --timeout=0" `
    "npm run dev -- --host 127.0.0.1 --strictPort" `
    --names=server,queue,vite --kill-others-on-fail
