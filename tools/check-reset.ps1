# End-to-end check for the "clear save" path: builds a page from dist + tools/reset-e2e.js,
# runs it in headless Chrome, and follows the real location.reload() that hardReset() triggers.
# Usage:  .\tools\check-reset.ps1
# ASCII only (PowerShell 5.1 reads BOM-less UTF-8 as GBK).
param([string]$Snippet = "", [string]$UrlHash = "")
$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $proj "dist\echoes-of-doom.html"
$snippet = if ($Snippet) { (Resolve-Path -LiteralPath $Snippet).Path } else { Join-Path $proj "tools\reset-e2e.js" }
if (-not (Test-Path -LiteralPath $dist)) { throw "dist not found: run tools\run.ps1 tools\build-single-file.js first" }

$tmpDir = Join-Path $proj "work"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$page = Join-Path $tmpDir ("dev-reset-page-" + $PID + ".html")
$dump = Join-Path $tmpDir ("dev-reset-dump-" + $PID + ".html")

$html = [System.IO.File]::ReadAllText($dist)
$code = [System.IO.File]::ReadAllText($snippet)
$tail = '<pre id="report" style="position:fixed;left:0;bottom:0;max-height:70vh;overflow:auto;background:#111;color:#0f0;font-size:12px;z-index:99999">running</pre>' +
    '<script>' + $code + '</script></body>' + "`n" + '</html>'
$idx = $html.LastIndexOf("</body>")
if ($idx -lt 0) { throw "anchor </body> not found" }
$html = $html.Remove($idx).Insert($idx, $tail)
[System.IO.File]::WriteAllText($page, $html, (New-Object System.Text.UTF8Encoding($false)))

. (Join-Path $PSScriptRoot "lib-chrome.ps1")
$chrome = Get-BrowserExe
if (-not (Test-Path -LiteralPath $chrome)) { throw "chrome not found: $chrome" }
$prof = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-doom-chrome-" + $PID)
$url = "file:///" + $page.Replace('\', '/') + $UrlHash
$args = '--headless=new --disable-gpu --no-sandbox --window-size=1280,900 ' +
    '--virtual-time-budget=20000 --user-data-dir="' + $prof + '" --dump-dom "' + $url + '"'
if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }
cmd /c ("`"" + $chrome + "`" " + $args + " > `"" + $dump + "`" 2>nul")

if (-not (Test-Path -LiteralPath $dump)) { throw "chrome produced no output" }
$out = $null
for ($try = 0; $try -lt 12; $try++) {
    try { $out = [System.IO.File]::ReadAllText($dump); break }
    catch { Start-Sleep -Milliseconds 400 }
}
if ($null -eq $out) { throw "cannot read chrome dump (file locked)" }
$m = [regex]::Match($out, '(?s)<pre id="report"[^>]*>(.*?)</pre>')
if (-not $m.Success) {
    Write-Host "!! report block not found - the page probably did not finish the reloaded pass"
    exit 1
}
$report = $m.Groups[1].Value
$report = $report.Replace('&lt;', '<').Replace('&gt;', '>').Replace('&quot;', '"').Replace('&#39;', "'").Replace('&amp;', '&')
Write-Host $report
[System.IO.File]::WriteAllText((Join-Path $tmpDir "dev-reset-report.txt"), $report, (New-Object System.Text.UTF8Encoding($false)))

Remove-Item -LiteralPath $page -Force
if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }
if ($report -cmatch '(?m)^FAIL') { exit 1 }
Write-Host "ALL GREEN"
exit 0
