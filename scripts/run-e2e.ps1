param(
    [switch]$SkipBuild,
    [string]$TestPattern = "",
    [string]$EvidenceDirectory = "",
    # Optional local review: after automated checks, retain this disposable stack
    # until the caller removes the named file. Normal CI behavior is unchanged.
    [string]$BrowserReviewGate = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$project = "orderfit-e2e-" + [guid]::NewGuid().ToString("N").Substring(0, 10)
$tempEnv = Join-Path ([System.IO.Path]::GetTempPath()) ("$project.env")
$tempCompose = Join-Path ([System.IO.Path]::GetTempPath()) ("$project.compose.yml")
$apiImage = "${project}-api:local"
$webImage = "${project}-web:local"
$testOutput = Join-Path ([System.IO.Path]::GetTempPath()) ("$project-results")
if ($EvidenceDirectory) {
    $testOutput = [System.IO.Path]::GetFullPath($EvidenceDirectory)
    New-Item -ItemType Directory -Path $testOutput -Force | Out-Null
}
if ($BrowserReviewGate) {
    $BrowserReviewGate = [System.IO.Path]::GetFullPath($BrowserReviewGate)
    if (Test-Path -LiteralPath $BrowserReviewGate) {
        throw "Browser review gate already exists; choose a fresh run-specific file."
    }
}

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
# Freeze image names per run: another developer's build must not replace the
# API between provisioning and startup (or replace the web under test).
$override = @("services:")
foreach ($service in @("api", "migrate", "provision", "worker")) {
    $override += @("  ${service}:", "    image: $apiImage")
}
$override += @("  web:", "    image: $webImage")
[System.IO.File]::WriteAllLines($tempCompose, $override, [System.Text.UTF8Encoding]::new($false))
$composeFiles = @("-f", (Join-Path $root "docker-compose.yml"), "-f", $tempCompose)

function Invoke-Compose([string[]]$Arguments) {
    & docker compose @composeFiles --project-name $project --env-file $tempEnv @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed with exit code $LASTEXITCODE" }
}

try {
    Push-Location $root
    if ($SkipBuild) {
        # Copy tags once, before provisioning; subsequent shared-tag changes are
        # irrelevant to this run. No configured application container is changed.
        & docker image tag orderfit-api:local $apiImage
        if ($LASTEXITCODE -ne 0) { throw "No prebuilt API image is available." }
        & docker image tag orderfit-web:local $webImage
        if ($LASTEXITCODE -ne 0) { throw "No prebuilt web image is available." }
    } else { Invoke-Compose @("build", "api", "web") }
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

    # This manifest deliberately excludes environment values, login URLs and
    # browser credentials. It identifies the running images rather than tags alone.
    $imageEvidence = [ordered]@{}
    foreach ($service in @("api", "worker", "web", "db")) {
        $containerId = & docker compose @composeFiles --project-name $project --env-file $tempEnv ps -q $service
        $imageEvidence[$service] = & docker inspect --format '{{.Image}}' $containerId
    }
    $manifest = [ordered]@{
        project = $project
        base_url = "http://localhost:$webPort"
        head = (& git -C $root rev-parse HEAD)
        images = $imageEvidence
        llm_mode = "off"
        evidence_directory = $testOutput
    }

    $env:E2E_BASE_URL = "http://localhost:$webPort"
    Push-Location (Join-Path $root "web")
    try {
        Write-Output "Isolated browser evidence: $testOutput"
        $acceptanceTestArgs = @("--workers=1", "--output=$testOutput")
        if ($TestPattern) { $acceptanceTestArgs += @("--grep", $TestPattern) }
        & npm run test:e2e -- @acceptanceTestArgs
        if ($LASTEXITCODE -ne 0) { throw "Playwright E2E failed. Evidence: $testOutput" }
    }
    finally {
        Pop-Location
        # Playwright clears its output directory at startup; write identity after
        # it exits, including a failed run, so the evidence cannot lose its target.
        $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $testOutput "environment.json") -Encoding utf8
    }
    if ($BrowserReviewGate) {
        $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $BrowserReviewGate -Encoding utf8
        Write-Output "Disposable browser review ready: http://localhost:$webPort"
        Write-Output "Remove the run-specific review gate to finish and clean up: $BrowserReviewGate"
        while (Test-Path -LiteralPath $BrowserReviewGate) { Start-Sleep -Seconds 2 }
    }
} catch {
    # Curated application events only: never dump container environment, raw
    # request headers, database statements, cookies or provider diagnostics.
    & docker compose @composeFiles --project-name $project --env-file $tempEnv logs --no-color --tail 100 api 2>&1 |
        Select-String -Pattern 'request_failed .*method=.*route=.*status=5[0-9][0-9].*code=.*error_type='
    $acceptanceApiId = & docker compose @composeFiles --project-name $project --env-file $tempEnv ps -q api
    if ($acceptanceApiId) {
        & docker inspect --format 'Acceptance API OOM={{.State.OOMKilled}} restarts={{.RestartCount}}' $acceptanceApiId
    }
    throw
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    & docker compose @composeFiles --project-name $project --env-file $tempEnv down -v
    foreach ($testImage in @($apiImage, $webImage)) {
        & docker image inspect $testImage *> $null
        if ($LASTEXITCODE -eq 0) { & docker image rm $testImage }
    }
    if (Test-Path -LiteralPath $tempEnv) { Clear-Content -LiteralPath $tempEnv; Remove-Item -LiteralPath $tempEnv -Force }
    if (Test-Path -LiteralPath $tempCompose) { Remove-Item -LiteralPath $tempCompose -Force }
}
