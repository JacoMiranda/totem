# Envia o pacote gerado pelo deploy.ps1 para a Hostinger e aplica: unzip,
# migrate, caches, cópia do build. Faz backup do banco e do .env ANTES.
#
# Uso:
#   .\deploy.ps1                    # gera dist\totem-<carimbo>.zip
#   .\deploy-remoto.ps1             # envia o mais recente e aplica
#   .\deploy-remoto.ps1 -Pacote dist\totem-2026-09-06-1022.zip
#   .\deploy-remoto.ps1 -SoBuild   # só recompila e copia public/build (rápido)
#
# Precisa de acesso SSH (a chave ~/.ssh/id_ed25519_hostinger já existe nesta
# máquina). No Claude Code, exige uma regra de permissão pra Bash(ssh...) /
# Bash(scp...) - ver docs/DEPLOY-HOSTINGER.md.

param(
    [string]$Pacote,
    [switch]$SoBuild
)

$ErrorActionPreference = 'Stop'

$Chave  = "$env:USERPROFILE\.ssh\id_ed25519_hostinger"
$Porta  = 65002
$Alvo   = 'u928337956@82.25.73.58'
$App    = '~/domains/prinatus.com.br/totem_app'
$WebDir = '~/domains/prinatus.com.br/public_html/totem'

if (-not (Test-Path $Chave)) { Write-Error "Chave SSH não encontrada: $Chave" }

$sshOpts = @('-i', $Chave, '-p', $Porta, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20')
function Remoto([string]$cmd) { & ssh @sshOpts $Alvo $cmd; if ($LASTEXITCODE -ne 0) { Write-Error "Falhou no servidor: $cmd" } }

$carimbo = Get-Date -Format 'yyyy-MM-dd-HHmm'

# ---------------------------------------------------------------- só build
if ($SoBuild) {
    if (Test-Path 'public/hot') { Remove-Item 'public/hot' -Force }
    Write-Host 'Compilando...' -ForegroundColor Cyan
    $ErrorActionPreference = 'Continue'; npm run build; $ErrorActionPreference = 'Stop'
    Compress-Archive -Path 'public/build' -DestinationPath "dist\build-$carimbo.zip" -Force

    & scp -i $Chave -P $Porta "dist\build-$carimbo.zip" "${Alvo}:~/build-$carimbo.zip"
    if ($LASTEXITCODE -ne 0) { Write-Error 'Falha no envio (scp).' }

    Remoto "cd $WebDir && rm -rf build.bak && (mv build build.bak || true) && cd ~ && unzip -oq build-$carimbo.zip -d /tmp/b-$carimbo && mv /tmp/b-$carimbo/build $WebDir/build && cp -r $WebDir/build $App/public/build && rm -rf /tmp/b-$carimbo build-$carimbo.zip && echo BUILD-OK"
    Write-Host 'Build publicado.' -ForegroundColor Green
    exit 0
}

# ------------------------------------------------------- pacote completo
if (-not $Pacote) {
    $Pacote = Get-ChildItem 'dist\totem-*.zip' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Pacote -or -not (Test-Path $Pacote)) {
    Write-Error 'Nenhum pacote encontrado. Rode .\deploy.ps1 primeiro.'
}
$nomePacote = Split-Path $Pacote -Leaf
Write-Host "Pacote: $nomePacote ($([math]::Round((Get-Item $Pacote).Length/1MB,1)) MB)" -ForegroundColor Cyan

Write-Host 'Backup no servidor (banco + .env + código)...' -ForegroundColor Cyan
Remoto @"
set -e
mkdir -p ~/backups_totem
cd $App
cp .env .env.backup-$carimbo
DBHOST=`$(grep -E '^DB_HOST=' .env | cut -d= -f2)
DBNAME=`$(grep -E '^DB_DATABASE=' .env | cut -d= -f2)
DBUSER=`$(grep -E '^DB_USERNAME=' .env | cut -d= -f2)
DBPASS=`$(grep -E '^DB_PASSWORD=' .env | cut -d= -f2-)
mysqldump -h "`$DBHOST" -u "`$DBUSER" -p"`$DBPASS" "`$DBNAME" > ~/backups_totem/db-$carimbo.sql
tar -czf ~/backups_totem/app-$carimbo.tar.gz --exclude=vendor --exclude=node_modules .
echo "BACKUP-OK: ~/backups_totem/db-$carimbo.sql (`$(du -h ~/backups_totem/db-$carimbo.sql | cut -f1))"
"@

Write-Host 'Enviando o pacote (pode demorar)...' -ForegroundColor Cyan
& scp -i $Chave -P $Porta $Pacote "${Alvo}:~/$nomePacote"
if ($LASTEXITCODE -ne 0) { Write-Error 'Falha no envio (scp).' }

Write-Host 'Aplicando...' -ForegroundColor Cyan
Remoto @"
set -e
cd $App
unzip -oq ~/$nomePacote || true   # aviso de backslash sai != 0, ignorar
php artisan migrate --force
php artisan db:seed --class='Database\Seeders\PlanoSeeder' --force
php artisan config:clear && php artisan route:clear && php artisan view:clear
php artisan config:cache && php artisan route:cache && php artisan view:cache
rm -rf $WebDir/build.bak && (mv $WebDir/build $WebDir/build.bak || true)
cp -r $App/public/build $WebDir/build
rm -f ~/$nomePacote
echo APLICADO-OK
"@

Write-Host ''
Write-Host 'Verificando produção...' -ForegroundColor Cyan
$health = (Invoke-WebRequest -Uri 'https://totem.prinatus.com.br/api/v1/health' -UseBasicParsing).Content
Write-Host "  /health  -> $health"
$planos = (Invoke-WebRequest -Uri 'https://totem.prinatus.com.br/api/v1/planos' -UseBasicParsing).StatusCode
Write-Host "  /planos  -> HTTP $planos (esperado 200)"
try {
    Invoke-WebRequest -Uri 'https://totem.prinatus.com.br/api/v1/logs' -UseBasicParsing | Out-Null
} catch {
    Write-Host "  /logs    -> HTTP $($_.Exception.Response.StatusCode.value__) (esperado 401 - precisa de login)"
}
Write-Host ''
Write-Host 'Pronto. Backup do banco: ~/backups_totem/db-'$carimbo'.sql no servidor.' -ForegroundColor Green
