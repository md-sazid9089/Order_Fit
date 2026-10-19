# Starts a disposable OrderFit stack for interactive UI review and leaves it running.
# Mirrors scripts/run-e2e.ps1 (random secrets, isolated Compose project, LLM off, filesystem documents),
# but skips Playwright and also publishes the isolated API on 127.0.0.1 so `next dev` can target it.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File docs/ui_ux_audit_2026-10-19/harness/start-audit-stack.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File docs/ui_ux_audit_2026-10-19/harness/start-audit-stack.ps1 -Down
#
# State (project name, ports, env path) is written to $env:TEMP\orderfit-audit-stack.json; secrets stay in the
# temp env file only and are never printed. Never point this at a shared or hosted database.
param([switch]$Down, [int]$ApiPort = 18000, [string]$DevOrigin = "http://localhost:3001")

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$statePath = Join-Path ([System.IO.Path]::GetTempPath()) "orderfit-audit-stack.json"

function Invoke-Compose([string]$Project, [string]$EnvFile, [string[]]$Files, [string[]]$Arguments) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & docker compose @Files --project-name $Project --env-file $EnvFile @Arguments 2>&1 | ForEach-Object { "$_" } }
    finally { $ErrorActionPreference = $previousPreference }
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
}

if ($Down) {
    if (-not (Test-Path $statePath)) { Write-Output "No audit stack recorded."; exit 0 }
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    $files = @("-f", (Join-Path $root "docker-compose.yml"), "-f", $state.override)
    Invoke-Compose $state.project $state.envFile $files @("down", "-v", "--remove-orphans")
    Remove-Item -LiteralPath $state.envFile, $state.override, $statePath -ErrorAction SilentlyContinue
    Write-Output "Audit stack $($state.project) removed."
    exit 0
}

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
}
function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start(); try { return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}

$project = "orderfit-audit-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$envFile = Join-Path ([System.IO.Path]::GetTempPath()) "$project.env"
$override = Join-Path ([System.IO.Path]::GetTempPath()) "$project.compose.yml"
$webPort = Get-FreePort
$dbPassword = New-Secret; $runtimePassword = New-Secret; $workerPassword = New-Secret
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
    "SESSION_SECRET=$(New-Secret)",
    "ACCOUNT_FINGERPRINT_KEY=$(New-Secret)",
    "ACCOUNT_FINGERPRINT_KEY_VERSION=1",
    "COOKIE_SECURE=false",
    "LLM_MODE=off",
    "TRUSTED_PROXY_IPS=[]",
    "DOCUMENT_STORAGE_BACKEND=filesystem"
)
[System.IO.File]::WriteAllLines($envFile, $lines, [System.Text.UTF8Encoding]::new($false))
$apiImage = "$project-api:local"; $webImage = "$project-web:local"
$overrideLines = @("services:")
foreach ($service in @("migrate", "provision", "worker")) { $overrideLines += @("  ${service}:", "    image: $apiImage") }
# The dev server (`next dev` on $DevOrigin) is a second browser origin; the API's CSRF origin check must allow it.
$origins = "[`"http://localhost:$webPort`",`"$DevOrigin`"]"
$overrideLines += @("  api:", "    image: $apiImage", "    environment:", "      ALLOWED_ORIGINS: '$origins'", "    ports:", "      - `"127.0.0.1:${ApiPort}:8000`"")
$overrideLines += @("  web:", "    image: $webImage")
[System.IO.File]::WriteAllLines($override, $overrideLines, [System.Text.UTF8Encoding]::new($false))
$files = @("-f", (Join-Path $root "docker-compose.yml"), "-f", $override)

[ordered]@{ project = $project; envFile = $envFile; override = $override; webPort = $webPort; apiPort = $ApiPort } |
    ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

Push-Location $root
try {
    Invoke-Compose $project $envFile $files @("build", "api", "web")
    Invoke-Compose $project $envFile $files @("--profile", "setup", "run", "--rm", "provision")
    Invoke-Compose $project $envFile $files @("up", "-d")
} finally { Pop-Location }

$deadline = [DateTime]::UtcNow.AddMinutes(3)
do {
    try { $ready = Invoke-RestMethod -Uri "http://localhost:$webPort/api/health" -TimeoutSec 3 } catch { $ready = $null }
    if ($ready -and $ready.connected -and $ready.ready) { break }
    Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $ready -or -not $ready.ready) { throw "Audit stack did not become ready." }
Write-Output "AUDIT_STACK_READY project=$project web=http://localhost:$webPort api=http://127.0.0.1:$ApiPort"
