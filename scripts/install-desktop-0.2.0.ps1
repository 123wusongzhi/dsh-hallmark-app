# Use the installed Desktop's official CLI; never edit ASAR or profile files directly.
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$desktopDirectory = 'C:\Users\wubil\AppData\Local\Programs\DeepSeek Harness'
$cli = Join-Path $desktopDirectory 'resources\runtime\cli\bin\dsh.cmd'
$archive = Join-Path $projectDirectory 'artifacts\dsh-plugin-hallmark-0.2.0.tgz'
$release = Get-Content -LiteralPath (Join-Path $projectDirectory 'artifacts\release-0.2.0.json') -Raw | ConvertFrom-Json
if (@(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'Fully quit DeepSeek Harness from its application menu before installing. This script never stops DSH.'
}
if ($release.version -ne '0.2.0' -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $release.sha256) {
  throw 'Release identity/hash mismatch; refusing installation.'
}
$cliVersion = (& $cli --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $cliVersion -ne '0.2.0-rc.2') { throw 'Unexpected Desktop CLI version.' }
& $cli plugin --profile desktop add "file:$($archive.Replace('\','/'))" '--registry=https://registry.npmjs.org' '--ignore-scripts'
if ($LASTEXITCODE -ne 0) { throw 'Official plugin installation failed. Preserve its output and inspect before retrying.' }
Write-Output 'Official package update completed. Reopen DSH and verify loaded Host version 0.2.0; installation alone does not prove runtime activation.'
