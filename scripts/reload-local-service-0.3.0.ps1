$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$nodeExecutable = 'C:\Users\wubil\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$dataDirectory = 'C:\Users\wubil\AppData\Local\dsh-hallmark-app'
$serviceProcessId = 71060
if (@(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Quit DSH normally before replacing its service.' }
$existing = Get-CimInstance Win32_Process -Filter "ProcessId = $serviceProcessId"
if ($null -eq $existing -or $existing.ExecutablePath -ine $nodeExecutable -or $existing.CommandLine -notmatch 'packages[/\\]service[/\\]src[/\\]main\.ts') { throw 'Service identity changed; refusing reload.' }
$listeners = @(Get-NetTCPConnection -LocalPort 4180 -State Listen)
if ($listeners.Count -ne 1 -or $listeners[0].OwningProcess -ne $serviceProcessId) { throw 'Port owner changed.' }
Set-Location -LiteralPath $projectDirectory
& $nodeExecutable scripts/migrate-live-views.mjs export artifacts/pre-source-views-final.json
if ($LASTEXITCODE -ne 0) { throw 'Could not back up idle live views.' }
& $nodeExecutable scripts/backup.mjs --output artifacts/pre-install-0.3.0-final-app-backup.json
if ($LASTEXITCODE -ne 0) { throw 'Could not back up app data.' }
# Old detached Windows Node has no control channel; stop the identified idle service only.
Stop-Process -Id $serviceProcessId
Wait-Process -Id $serviceProcessId -Timeout 10 -ErrorAction SilentlyContinue
& $nodeExecutable scripts/migrate-live-views.mjs import artifacts/pre-source-views-final.json
if ($LASTEXITCODE -ne 0) { throw 'Draft migration failed; preserve backup before proceeding.' }
& $nodeExecutable scripts/provision-source-template.mjs
if ($LASTEXITCODE -ne 0) { throw 'Source template installation failed.' }
$savedValues = @{}
foreach ($key in @('HALLMARK_CONTROL_URL','HALLMARK_APP_PORT','HALLMARK_APP_DATA_DIR')) { $savedValues[$key] = [Environment]::GetEnvironmentVariable($key,'Process') }
try {
 $env:HALLMARK_CONTROL_URL = 'http://127.0.0.1:4280'
 $env:HALLMARK_APP_PORT = '4180'
 $env:HALLMARK_APP_DATA_DIR = $dataDirectory
 $started = Start-Process -FilePath $nodeExecutable -ArgumentList @('packages/service/src/main.ts') -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectDirectory 'artifacts/live-service-0.3.0.stdout.log') -RedirectStandardError (Join-Path $projectDirectory 'artifacts/live-service-0.3.0.stderr.log')
 @{previousPid=$serviceProcessId;startedPid=$started.Id;sourceUrl=$env:HALLMARK_CONTROL_URL;servicePort=4180;at=[datetime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectDirectory 'artifacts/live-service-reload-0.3.0.json') -Encoding utf8
 Write-Output "Started upgraded Hallmark service PID $($started.Id)."
} finally { foreach ($key in $savedValues.Keys) { [Environment]::SetEnvironmentVariable($key,$savedValues[$key],'Process') } }
