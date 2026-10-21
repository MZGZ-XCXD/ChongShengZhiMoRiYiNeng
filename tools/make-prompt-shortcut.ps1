# Creates (or refreshes) a desktop shortcut to the prompt list (tools/art-prompts.md).
#
# A fresh Windows box usually has no handler for .md, so pointing the shortcut at the
# file itself would pop "how do you want to open this?". Instead the shortcut opens the
# file in VS Code, falling back to Notepad when VS Code is not installed.
#
# Chinese text lives in tools/prompt-shortcut.json - PowerShell 5.1 reads a BOM-less
# UTF-8 .ps1 as GBK, so this script must stay ASCII.
#
# Usage (from the project directory):  .\tools\make-prompt-shortcut.ps1
# Optional: -Desktop <path> to override the target folder.
param([string]$Desktop = "")

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$cfgPath = Join-Path $PSScriptRoot "prompt-shortcut.json"
if (-not (Test-Path -LiteralPath $cfgPath)) { throw "prompt-shortcut.json not found" }
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $Desktop) { $Desktop = [Environment]::GetFolderPath('Desktop') }
if (-not (Test-Path -LiteralPath $Desktop)) { throw "desktop folder not found: $Desktop" }

$target = Join-Path $proj ($cfg.entry -replace '/', '\')
if (-not (Test-Path -LiteralPath $target)) {
    throw "prompt file not found: $target (run tools\run.ps1 tools\gen-art.js --dump first)"
}

$editor = $null
$candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe"),
    (Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\Code.exe")
)
foreach ($c in $candidates) {
    if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) { $editor = $c; break }
}
if (-not $editor) { $editor = Join-Path $env:SystemRoot "System32\notepad.exe" }

$lnkPath = Join-Path $Desktop ($cfg.name + ".lnk")
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $editor
$lnk.Arguments = '"' + $target + '"'
$lnk.WorkingDirectory = Split-Path -Parent $target
$lnk.IconLocation = "$editor,0"
$lnk.Description = $cfg.description
$lnk.Save()

if (-not (Test-Path -LiteralPath $lnkPath)) { throw "shortcut was not created" }
Write-Host ("shortcut: " + $lnkPath)
Write-Host ("opens   : " + $target)
Write-Host ("with    : " + $editor)
