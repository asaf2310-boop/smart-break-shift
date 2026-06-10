# GitHub upload API helpers (dot-sourced by upload-to-github.ps1)

function Initialize-GitHubUploadScript {
    $script:AuthScheme = "Bearer"
    $script:SuccessfulBlobCount = 0
    $script:WriteProbePassed = $false
    $script:BlobUploadDelayMs = 350
    $script:ApiRetryMaxAttempts = 8
    $script:PostProbeDelaySec = 3
    $script:UploadProgressFileName = ".upload-to-github-progress.json"
    $script:LastErrorHeaders = @{}
}

function Get-GitHubRequestHeaders {
    return @{
        Authorization          = "$script:AuthScheme $Token"
        Accept                 = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
}

function Format-GitHubApiLabel {
    param([string]$Method, [string]$Url, [string]$Operation = "")
    $path = $Url -replace '^https://api\.github\.com', ''
    if ($Operation) { return "$Method $path ($Operation)" }
    return "$Method $path"
}

function Invoke-GitHubApi {
    param([string]$Method, [string]$Url, $Body = $null, [string]$Operation = "")
    $label = Format-GitHubApiLabel -Method $Method -Url $Url -Operation $Operation
    $requestHeaders = Get-GitHubRequestHeaders
    $params = @{
        Method          = $Method
        Uri             = $Url
        Headers         = $requestHeaders
        UseBasicParsing = $true
    }
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $params.PreserveAuthorizationOnRedirect = $true
    }
    if ($null -ne $Body) {
        $params.Body = $Body | ConvertTo-Json -Depth 20 -Compress
        $params.ContentType = "application/json; charset=utf-8"
    }
    try {
        $response = Invoke-WebRequest @params
        $data = $null
        if ($response.Content) { $data = $response.Content | ConvertFrom-Json }
        $outHeaders = @{}
        foreach ($key in $response.Headers.Keys) { $outHeaders[$key] = $response.Headers[$key] }
        return @{ Data = $data; Headers = $outHeaders; StatusCode = [int]$response.StatusCode; Label = $label }
    } catch {
        $details = Get-GitHubErrorDetails $_
        $details.Label = $label
        $err = [System.Exception]::new("GitHub API $label -> $($details.StatusCode): $($details.Message)")
        $err.Data["GitHubDetails"] = $details
        throw $err
    }
}

function Get-GitHubHeaderValue {
    param($Headers, [string]$Name)
    if (-not $Headers) { return $null }
    foreach ($key in $Headers.Keys) {
        if ($key -ieq $Name) {
            $val = $Headers[$key]
            if ($val -is [System.Array]) { return $val[0] }
            return $val
        }
    }
    return $null
}

