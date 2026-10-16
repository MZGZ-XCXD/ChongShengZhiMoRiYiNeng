# Installs one artwork file into the game's assets/ folder.
#   - crops the bottom strip (handy for AI tools that stamp a watermark in a corner)
#   - scales to a target width and re-encodes as JPEG so the single-file build stays small
#
# Usage (from the project directory):
#   .\tools\install-art.ps1 -Source "C:\path\to\wangyi.png" -Id wangyi
#   .\tools\install-art.ps1 -Source "D:\dl\market.png" -Id market -Kind scenes -Width 1280 -CropBottom 0
#
# ASCII only (PowerShell 5.1 reads BOM-less UTF-8 .ps1 as GBK).
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Id,
    [string]$Kind = "portraits",
    [double]$CropBottom = 0.05,
    [int]$Width = 768,
    [int]$Quality = 86
)

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$src = (Resolve-Path -LiteralPath $Source).Path
$assetsDir = Join-Path $proj (Join-Path "assets" $Kind)
if (-not (Test-Path -LiteralPath $assetsDir)) { throw "assets folder not found: $assetsDir" }

$tmpDir = Join-Path $proj "work"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$page = Join-Path $tmpDir "dev-crop.html"
$dump = Join-Path $tmpDir "dev-crop-dom.html"

$srcUrl = "file:///" + ($src -replace '\\', '/')
$body = @'
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<canvas id="c"></canvas><pre id="out">pending</pre>
<script>
var img = new Image();
img.onload = function () {
    var keepRatio = __KEEP__;
    var maxW = __WIDTH__;
    var q = __QUALITY__ / 100;
    var keepH = Math.max(1, Math.round(img.height * keepRatio));
    var outW = Math.min(maxW, img.width);
    var outH = Math.max(1, Math.round(keepH * (outW / img.width)));
    var c = document.getElementById('c');
    c.width = outW; c.height = outH;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, img.width, keepH, 0, 0, outW, outH);
    var url = c.toDataURL('image/jpeg', q);
    document.getElementById('out').textContent =
        'META:' + img.width + 'x' + img.height + '->' + outW + 'x' + outH + ':ENDMETA\n' + url;
};
// sentinel is split so that this script text (which --dump-dom also dumps) cannot be
// mistaken for the real failure state by the checker below.
img.onerror = function () { document.getElementById('out').textContent = 'LOAD' + '_FAIL'; };
img.src = '__SRC__';
</script></body></html>
'@

$body = $body.Replace('__KEEP__', ([string](1 - $CropBottom))).Replace('__WIDTH__', [string]$Width).
    Replace('__QUALITY__', [string]$Quality).Replace('__SRC__', $srcUrl)
[System.IO.File]::WriteAllText($page, $body, (New-Object System.Text.UTF8Encoding($false)))

. (Join-Path $PSScriptRoot "lib-chrome.ps1")
$chrome = Get-BrowserExe
$prof = Join-Path ([System.IO.Path]::GetTempPath()) "codex-doom-chrome-profile"
$url = "file:///" + $page.Replace('\', '/')
$args = '--headless=new --disable-gpu --no-sandbox --allow-file-access-from-files ' +
    '--virtual-time-budget=20000 --user-data-dir="' + $prof + '" --dump-dom "' + $url + '"'
if (Test-Path -LiteralPath $dump) { Remove-Item -LiteralPath $dump -Force }
cmd /c ("`"" + $chrome + "`" " + $args + " > `"" + $dump + "`" 2>nul")

if (-not (Test-Path -LiteralPath $dump)) { throw "chrome produced no output" }
$out = $null
for ($try = 0; $try -lt 12; $try++) {
    try { $out = [System.IO.File]::ReadAllText($dump); break }
    catch { Start-Sleep -Milliseconds 400 }
}
if ($null -eq $out) { throw "cannot read chrome dump" }
if ($out -match 'LOAD_FAIL') { throw "browser could not load the source image: $src" }

# --dump-dom escapes the '>' of '->' as '&gt;', so accept both spellings.
$m = [regex]::Match($out, 'META:([0-9]+x[0-9]+)-(?:&gt;|>)([0-9]+x[0-9]+):ENDMETA\s*(data:image/jpeg;base64,[A-Za-z0-9+/=]+)')
if (-not $m.Success) {
    Write-Host "!! could not find the encoded image in the page dump"
    exit 1
}
$b64 = $m.Groups[3].Value.Substring('data:image/jpeg;base64,'.Length)
$bytes = [Convert]::FromBase64String($b64)

$target = Join-Path $assetsDir ($Id + ".jpg")
Get-ChildItem -LiteralPath $assetsDir -File | Where-Object { $_.BaseName -eq $Id } | ForEach-Object {
    if ($_.FullName -ne $target) { Remove-Item -LiteralPath $_.FullName -Force }
}
[System.IO.File]::WriteAllBytes($target, $bytes)

Remove-Item -LiteralPath $page -Force
Remove-Item -LiteralPath $dump -Force

Write-Host ("installed: " + $target)
Write-Host ("source   : " + $m.Groups[1].Value + "  ->  " + $m.Groups[2].Value + "  (" + [math]::Round($bytes.Length / 1024) + " KB)")
Write-Host "next: tools\run.ps1 tools\gen-asset-manifest.js  then  tools\run.ps1 tools\build-single-file.js"
