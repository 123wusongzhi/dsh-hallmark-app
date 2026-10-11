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
$launcher = $request.launcher
$nodeArgs = @()
if ($null -ne $launcher) {
    if ($launcher.executable -isnot [string] -or [string]::IsNullOrWhiteSpace($launcher.executable) -or $launcher.nodeArgs -isnot [array] -or @($launcher.nodeArgs | Where-Object { $_ -isnot [string] -or [string]::IsNullOrWhiteSpace($_) }).Count) {
        throw 'launcher requires an executable string and a nodeArgs string array; copy launcher from authoring guidance.'
    }
    $nodeExecutable = $launcher.executable
    $nodeArgs = $launcher.nodeArgs
} else {
    # Compatibility for existing generated Node/Electron + build.mjs requests only.
    # Custom build argv (for example --eval or npm run) must never become runner argv.
    $buildCommand = @($request.build.command)
    $legacyArgs = @($buildCommand | Select-Object -Skip 1 | Select-Object -SkipLast 1)
    $safeLegacyArgs = @($legacyArgs | Where-Object { $_ -notmatch '^--(no-warnings|expose-internals|experimental-strip-types|experimental-transform-types|disable-warning=ExperimentalWarning)$' }).Count -eq 0
    if ($buildCommand.Count -ge 2 -and [System.IO.Path]::GetFileName($buildCommand[-1]) -eq 'build.mjs' -and $safeLegacyArgs) {
        $nodeExecutable = $buildCommand[0]
        $nodeArgs = $legacyArgs
    } elseif ($buildCommand.Count -gt 0 -and [System.IO.Path]::GetFileNameWithoutExtension($buildCommand[0]) -in @('node','nodejs')) {
        $nodeExecutable = $buildCommand[0]
    } else {
        $nodeExecutable = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    }
}
$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $nodeExecutable
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.Environment['ELECTRON_RUN_AS_NODE'] = '1'
foreach ($argument in $nodeArgs) { $start.ArgumentList.Add($argument) }
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