function Get-GitHubRateLimitWaitSeconds {
    param($Headers, [int]$Attempt)
    $retryAfter = Get-GitHubHeaderValue -Headers $Headers -Name "Retry-After"
    if ($retryAfter -match '^\d+$') {
        $secs = [int]$retryAfter
        if ($secs -gt 0) { return [Math]::Min($secs, 3600) }
    }
    $remaining = Get-GitHubHeaderValue -Headers $Headers -Name "X-RateLimit-Remaining"
    $reset = Get-GitHubHeaderValue -Headers $Headers -Name "X-RateLimit-Reset"
    if ($remaining -eq "0" -and $reset -match '^\d+$') {
        $wait = [int]$reset - [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 1
        if ($wait -gt 0) { return [Math]::Min($wait, 3600) }
    }
    return [Math]::Min(60, [Math]::Pow(2, $Attempt - 1))
}

function Test-GitHubTransientError {
    param([int]$StatusCode, [string]$Message, [int]$PriorSuccessCount = 0)
    if ($StatusCode -in 429, 503) { return $true }
    if ($Message -match 'secondary rate limit|rate limit|abuse detection|too many requests') { return $true }
    if ($StatusCode -in 401, 403) { return $true }
    return $false
}

function Test-GitHubConnectionTransientError {
    param([string]$Message, $Exception = $null)
    if ($Message -match '(?i)connection was closed|underlying connection|keep.?alive|Unable to connect|timed out|timeout|SSL/TLS|forcibly closed|unexpected error occurred on a send|remote name could not be resolved|No such host|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout|A connection attempt failed|An existing connection was forcibly closed|receive the response|send the request') {
        return $true
    }
    $ex = $Exception
    while ($null -ne $ex) {
        if ($ex -is [System.Net.WebException]) {
            if ($ex.Status -in @(
                [System.Net.WebExceptionStatus]::ConnectFailure,
                [System.Net.WebExceptionStatus]::ConnectionClosed,
                [System.Net.WebExceptionStatus]::KeepAliveFailure,
                [System.Net.WebExceptionStatus]::NameResolutionFailure,
                [System.Net.WebExceptionStatus]::ReceiveFailure,
                [System.Net.WebExceptionStatus]::SendFailure,
                [System.Net.WebExceptionStatus]::Timeout,
                [System.Net.WebExceptionStatus]::PipelineFailure,
                [System.Net.WebExceptionStatus]::SecureChannelFailure,
                [System.Net.WebExceptionStatus]::ProxyNameResolutionFailure
            )) { return $true }
        }
        $ex = $ex.InnerException
    }
    return $false
}

function Get-GitHubConnectionWaitSeconds {
    param([int]$Attempt)
    return [Math]::Min(120, [Math]::Pow(2, $Attempt))
}

function Get-GitHubErrorCategory {
    param([int]$StatusCode, [string]$Message, [int]$PriorSuccessCount = 0)
    if ($StatusCode -in 502, 504) { return "Connection" }
    if ($StatusCode -eq 0 -and (Test-GitHubConnectionTransientError -Message $Message)) { return "Connection" }
    if ($StatusCode -eq 429) { return "RateLimit" }
    if ($Message -match 'secondary rate limit|rate limit|abuse detection|too many requests') { return "RateLimit" }
    if ($StatusCode -in 401, 403 -and ($PriorSuccessCount -gt 0 -or $script:WriteProbePassed)) { return "RateLimit" }
    if ($StatusCode -in 401, 403) { return "Auth" }
    if ($StatusCode -eq 413 -or $Message -match 'too large|payload') { return "FileSize" }
    return "Unknown"
}

function Show-GitHubRateLimitHelp {
    param([int]$StatusCode = 403, [string]$ApiMessage = "", [string]$FailedCall = "", [int]$BlobsUploaded = 0, [string]$FilePath = "", [long]$FileBytes = 0)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " GitHub API error: $StatusCode (likely rate limit, not bad token)" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    if ($FailedCall) { Write-Host "Failed API call: $FailedCall" -ForegroundColor Yellow; Write-Host "" }
    if ($ApiMessage) {
        Write-Host "GitHub says: $ApiMessage" -ForegroundColor Yellow
        Write-Host "(Often misleading when earlier uploads in the same run succeeded.)" -ForegroundColor DarkYellow
        Write-Host ""
    }
    if ($BlobsUploaded -gt 0) {
        Write-Host "$BlobsUploaded blob(s) uploaded successfully before this failure." -ForegroundColor Yellow
        Write-Host "Progress is saved locally; re-run to resume skipped files." -ForegroundColor Yellow
        Write-Host ""
    }
    if ($FilePath) { Write-Host "File at failure: $FilePath ($FileBytes bytes)" -ForegroundColor Gray; Write-Host "" }
    Write-Host "What to do: wait 1-2 minutes and run again. Avoid two uploads at once." -ForegroundColor Yellow
    Write-Host ""
}

function Show-GitHubConnectionHelp {
    param([string]$FailedCall = "", [int]$BlobsUploaded = 0, [string]$FilePath = "", [long]$FileBytes = 0)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " Network / connection error (not auth)" -ForegroundColor Red
    Write-Host " שגיאת רשת / חיבור (לא בעיית הרשאות)" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    if ($FailedCall) { Write-Host "Failed API call: $FailedCall" -ForegroundColor Yellow; Write-Host "" }
    if ($FilePath) { Write-Host "File at failure: $FilePath ($FileBytes bytes)" -ForegroundColor Gray; Write-Host "" }
    if ($BlobsUploaded -gt 0) {
        Write-Host "$BlobsUploaded blob(s) uploaded in this run before disconnect." -ForegroundColor Yellow
        Write-Host "Progress saved locally — re-run to resume (skipped files won't re-upload)." -ForegroundColor Yellow
        Write-Host "ההתקדמות נשמרה — הרץ שוב את הסקריפט להמשך." -ForegroundColor Yellow
        Write-Host ""
    }
    Write-Host "Wait 30-60s, check Wi-Fi/VPN, run the same script again." -ForegroundColor Yellow
    Write-Host "המתן 30-60 שניות, בדוק אינטרנט/VPN, והרץ שוב." -ForegroundColor Yellow
    Write-Host "Do not start a second upload in another window." -ForegroundColor Gray
    Write-Host ""
}

function Get-GitHubErrorDetails {
    param($ErrorRecord)
    $status = 0
    $body = $null
    $headers = @{}
    $response = $ErrorRecord.Exception.Response
    if ($response) {
        $status = [int]$response.StatusCode
        try {
            $stream = $response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $raw = $reader.ReadToEnd()
                if ($raw) { $body = $raw | ConvertFrom-Json }
            }
        } catch { }
        foreach ($key in $response.Headers.AllKeys) { $headers[$key] = $response.Headers[$key] }
    }
    return @{
        StatusCode = $status
        Message    = if ($body.message) { [string]$body.message } else { $ErrorRecord.Exception.Message }
        Body       = $body
        Headers    = $headers
    }
}

