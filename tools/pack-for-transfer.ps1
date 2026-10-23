# Packs the project into one zip that is safe to hand to another machine / another AI.
#
# What it leaves out:
#   work/            scratch: temp pages, self-test reports, source images, gemini.key
#   .git/            history, if this folder happens to be a repo
#   node_modules/    not used by this project, listed just in case
#   *.zip            nested archives
#
# The archive is verified after creation: if a work/ or key file slipped in, it says so.
#
# Usage (from the project directory):
#   .\tools\pack-for-transfer.ps1
#   .\tools\pack-for-transfer.ps1 -Out "D:\末日轮回.zip"
#
# ASCII only (PowerShell 5.1 reads a BOM-less UTF-8 .ps1 as GBK).
param(
    [string]$Out = ""
)

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$parent = Split-Path -Parent $proj
$leaf = Split-Path -Leaf $proj

if (-not $Out) {
    $Out = Join-Path $parent ("echoes-of-doom-src-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".zip")
}
$Out = [System.IO.Path]::GetFullPath($Out)

# Never write the archive back into the tree we are archiving (or into work/).
if ($Out.StartsWith($proj, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write the archive inside the project folder: $Out"
}

$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $tar) {
    throw "tar.exe not found (it ships with Windows 10 1803+). Right-click the folder and use 'Send to > Compressed folder' instead - but exclude work/ by hand."
}

if (Test-Path -LiteralPath $Out) { Remove-Item -LiteralPath $Out -Force }

$exclude = @(
    "$leaf/work", "$leaf/work/*",
    "$leaf/.git", "$leaf/.git/*",
    "$leaf/node_modules", "$leaf/node_modules/*",
    "$leaf/.chrome-profile", "$leaf/.chrome-profile/*",
    "*.zip"
)
$tarArgs = @("-a", "-c", "-f", $Out, "-C", $parent)
foreach ($e in $exclude) { $tarArgs += @("--exclude", $e) }
$tarArgs += $leaf

Write-Host ("packing " + $proj)
& $tar @tarArgs
if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $Out)) { throw "archive was not created: $Out" }

# Verify: list the archive and look for things that must not be in there.
$entries = & tar -tf $Out
$bad = @()
foreach ($pattern in @("/work/", "/.git/", "node_modules/", "gemini.key", ".chrome-profile/")) {
    $hit = $entries | Where-Object { $_.IndexOf($pattern, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
    if ($hit) { $bad += ($pattern + " (" + @($hit).Count + " files)") }
}

$size = [math]::Round((Get-Item -LiteralPath $Out).Length / 1MB, 2)
Write-Host ""
Write-Host ("archive : " + $Out)
Write-Host ("size    : " + $size + " MB, " + @($entries).Count + " entries")
Write-Host ("excluded: work/ .git/ node_modules/ *.zip")
if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host "WARNING - these should NOT be in the archive:"
    foreach ($b in $bad) { Write-Host ("  - " + $b) }
    Write-Host "Do not send this file as-is; check the excludes above."
    exit 1
}

Write-Host "check   : clean (no work/, no .git/, no key file)"
Write-Host ""
Write-Host "on the other machine:"
Write-Host "  1. unzip anywhere (avoid a path with spaces if you can)"
Write-Host "  2. install Node.js LTS + Chrome"
Write-Host "  3. open the folder in Codex and tell the AI: read AGENTS.md first"
Write-Host "  4. .\tools\run.ps1 .\tools\check-env.js   then   .\tools\check.ps1"
