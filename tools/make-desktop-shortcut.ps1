# Creates (or refreshes) a desktop shortcut to the game.
#
# Why a JSON file: PowerShell 5.1 reads BOM-less UTF-8 .ps1 files as GBK, so Chinese
# text must not live in this script - it is read from tools/shortcut.json instead.
#
# Usage (from the project directory):  .\tools\make-desktop-shortcut.ps1
# Optional: -Desktop <path> to override the target folder.
param([string]$Desktop = "")

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$cfgPath = Join-Path $PSScriptRoot "shortcut.json"
if (-not (Test-Path -LiteralPath $cfgPath)) { throw "shortcut.json not found" }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $Desktop) { $Desktop = [Environment]::GetFolderPath('Desktop') }
if (-not (Test-Path -LiteralPath $Desktop)) { throw "desktop folder not found: $Desktop" }

$entry = Join-Path $proj ($cfg.entry -replace '/', '\')
$icon = Join-Path $proj ($cfg.icon -replace '/', '\')
if (-not (Test-Path -LiteralPath $entry)) { throw "entry not found (run tools\run.ps1 tools\build-single-file.js first): $entry" }
if (-not (Test-Path -LiteralPath $icon)) { throw "icon not found (run tools\run.ps1 tools\gen-icon.js first): $icon" }

$lnkPath = Join-Path $Desktop ($cfg.name + ".lnk")
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $entry
$lnk.WorkingDirectory = Split-Path -Parent $entry
$lnk.IconLocation = "$icon,0"
$lnk.Description = $cfg.description
$lnk.Save()

if (-not (Test-Path -LiteralPath $lnkPath)) { throw "shortcut was not created" }
Write-Host ("shortcut: " + $lnkPath)
Write-Host ("target  : " + $entry)
Write-Host ("icon    : " + $icon)