function Show-GitHubAuthHelp {
    param(
        [ValidateSet("Identity", "RepoRead", "Upload", "Simple")]
        [string]$Context = "Simple",
        [int]$StatusCode = 401,
        [string]$ApiMessage = "",
        [string]$RequiredPermissions = "",
        [string]$FailedCall = ""
    )
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    if ($Context -eq "Simple") {
        Write-Host " GitHub API error: $StatusCode" -ForegroundColor Red
    } else {
        Write-Host " GitHub API error: $StatusCode ($Context)" -ForegroundColor Red
    }
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    if ($FailedCall) { Write-Host "Failed API call: $FailedCall" -ForegroundColor Yellow; Write-Host "" }
    if ($ApiMessage) { Write-Host "GitHub says: $ApiMessage" -ForegroundColor Yellow; Write-Host "" }
    Write-Host "Create token: https://github.com/settings/tokens — classic [repo] or fine-grained Contents R/W." -ForegroundColor Yellow
    Write-Host "Repo: https://github.com/$Owner/$Repo" -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-GitHubApiWithRetry {
    param([string]$Method, [string]$Url, $Body = $null, [string]$Operation = "", [int]$PriorSuccessCount = 0)
    $lastDetails = $null
    for ($attempt = 1; $attempt -le $script:ApiRetryMaxAttempts; $attempt++) {
        try {
            return Invoke-GitHubApi -Method $Method -Url $Url -Body $Body -Operation $Operation
        } catch {
            $details = $_.Exception.Data["GitHubDetails"]
            if (-not $details) {
                $details = Get-GitHubErrorDetails $_
                $details.Label = Format-GitHubApiLabel -Method $Method -Url $Url -Operation $Operation
            }
            $lastDetails = $details
            $script:LastErrorHeaders = $details.Headers
            $isRateTransient = Test-GitHubTransientError -StatusCode $details.StatusCode -Message $details.Message -PriorSuccessCount $PriorSuccessCount
            $isConnectionTransient = Test-GitHubConnectionTransientError -Message $details.Message -Exception $_.Exception
            if ($details.StatusCode -in 502, 504) { $isConnectionTransient = $true }
            if (-not ($isRateTransient -or $isConnectionTransient) -or $attempt -ge $script:ApiRetryMaxAttempts) {
                $err = [System.Exception]::new("GitHub API $($details.Label) -> $($details.StatusCode): $($details.Message)")
                $err.Data["GitHubDetails"] = $details
                if ($isConnectionTransient) { $err.Data["GitHubConnectionTransient"] = $true }
                throw $err
            }
            $label = if ($details.Label) { $details.Label } else { $Operation }
            if ($isConnectionTransient -and -not $isRateTransient) {
                $waitSec = Get-GitHubConnectionWaitSeconds -Attempt $attempt
                Write-Host "  Connection retry $attempt/$($script:ApiRetryMaxAttempts): $label - waiting ${waitSec}s..." -ForegroundColor DarkYellow
                Write-Host "  (connection error — retrying / שגיאת חיבור — מנסה שוב)" -ForegroundColor DarkGray
            } else {
                $waitSec = Get-GitHubRateLimitWaitSeconds -Headers $details.Headers -Attempt $attempt
                Write-Host "  Retry $attempt/$($script:ApiRetryMaxAttempts): $($details.StatusCode) on $label - waiting ${waitSec}s..." -ForegroundColor DarkYellow
            }
            Start-Sleep -Seconds $waitSec
        }
    }
    throw [System.Exception]::new("GitHub API retry exhausted for $Operation")
}

function Invoke-GitHubJson {
    [CmdletBinding()]
    param(
        [Parameter(Position = 0, Mandatory = $true)][string]$Method,
        [Parameter(Position = 1, Mandatory = $true)][string]$Url,
        [Parameter(Position = 2)]$Body = $null,
        [string]$Operation = "",
        [switch]$NoAuthHelpOnFailure,
        [int]$PriorSuccessCount = 0,
        [string]$FailedFilePath = "",
        [long]$FailedFileBytes = 0
    )
    if (-not $Operation -and $Url -match '/git/blobs$' -and $Body.content) { $Operation = "Create blob" }
    try {
        $result = Invoke-GitHubApiWithRetry -Method $Method -Url $Url -Body $Body -Operation $Operation -PriorSuccessCount $PriorSuccessCount
        return $result.Data
    } catch {
        $details = $_.Exception.Data["GitHubDetails"]
        if (-not $details) { $details = Get-GitHubErrorDetails $_ }
        $script:LastErrorHeaders = $details.Headers
        $failedCall = if ($details.Label) { $details.Label } else { Format-GitHubApiLabel -Method $Method -Url $Url -Operation $Operation }
        $category = Get-GitHubErrorCategory -StatusCode $details.StatusCode -Message $details.Message -PriorSuccessCount $PriorSuccessCount
        $connectionFailed = ($category -eq "Connection") -or ($_.Exception.Data["GitHubConnectionTransient"] -eq $true) -or (Test-GitHubConnectionTransientError -Message $details.Message -Exception $_.Exception)
        if ($connectionFailed) {
            Show-GitHubConnectionHelp -FailedCall $failedCall -BlobsUploaded $PriorSuccessCount -FilePath $FailedFilePath -FileBytes $FailedFileBytes
            exit 1
        }
        if ($category -eq "RateLimit") {
            Show-GitHubRateLimitHelp -StatusCode $details.StatusCode -ApiMessage $details.Message -FailedCall $failedCall -BlobsUploaded $PriorSuccessCount -FilePath $FailedFilePath -FileBytes $FailedFileBytes
            exit 1
        }
        if ($category -eq "FileSize" -and $FailedFilePath) {
            Write-Host "GitHub rejected blob: $FailedFilePath ($FailedFileBytes bytes)" -ForegroundColor Red
            exit 1
        }
        if (-not $NoAuthHelpOnFailure -and $category -eq "Auth") {
            Show-GitHubAuthHelp -Context Upload -StatusCode $details.StatusCode -ApiMessage $details.Message -FailedCall $failedCall
            exit 1
        }
        Write-Host "GitHub API error on: $failedCall" -ForegroundColor Red
        if ($FailedFilePath) { Write-Host "  File: $FailedFilePath ($FailedFileBytes bytes)" -ForegroundColor Yellow }
        if ($details.Message) { Write-Host "  $($details.Message)" -ForegroundColor Yellow }
        throw
    }
}

function Get-UploadProgressFilePath { Join-Path $Root $script:UploadProgressFileName }

function Get-UploadProgressBlobMap {
    $filePath = Get-UploadProgressFilePath
    if (-not (Test-Path -LiteralPath $filePath)) { return @{} }
    try {
        $state = (Get-Content -LiteralPath $filePath -Raw -Encoding UTF8) | ConvertFrom-Json
        if ($state.owner -ne $Owner -or $state.repo -ne $Repo -or $state.branch -ne $Branch) {
            Write-Host "Progress file is for another repo/branch — ignoring cache." -ForegroundColor Yellow
            return @{}
        }
        $map = @{}
        if ($state.blobs) {
            foreach ($prop in $state.blobs.PSObject.Properties) {
                $map[$prop.Name] = @{ sha = [string]$prop.Value.sha; size = [long]$prop.Value.size; lastWriteUtc = [string]$prop.Value.lastWriteUtc }
            }
        }
        return $map
    } catch {
        Write-Host "Could not read progress file — starting without cache." -ForegroundColor Yellow
        return @{}
    }
}

function Save-UploadProgressBlobMap {
    param([hashtable]$BlobMap)
    $payload = @{ owner = $Owner; repo = $Repo; branch = $Branch; updatedAt = (Get-Date).ToUniversalTime().ToString("o"); blobs = $BlobMap }
    $payload | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Get-UploadProgressFilePath) -Encoding UTF8
}

