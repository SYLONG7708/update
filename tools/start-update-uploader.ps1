param(
  [int]$Port = 7708,
  [string]$UpdateRepoPath = "",
  [string]$AssistantRepoPath = "C:\Users\Administrator\shen-yue-iphone-assistant-live-work",
  [string]$CloudflaredPath = "C:\Users\Administrator\ReplayCenter\tools\cloudflared.exe",
  [string]$AppsScriptEndpoint = "https://script.google.com/macros/s/AKfycbwrUCUeksZrWOUSDrdKgUGTS1JIPRX3c18PIKgZu_j64jBZGXjI7rnHTFjmIqUljZFzeg/exec",
  [string]$UploadKey = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

if (-not $UpdateRepoPath) {
  $UpdateRepoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
} else {
  $UpdateRepoPath = (Resolve-Path -LiteralPath $UpdateRepoPath).Path
}

$logDir = Join-Path $UpdateRepoPath "output\uploader"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$serverOut = Join-Path $logDir "server.out.log"
$serverErr = Join-Path $logDir "server.err.log"
$tunnelOut = Join-Path $logDir "cloudflared.out.log"
$tunnelErr = Join-Path $logDir "cloudflared.err.log"
$keyFile = Join-Path $logDir "upload-key.txt"
$serverPidFile = Join-Path $logDir "server.pid"
$serverWrapperPidFile = Join-Path $logDir "server-wrapper.pid"
$tunnelPidFile = Join-Path $logDir "cloudflared.pid"
$latestTextFile = Join-Path $logDir "latest-upload-url.txt"
$latestJsonFile = Join-Path $logDir "latest-upload-url.json"
$latestResultFile = Join-Path $logDir "latest-run-result.json"

function New-UploadKey {
  $bytes = New-Object byte[] 12
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

function Read-ExistingUploadKey {
  if (Test-Path -LiteralPath $keyFile) {
    $value = (Get-Content -LiteralPath $keyFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($value) { return $value }
  }
  if (Test-Path -LiteralPath $serverOut) {
    $text = Get-Content -LiteralPath $serverOut -Raw -ErrorAction SilentlyContinue
    $tokenMatch = [regex]::Match($text, "Token:\s*([a-fA-F0-9]{24,128})")
    if ($tokenMatch.Success) { return $tokenMatch.Groups[1].Value.ToLowerInvariant() }
    $urlMatch = [regex]::Match($text, "[?&]key=([a-fA-F0-9]{24,128})")
    if ($urlMatch.Success) { return $urlMatch.Groups[1].Value.ToLowerInvariant() }
  }
  return ""
}

if ($UploadKey) {
  $UploadKey = $UploadKey.Trim()
} else {
  $UploadKey = Read-ExistingUploadKey
}
if (-not $UploadKey) {
  $UploadKey = New-UploadKey
}
[System.IO.File]::WriteAllText($keyFile, "$UploadKey`r`n", [System.Text.Encoding]::ASCII)

$node = (Get-Command node -ErrorAction Stop).Source
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$serverScript = Join-Path $PSScriptRoot "update-uploader-server.mjs"

if (-not (Test-Path -LiteralPath $serverScript)) {
  throw "Cannot find uploader server: $serverScript"
}
if (-not (Test-Path -LiteralPath $UpdateRepoPath)) {
  throw "Cannot find update repo: $UpdateRepoPath"
}
if (-not (Test-Path -LiteralPath $AssistantRepoPath)) {
  throw "Cannot find assistant repo: $AssistantRepoPath"
}
if (-not (Test-Path -LiteralPath $CloudflaredPath)) {
  throw "Cannot find cloudflared.exe: $CloudflaredPath"
}

function Quote-PSString([string]$Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

function Read-PidFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  try {
    $value = (Get-Content -LiteralPath $Path -Raw -ErrorAction Stop).Trim()
    if (-not $value) { return 0 }
    return [int]$value
  } catch {
    return 0
  }
}

function Write-PidFile([string]$Path, [int]$ProcessId) {
  if ($ProcessId -gt 0) {
    [System.IO.File]::WriteAllText($Path, "$ProcessId`r`n", [System.Text.Encoding]::ASCII)
  }
}

function Get-LiveProcess([int]$ProcessId) {
  if ($ProcessId -le 0) { return $null }
  try {
    return Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return $null
  }
}

function Stop-ExpectedProcess([int]$ProcessId, [string[]]$ExpectedNames, [string]$ExpectedPath = "") {
  $process = Get-LiveProcess $ProcessId
  if (-not $process) { return }

  $nameOk = $ExpectedNames -contains $process.ProcessName
  $pathOk = $true
  if ($ExpectedPath) {
    try {
      $pathOk = ($process.Path -ieq $ExpectedPath)
    } catch {
      $pathOk = $false
    }
  }

  if ($nameOk -and $pathOk) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
}

function Get-PortOwningProcessId {
  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Where-Object { $_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::1" -or $_.LocalAddress -eq "::" } |
      Select-Object -First 1
    if ($connection) { return [int]$connection.OwningProcess }
  } catch {
  }
  return 0
}

function Get-UploaderStatus([string]$BaseUrl) {
  try {
    $escapedKey = [uri]::EscapeDataString($UploadKey)
    return Invoke-RestMethod -Uri "$BaseUrl/api/status?key=$escapedKey" -TimeoutSec 3
  } catch {
    return $null
  }
}

function Wait-LocalStatus([string]$BaseUrl, [System.Diagnostics.Process]$StartedProcess) {
  $deadline = (Get-Date).AddSeconds(25)
  do {
    Start-Sleep -Milliseconds 500
    $status = Get-UploaderStatus $BaseUrl
    if ($status -and $status.ok) { return $status }
    if ($StartedProcess -and $StartedProcess.HasExited) {
      throw "Uploader server exited. Check $serverErr"
    }
  } while ((Get-Date) -lt $deadline)

  throw "Uploader server startup timed out. Check $serverOut and $serverErr"
}

function Read-TunnelUrlFromLogs {
  $text = ""
  if (Test-Path -LiteralPath $tunnelOut) {
    $text += Get-Content -LiteralPath $tunnelOut -Raw -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $tunnelErr) {
    $text += Get-Content -LiteralPath $tunnelErr -Raw -ErrorAction SilentlyContinue
  }
  $matches = [regex]::Matches($text, "https://[-a-z0-9]+\.trycloudflare\.com")
  if ($matches.Count -gt 0) {
    return $matches[$matches.Count - 1].Value
  }
  return ""
}

function Test-PublicStatus([string]$PublicUrl) {
  if (-not $PublicUrl) { return $false }
  try {
    $escapedKey = [uri]::EscapeDataString($UploadKey)
    $status = Invoke-RestMethod -Uri "$PublicUrl/api/status?key=$escapedKey" -TimeoutSec 8
    return [bool]$status.ok
  } catch {
    return $false
  }
}

function Get-CloudflaredProcessId {
  $tracked = Read-PidFile $tunnelPidFile
  $process = Get-LiveProcess $tracked
  if ($process) {
    try {
      if ($process.ProcessName -eq "cloudflared" -and $process.Path -ieq $CloudflaredPath) {
        return $tracked
      }
    } catch {
    }
  }

  $matches = @(Get-Process cloudflared -ErrorAction SilentlyContinue | Where-Object {
    try { $_.Path -ieq $CloudflaredPath } catch { $false }
  })
  if ($matches.Count -eq 1) {
    return [int]$matches[0].Id
  }
  return 0
}

function Write-LaunchFiles([string]$PublicUrl, [int]$ServerProcessId, [int]$CloudflaredProcessId) {
  $localBase = "http://127.0.0.1:$Port"
  $directPublicPage = "$PublicUrl/update-uploader/index.html?api=$([uri]::EscapeDataString($PublicUrl))&key=$UploadKey"
  $githubPagesPage = "https://sylong7708.github.io/shen-yue-iphone-assistant/update-uploader/index.html?api=$([uri]::EscapeDataString($PublicUrl))&key=$UploadKey"
  $localPage = "$localBase/update-uploader/index.html?api=$([uri]::EscapeDataString($localBase))&key=$UploadKey"
  $generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

  $text = @"
Shen Yue Update Uploader
GeneratedAt: $generatedAt
PublicUploadUrl: $directPublicPage
GitHubPagesUploadUrl: $githubPagesPage
LocalUploadUrl: $localPage
UploadKey: $UploadKey

Keep this URL private. Anyone with the full URL can upload replacement APK files.
"@

  [System.IO.File]::WriteAllText($latestTextFile, $text, [System.Text.Encoding]::UTF8)

  $result = [ordered]@{
    ok = $true
    generatedAt = $generatedAt
    port = $Port
    updateRepoPath = $UpdateRepoPath
    assistantRepoPath = $AssistantRepoPath
    publicBaseUrl = $PublicUrl
    publicUploadUrl = $directPublicPage
    githubPagesUploadUrl = $githubPagesPage
    localUploadUrl = $localPage
    uploadKeyFile = $keyFile
    serverPid = $ServerProcessId
    cloudflaredPid = $CloudflaredProcessId
    serverLog = $serverOut
    tunnelLog = $tunnelErr
  }

  $desktop = [Environment]::GetFolderPath("Desktop")
  if ($desktop -and (Test-Path -LiteralPath $desktop)) {
    $shortcutPath = Join-Path $desktop "ShenYue Update Uploader.url"
    $desktopTextPath = Join-Path $desktop "ShenYue Update Uploader URL.txt"
    [System.IO.File]::WriteAllText($shortcutPath, "[InternetShortcut]`r`nURL=$directPublicPage`r`n", [System.Text.Encoding]::ASCII)
    [System.IO.File]::WriteAllText($desktopTextPath, $text, [System.Text.Encoding]::UTF8)
    $result.desktopShortcut = $shortcutPath
    $result.desktopUrlFile = $desktopTextPath
  }

  $json = $result | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($latestJsonFile, "$json`r`n", [System.Text.Encoding]::UTF8)
  [System.IO.File]::WriteAllText($latestResultFile, "$json`r`n", [System.Text.Encoding]::UTF8)

  return [pscustomobject]$result
}

$localBase = "http://127.0.0.1:$Port"
$status = Get-UploaderStatus $localBase
$serverPid = Get-PortOwningProcessId

if ($status -and $status.ok) {
  Write-PidFile $serverPidFile $serverPid
} else {
  if ($serverPid -gt 0) {
    Stop-ExpectedProcess $serverPid @("node")
    $remainingPid = Get-PortOwningProcessId
    if ($remainingPid -gt 0) {
      throw "Port $Port is already in use by process $remainingPid."
    }
  }

  "" | Set-Content -LiteralPath $serverOut -Encoding ASCII
  "" | Set-Content -LiteralPath $serverErr -Encoding ASCII

  $serverCommand = @(
    "`$env:PORT=$(Quote-PSString ([string]$Port))",
    "`$env:SHENYUE_UPLOAD_KEY=$(Quote-PSString $UploadKey)",
    "`$env:UPDATE_REPO_PATH=$(Quote-PSString $UpdateRepoPath)",
    "`$env:ASSISTANT_REPO_PATH=$(Quote-PSString $AssistantRepoPath)",
    "`$env:APPS_SCRIPT_ENDPOINT=$(Quote-PSString $AppsScriptEndpoint)",
    "& $(Quote-PSString $node) $(Quote-PSString $serverScript)"
  ) -join "; "

  $serverProcess = Start-Process -FilePath $powershell `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $serverCommand) `
    -WorkingDirectory $UpdateRepoPath `
    -WindowStyle Hidden `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -PassThru

  Write-PidFile $serverWrapperPidFile $serverProcess.Id
  $status = Wait-LocalStatus $localBase $serverProcess
  $serverPid = Get-PortOwningProcessId
  Write-PidFile $serverPidFile $serverPid
}

$publicUrl = Read-TunnelUrlFromLogs
$tunnelPid = Get-CloudflaredProcessId
$tunnelReusable = $false
if ($tunnelPid -gt 0 -and $publicUrl) {
  $tunnelReusable = Test-PublicStatus $publicUrl
}

if (-not $tunnelReusable) {
  if ($tunnelPid -gt 0) {
    Stop-ExpectedProcess $tunnelPid @("cloudflared") $CloudflaredPath
  }

  "" | Set-Content -LiteralPath $tunnelOut -Encoding ASCII
  "" | Set-Content -LiteralPath $tunnelErr -Encoding ASCII

  $cloudflaredArgs = @("tunnel", "--url", $localBase, "--no-autoupdate")
  $tunnelProcess = Start-Process -FilePath $CloudflaredPath `
    -ArgumentList $cloudflaredArgs `
    -WorkingDirectory $UpdateRepoPath `
    -WindowStyle Hidden `
    -RedirectStandardOutput $tunnelOut `
    -RedirectStandardError $tunnelErr `
    -PassThru

  $tunnelPid = [int]$tunnelProcess.Id
  Write-PidFile $tunnelPidFile $tunnelPid

  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Seconds 1
    $publicUrl = Read-TunnelUrlFromLogs
    if ($publicUrl -and (Test-PublicStatus $publicUrl)) { break }
    if ($tunnelProcess.HasExited) {
      throw "cloudflared exited. Check $tunnelErr"
    }
  } while ((Get-Date) -lt $deadline)

  if (-not $publicUrl) {
    throw "cloudflared did not return a public URL. Check $tunnelOut and $tunnelErr"
  }
}

if (-not (Test-PublicStatus $publicUrl)) {
  throw "Public uploader URL is not reachable: $publicUrl"
}

Write-PidFile $tunnelPidFile $tunnelPid
Write-Output (Write-LaunchFiles $publicUrl $serverPid $tunnelPid)
