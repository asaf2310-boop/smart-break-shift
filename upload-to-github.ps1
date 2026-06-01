# Upload local tree to GitHub (replaces branch contents).
# Usage:
#   .\upload-to-github.ps1                          # interactive menu
#   .\upload-to-github.ps1 -Target Demo           # upload with demo-oriented warnings
#   .\upload-to-github.ps1 -Target Production       # extra confirmation for prod path
#   .\upload-to-github.ps1 -Branch demo             # push to demo branch (see upload-demo-only.ps1)
param(
    [ValidateSet("Demo", "Production", "Ask")]
    [string]$Target = "Ask",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$Owner = "asaf2310-boop"
$Repo = "smart-break-shift"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-VercelWarning {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " WARNING: GitHub push triggers ALL" -ForegroundColor Red
    Write-Host " Vercel projects linked to this repo." -ForegroundColor Red
    Write-Host " Each project uses ITS OWN env at build." -ForegroundColor Yellow
    Write-Host " Production must NOT have VITE_DEMO_MODE=true" -ForegroundColor Red
    Write-Host " See: docs/DEMO_VS_PRODUCTION.md" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
}

function Confirm-UploadChoice {
    param([string]$EffectiveTarget, [string]$EffectiveBranch)

    Show-VercelWarning

    Write-Host "Branch: $EffectiveBranch" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[1] Upload code only" -ForegroundColor Green
    Write-Host "    Both Vercel projects may rebuild from GitHub." -ForegroundColor Gray
    Write-Host "    Demo vs live is decided by each project's env (not this script)." -ForegroundColor Gray
    Write-Host "[2] Cancel" -ForegroundColor Gray
    Write-Host ""

    $choice = Read-Host "Choose 1 or 2"
    if ($choice -ne "1") {
        Write-Host "Cancelled." -ForegroundColor Gray
        exit 0
    }
}

function Confirm-ProductionUpload {
    Write-Host ""
    Write-Host "Production path: you are uploading to branch '$Branch'." -ForegroundColor Yellow
    Write-Host "If Production Vercel auto-deploys from this branch, a new live build will start." -ForegroundColor Yellow
    Write-Host "Recommended: disable auto-deploy on Production; deploy manually when ready." -ForegroundColor Yellow
    Write-Host ""
    $typed = Read-Host "Type PROD to confirm upload"
    if ($typed -ne "PROD") {
        Write-Host "Cancelled (expected PROD)." -ForegroundColor Gray
        exit 0
    }
}

Write-Host "This script replaces the GitHub repo contents with the local project tree." -ForegroundColor Cyan
Write-Host "Token is requested locally and is not written to disk." -ForegroundColor Yellow
Write-Host ""

if ($Target -eq "Ask") {
    Confirm-UploadChoice -EffectiveTarget "Ask" -EffectiveBranch $Branch
} else {
    Show-VercelWarning
    if ($Target -eq "Production") {
        Confirm-ProductionUpload
    } else {
        Write-Host "Demo-oriented upload to branch '$Branch'." -ForegroundColor Cyan
        if ($Branch -eq "main") {
            Write-Host "Tip: for experiments without touching main, use .\upload-demo-only.ps1 (branch demo)." -ForegroundColor Yellow
        }
        $go = Read-Host "Continue? (y/N)"
        if ($go -notmatch "^[yY]") {
            Write-Host "Cancelled." -ForegroundColor Gray
            exit 0
        }
    }
}

Write-Host ""

$TokenSecure = Read-Host "Paste a GitHub token with Contents: Read and write" -AsSecureString
$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($TokenSecure)
$Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPtr)

