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
    [switch]$SoAssets,
    # Pula a confirmação do VITE_KIOSK_IA_LOCAL (automação/CI).
    [switch]$SemPerguntar
)

$ErrorActionPreference = 'Stop'

# npm e composer escrevem avisos normais no stderr (ex.: o aviso de tamanho
# de chunk do Vite). Com ErrorActionPreference='Stop', o PowerShell embrulha
# cada linha de stderr de um executável nativo num ErrorRecord e ABORTA o
# script, mesmo com o comando tendo terminado com sucesso. Por isso os
# comandos nativos rodam com 'Continue' e a verificação é pelo $LASTEXITCODE.
function Invoke-Nativo {
    param([scriptblock]$Comando, [string]$Erro)

    $anterior = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Comando } finally { $ErrorActionPreference = $anterior }
    if ($LASTEXITCODE -ne 0) { Write-Error $Erro }
}

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
if (-not $SemPerguntar) {
    $resposta = Read-Host '  Continuar com esse valor? (s/N)'
    if ($resposta -notmatch '^[sS]') { Write-Host 'Cancelado.'; exit 0 }
}

# `public/hot` faz o Blade apontar pro dev server do Vite. Se for junto no
# pacote, o site em produção tenta carregar de 127.0.0.1:5173 e vem branco.
if (Test-Path 'public/hot') { Remove-Item 'public/hot' -Force }

Write-Host 'Compilando assets...' -ForegroundColor Cyan
Invoke-Nativo { npm run build } 'Falha no build.'

if ($SoAssets) {
    $zip = Join-Path $saida "totem-assets-$carimbo.zip"
    Compress-Archive -Path 'public/build' -DestinationPath $zip -Force
    Write-Host ''
    Write-Host "  Pacote de assets: $zip" -ForegroundColor Green
    Write-Host '  Descompacte sobre public/ no servidor, substituindo public/build.' -ForegroundColor Green
    exit 0
}

Write-Host 'Instalando dependências de produção (sem dev)...' -ForegroundColor Cyan
Invoke-Nativo { composer install --no-dev --optimize-autoloader --no-interaction } 'Falha no composer install.'

# `Compress-Archive` descarta itens em silêncio quando a lista mistura
# pastas e arquivos sem extensão - foi assim que o `artisan` ficou de fora
# de um pacote (e sem ele nenhum `php artisan migrate` roda no servidor).
# Copiar para uma pasta de staging e zipar a PASTA, via .NET, é previsível.
$staging = Join-Path $saida "staging-$carimbo"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

$itens = @(
    'app', 'bootstrap', 'config', 'database', 'public', 'resources', 'routes',
    'storage', 'vendor', 'artisan', 'composer.json', 'composer.lock', '.env.example'
) | Where-Object { Test-Path $_ }

Write-Host 'Preparando os arquivos...' -ForegroundColor Cyan
foreach ($item in $itens) {
    Copy-Item -Path $item -Destination $staging -Recurse -Force
}

$zip = Join-Path $saida "totem-$carimbo.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Write-Host 'Compactando (pode demorar - vendor é grande)...' -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zip)
Remove-Item $staging -Recurse -Force

# Confere o pacote antes de declarar sucesso: um zip incompleto só dá as
# caras no servidor, no meio do deploy.
$obrigatorios = @('artisan', 'public/index.php', 'public/build/manifest.json',
                  'vendor/autoload.php', 'database/seeders/PlanoSeeder.php')
$arquivo = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $dentro = $arquivo.Entries.FullName | ForEach-Object { $_.Replace([char]92, '/') }
    $faltando = $obrigatorios | Where-Object { $alvo = $_; -not ($dentro -contains $alvo) }
    $temEnv = $dentro | Where-Object { $_ -eq '.env' }
}
finally { $arquivo.Dispose() }

if ($faltando) { Write-Error "Pacote incompleto - faltou: $($faltando -join ', ')" }
if ($temEnv) { Write-Error 'O .env entrou no pacote. Aborte: ele tem a chave da Gemini e a senha do banco.' }
Write-Host 'Pacote conferido: arquivos essenciais presentes, .env fora.' -ForegroundColor Green

# Restaura as dependências de desenvolvimento, senão os testes param de
# rodar nesta máquina depois do deploy.
Write-Host 'Restaurando dependências de desenvolvimento...' -ForegroundColor Cyan
Invoke-Nativo { composer install --no-interaction | Out-Null } 'Falha ao restaurar dependências de dev.'

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
