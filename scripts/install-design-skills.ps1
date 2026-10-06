# User-authorized DSH skill installation. Preserve every existing unrelated skill.
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$stagingDirectory = Join-Path $projectDirectory 'artifacts/design-skills-staging'
$destinationDirectory = 'C:\Users\wubil\.dsh\skills'
$skillNames = @('impeccable', 'shadcn', 'json-render-core', 'json-render-shadcn', 'hallmark-component-design')
$records = @()
foreach ($skillName in $skillNames) {
  $sourceDirectory = Join-Path $stagingDirectory $skillName
  $skillFile = Join-Path $sourceDirectory 'SKILL.md'
  $skillText = [System.IO.File]::ReadAllText($skillFile)
  if (-not $skillText.StartsWith('---') -or $skillText -notmatch ('(?m)^name: ' + [regex]::Escape($skillName) + '\r?$') -or $skillText -notmatch '(?m)^description: \S') {
    throw "Skill frontmatter does not match the intended DSH name: $skillName"
  }
  $targetDirectory = Join-Path $destinationDirectory $skillName
  if (Test-Path -LiteralPath $targetDirectory) {
    $existingCount = @(Get-ChildItem -LiteralPath $targetDirectory -Recurse -File).Count
    $sourceCount = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File).Count
    if ($existingCount -ne $sourceCount) { throw "Existing skill differs; refusing overwrite: $skillName" }
  } else {
    Copy-Item -LiteralPath $sourceDirectory -Destination $targetDirectory -Recurse
  }
  $fileRecords = @()
  foreach ($sourceFile in Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File) {
    $relativePath = $sourceFile.FullName.Substring($sourceDirectory.Length).TrimStart('\','/')
    $targetFile = Join-Path $targetDirectory $relativePath
    $sourceHash = (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if (-not (Test-Path -LiteralPath $targetFile) -or (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sourceHash) {
      throw "Installed skill verification failed: $skillName/$relativePath"
    }
    $fileRecords += [ordered]@{ path = $relativePath.Replace('\','/'); sha256 = $sourceHash }
  }
  $records += [ordered]@{ name = $skillName; directory = $targetDirectory; files = $fileRecords; verified = $true }
}
$engineLauncher = Join-Path $destinationDirectory 'impeccable/scripts/impeccable.cmd'
$engineProbe = (& $engineLauncher engine-probe | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $engineProbe -ne 'impeccable-engine 0.1.11') { throw 'Installed official engine probe failed.' }
$report = [ordered]@{
  installedAt = [DateTime]::UtcNow.ToString('o')
  destination = $destinationDirectory
  sourcePins = Get-Content -LiteralPath (Join-Path $projectDirectory 'artifacts/design-skill-sources-2026-10-06.json') -Raw | ConvertFrom-Json
  upstreamAdaptations = @('json-render core/shadcn frontmatter names prefixed to avoid collisions', 'Official upstream licenses retained', 'Verified official Windows engine 0.1.11 bundled beside launcher')
  localSkill = 'hallmark-component-design'
  engineProbe = $engineProbe
  skills = $records
  nativeDiscoveryObserved = $false
  actualAgentDesignQualityVerified = $false
}
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $projectDirectory 'artifacts/design-skills-installed.json') -Encoding utf8
Write-Output ('Installed and verified DSH skills: ' + ($skillNames -join ', '))
Write-Output $engineProbe
