# Empacota o projeto para subir na Hostinger (hospedagem compartilhada).
#
# Gera um .zip com o que o git NÃO leva - `vendor/` e `public/build/` -
# junto com o código, pronto para descompactar no Gerenciador de Arquivos.
# Hospedagem compartilhada não tem Node, então o build TEM que sair daqui.
#
# Uso:
#   .\deploy.ps1              pacote completo (código + vendor + build)
#   .\deploy.ps1 -SoAssets    só public/build (deploy de mudança de front)
#
# Ver docs/DEPLOY-HOSTINGER.md para o passo a passo no servidor.

param(
    [switch]$SoAssets
)

$ErrorActionPreference = 'Stop'

$php84 = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if (Test-Path "$php84\php.exe") {
    $env:PATH = "$php84;$env:USERPROFILE\.config\herd-lite\bin;$env:PATH"
}

$saida = Join-Path $PSScriptRoot 'dist'
$carimbo = Get-Date -Format 'yyyy-MM-dd-HHmm'
New-Item -ItemType Directory -Force -Path $saida | Out-Null

# O bundle é gerado com as VITE_* do .env atual - se este .env for o de
# desenvolvimento, o front vai para produção com a configuração errada.
$viteLocal = (Select-String -Path '.env' -Pattern '^VITE_KIOSK_IA_LOCAL=(.*)$' -ErrorAction SilentlyContinue).Matches.Groups[1].Value
Write-Host ''
Write-Host "  As variáveis VITE_* entram no bundle AGORA, no build." -ForegroundColor Yellow
Write-Host "  VITE_KIOSK_IA_LOCAL no .env atual = '$viteLocal'" -ForegroundColor Yellow
Write-Host "  Em produção normalmente deve ser 'false' (usa a Gemini)." -ForegroundColor Yellow
Write-Host ''
$resposta = Read-Host '  Continuar com esse valor? (s/N)'
if ($resposta -notmatch '^[sS]') { Write-Host 'Cancelado.'; exit 0 }

# `public/hot` faz o Blade apontar pro dev server do Vite. Se for junto no
# pacote, o site em produção tenta carregar de 127.0.0.1:5173 e vem branco.
if (Test-Path 'public/hot') { Remove-Item 'public/hot' -Force }

Write-Host 'Compilando assets...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error 'Falha no build.' }

if ($SoAssets) {
    $zip = Join-Path $saida "totem-assets-$carimbo.zip"
    Compress-Archive -Path 'public/build' -DestinationPath $zip -Force
    Write-Host ''
    Write-Host "  Pacote de assets: $zip" -ForegroundColor Green
    Write-Host '  Descompacte sobre public/ no servidor, substituindo public/build.' -ForegroundColor Green
    exit 0
}

Write-Host 'Instalando dependências de produção (sem dev)...' -ForegroundColor Cyan
composer install --no-dev --optimize-autoloader --no-interaction
if ($LASTEXITCODE -ne 0) { Write-Error 'Falha no composer install.' }

$itens = @(
    'app', 'bootstrap', 'config', 'database', 'public', 'resources', 'routes',
    'storage', 'vendor', 'artisan', 'composer.json', 'composer.lock', '.env.example'
) | Where-Object { Test-Path $_ }

$zip = Join-Path $saida "totem-$carimbo.zip"
Write-Host 'Compactando (pode demorar - vendor é grande)...' -ForegroundColor Cyan
Compress-Archive -Path $itens -DestinationPath $zip -Force

# Restaura as dependências de desenvolvimento, senão os testes param de
# rodar nesta máquina depois do deploy.
Write-Host 'Restaurando dependências de desenvolvimento...' -ForegroundColor Cyan
composer install --no-interaction | Out-Null

$tamanho = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ''
Write-Host "  Pacote: $zip  ($tamanho MB)" -ForegroundColor Green
Write-Host ''
Write-Host '  No servidor:' -ForegroundColor Cyan
Write-Host '   1. descompacte e aponte a raiz do domínio para public/'
Write-Host '   2. crie o .env (ver docs/DEPLOY-HOSTINGER.md) e rode key:generate'
Write-Host '   3. php artisan migrate --force'
Write-Host '   4. php artisan db:seed --class="Database\Seeders\PlanoSeeder" --force'
Write-Host '   5. php artisan storage:link && php artisan config:cache route:cache'
Write-Host '   6. cron a cada minuto: php artisan schedule:run'
Write-Host ''
Write-Host '  O .env NAO vai no pacote, de proposito.' -ForegroundColor Yellow
Write-Host ''
