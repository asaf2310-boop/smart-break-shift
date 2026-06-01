# Production build: no demo data strings; must include AllInCenter brand shell (login hero + ambient).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$demoPatterns = @(
    "דמו פעיל",
    "סביבת דמו פעילה",
    "smart-break-shift-demo-store-v1",
    "נציג 01",
    "agent01@demo.local"
)

$requiredJsPatterns = @(
    "allincenter-login-hero",
    "app-brand-background",
    "login-shell--brand"
)

$requiredCssPatterns = @(
    "app-brand-background",
    "login-shell--brand"
)

Write-Host "Production build check (VITE_DEMO_MODE unset)..." -ForegroundColor Cyan

Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install..."
    npm install
}

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$jsFiles = Get-ChildItem -Path "dist/assets" -Filter "*.js" -ErrorAction SilentlyContinue
$cssFiles = Get-ChildItem -Path "dist/assets" -Filter "*.css" -ErrorAction SilentlyContinue
if (-not $jsFiles) {
    Write-Host "No dist/assets/*.js found." -ForegroundColor Red
    exit 1
}

$failed = $false

foreach ($file in $jsFiles) {
    $text = Get-Content $file.FullName -Raw -Encoding utf8
    foreach ($pat in $demoPatterns) {
        if ($text -match [regex]::Escape($pat)) {
            Write-Host "FAIL (demo leak): '$pat' in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
    foreach ($pat in $requiredJsPatterns) {
        if ($text -notmatch [regex]::Escape($pat)) {
            Write-Host "FAIL (missing brand): '$pat' not in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
}

foreach ($file in $cssFiles) {
    $text = Get-Content $file.FullName -Raw -Encoding utf8
    foreach ($pat in $requiredCssPatterns) {
        if ($text -notmatch [regex]::Escape($pat)) {
            Write-Host "FAIL (missing brand CSS): '$pat' not in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
}

if ($failed) {
    Write-Host ""
    Write-Host "Production build verification failed. Fix gating or rebuild before deploy." -ForegroundColor Red
    exit 1
}

Write-Host "OK: brand shell present; no demo markers in dist JS." -ForegroundColor Green
exit 0
