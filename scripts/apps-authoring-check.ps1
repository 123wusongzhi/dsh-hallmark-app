param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
$requestFile = (Resolve-Path -LiteralPath $RequestPath).Path
$request = Get-Content -LiteralPath $requestFile -Raw | ConvertFrom-Json
$logDirectory = $request.build.evidenceRoot
[System.IO.Directory]::CreateDirectory($logDirectory) | Out-Null
$logBase = Join-Path $logDirectory ("check-process-" + [guid]::NewGuid().ToString())
$entry = Join-Path $PSScriptRoot 'apps-authoring-check.js'
if (!(Test-Path -LiteralPath $entry)) { $entry = Join-Path $PSScriptRoot 'apps-authoring-check.mjs' }
# ArgumentList preserves spaces without constructing another shell command.
$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $request.build.command[0]
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.Environment['ELECTRON_RUN_AS_NODE'] = '1'
for ($i = 1; $i -lt $request.build.command.Count - 1; $i++) { $start.ArgumentList.Add($request.build.command[$i]) }
$start.ArgumentList.Add($entry)
$start.ArgumentList.Add($requestFile)
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $start
try {
    $process.Start() | Out-Null
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    [System.IO.File]::WriteAllText("$logBase.stdout.log", $stdout)
    [System.IO.File]::WriteAllText("$logBase.stderr.log", $stderr)
    $result = $null
    if ($stdout.Trim()) { try { $result = $stdout | ConvertFrom-Json } catch {} }
    @{ exitCode = $process.ExitCode; result = $result; stdoutPath = "$logBase.stdout.log"; stderrPath = "$logBase.stderr.log" } | ConvertTo-Json -Depth 30 -Compress
    $exitCode = $process.ExitCode
} finally { $process.Dispose() }
exit $exitCode
