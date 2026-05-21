# תצוגה מקדימה — מצב דמו בלבד (localStorage). ללייב: preview-live.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$michalckNode = Join-Path (Split-Path $root -Parent) "michalck\.tools\node"

if (-not (Test-Path (Join-Path $michalckNode "npm.cmd"))) {
    Write-Host "Missing michalck\.tools\node - run preview in michalck once, or install Node.js"
    exit 1
}

$env:PATH = "$michalckNode;$env:PATH"
Set-Location $root

if (-not (Test-Path ".env.local")) {
    "VITE_DEMO_MODE=true" | Set-Content ".env.local" -Encoding utf8
}

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install (first time)..."
    npm install
}

Write-Host ""
Write-Host "מצב: דמו (לא לייב)"
Write-Host "לייב מול Supabase: preview-live.ps1"
Write-Host "Open: http://localhost:5173"
Write-Host "Stop: Ctrl+C"
Write-Host ""
npm run dev
