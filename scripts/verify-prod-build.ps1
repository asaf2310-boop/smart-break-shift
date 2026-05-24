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
