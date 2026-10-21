# Smoke test for the multi-file build: opens index.html in headless Chrome over file://
# and checks that the game actually rendered (cards present, no missing-<script> blank screen).
# ASCII only - see tools/check.ps1 for why.
$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$page = Join-Path $proj "index.html"
if (-not (Test-Path -LiteralPath $page)) { throw "index.html not found" }

$tmpDir = Join-Path $proj "work"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$dump = Join-Path $tmpDir ("dev-smoke-dom-" + $PID + ".html")
. (Join-Path $PSScriptRoot "lib-chrome.ps1")
$chrome = Get-BrowserExe
if (-not (Test-Path -LiteralPath $chrome)) { throw "chrome not found: $chrome" }
$prof = Join-Path ([System.IO.Path]::GetTempPath()) "codex-doom-chrome-smoke"
$url = "file:///" + $page.Replace('\', '/')
$args = '--headless=new --disable-gpu --no-sandbox --window-size=1280,900 --virtual-time-budget=6000 ' +
    '--user-data-dir="' + $prof + '" --dump-dom "' + $url + '"'
if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }
cmd /c ("`"" + $chrome + "`" " + $args + " > `"" + $dump + "`" 2>nul")

if (-not (Test-Path -LiteralPath $dump)) { throw "chrome produced no output" }
$out = $null
for ($try = 0; $try -lt 40; $try++) {
    try { $out = [System.IO.File]::ReadAllText($dump); break }
    catch { Start-Sleep -Milliseconds 400 }
}
if ($null -eq $out) { throw "cannot read chrome dump (file locked)" }

$nodes = ([regex]::Matches($out, 'class="mnode')).Count
$tabs = ([regex]::Matches($out, 'class="tab')).Count
$hasTitle = $out.Contains('末日回声')
$hasMap = $out.Contains('svg class="citymap')
Write-Host ("multi-file smoke: title=" + $hasTitle + " mapNodes=" + $nodes + " map=" + $hasMap + " tabs=" + $tabs)
Remove-Item -LiteralPath $dump -Force

if ($nodes -lt 10 -or $tabs -lt 4 -or -not $hasTitle -or -not $hasMap) {
    Write-Host "!! index.html did not render properly (a script probably failed to load)"
    exit 1
}
Write-Host "ok: index.html renders when opened directly"
exit 0
