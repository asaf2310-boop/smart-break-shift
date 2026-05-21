# תצוגה מקדימה מקומית מול Supabase אמיתי (לא דמו)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$michalckNode = Join-Path (Split-Path $root -Parent) "michalck\.tools\node"

if (-not (Test-Path (Join-Path $michalckNode "npm.cmd"))) {
    Write-Host "חסר michalck\.tools\node — התקן Node או הרץ פעם אחת preview ב-michalck"
    exit 1
}

$env:PATH = "$michalckNode;$env:PATH"
Set-Location $root

$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host ""
    Write-Host "חסר .env.local עם חיבור ל-Supabase."
    Write-Host "1. Vercel -> smart-break-shift -> Settings -> Environment Variables"
    Write-Host "2. העתק VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY"
    Write-Host "3. צור .env.local (ראה .env.live.example)"
    Write-Host ""
    exit 1
}

$raw = Get-Content $envFile -Raw
if ($raw -match "VITE_DEMO_MODE\s*=\s*true") {
    Write-Host ""
    Write-Host "אזהרה: .env.local מכיל VITE_DEMO_MODE=true — מריץ בלי דמו (לייב)."
    Write-Host "להסרה קבועה: מחק או הערה את השורה ב-.env.local"
    Write-Host ""
}

if ($raw -notmatch "VITE_SUPABASE_URL\s*=\s*https?://") {
    Write-Host ""
    Write-Host "חסר VITE_SUPABASE_URL ב-.env.local"
    Write-Host "העתק מ-Vercel את Supabase URL + Anon Key (ראה .env.live.example)"
    Write-Host ""
    exit 1
}

if ($raw -notmatch "VITE_SUPABASE_ANON_KEY\s*=\s*\S+") {
    Write-Host "חסר VITE_SUPABASE_ANON_KEY ב-.env.local"
    exit 1
}

# עוקף דמו לסשן הזה גם אם נשאר בקובץ
Remove-Item Env:VITE_DEMO_MODE -ErrorAction SilentlyContinue
$env:VITE_DEMO_MODE = "false"

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install (פעם ראשונה)..."
    npm install
}

Write-Host ""
Write-Host "מצב: לייב (Supabase) — לא דמו"
Write-Host "פתח: http://localhost:5173"
Write-Host "משמרות -> שיבוץ = שבוע הבא שפורסם במנהל"
Write-Host "עצירה: Ctrl+C"
Write-Host ""
npm run dev
