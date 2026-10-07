param([string]$DestinationDirectory = (Join-Path $env:USERPROFILE '.dsh/skills'), [switch]$LocalOnly)
# Upgrade the user-owned local skill after a verified backup; preserve unrelated/upstream skills.
$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$stagingDirectory = Join-Path $projectDirectory 'artifacts/design-skills-staging'
$destinationRoot = [IO.Path]::GetFullPath($DestinationDirectory)
$skillNames = if ($LocalOnly) { @('hallmark-component-design') } else { @('impeccable', 'shadcn', 'json-render-core', 'json-render-shadcn', 'hallmark-component-design') }
$records = @()
New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
foreach ($skillName in $skillNames) {
  $sourceDirectory = if ($skillName -eq 'hallmark-component-design') { Join-Path $projectDirectory ('skills/' + $skillName) } else { Join-Path $stagingDirectory $skillName }
  $sourceDirectory = [IO.Path]::GetFullPath($sourceDirectory)
  $skillText = [IO.File]::ReadAllText((Join-Path $sourceDirectory 'SKILL.md'))
  if (-not $skillText.StartsWith('---') -or $skillText -notmatch ('(?m)^name: ' + [regex]::Escape($skillName) + '\r?$') -or $skillText -notmatch '(?m)^description: \S') { throw ('Invalid skill frontmatter: ' + $skillName) }
  $targetDirectory = [IO.Path]::GetFullPath((Join-Path $destinationRoot $skillName))
  if (-not $targetDirectory.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $targetDirectory) -ne $skillName) { throw 'Invalid skill target directory.' }
  $sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File)
  $unchanged = Test-Path -LiteralPath $targetDirectory
  if ($unchanged -and @(Get-ChildItem -LiteralPath $targetDirectory -Recurse -File).Count -ne $sourceFiles.Count) { $unchanged = $false }
  foreach ($sourceFile in $sourceFiles) {
    $relativePath = $sourceFile.FullName.Substring($sourceDirectory.Length).TrimStart('\','/')
    $targetFile = Join-Path $targetDirectory $relativePath
    if (-not (Test-Path -LiteralPath $targetFile -PathType Leaf) -or (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash) { $unchanged = $false }
  }
  $backupDirectory = $null
  if ((Test-Path -LiteralPath $targetDirectory) -and -not $unchanged) {
    if ($skillName -ne 'hallmark-component-design') { throw ('Upstream skill differs; preserve existing installation: ' + $skillName) }
    $backupDirectory = Join-Path $projectDirectory ('artifacts/design-skills-backups/' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N') + '/' + $skillName)
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
$engineProbe = $null
if (-not $LocalOnly) {
  $engineProbe = (& (Join-Path $destinationRoot 'impeccable/scripts/impeccable.cmd') engine-probe | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $engineProbe -ne 'impeccable-engine 0.1.11') { throw 'Installed official engine probe failed.' }
}
$report = [ordered]@{ installedAt = [DateTime]::UtcNow.ToString('o'); destination = $destinationRoot; releaseId = 'apps-a2-20261007'; localSkill = 'hallmark-component-design'; engineProbe = $engineProbe; skills = $records; nativeDiscoveryObserved = $false; actualAgentDesignQualityVerified = $false }
$evidence = Join-Path $projectDirectory 'evidence/apps-a2-20261007/design-skills'
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$reportPath = Join-Path $evidence ('installed-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N') + '.json')
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding utf8
Write-Output ('Installed and verified DSH skills: ' + ($skillNames -join ', '))
Write-Output ('Installation evidence: ' + $reportPath)
