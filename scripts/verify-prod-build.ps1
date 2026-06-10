<<<<<<< HEAD
# Production build: no demo data strings; must include HYP blue shell (app-hyp-demo).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$demoPatterns = @(
    "smart-break-shift-demo-store-v1",
    "agent01@demo.local",
    "allincenter-login-hero"
)

$requiredJsPatterns = @(
    "app-brand-background",
    "app-hyp-demo",
    "hyp-nav-bar",
    "hyp-page"
)

$requiredCssPatterns = @(
    "app-brand-background",
    "app-hyp-demo",
    "hyp-nav-bar"
)

$forbiddenJsPatterns = @(
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
    foreach ($pat in $forbiddenJsPatterns) {
        if ($text -match [regex]::Escape($pat)) {
            Write-Host "FAIL (legacy brand login): '$pat' in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
    foreach ($pat in $requiredJsPatterns) {
        if ($text -notmatch [regex]::Escape($pat)) {
            Write-Host "FAIL (missing HYP shell): '$pat' not in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
}

foreach ($file in $cssFiles) {
    $text = Get-Content $file.FullName -Raw -Encoding utf8
    foreach ($pat in $requiredCssPatterns) {
        if ($text -notmatch [regex]::Escape($pat)) {
            Write-Host "FAIL (missing HYP CSS): '$pat' not in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
}

if ($failed) {
    Write-Host ""
    Write-Host "Production build verification failed. Fix gating or rebuild before deploy." -ForegroundColor Red
    exit 1
}

Write-Host "OK: HYP shell present; no demo markers in dist JS." -ForegroundColor Green
exit 0
=======
# בודק ש-build פרודקשן (בלי VITE_DEMO_MODE) לא מכיל מחרוזות דמו ב-dist
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$patterns = @(
    "דמו פעיל",
    "סביבת דמו פעילה",
    "smart-break-shift-demo-store-v1",
    "נציג 01",
    "agent01@demo.local"
)

Write-Host "Production build check (VITE_DEMO_MODE unset)..." -ForegroundColor Cyan

Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue
# Build must not see VITE_DEMO_MODE=true (unset = production bundle)

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install..."
    npm install
}

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$assetFiles = Get-ChildItem -Path "dist/assets" -Filter "*.js" -ErrorAction SilentlyContinue
if (-not $assetFiles) {
    Write-Host "No dist/assets/*.js found." -ForegroundColor Red
    exit 1
}

$failed = $false
foreach ($file in $assetFiles) {
    $text = Get-Content $file.FullName -Raw -Encoding utf8
    foreach ($pat in $patterns) {
        if ($text -match [regex]::Escape($pat)) {
            Write-Host "FAIL: '$pat' in $($file.Name)" -ForegroundColor Red
            $failed = $true
        }
    }
}

if ($failed) {
    Write-Host ""
    Write-Host "Demo strings found in production build. Fix demo gating or env before deploy." -ForegroundColor Red
    exit 1
}

Write-Host "OK: no demo markers in dist JS bundles." -ForegroundColor Green
exit 0
>>>>>>> 842dd9e (Initial commit)
