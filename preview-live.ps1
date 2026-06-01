# Local live preview (no demo, no admin PIN). For demo use preview-shell.ps1
# Run: powershell -ExecutionPolicy Bypass -File .\preview-live.ps1
#      powershell -ExecutionPolicy Bypass -File .\preview-live.ps1 -AllowMissingSupabase
param(
    [switch]$AllowMissingSupabase
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$michalckNode = Join-Path (Split-Path $root -Parent) "michalck\.tools\node"

if (-not (Test-Path (Join-Path $michalckNode "npm.cmd"))) {
    Write-Host "Missing michalck\.tools\node - run preview in michalck once, or install Node.js"
    exit 1
}

$env:PATH = "$michalckNode;$env:PATH"
Set-Location $root

function Remove-EnvLocalKey {
    param(
        [string[]]$Lines,
        [string]$Key
    )
    $pattern = "^\s*$([regex]::Escape($Key))\s*="
    return ,@($Lines | Where-Object { $_ -notmatch $pattern })
}

function Test-SupabaseInEnvText {
    param([string]$Text)
    $hasUrl = $Text -match "VITE_SUPABASE_URL\s*=\s*https?://"
    $hasKey = $Text -match "VITE_SUPABASE_ANON_KEY\s*=\s*\S+"
    return ($hasUrl -and $hasKey)
}

$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) {
    if (-not $AllowMissingSupabase) {
        Write-Host ""
        Write-Host "Missing .env.local with Supabase connection."
        Write-Host "1. Vercel -> smart-break-shift -> Settings -> Environment Variables"
        Write-Host "2. Copy VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
        Write-Host "3. Create .env.local (see .env.live.example)"
        Write-Host ""
        Write-Host "Or re-run with -AllowMissingSupabase to test /admin UI without Supabase."
        Write-Host ""
        exit 1
    }
    Write-Host ""
    Write-Host "WARNING: .env.local not found. Starting without Supabase (UI-only test)."
    Write-Host "Add Supabase vars from .env.live.example for real data."
    Write-Host ""
    $raw = ""
    $hadDemo = $false
    $hadPin = $false
} else {
    $raw = Get-Content $envFile -Raw -Encoding utf8
    if ($null -eq $raw) { $raw = "" }
    $hadDemo = $raw -match "VITE_DEMO_MODE\s*="
    $hadPin = $raw -match "VITE_ADMIN_PIN\s*="

    $hasSupabase = Test-SupabaseInEnvText $raw
    if (-not $hasSupabase) {
        if (-not $AllowMissingSupabase) {
            Write-Host ""
            Write-Host "Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY in .env.local"
            Write-Host "Copy from Vercel (see .env.live.example)"
            Write-Host ""
            Write-Host "Or re-run with -AllowMissingSupabase to test /admin UI without Supabase."
            Write-Host ""
            exit 1
        }
        Write-Host ""
        Write-Host "WARNING: Supabase vars missing in .env.local. Starting anyway (UI-only test)."
        Write-Host ""
    }

    $envLines = @(Get-Content $envFile -Encoding utf8)
    $envLines = Remove-EnvLocalKey $envLines "VITE_DEMO_MODE"
    $envLines = Remove-EnvLocalKey $envLines "VITE_ADMIN_PIN"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($envFile, $envLines, $utf8NoBom)
}

Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue
Remove-Item Env:VITE_ADMIN_PIN -ErrorAction SilentlyContinue

Write-Host ""
if ($hadDemo -or $hadPin) {
    if ($hadDemo) { Write-Host "Removed VITE_DEMO_MODE from .env.local (live mode)." }
    if ($hadPin) { Write-Host "Removed VITE_ADMIN_PIN from .env.local - /admin has no PIN." }
} else {
    Write-Host ".env.local: no VITE_DEMO_MODE, no VITE_ADMIN_PIN (live mode)."
}
Write-Host "If dev server is already running, stop it (Ctrl+C) and run this script again."
Write-Host "For demo mode again: preview-shell.ps1"
Write-Host ""

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install (first time)..."
    npm install
}

Write-Host ""
Write-Host "Mode: live (no demo, no admin PIN)"
Write-Host "Open:  http://localhost:5173"
Write-Host "Admin: http://localhost:5173/admin  (no access code)"
Write-Host "Stop:  Ctrl+C"
Write-Host ""
Write-Host "If you used preview-shell before, stop the server (Ctrl+C) and run preview-live.ps1 again."
Write-Host "Vite loads .env only at startup."
Write-Host ""
Write-Host "Expected: tab title = live Hebrew title (not demo). /admin = no PIN gate."
Write-Host ""
npm run dev