function Clear-UploadProgressFile {
    $filePath = Get-UploadProgressFilePath
    if (Test-Path -LiteralPath $filePath) { Remove-Item -LiteralPath $filePath -Force }
}

function Test-CanReuseUploadProgressBlob {
    param([System.IO.FileInfo]$FileInfo, [hashtable]$Entry)
    if (-not $Entry -or -not $Entry.sha) { return $false }
    if ([long]$Entry.size -ne $FileInfo.Length) { return $false }
    if ([string]$Entry.lastWriteUtc -ne $FileInfo.LastWriteTimeUtc.ToString("o")) { return $false }
    return $true
}

function Test-GitHubToken {
    try {
        $userResult = Invoke-GitHubJson -Method Get -Url "https://api.github.com/user" -Operation "Verify token identity" -NoAuthHelpOnFailure
        Write-Host "GitHub login OK: $($userResult.login)" -ForegroundColor Green
    } catch {
        $details = Get-GitHubErrorDetails $_
        Show-GitHubAuthHelp -Context Identity -StatusCode $(if ($details.StatusCode) { $details.StatusCode } else { 401 }) -ApiMessage $details.Message
        exit 1
    }
    try {
        $repoResponse = Invoke-GitHubApiWithRetry -Method Get -Url "https://api.github.com/repos/$Owner/$Repo" -Operation "Verify repository access"
        Write-Host "Repository access OK: $Owner/$Repo" -ForegroundColor Green
        $repoScopes = Get-GitHubHeaderValue -Headers $repoResponse.Headers -Name "X-OAuth-Scopes"
        if ($repoScopes) {
            $scopeList = @($repoScopes -split ',\s*' | Where-Object { $_ })
            if ($scopeList.Count -gt 0 -and $scopeList -notcontains "repo" -and $scopeList -notcontains "public_repo") {
                Show-GitHubAuthHelp -Context Upload -StatusCode 403 -ApiMessage "Token scopes: $($scopeList -join ', '). Missing repo or public_repo." -FailedCall "Classic PAT scope check"
                exit 1
            }
        }
    } catch {
        $details = Get-GitHubErrorDetails $_
        if ($details.StatusCode -eq 404) {
            Write-Host "Token works but repo $Owner/$Repo not found or no access." -ForegroundColor Red
            exit 1
        }
        Show-GitHubAuthHelp -Context RepoRead -StatusCode $(if ($details.StatusCode) { $details.StatusCode } else { 403 }) -ApiMessage $details.Message
        exit 1
    }
    try {
        $probeBytes = [Text.Encoding]::UTF8.GetBytes("upload-probe")
        Invoke-GitHubJson -Method Post -Url "https://api.github.com/repos/$Owner/$Repo/git/blobs" -Body @{
            content = [Convert]::ToBase64String($probeBytes); encoding = "base64"
        } -Operation "Write probe (same endpoint as file upload)" | Out-Null
    } catch { exit 1 }
    Write-Host "Write access OK (verified via POST /git/blobs probe)" -ForegroundColor Green
    $script:WriteProbePassed = $true
    $script:SuccessfulBlobCount = 1
    if ($script:PostProbeDelaySec -gt 0) {
        Write-Host "Pausing $($script:PostProbeDelaySec)s before bulk upload (GitHub rate limits)..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $script:PostProbeDelaySec
    }
    Write-Host ""
}
