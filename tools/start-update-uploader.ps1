param(
  [int]$Port = 7708,
  [string]$UpdateRepoPath = "",
  [string]$AssistantRepoPath = "C:\Users\Administrator\shen-yue-iphone-assistant-live-work",
  [string]$CloudflaredPath = "C:\Users\Administrator\ReplayCenter\tools\cloudflared.exe",
  [string]$AppsScriptEndpoint = "https://script.google.com/macros/s/AKfycbwrUCUeksZrWOUSDrdKgUGTS1JIPRX3c18PIKgZu_j64jBZGXjI7rnHTFjmIqUljZFzeg/exec",
  [string]$UploadKey = ""
)

$ErrorActionPreference = "Stop"

if (-not $UpdateRepoPath) {
  $UpdateRepoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}

if (-not $UploadKey) {
  $bytes = New-Object byte[] 12
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  $UploadKey = ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

$node = (Get-Command node -ErrorAction Stop).Source
$serverScript = Join-Path $PSScriptRoot "update-uploader-server.mjs"
if (-not (Test-Path -LiteralPath $serverScript)) {
  throw "找不到 uploader server: $serverScript"
}
if (-not (Test-Path -LiteralPath $UpdateRepoPath)) {
  throw "找不到 update repo: $UpdateRepoPath"
}
if (-not (Test-Path -LiteralPath $AssistantRepoPath)) {
  throw "找不到 shen-yue-iphone-assistant repo: $AssistantRepoPath"
}
if (-not (Test-Path -LiteralPath $CloudflaredPath)) {
  throw "找不到 cloudflared.exe: $CloudflaredPath"
}

$logDir = Join-Path $UpdateRepoPath "output\uploader"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$serverOut = Join-Path $logDir "server.out.log"
$serverErr = Join-Path $logDir "server.err.log"
$tunnelOut = Join-Path $logDir "cloudflared.out.log"
$tunnelErr = Join-Path $logDir "cloudflared.err.log"

function Quote-PSString([string]$Value) {
  return "'" + ($Value -replace "'", "''") + "'"
}

$serverCommand = @(
  "`$env:PORT=$(Quote-PSString ([string]$Port))",
  "`$env:SHENYUE_UPLOAD_KEY=$(Quote-PSString $UploadKey)",
  "`$env:UPDATE_REPO_PATH=$(Quote-PSString $UpdateRepoPath)",
  "`$env:ASSISTANT_REPO_PATH=$(Quote-PSString $AssistantRepoPath)",
  "`$env:APPS_SCRIPT_ENDPOINT=$(Quote-PSString $AppsScriptEndpoint)",
  "& $(Quote-PSString $node) $(Quote-PSString $serverScript)"
) -join "; "

$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$server = Start-Process -FilePath $powershell `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $serverCommand) `
  -WorkingDirectory $UpdateRepoPath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $serverOut `
  -RedirectStandardError $serverErr `
  -PassThru

$localBase = "http://127.0.0.1:$Port"
$deadline = (Get-Date).AddSeconds(20)
do {
  Start-Sleep -Milliseconds 500
  try {
    $status = Invoke-RestMethod -Uri "$localBase/api/status?key=$UploadKey" -TimeoutSec 2
    if ($status.ok) { break }
  } catch {
    if ($server.HasExited) {
      throw "uploader server 已結束，請查看 $serverErr"
    }
  }
} while ((Get-Date) -lt $deadline)

if (-not $status.ok) {
  throw "uploader server 啟動逾時，請查看 $serverOut / $serverErr"
}

$cloudflaredArgs = @("tunnel", "--url", $localBase, "--no-autoupdate")
$tunnel = Start-Process -FilePath $CloudflaredPath `
  -ArgumentList $cloudflaredArgs `
  -WorkingDirectory $UpdateRepoPath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $tunnelOut `
  -RedirectStandardError $tunnelErr `
  -PassThru

$publicUrl = ""
$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 1
  $text = ""
  if (Test-Path -LiteralPath $tunnelOut) { $text += Get-Content -LiteralPath $tunnelOut -Raw -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $tunnelErr) { $text += Get-Content -LiteralPath $tunnelErr -Raw -ErrorAction SilentlyContinue }
  $match = [regex]::Match($text, "https://[-a-z0-9]+\.trycloudflare\.com")
  if ($match.Success) {
    $publicUrl = $match.Value
    break
  }
  if ($tunnel.HasExited) {
    throw "cloudflared 已結束，請查看 $tunnelErr"
  }
} while ((Get-Date) -lt $deadline)

if (-not $publicUrl) {
  throw "cloudflared 公開網址取得逾時，請查看 $tunnelOut / $tunnelErr"
}

$directPublicPage = "$publicUrl/update-uploader/index.html?api=$([uri]::EscapeDataString($publicUrl))&key=$UploadKey"
$githubPagesPage = "https://sylong7708.github.io/shen-yue-iphone-assistant/update-uploader/index.html?api=$([uri]::EscapeDataString($publicUrl))&key=$UploadKey"
$localPage = "$localBase/update-uploader/index.html?api=$([uri]::EscapeDataString($localBase))&key=$UploadKey"

[pscustomobject]@{
  ServerPid = $server.Id
  CloudflaredPid = $tunnel.Id
  PublicUploadUrl = $directPublicPage
  GitHubPagesUploadUrl = $githubPagesPage
  LocalUploadUrl = $localPage
  ServerLog = $serverOut
  TunnelLog = $tunnelErr
}