$Headers = @{
    Authorization = "Bearer $Token"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

function Convert-ToGitHubPath([string]$FullName) {
    $rootPath = (Resolve-Path $Root).Path.TrimEnd("\", "/")
    $filePath = (Resolve-Path $FullName).Path
    $relative = $filePath.Substring($rootPath.Length).TrimStart("\", "/")
    return ($relative -replace "\\", "/")
}

function Should-Skip([string]$Path) {
    $normalized = $Path -replace "\\", "/"
    if ($normalized -match "(^|/)\.git(/|$)") { return $true }
    if ($normalized -match "(^|/)node_modules(/|$)") { return $true }
    if ($normalized -match "(^|/)dist(/|$)") { return $true }
    if ($normalized -match "(^|/)dist-ssr(/|$)") { return $true }
    if ($normalized -match "(^|/)\.vite(/|$)") { return $true }
    if ($normalized -match "(^|/)\.env(\.|$)") { return $true }
    if ($normalized -match "(^|/)\.env$") { return $true }
    if ($normalized -match "(^|/)\.cursor(/|$)") { return $true }
    if ($normalized -match "(^|/)\.agents(/|$)") { return $true }
    if ($normalized -match "upload-to-github\.ps1$") { return $true }
    return $false
}

function Invoke-GitHubJson($Method, $Url, $Body = $null) {
    if ($null -eq $Body) {
        return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }
    $json = $Body | ConvertTo-Json -Depth 20
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body $json -ContentType "application/json"
}

function Get-ParentCommitSha {
    param([string]$BranchName)

    $refUrl = "https://api.github.com/repos/$Owner/$Repo/git/ref/heads/$BranchName"
    try {
        $ref = Invoke-GitHubJson "Get" $refUrl
        return @{ Sha = $ref.object.sha; BranchExists = $true }
    } catch {
        $status = $null
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        if ($BranchName -eq "main" -or $status -ne 404) {
            throw
        }
        Write-Host "Branch '$BranchName' not found - will create from current main." -ForegroundColor Yellow
        $mainRef = Invoke-GitHubJson "Get" "https://api.github.com/repos/$Owner/$Repo/git/ref/heads/main"
        return @{ Sha = $mainRef.object.sha; BranchExists = $false }
    }
}

function Set-BranchRef {
    param([string]$BranchName, [string]$CommitSha, [bool]$BranchExists)

    if ($BranchExists) {
        Invoke-GitHubJson "Patch" "https://api.github.com/repos/$Owner/$Repo/git/refs/heads/$BranchName" @{
            sha   = $CommitSha
            force = $true
        } | Out-Null
    } else {
        Invoke-GitHubJson "Post" "https://api.github.com/repos/$Owner/$Repo/git/refs" @{
            ref = "refs/heads/$BranchName"
            sha = $CommitSha
        } | Out-Null
    }
}

function Get-CommitTreeSha {
    param([string]$CommitSha)
    $info = Invoke-GitHubJson "Get" "https://api.github.com/repos/$Owner/$Repo/git/commits/$CommitSha"
    return $info.tree.sha
}

# Ref update + verify with retries. Handles concurrent uploads and brief API lag.
function Confirm-BranchRefUpdate {
    param(
        [string]$BranchName,
        [string]$CommitSha,
        [string]$TreeSha,
        [bool]$BranchExists
    )

    $refUrl = "https://api.github.com/repos/$Owner/$Repo/git/ref/heads/$BranchName"
    $exists = $BranchExists
    $maxSetAttempts = 3
    $verifyAttemptsPerSet = 5
    $delayMs = 500

    for ($setAttempt = 1; $setAttempt -le $maxSetAttempts; $setAttempt++) {
        Set-BranchRef -BranchName $BranchName -CommitSha $CommitSha -BranchExists $exists
        $exists = $true

        for ($v = 1; $v -le $verifyAttemptsPerSet; $v++) {
            Start-Sleep -Milliseconds $delayMs
            $updatedRef = Invoke-GitHubJson "Get" $refUrl
            if ($updatedRef.object.sha -eq $CommitSha) {
                return @{ Success = $true; HeadSha = $CommitSha; UsedFallback = $false }
            }
        }
    }

    $finalRef = Invoke-GitHubJson "Get" $refUrl
    $remoteHead = $finalRef.object.sha
    if ($remoteHead -eq $CommitSha) {
        return @{ Success = $true; HeadSha = $CommitSha; UsedFallback = $false }
    }

    try {
        $remoteTree = Get-CommitTreeSha -CommitSha $remoteHead
        if ($remoteTree -eq $TreeSha) {
            Write-Host ""
            Write-Host "Branch '$BranchName' head is $remoteHead (not $CommitSha)." -ForegroundColor Yellow
            Write-Host "Another upload likely finished at the same time; remote tree matches this run." -ForegroundColor Yellow
            return @{ Success = $true; HeadSha = $remoteHead; UsedFallback = $true }
        }
    } catch {
        # ignore; throw detailed error below
    }

    $recovery = @"
Branch update could not be confirmed on '$BranchName'.
  This run's commit: $CommitSha
  Remote HEAD:       $remoteHead

Common causes:
  - Two upload scripts ran at once (demo + main, or double-click).
  - GitHub Actions or another push updated the branch during upload.

Recovery (pick one):
  1. Open https://github.com/$Owner/$Repo/commits/$BranchName — if the latest commit time/message looks like your upload, you are done; Vercel may already be building.
  2. Wait 30s and run: .\upload-demo-only.ps1  (or .\upload-to-github.ps1 with your -Branch / -Target)
  3. Do not start a second upload until the first finishes.

If remote HEAD is wrong, run the upload script once more (single terminal).
"@

    throw $recovery
}

$files = Get-ChildItem -Path $Root -Recurse -File | Where-Object {
    -not (Should-Skip (Convert-ToGitHubPath $_.FullName))
}

Write-Host "Preparing $($files.Count) files from $Root ..." -ForegroundColor Cyan

$treeEntries = New-Object System.Collections.ArrayList
$i = 0
foreach ($file in $files) {
    $i++
    $path = Convert-ToGitHubPath $file.FullName
    Write-Host "[$i/$($files.Count)] $path" -ForegroundColor Gray

    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    $content = [Convert]::ToBase64String($bytes)
    $blob = Invoke-GitHubJson "Post" "https://api.github.com/repos/$Owner/$Repo/git/blobs" @{
        content  = $content
        encoding = "base64"
    }

    [void]$treeEntries.Add(@{
            path = $path
            mode = "100644"
            type = "blob"
            sha  = $blob.sha
        })
}

Write-Host "Reading branch '$Branch'..." -ForegroundColor Cyan
$parentInfo = Get-ParentCommitSha -BranchName $Branch
$parentSha = $parentInfo.Sha
$branchExists = $parentInfo.BranchExists

Write-Host "Creating clean tree..." -ForegroundColor Cyan
$tree = Invoke-GitHubJson "Post" "https://api.github.com/repos/$Owner/$Repo/git/trees" @{
    tree = @($treeEntries)
}

$commitMessage = "Upload project ($Branch) $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
if ($Target -ne "Ask") {
    $commitMessage = "Upload [$Target] to $Branch $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host "Creating commit..." -ForegroundColor Cyan
$commit = Invoke-GitHubJson "Post" "https://api.github.com/repos/$Owner/$Repo/git/commits" @{
    message = $commitMessage
    tree    = $tree.sha
    parents = @($parentSha)
}

Write-Host "Updating branch '$Branch'..." -ForegroundColor Cyan
$refResult = Confirm-BranchRefUpdate -BranchName $Branch -CommitSha $commit.sha -TreeSha $tree.sha -BranchExists $branchExists
$headSha = $refResult.HeadSha

Write-Host ""
Write-Host "Done. GitHub branch '$Branch' matches your local project tree." -ForegroundColor Green
Write-Host "Commit: https://github.com/$Owner/$Repo/commit/$headSha" -ForegroundColor Green
if ($Branch -eq "main") {
    Write-Host ""
    Write-Host "Vercel: check deploy logs for both Vercel projects. Production uses its own env." -ForegroundColor Cyan
}
Write-Host "Verify:" -ForegroundColor Cyan
Write-Host "https://github.com/$Owner/$Repo/blob/$Branch/src/main.jsx"
Write-Host "https://github.com/$Owner/$Repo/blob/$Branch/src/App.jsx"
