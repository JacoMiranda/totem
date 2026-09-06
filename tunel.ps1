# Publica o ambiente local numa URL HTTPS pública (Cloudflare Quick Tunnel),
# para testar em celular/tablet COM microfone e ditado por voz.
#
# Por que isso é necessário: navegadores só liberam getUserMedia (gravação)
# e SpeechRecognition (ditado) em "contexto seguro" - https, ou localhost.
# Acessando por http://<ip-da-rede>:8001 as telas abrem, mas falar não
# funciona. Um túnel HTTPS resolve, e funciona em qualquer aparelho,
# inclusive iPhone.
#
# Uso:  .\tunel.ps1
#
# DIFERENÇA para o .\dev.ps1: aqui os assets são COMPILADOS (npm run build),
# não servidos pelo Vite. O túnel expõe uma porta só, então um dev server
# noutra porta não seria alcançável de fora. Consequência prática: não há
# hot reload - ao mudar código, pare (Ctrl+C) e rode de novo.
#
# Requer o cloudflared (instale com: winget install --id Cloudflare.cloudflared).
# O Quick Tunnel não precisa de conta na Cloudflare. A URL é aleatória,
# temporária e pública - qualquer um com o link acessa. Não deixe rodando
# esquecido com dados reais.

$ErrorActionPreference = 'Stop'

$php84 = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe"
if (Test-Path "$php84\php.exe") {
    $env:PATH = "$php84;$env:USERPROFILE\.config\herd-lite\bin;$env:PATH"
}

$cloudflared = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cloudflared) {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { $cloudflared = $cmd.Source }
}
if (-not $cloudflared) {
    Write-Error "cloudflared não encontrado. Instale com: winget install --id Cloudflare.cloudflared"
}

# Libera as portas de execuções anteriores.
Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# `public/hot` faz o Blade apontar pro dev server do Vite. Se sobrou de uma
# execução do dev.ps1, a página tentaria carregar de um servidor que não
# existe aqui - e viria em branco.
if (Test-Path 'public/hot') {
    Remove-Item 'public/hot' -Force
    Write-Host 'Removido public/hot (usaremos os assets compilados).' -ForegroundColor DarkGray
}

Write-Host 'Compilando os assets (npm run build)...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error 'Falha no build.' }

Write-Host 'Abrindo o túnel...' -ForegroundColor Cyan
$log = Join-Path $env:TEMP "totem-tunel-$PID.log"
if (Test-Path $log) { Remove-Item $log -Force }

$tunel = Start-Process -FilePath $cloudflared `
    -ArgumentList 'tunnel', '--url', 'http://localhost:8001', '--no-autoupdate' `
    -RedirectStandardError $log -RedirectStandardOutput "$log.out" `
    -NoNewWindow -PassThru

# A URL só aparece depois que o túnel sobe; o cloudflared a escreve no
# stderr. Espera até uns 40s por ela.
$url = $null
foreach ($tentativa in 1..80) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $log) {
        $achado = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($achado) { $url = $achado.Matches[0].Value; break }
    }
    if ($tunel.HasExited) { break }
}

if (-not $url) {
    Stop-Process -Id $tunel.Id -Force -ErrorAction SilentlyContinue
    Write-Host (Get-Content $log -Raw -ErrorAction SilentlyContinue)
    Write-Error 'Não consegui obter a URL do túnel. Veja o log acima.'
}

# O Laravel monta as URLs dos assets a partir do APP_URL. Sem apontar pro
# túnel, o celular receberia links para 127.0.0.1 - que, no celular, é o
# próprio celular.
$env:APP_URL = $url
$env:ASSET_URL = $url

Write-Host ''
Write-Host '  ==================================================' -ForegroundColor Green
Write-Host "   Home    $url/"            -ForegroundColor White
Write-Host "   Painel  $url/admin"       -ForegroundColor White
Write-Host "   Totem   $url/atendimento" -ForegroundColor White
Write-Host '  ==================================================' -ForegroundColor Green
Write-Host '   HTTPS: microfone e ditado por voz funcionam aqui.' -ForegroundColor Green
Write-Host '   Sem hot reload - mudou o codigo? Ctrl+C e rode de novo.' -ForegroundColor Yellow
Write-Host '   Link publico e temporario: nao deixe rodando esquecido.' -ForegroundColor Yellow
Write-Host ''

try {
    php artisan serve --port=8001
}
finally {
    Write-Host 'Encerrando o túnel...' -ForegroundColor DarkGray
    Stop-Process -Id $tunel.Id -Force -ErrorAction SilentlyContinue
    Remove-Item $log, "$log.out" -Force -ErrorAction SilentlyContinue
}
