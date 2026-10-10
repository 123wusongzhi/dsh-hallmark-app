param(
  [string]$DestinationDirectory = '',
  [string]$SourceDirectory = '',
  [string]$EvidenceDirectory = '',
  [switch]$LocalOnly,
  [switch]$ValidateOnly
)
# Upgrade the user-owned local skill after a verified backup; preserve unrelated/upstream skills.
$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$dshStateRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
if (-not $DestinationDirectory) { $DestinationDirectory = Join-Path $dshStateRoot 'skills' }
if (-not $SourceDirectory) { $SourceDirectory = Join-Path $projectDirectory 'skills' }
$sourceRoot = [IO.Path]::GetFullPath($SourceDirectory)
$stagingDirectory = Join-Path $projectDirectory 'artifacts/design-skills-staging'
$destinationRoot = [IO.Path]::GetFullPath($DestinationDirectory)
$localSkills = @('hallmark-component-design', 'ozon-listing')
$skillNames = if ($LocalOnly) { $localSkills } else { @('impeccable', 'shadcn', 'json-render-core', 'json-render-shadcn') + $localSkills }
$evidence = if ($EvidenceDirectory) { [IO.Path]::GetFullPath($EvidenceDirectory) } else { Join-Path (Split-Path -Parent $destinationRoot) 'state/apps-skill-installs' }
$records = @()
if (-not $ValidateOnly) { New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null }
foreach ($skillName in $skillNames) {
  $sourceDirectory = if ($localSkills -contains $skillName) { Join-Path $sourceRoot $skillName } else { Join-Path $stagingDirectory $skillName }
  $sourceDirectory = [IO.Path]::GetFullPath($sourceDirectory)
  $skillText = [IO.File]::ReadAllText((Join-Path $sourceDirectory 'SKILL.md'))
  if (-not $skillText.StartsWith('---') -or $skillText -notmatch ('(?m)^name: ' + [regex]::Escape($skillName) + '\r?$') -or $skillText -notmatch '(?m)^description: \S') { throw ('Invalid skill frontmatter: ' + $skillName) }
  $targetDirectory = [IO.Path]::GetFullPath((Join-Path $destinationRoot $skillName))
  if (-not $targetDirectory.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $targetDirectory) -ne $skillName) { throw 'Invalid skill target directory.' }
  $sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File)
  if ($ValidateOnly) {
    $records += [ordered]@{ name = $skillName; source = $sourceDirectory; destination = $targetDirectory; files = @($sourceFiles | ForEach-Object { [ordered]@{ path = $_.FullName.Substring($sourceDirectory.Length).TrimStart('\','/').Replace('\','/'); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() } }) }
    continue
  }
  $unchanged = Test-Path -LiteralPath $targetDirectory
  if ($unchanged -and @(Get-ChildItem -LiteralPath $targetDirectory -Recurse -File).Count -ne $sourceFiles.Count) { $unchanged = $false }
  foreach ($sourceFile in $sourceFiles) {
    $relativePath = $sourceFile.FullName.Substring($sourceDirectory.Length).TrimStart('\','/')
    $targetFile = Join-Path $targetDirectory $relativePath
    if (-not (Test-Path -LiteralPath $targetFile -PathType Leaf) -or (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash) { $unchanged = $false }
  }
  $backupDirectory = $null
  if ((Test-Path -LiteralPath $targetDirectory) -and -not $unchanged) {
    if ($localSkills -notcontains $skillName) { throw ('Upstream skill differs; preserve existing installation: ' + $skillName) }
    $backupDirectory = Join-Path $evidence ('backups/' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N') + '/' + $skillName)
    New-Item -ItemType Directory -Path (Split-Path -Parent $backupDirectory) -Force | Out-Null
    Copy-Item -LiteralPath $targetDirectory -Destination $backupDirectory -Recurse
    $backupFiles = @()
    foreach ($original in Get-ChildItem -LiteralPath $targetDirectory -Recurse -File) {
      $relativePath = $original.FullName.Substring($targetDirectory.Length).TrimStart('\','/')
      $backupFile = Join-Path $backupDirectory $relativePath
      $hash = (Get-FileHash -LiteralPath $original.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      if ((Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw 'Local skill backup verification failed.' }
      $backupFiles += [ordered]@{ path = $relativePath.Replace('\','/'); sha256 = $hash }
    }
    $backupFiles | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path (Split-Path -Parent $backupDirectory) 'backup-manifest.json') -Encoding utf8
    # Absolute target was checked against the intended skill root before this recursive replacement.
    Remove-Item -LiteralPath $targetDirectory -Recurse -Force
  }
  if (-not (Test-Path -LiteralPath $targetDirectory)) { Copy-Item -LiteralPath $sourceDirectory -Destination $targetDirectory -Recurse }
  $fileRecords = @()
  foreach ($sourceFile in $sourceFiles) {
    $relativePath = $sourceFile.FullName.Substring($sourceDirectory.Length).TrimStart('\','/')
    $targetFile = Join-Path $targetDirectory $relativePath
    $hash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ((Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) { throw ('Installed skill verification failed: ' + $skillName + '/' + $relativePath) }
    $fileRecords += [ordered]@{ path = $relativePath.Replace('\','/'); sha256 = $hash }
  }
  $records += [ordered]@{ name = $skillName; directory = $targetDirectory; files = $fileRecords; verified = $true; changed = -not $unchanged; backupDirectory = $backupDirectory }
}
if ($ValidateOnly) {
  [ordered]@{ validated = $true; installed = $false; destination = $destinationRoot; source = $sourceRoot; skills = $records; discoveryProvider = 'official DSH filesystem'; nativeDiscoveryObserved = $false } | ConvertTo-Json -Depth 10
  exit 0
}
$engineProbe = $null
if (-not $LocalOnly) {
  $engineProbe = (& (Join-Path $destinationRoot 'impeccable/scripts/impeccable.cmd') engine-probe | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $engineProbe -ne 'impeccable-engine 0.1.11') { throw 'Installed official engine probe failed.' }
}
$report = [ordered]@{ installedAt = [DateTime]::UtcNow.ToString('o'); destination = $destinationRoot; source = $sourceRoot; releaseId = 'apps-a2-20261007'; localSkills = $localSkills; engineProbe = $engineProbe; skills = $records; discoveryProvider = 'official DSH filesystem'; nativeDiscoveryObserved = $false; actualAgentDesignQualityVerified = $false }
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$reportPath = Join-Path $evidence ('installed-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N') + '.json')
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding utf8
Write-Output ('Installed and verified DSH skills: ' + ($skillNames -join ', '))
Write-Output ('Installation evidence: ' + $reportPath)
