param(
  [switch]$Resume,
  [string]$SessionId = '',
  [string]$TokenPath = '',
  [string]$CliPath = '',
  [string]$EvidencePath = ''
)
$ErrorActionPreference = 'Stop'
$taskRoot = 'E:/project/deepseek_h/dsh-hallmark-app'
$taskEvidence = if ($EvidencePath) { $EvidencePath } elseif ($env:LISTING_ACCEPTANCE_EVIDENCE) { $env:LISTING_ACCEPTANCE_EVIDENCE } else { 'E:/project/deepseek_h/output/listing-acceptance-20261013' }
$taskData = Join-Path $taskEvidence 'runtime'
if (-not (Get-NetTCPConnection -State Listen -LocalPort 4297 -ErrorAction SilentlyContinue)) {
  $actualTokenPath = if ($TokenPath) { $TokenPath } elseif ($env:HALLMARK_OPERATOR_TOKEN_FILE) { $env:HALLMARK_OPERATOR_TOKEN_FILE } else { 'E:/bill学习专区/trademind_cli/data/human-token.json' }
  $taskOperator = if ($env:HALLMARK_OPERATOR_TOKEN) { $env:HALLMARK_OPERATOR_TOKEN } elseif (Test-Path $actualTokenPath) { (Get-Content -LiteralPath $actualTokenPath -Raw | ConvertFrom-Json).token } else { $null }
  $taskRouter = [Environment]::GetEnvironmentVariable('openrouter','User')
  if (-not $taskRouter) { $taskRouter = [Environment]::GetEnvironmentVariable('openrouter','Machine') }
  if (-not $taskRouter) { $taskRouter = $env:openrouter }
  if (-not $taskOperator -or -not $taskRouter) { throw 'Existing business credentials unavailable' }
  $taskEnvironment = @{APPS_DATA_DIR=$taskData; APPS_CONNECTIONS_FILE=(Join-Path $taskData 'connections.json'); APPS_PORT='4297'; HALLMARK_OPERATOR_TOKEN=$taskOperator; openrouter=$taskRouter}
  $nodeExe = (Get-Command node -ErrorAction SilentlyContinue)?.Source
  if (-not $nodeExe) { $nodeExe = 'C:/Program Files/nodejs/node.exe' }
  $taskRuntime = Start-Process -FilePath $nodeExe -ArgumentList @('packages/service/src/apps-main.ts') -WorkingDirectory $taskRoot -Environment $taskEnvironment -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskEvidence 'runtime.stdout.log') -RedirectStandardError (Join-Path $taskEvidence 'runtime.stderr.log') -PassThru
  $taskRuntime.Id | Set-Content (Join-Path $taskEvidence 'runtime.pid')
  $taskEnvironment.Clear(); $taskOperator=$null; $taskRouter=$null
  $taskDeadline=[DateTime]::UtcNow.AddSeconds(20)
  do { Start-Sleep -Milliseconds 300; $taskListener=Get-NetTCPConnection -State Listen -LocalPort 4297 -ErrorAction SilentlyContinue } while (-not $taskListener -and [DateTime]::UtcNow -lt $taskDeadline -and -not $taskRuntime.HasExited)
  if (-not $taskListener -or $taskListener.OwningProcess -ne $taskRuntime.Id) { throw 'Acceptance Runtime failed to start' }
}
$env:LISTING_ACCEPTANCE_DATA=$taskData
$env:LISTING_ACCEPTANCE_EVIDENCE=$taskEvidence
$env:LISTING_ACCEPTANCE_AUTHORIZE_BILL='yes'
$env:DSH_PERMISSION_MODE='danger-full-access'
$taskCli = if ($CliPath) { $CliPath } elseif ($env:DSH_CLI_PATH) { $env:DSH_CLI_PATH } else { 'C:/Users/wubil/AppData/Local/Programs/DeepSeek Harness/resources/runtime/cli/bin/dsh.cmd' }
Set-Location (Join-Path $taskEvidence 'work')
if ($Resume) {
  if (-not $SessionId) { throw 'Resume requires the original SessionId' }
  $resumePrompt = '继续原上品任务，重新读取更新后的 ozon-listing skill，复用已完成的资料和图片。'
  if (Test-Path -LiteralPath (Join-Path $taskEvidence 'work/notes/structure-review-handoff.json')) {
    $resumePrompt += '先读取 notes/structure-review-handoff.json 和其中的逐图审核报告，按用户新增结构审核标准处理；未通过的图片不得用于提交。'
  }
  & $taskCli --profile listing-acceptance-20261013 --json --session-id $SessionId $resumePrompt 1>> (Join-Path $taskEvidence 'events.jsonl') 2>> (Join-Path $taskEvidence 'diagnostics.log')
} else {
  Get-Content -LiteralPath (Join-Path $taskEvidence 'prompt.txt') -Raw | & $taskCli --profile listing-acceptance-20261013 --json - 1> (Join-Path $taskEvidence 'events.jsonl') 2> (Join-Path $taskEvidence 'diagnostics.log')
}
$LASTEXITCODE | Set-Content (Join-Path $taskEvidence 'headless.exit')
exit $LASTEXITCODE
