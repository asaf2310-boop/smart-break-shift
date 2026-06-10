# Demo preview (localStorage). For live Supabase use preview-live.ps1
# Run: powershell -ExecutionPolicy Bypass -File .\preview-shell.ps1  (if scripts are blocked)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$michalckNode = Join-Path (Split-Path $root -Parent) "michalck\.tools\node"

if (-not (Test-Path (Join-Path $michalckNode "npm.cmd"))) {
    Write-Host "Missing michalck\.tools\node - run preview in michalck once, or install Node.js"
    exit 1
}

$env:PATH = "$michalckNode;$env:PATH"
Set-Location $root

function Set-EnvLocalValue {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$Value
    )
    $pattern = "^\s*$([regex]::Escape($Key))\s*="
    $found = $false
    $out = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $Lines) {
        if ($line -match $pattern) {
            $out.Add("$Key=$Value")
            $found = $true
        } else {
            $out.Add($line)
        }
    }
    if (-not $found) {
        if ($out.Count -gt 0 -and $out[$out.Count - 1] -ne "") { $out.Add("") }
        $out.Add("$Key=$Value")
    }
    return ,$out.ToArray()
}

$envLines = @()
if (Test-Path ".env.local") {
    $envLines = @(Get-Content ".env.local" -Encoding utf8)
}
$envLines = Set-EnvLocalValue $envLines "VITE_DEMO_MODE" "true"
$envLines = Set-EnvLocalValue $envLines "VITE_ADMIN_PIN" "1234"
$envLocalPath = Join-Path $root ".env.local"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($envLocalPath, $envLines, $utf8NoBom)

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install (first time)..."
    npm install
}

Write-Host ""
Write-Host "Mode: demo (not live)"
Write-Host "Live Supabase: preview-live.ps1"
Write-Host "Agent:  http://localhost:5173"
Write-Host "Admin:  http://localhost:5173/admin  PIN: 1234"
Write-Host "Stop:   Ctrl+C"
Write-Host ""
Write-Host "If you changed .env.local earlier, restart this script so Vite reloads env."
Write-Host ""
npm run dev

