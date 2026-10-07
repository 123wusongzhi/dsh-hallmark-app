param(
  [string]$PackageManifestPath = '',
  [string]$DesktopDirectory = (Join-Path $env:LOCALAPPDATA 'Programs/DeepSeek Harness'),
  [string]$ProfileDirectory = '',
  [switch]$ValidateOnly
)
# The official plugin manager replaces the same plugin. This script never stops Desktop or migrates app.db.
$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if (-not $PackageManifestPath) { $PackageManifestPath = Join-Path $projectDirectory 'evidence/apps-a2-20261007/candidates/1.0.0-candidate.12/package-manifest.json' }
$release = Get-Content -LiteralPath $PackageManifestPath -Raw | ConvertFrom-Json
$buildPath = Join-Path (Split-Path -Parent $PackageManifestPath) 'build-manifest.json'
$build = Get-Content -LiteralPath $buildPath -Raw | ConvertFrom-Json
$archive = [IO.Path]::GetFullPath((Join-Path $projectDirectory $release.archive))
$dshStateRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$officialProfile = [IO.Path]::GetFullPath((Join-Path $dshStateRoot 'profiles/desktop'))
$profile = if ($ProfileDirectory) { [IO.Path]::GetFullPath($ProfileDirectory) } else { $officialProfile }
if (-not $profile.Equals($officialProfile, [StringComparison]::OrdinalIgnoreCase)) { throw 'Profile backup target must match the official CLI desktop profile.' }
$cli = Join-Path $DesktopDirectory 'resources/runtime/cli/bin/dsh.cmd'
$packageName = 'dsh-plugin-apps-bundle'
if ($release.package.name -ne $packageName -or $release.package.version -ne '1.0.0-candidate.12' -or $build.versions.bundleVersion -ne '1.0.0-candidate.12' -or $build.versions.hostPluginVersion -ne '1.0.0-candidate.12' -or $build.versions.runtimeVersion -ne '1.0.0-candidate.12' -or $build.versions.databaseSchemaVersion -ne 4) { throw 'Candidate identity mismatch.' }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $release.sha256) { throw 'Candidate archive hash mismatch.' }
$archiveEntries = @(& tar -tf $archive)
if ($LASTEXITCODE -ne 0 -or @($archiveEntries | Where-Object { -not $_.StartsWith('package/') -or $_.Contains('\') -or $_.Split('/').Contains('..') }).Count -gt 0) { throw 'Unsafe candidate archive.' }
$packedManifest = (& tar -xOf $archive 'package/package.json' | Out-String) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $packedManifest.name -ne $packageName -or $packedManifest.version -ne '1.0.0-candidate.12') { throw 'Packed manifest identity mismatch.' }
$profileManifest = Get-Content -LiteralPath (Join-Path $profile 'package.json') -Raw | ConvertFrom-Json
if ($profileManifest.name -ne 'dsh-profile-desktop') { throw 'Unexpected Desktop profile identity.' }
$oldDependency = $profileManifest.dependencies.$packageName
if (-not $oldDependency) { throw 'The original same-name desktop plugin is not installed; refuse to add a parallel entry.' }
$installedDirectory = Join-Path $profile ('node_modules/' + $packageName)
$oldManifest = Get-Content -LiteralPath (Join-Path $installedDirectory 'package.json') -Raw | ConvertFrom-Json
if ($oldManifest.name -ne $packageName) { throw 'Installed original plugin identity mismatch.' }
$cliVersion = (& $cli --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $cliVersion -ne '0.2.0-rc.2') { throw 'Unexpected official Desktop CLI version.' }
$desktopRunning = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count -gt 0
if ($ValidateOnly) {
  [ordered]@{ validated = $true; installed = $false; package = $packageName; version = $packedManifest.version; archive = $archive; sha256 = $release.sha256; originalVersion = $oldManifest.version; profile = $profile; cliVersion = $cliVersion; desktopRunning = $desktopRunning; command = 'dsh plugin --profile desktop add file:<archive> --ignore-scripts'; dataMigration = 'NOT_RUN' } | ConvertTo-Json -Depth 5
  exit 0
}
if ($desktopRunning) { throw 'Fully quit DeepSeek Harness from its application menu before installing. This script never stops it.' }
$backupRoot = Join-Path $projectDirectory 'artifacts/desktop-apps-rollbacks'
$backup = Join-Path $backupRoot (([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')) + '-' + [Guid]::NewGuid().ToString('N'))
$resolvedBackup = [IO.Path]::GetFullPath($backup)
if (-not $resolvedBackup.StartsWith([IO.Path]::GetFullPath($backupRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid backup directory.' }
New-Item -ItemType Directory -Path $resolvedBackup | Out-Null
$configuration = @()
foreach ($name in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.yml', 'cordis.patch.yml')) {
  $original = Join-Path $profile $name
  if (Test-Path -LiteralPath $original -PathType Leaf) {
    $copy = Join-Path $resolvedBackup ('configuration/' + $name)
    New-Item -ItemType Directory -Path (Split-Path -Parent $copy) -Force | Out-Null
    Copy-Item -LiteralPath $original -Destination $copy
    $configuration += [ordered]@{ original = $original; backup = $copy; sha256 = (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
}
Copy-Item -LiteralPath $installedDirectory -Destination (Join-Path $resolvedBackup 'package') -Recurse
$rollbackArchive = Join-Path $resolvedBackup 'original-plugin.tgz'
& tar -czf $rollbackArchive -C $resolvedBackup 'package'
if ($LASTEXITCODE -ne 0) { throw 'Original plugin backup archive failed.' }
$rollbackSha256 = (Get-FileHash -LiteralPath $rollbackArchive -Algorithm SHA256).Hash.ToLowerInvariant()
$record = [ordered]@{ createdAt = [DateTime]::UtcNow.ToString('o'); plugin = $packageName; originalVersion = $oldManifest.version; originalDependency = $oldDependency; profile = $profile; cli = $cli; originalArchive = $rollbackArchive; originalArchiveSha256 = $rollbackSha256; candidateArchive = $archive; candidateSha256 = $release.sha256; configuration = $configuration; installed = $false; dataMigration = 'NOT_RUN' }
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedBackup 'backup.json') -Encoding utf8
$rollbackScript = @'
param([switch]$RestoreConfiguration)
$ErrorActionPreference = 'Stop'
$record = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'backup.json') -Raw | ConvertFrom-Json
if (@(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Fully quit Desktop before rollback.' }
$currentDshStateRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$currentOfficialProfile = [IO.Path]::GetFullPath((Join-Path $currentDshStateRoot 'profiles/desktop'))
if (-not $currentOfficialProfile.Equals([IO.Path]::GetFullPath($record.profile), [StringComparison]::OrdinalIgnoreCase)) { throw 'Official Desktop profile changed since backup; refuse rollback into a different profile.' }
if ((Get-FileHash -LiteralPath $record.originalArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.originalArchiveSha256) { throw 'Rollback package hash mismatch.' }
& $record.cli plugin --profile desktop add ('file:' + $record.originalArchive.Replace('\','/')) '--ignore-scripts'
if ($LASTEXITCODE -ne 0) { throw 'Official rollback failed; preserve output.' }
if ($RestoreConfiguration) {
  # Explicit recovery option restores exactly the captured profile files, after checking hashes and paths.
  $profileRoot = [IO.Path]::GetFullPath($record.profile) + [IO.Path]::DirectorySeparatorChar
  foreach ($file in $record.configuration) {
    $target = [IO.Path]::GetFullPath($file.original)
    if (-not $target.StartsWith($profileRoot, [StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $file.backup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Configuration rollback path/hash mismatch.' }
    Copy-Item -LiteralPath $file.backup -Destination $target -Force
  }
}
Write-Output ('Original plugin restored through official manager: ' + $record.originalVersion + '. Reopen Desktop to verify loaded identity; app.db was not migrated.')
'@
$rollbackScript | Set-Content -LiteralPath (Join-Path $resolvedBackup 'rollback.ps1') -Encoding utf8
# CLI ordering is verified against the installed 0.2.0-rc.2 help; --profile before plugin would boot Desktop.
& $cli plugin --profile desktop add ('file:' + $archive.Replace('\','/')) '--registry=https://registry.npmjs.org' '--ignore-scripts' 2>&1 | Tee-Object -FilePath (Join-Path $resolvedBackup 'install.log')
if ($LASTEXITCODE -ne 0) { throw ('Official update failed. Preserve output and use rollback: ' + (Join-Path $resolvedBackup 'rollback.ps1')) }
$installedManifest = Get-Content -LiteralPath (Join-Path $installedDirectory 'package.json') -Raw | ConvertFrom-Json
if ($installedManifest.version -ne '1.0.0-candidate.12') { throw 'Disk package version mismatch after manager update.' }
foreach ($artifact in @('lib/index.js', 'client/client.js', 'lib/runtime.js', 'lib/apps-authoring-build.js', 'lib/apps-authoring-preview.js')) {
  if ((Get-FileHash -LiteralPath (Join-Path $installedDirectory $artifact) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $build.artifacts.$artifact) { throw ('Installed artifact hash mismatch: ' + $artifact) }
}
$record.installed = $true
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedBackup 'backup.json') -Encoding utf8
Write-Output ('Updated the original desktop plugin. Reopen and verify Host12/Runtime12/schema4; rollback: ' + (Join-Path $resolvedBackup 'rollback.ps1'))
