# End-to-end self check: runs tools/driver.js inside dist/echoes-of-doom.html
# in headless Chrome and prints the assert report.
#
# Usage (from the project directory):
#   .\tools\check.ps1
# Note: keep this file ASCII only - Windows PowerShell 5.1 reads BOM-less UTF-8
# files as GBK, so non-ASCII text here would break parsing.

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $proj "dist\echoes-of-doom.html"
$driver = Join-Path $proj "tools\driver.js"
if (-not (Test-Path -LiteralPath $dist)) { throw "dist not found: run tools\run.ps1 tools\build-single-file.js first" }

$tmpDir = Join-Path $proj "work"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$page = Join-Path $tmpDir ("dev-driver-page-" + $PID + ".html")
$dump = Join-Path $tmpDir ("dev-driver-dump-" + $PID + ".html")

$html = [System.IO.File]::ReadAllText($dist)

$stub = @'
<script>
try { localStorage.clear(); } catch (e) {}
window.__report = { errors: [], fail: 0, pass: 0, log: [] };
window.addEventListener('error', function (e) { window.__report.errors.push('onerror: ' + (e.message || e.error)); });
window.__rafQueue = [];
window.requestAnimationFrame = function (cb) { window.__rafQueue.push(cb); return window.__rafQueue.length; };
window.cancelAnimationFrame = function () {};
var __ce = console.error;
console.error = function () {
  try { window.__report.errors.push('console.error: ' + Array.prototype.slice.call(arguments).map(String).join(' ')); } catch (x) {}
  __ce.apply(console, arguments);
};
</script>
'@

$anchor = "</head>"
$idx = $html.IndexOf($anchor)
if ($idx -lt 0) { throw "anchor </head> not found in dist" }
$html = $html.Remove($idx, $anchor.Length).Insert($idx, $stub + $anchor)

$driverSrc = [System.IO.File]::ReadAllText($driver)
$tail = '<pre id="report" style="position:fixed;left:0;bottom:0;max-height:70vh;overflow:auto;background:#111;color:#0f0;font-size:11px;z-index:99999">running</pre>' +
    '<script>' + $driverSrc + '</script></body>' + "`n" + '</html>'
$bodyIdx = $html.LastIndexOf("</body>")
if ($bodyIdx -lt 0) { throw "anchor </body> not found in dist" }
$html = $html.Remove($bodyIdx).Insert($bodyIdx, $tail)

[System.IO.File]::WriteAllText($page, $html, (New-Object System.Text.UTF8Encoding($false)))

. (Join-Path $PSScriptRoot "lib-chrome.ps1")
$chrome = Get-BrowserExe
if (-not (Test-Path -LiteralPath $chrome)) { throw "chrome not found: $chrome" }
$prof = Join-Path ([System.IO.Path]::GetTempPath()) "codex-doom-chrome-check"
$url = "file:///" + $page.Replace('\', '/')
$failed = $false
foreach ($size in @("1280,900", "480,900")) {
    $args = '--headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=' + $size + ' ' +
        '--virtual-time-budget=30000 --user-data-dir="' + $prof + '" --dump-dom "' + $url + '"'
    if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }
    cmd /c ("`"" + $chrome + "`" " + $args + " > `"" + $dump + "`" 2>nul")

    if (-not (Test-Path -LiteralPath $dump)) { throw "chrome produced no output for $size" }
    $out = $null
for ($try = 0; $try -lt 40; $try++) {
        try { $out = [System.IO.File]::ReadAllText($dump); break }
        catch { Start-Sleep -Milliseconds 400 }
    }
    if ($null -eq $out) { throw "cannot read chrome dump (file locked)" }
    $m = [regex]::Match($out, '(?s)<pre id="report"[^>]*>(.*?)</pre>')
    if (-not $m.Success) {
        Write-Host "!! report block not found for viewport $size - the driver probably crashed early"
        Write-Host ($out.Substring(0, [math]::Min(1200, $out.Length)))
        $failed = $true
        continue
    }
    $report = $m.Groups[1].Value
    $report = $report.Replace('&lt;', '<').Replace('&gt;', '>').Replace('&quot;', '"').Replace('&#39;', "'").Replace('&amp;', '&')
    Write-Host ("---- viewport " + $size + " ----")
    Write-Host $report
    $logName = "dev-driver-report-" + $size.Replace(',', 'x') + ".txt"
    [System.IO.File]::WriteAllText((Join-Path $tmpDir $logName), $report, (New-Object System.Text.UTF8Encoding($false)))
    if ($report -cmatch '(?m)^FAIL') { $failed = $true }
}

Remove-Item -LiteralPath $page -Force
if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }

if ($failed) { exit 1 }
Write-Host "ALL GREEN"
exit 0
