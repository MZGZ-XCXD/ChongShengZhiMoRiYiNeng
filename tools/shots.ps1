# Builds a temp page from dist and takes screenshots of the main tabs.
# Usage:  .\tools\shots.ps1
$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$dist = Join-Path $proj "dist\echoes-of-doom.html"
$snippet = Join-Path $proj "work\shot-setup.js"
if (-not (Test-Path -LiteralPath $dist)) { throw "dist not found: run tools\run.ps1 tools\build-single-file.js" }

$outDir = Join-Path $proj "screenshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$tmp = Join-Path $proj "work\dev-shot.html"

$html = [System.IO.File]::ReadAllText($dist)
$code = [System.IO.File]::ReadAllText($snippet)
$tail = '<script>' + $code + '</script></body>' + "`n" + '</html>'
$idx = $html.LastIndexOf("</body>")
$html = $html.Remove($idx).Insert($idx, $tail)
[System.IO.File]::WriteAllText($tmp, $html, (New-Object System.Text.UTF8Encoding($false)))

. (Join-Path $PSScriptRoot "lib-chrome.ps1")
$chrome = Get-BrowserExe
$prof = Join-Path ([System.IO.Path]::GetTempPath()) "codex-doom-chrome-profile"
$url = "file:///" + $tmp.Replace('\', '/')

$shots = @(
    @{ name = "map";     size = "1440,1100"; query = "tab=map" },
    @{ name = "map-pick"; size = "1440,1100"; query = "tab=map&select=market" },
    @{ name = "base";    size = "1440,1100"; query = "tab=base" },
    @{ name = "ability"; size = "1440,1100"; query = "tab=ability" },
    @{ name = "bonds";   size = "1440,1100"; query = "tab=bonds" },
    @{ name = "bond-pop"; size = "1440,1100"; query = "tab=bonds&pending=bond&bond=baimanman" },
    @{ name = "light-bonds"; size = "1440,1100"; query = "tab=bonds&theme=light" },
    @{ name = "defense"; size = "1440,1100"; query = "tab=defense" },
    @{ name = "story";   size = "1440,1100"; query = "tab=map&pending=story" },
    @{ name = "encounter"; size = "1440,1100"; query = "tab=map&pending=encounter" },
    @{ name = "cache";   size = "1440,1100"; query = "tab=map&pending=cache" },
    @{ name = "mobile";  size = "520,1000";  query = "tab=map" },
    @{ name = "light-map"; size = "1440,1100"; query = "tab=map&theme=light" },
    @{ name = "light-settings"; size = "1440,1100"; query = "tab=settings&theme=light" },
    @{ name = "settings"; size = "1440,1100"; query = "tab=settings" }
)

foreach ($shot in $shots) {
    $png = Join-Path $outDir ("shot-" + $shot.name + ".png")
    if (Test-Path -LiteralPath $png) { Remove-Item -LiteralPath $png -Force }
    $args = '--headless=new --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=1 ' +
        '--window-size=' + $shot.size + ' --virtual-time-budget=4000 --user-data-dir="' + $prof + '" ' +
        '--screenshot="' + $png + '" "' + ($url + "?" + $shot.query) + '"'
    cmd /c ("`"" + $chrome + "`" " + $args + " > nul 2>&1")
    if (Test-Path -LiteralPath $png) { Write-Host ("shot ok: " + $shot.name) }
    else { Write-Host ("shot FAILED: " + $shot.name) }
}

Remove-Item -LiteralPath $tmp -Force
