param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$project = "orderfit-e2e-" + [guid]::NewGuid().ToString("N").Substring(0, 10)
$tempEnv = Join-Path ([System.IO.Path]::GetTempPath()) ("$project.env")

function New-Secret {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    try { return $listener.LocalEndpoint.Port }
    finally { $listener.Stop() }
}

$webPort = Get-FreePort
$dbPassword = New-Secret
$runtimePassword = New-Secret
$workerPassword = New-Secret
$sessionSecret = New-Secret
$fingerprintKey = New-Secret
$lines = @(
    "WEB_PORT=$webPort",
    "POSTGRES_USER=orderfit_migrator",
    "POSTGRES_PASSWORD=$dbPassword",
    "POSTGRES_DB=orderfit",
    "DATABASE_URL_DIRECT=postgresql+psycopg://orderfit_migrator:$dbPassword@db:5432/orderfit",
    "DATABASE_URL=postgresql+psycopg://orderfit_runtime:$runtimePassword@db:5432/orderfit",
    "WORKER_DATABASE_URL=postgresql+psycopg://orderfit_worker_login:$workerPassword@db:5432/orderfit",
    "RUNTIME_LOGIN=orderfit_runtime",
    "RUNTIME_PASSWORD=$runtimePassword",
    "WORKER_LOGIN=orderfit_worker_login",
    "WORKER_PASSWORD=$workerPassword",
    "SESSION_SECRET=$sessionSecret",
    "ACCOUNT_FINGERPRINT_KEY=$fingerprintKey",
    "ACCOUNT_FINGERPRINT_KEY_VERSION=1",
    "COOKIE_SECURE=false",
    "LLM_MODE=off",
    "TRUSTED_PROXY_IPS=[]",
    "DOCUMENT_STORAGE_BACKEND=filesystem"
)
[System.IO.File]::WriteAllLines($tempEnv, $lines, [System.Text.UTF8Encoding]::new($false))

function Invoke-Compose([string[]]$Arguments) {
    & docker compose --project-name $project --env-file $tempEnv @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
}

try {
    Push-Location $root
    if (-not $SkipBuild) { Invoke-Compose @("build", "api", "web") }
    Invoke-Compose @("--profile", "setup", "run", "--rm", "provision")
    Invoke-Compose @("up", "-d")

    $readyUrl = "http://localhost:$webPort/api/health"
    $deadline = [DateTime]::UtcNow.AddMinutes(3)
    do {
        try {
            $ready = Invoke-RestMethod -Uri $readyUrl -TimeoutSec 3
        } catch { $ready = $null }
        if ($ready -and $ready.connected -and $ready.ready) { break }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $ready -or -not $ready.connected -or -not $ready.ready) { throw "The isolated API did not become ready through the web proxy." }

    $env:E2E_BASE_URL = "http://localhost:$webPort"
    Push-Location (Join-Path $root "web")
    try { & npm run test:e2e -- --workers=1; if ($LASTEXITCODE -ne 0) { throw "Playwright E2E failed." } }
    finally { Pop-Location }
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    & docker compose --project-name $project --env-file $tempEnv down -v
    if (Test-Path -LiteralPath $tempEnv) { Clear-Content -LiteralPath $tempEnv; Remove-Item -LiteralPath $tempEnv -Force }
}
