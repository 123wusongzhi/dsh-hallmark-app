# One-shot reload of the verified, idle Hallmark app service. Does not restart DSH or Hallmark Board.
$ErrorActionPreference = 'Stop'
$serviceProcessId = 46248
$projectDirectory = 'E:\project\deepseek_h\dsh-hallmark-app'
$nodeExecutable = 'C:\Users\wubil\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$entryPath = Join-Path $projectDirectory 'packages\service\src\main.ts'
$dataDirectory = 'C:\Users\wubil\AppData\Local\dsh-hallmark-app'
$existing = Get-CimInstance Win32_Process -Filter "ProcessId = $serviceProcessId"
if ($null -eq $existing -or $existing.ExecutablePath -ine $nodeExecutable -or $existing.CommandLine -notmatch 'packages[/\\]service[/\\]src[/\\]main\.ts') {
  throw 'Service process identity changed; refusing reload.'
}
$listener = @(Get-NetTCPConnection -LocalPort 4180 -State Listen)
if ($listener.Count -ne 1 -or $listener[0].OwningProcess -ne $serviceProcessId) { throw 'Port ownership changed; refusing reload.' }
if (!(Test-Path -LiteralPath (Join-Path $projectDirectory 'artifacts\pre-ui-0.2.1-app-backup.json'))) { throw 'Pre-reload backup missing.' }
& $nodeExecutable --input-type=module -e 'import {DatabaseSync} from "node:sqlite"; const db=new DatabaseSync("C:/Users/wubil/AppData/Local/dsh-hallmark-app/app.db",{readOnly:true}); try { if(db.prepare("SELECT COUNT(*) AS n FROM operations WHERE state IN (?,?)").get("pending","running").n) process.exitCode=1; } finally {db.close();}'
if ($LASTEXITCODE -ne 0) { throw 'In-flight operations exist; refusing reload.' }

# The old detached Windows process has no control channel. Stop only the exact idle process,
# retaining the SQLite WAL, service key, component configuration and all other applications.
Stop-Process -Id $serviceProcessId
Wait-Process -Id $serviceProcessId -Timeout 10 -ErrorAction SilentlyContinue
$savedValues = @{}
foreach ($key in @('HALLMARK_CONTROL_URL','HALLMARK_APP_PORT','HALLMARK_APP_DATA_DIR')) {
  $savedValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
  $env:HALLMARK_CONTROL_URL = 'http://127.0.0.1:4280'
  $env:HALLMARK_APP_PORT = '4180'
  $env:HALLMARK_APP_DATA_DIR = $dataDirectory
  $started = Start-Process -FilePath $nodeExecutable -ArgumentList @($entryPath) -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectDirectory 'artifacts\live-service-0.2.1.stdout.log') -RedirectStandardError (Join-Path $projectDirectory 'artifacts\live-service-0.2.1.stderr.log')
  @{previousPid=$serviceProcessId;startedPid=$started.Id;sourceUrl=$env:HALLMARK_CONTROL_URL;servicePort=4180;at=[datetime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectDirectory 'artifacts\live-service-reload-0.2.1.json') -Encoding utf8
  Write-Output "Started Hallmark app service PID $($started.Id); health verification is required."
} finally {
  foreach ($key in $savedValues.Keys) { [Environment]::SetEnvironmentVariable($key, $savedValues[$key], 'Process') }
}
