param(
  [string]$TaskName = "ShenYueUpdateUploaderAutoStart"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$startScript = Join-Path $PSScriptRoot "start-update-uploader.ps1"
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $startScript)) {
  throw "Cannot find start script: $startScript"
}

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $repoPath
$trigger = New-ScheduledTaskTrigger -AtLogOn
try {
  $trigger.Delay = "PT30S"
} catch {
}

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Start the Shen Yue public update uploader after Windows logon." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 5

$task = Get-ScheduledTask -TaskName $TaskName
$info = Get-ScheduledTaskInfo -TaskName $TaskName

[pscustomobject]@{
  TaskName = $task.TaskName
  State = $task.State
  LastRunTime = $info.LastRunTime
  LastTaskResult = $info.LastTaskResult
  StartScript = $startScript
}
