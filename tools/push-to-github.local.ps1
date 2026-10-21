# Push helper: only pushes when the repo is actually in a pushable state.
#
#   .\tools\push-to-github.local.ps1            # check, then git push origin main
#   .\tools\push-to-github.local.ps1 -DryRun    # check only, never pushes
#
# Guards, in order:
#   1. current branch is main
#   2. working tree is clean (nothing uncommitted / unstaged)
#   3. dist/echoes-of-doom.html is not older than js/ css/ assets/ index.html
#      (a stale dist means someone forgot build-single-file.js)
#
# ASCII only (PowerShell 5.1 reads a BOM-less UTF-8 .ps1 as GBK).
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$proj = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Push-Location -LiteralPath $proj
try {
    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw "git rev-parse failed - is this a git repo?" }
    if ($branch -ne "main") { throw "you are on '$branch', not 'main'" }

    $dirty = @(& git status --porcelain)
    if ($dirty.Count -gt 0) {
        Write-Host "working tree is NOT clean:"
        $dirty | ForEach-Object { Write-Host ("  " + $_) }
        throw "commit or stash the changes first"
    }
    Write-Host "check 1/3 ok: branch is main, working tree clean"

    $dist = Join-Path $proj "dist\echoes-of-doom.html"
    if (-not (Test-Path -LiteralPath $dist)) {
        throw "dist\echoes-of-doom.html is missing - run: .\tools\run.ps1 .\tools\build-single-file.js"
    }
    $distTime = (Get-Item -LiteralPath $dist).LastWriteTimeUtc

    $sources = @()
    $sources += Get-ChildItem -LiteralPath (Join-Path $proj "js") -Recurse -File
    $sources += Get-ChildItem -LiteralPath (Join-Path $proj "css") -Recurse -File
    $sources += Get-ChildItem -LiteralPath (Join-Path $proj "assets") -Recurse -File
    $sources += Get-Item -LiteralPath (Join-Path $proj "index.html")
    $newest = $sources | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if ($newest -and ($newest.LastWriteTimeUtc -gt $distTime)) {
        $rel = $newest.FullName.Substring($proj.Length + 1)
        throw ("dist is OLDER than " + $rel + " - run: .\tools\run.ps1 .\tools\build-single-file.js")
    }
    Write-Host "check 2/3 ok: dist is not older than js / css / assets / index.html"

    $aheadRaw = (& git rev-list --count "origin/main..HEAD" 2>$null)
    $ahead = -1
    if ($aheadRaw) {
        try { $ahead = [int]([string]$aheadRaw).Trim() } catch { $ahead = -1 }
    }
    $head = (& git rev-parse --short HEAD).Trim()
    if ($ahead -ge 0) {
        Write-Host ("check 3/3 ok: " + $ahead + " commit(s) ahead of origin/main, HEAD " + $head)
    } else {
        Write-Host "check 3/3 warning: cannot read origin/main locally, will still try to push"
    }

    if ($ahead -eq 0) {
        Write-Host "nothing to push - already up to date"
        exit 0
    }

    if ($DryRun) {
        Write-Host "dry run: every check passed, nothing was pushed"
        exit 0
    }

    Write-Host "pushing to origin main ..."
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed (exit code $LASTEXITCODE)" }
    Write-Host "done: pushed to origin/main"
}
finally {
    Pop-Location
}
