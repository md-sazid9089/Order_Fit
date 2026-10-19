param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$evidence = Join-Path $root 'docs/ui_ux_audit_2026-10-19/evidence/quality-gate'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$results = @()
function Invoke-Gate([string]$Name, [string]$Command, [scriptblock]$Work) {
  $started = [DateTime]::UtcNow
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Work 2>&1 | ForEach-Object { "$_" } | Set-Content -LiteralPath (Join-Path $evidence "$Name.txt") -Encoding utf8; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $previous }
  $script:results += [ordered]@{ command=$Command; exit_code=$code; started_utc=$started.ToString('o'); finished_utc=[DateTime]::UtcNow.ToString('o') }
  $script:results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidence 'commands.json') -Encoding utf8
  Write-Output "$Name exit=$code"
  if ($code -ne 0) { throw "$Command failed; see quality-gate/$Name.txt" }
}
Push-Location $root
try {
  Invoke-Gate 'install' 'npm --prefix web ci' { npm --prefix web ci }
  Invoke-Gate 'typecheck' 'npm --prefix web run typecheck' { npm --prefix web run typecheck }
  Invoke-Gate 'lint' 'npm --prefix web run lint' { npm --prefix web run lint }
  Invoke-Gate 'unit' 'npm --prefix web test' { npm --prefix web test }
  Invoke-Gate 'build' 'npm --prefix web run build' { npm --prefix web run build }
  Invoke-Gate 'docker' 'docker build -t orderfit-ui-release:20261019 -f web/Dockerfile web' { docker build -t orderfit-ui-release:20261019 -f web/Dockerfile web }
  Push-Location (Join-Path $root 'backend')
  try { Invoke-Gate 'contracts' 'cd backend; uv run --frozen python -m orderfit.contracts.export --check' { uv run --frozen python -m orderfit.contracts.export --check } } finally { Pop-Location }
  Invoke-Gate 'reference' 'python docs/architecture/orderfit/fixtures/reference_engine.py --check' { python docs/architecture/orderfit/fixtures/reference_engine.py --check }
} finally { Pop-Location }
