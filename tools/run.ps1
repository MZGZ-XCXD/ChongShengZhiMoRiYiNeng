# Runs a Node script inside the Codex sandbox (workspace root must stay read-only safe).
#
# Why not `node script.js`? In this sandbox node's realpath() is blocked and it dies with
#   EPERM: operation not permitted, lstat 'C:\Users\...'
# The reliable pattern is node -e + vm.runInThisContext.
#
# Usage (from the project directory):
#   .\tools\run.ps1 .\tools\scan-effect-keys.js
#   .\tools\run.ps1 ..\..\work\syntax-check.js
param(
    [Parameter(Mandatory = $true, Position = 0)][string]$Script,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$full = (Resolve-Path -LiteralPath $Script).Path
$env:SCRIPT = $full
$env:PROJ_ROOT = (Get-Location).Path
if ($Rest -and $Rest.Count -gt 0) { $env:SCRIPT_ARGS = ($Rest -join "`n") } else { $env:SCRIPT_ARGS = "" }
$code = @'
const fs = require('fs'), path = require('path'), vm = require('vm');
const file = process.env.SCRIPT;
const raw = fs.readFileSync(file, 'utf8');
// 带 #! 的脚本包进函数会语法报错，先把 shebang 换成等长注释（行号不变）
const src = raw.charAt(0) === '#' && raw.charAt(1) === '!' ? raw.replace(/^#![^\n]*/, function (m) { return '//' + m.slice(2); }) : raw;
const extra = (process.env.SCRIPT_ARGS || '').split('\n').filter(function (s) { return s !== ''; });
if (extra.length) { process.argv = [process.argv[0] || 'node', file].concat(extra); }
const wrapped = '(function (require, module, exports, __filename, __dirname) {\n' + src + '\n})';
const fn = vm.runInThisContext(wrapped, { filename: path.basename(file) });
const mod = { exports: {} };
fn(require, mod, mod.exports, file, path.dirname(file));
'@
& node -e $code
exit $LASTEXITCODE
