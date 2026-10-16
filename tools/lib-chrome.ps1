# Locates a Chromium browser (Chrome or Edge) for the headless scripts.
#
# Lookup order:
#   1. $env:CHROME_PATH          -- set this on a machine with a unusual install
#   2. the usual install folders (Chrome, then Edge)
#   3. "chrome" / "msedge" on PATH
#   4. the App Paths registry keys
#
# Usage from another script in tools/:
#   . (Join-Path $PSScriptRoot "lib-chrome.ps1")
#   $chrome = Get-BrowserExe
#
# ASCII only (PowerShell 5.1 reads a BOM-less UTF-8 .ps1 as GBK).

function Get-BrowserExe {
    $cands = New-Object System.Collections.ArrayList
    if ($env:CHROME_PATH) { [void]$cands.Add($env:CHROME_PATH) }
    [void]$cands.Add((Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"))
    [void]$cands.Add((Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"))
    if ($env:LOCALAPPDATA) { [void]$cands.Add((Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")) }
    [void]$cands.Add((Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"))
    [void]$cands.Add((Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"))
    if ($env:LOCALAPPDATA) { [void]$cands.Add((Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")) }

    foreach ($c in $cands) {
        if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $c).Path
        }
    }

    foreach ($n in @("chrome", "chrome.exe", "msedge", "msedge.exe")) {
        $cmd = Get-Command $n -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) { return $cmd.Source }
    }

    $keys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"
    )
    foreach ($k in $keys) {
        try {
            $v = (Get-ItemProperty -LiteralPath $k -ErrorAction Stop).'(default)'
            if ($v -and (Test-Path -LiteralPath $v -PathType Leaf)) { return $v }
        } catch { }
    }

    throw "No Chrome/Edge found. Install Chrome, or set CHROME_PATH to the browser exe."
}
