/*
 * 环境自检：换一台电脑之后先跑这个，确认这台机器能不能把工程跑起来。
 *
 *   tools\run.ps1 tools\check-env.js
 *
 * 只读检查 + 一次写权限试探，不改动任何工程文件。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.PROJ_ROOT ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');

const lines = [];
let fails = 0;
let warns = 0;

function ok(msg, extra) {
    lines.push('  OK    ' + msg + (extra ? '   [' + extra + ']' : ''));
}
function warn(msg, extra) {
    warns++;
    lines.push('  WARN  ' + msg + (extra ? '   [' + extra + ']' : ''));
}
function fail(msg, extra) {
    fails++;
    lines.push('  FAIL  ' + msg + (extra ? '   [' + extra + ']' : ''));
}
function note(msg) {
    lines.push('  ·     ' + msg);
}

lines.push('======== 末日回声 · 环境自检 ========');
lines.push('工程目录：' + ROOT);
lines.push('');

/* ---- 1. 目录结构 ---- */
lines.push('[1] 工程结构');
const mustHave = [
    'index.html', 'css/style.css', 'README.md', 'CHANGELOG.md', 'AGENTS.md',
    'js/config/bonds.js', 'js/engine/state.js', 'js/ui/app.js',
    'tools/run.ps1', 'tools/lib-chrome.ps1', 'tools/build-single-file.js',
    'tools/check.ps1', 'tools/gen-changelog.js', 'tools/gen-asset-manifest.js',
];
const missing = mustHave.filter(function (f) { return !fs.existsSync(path.join(ROOT, f)); });
if (missing.length === 0) ok('三层结构 + 工具脚本齐全（' + mustHave.length + ' 项）');
else fail('缺少文件：' + missing.join('、'), '可能没复制全，或者解压不完整');

/* ---- 2. Node ---- */
lines.push('');
lines.push('[2] Node.js');
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major >= 18) ok('node ' + process.version);
else warn('node ' + process.version + ' 偏旧', '建议 18 或更高');
note('所有 node 脚本都要走 tools\\run.ps1 调用，别直接 node xxx.js（见 AGENTS.md）');

/* ---- 3. PowerShell ---- */
lines.push('');
lines.push('[3] PowerShell');
const ps = spawnSync('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' });
if (ps.status === 0 && ps.stdout) {
    const ver = String(ps.stdout).trim();
    ok('powershell ' + ver);
    if (parseInt(ver.split('.')[0], 10) < 5) warn('PowerShell 版本偏低', '脚本按 5.1 写的，建议升级');
} else {
    warn('读不到 PowerShell 版本号', '不影响使用（本脚本就是 PowerShell 拉起来的）');
}

/* ---- 4. 浏览器（无头自检与截图要用） ---- */
lines.push('');
lines.push('[4] Chrome / Edge（端到端自检、截图、图片入库要用）');
const browser = findBrowser();
if (browser) ok('找到了：' + browser);
else fail('没找到 Chrome 或 Edge', '装一个 Chrome，或把环境变量 CHROME_PATH 指向浏览器 exe');

/* ---- 5. 写权限 ---- */
lines.push('');
lines.push('[5] 写权限（自检会把临时页面和报告写进 work\\）');
const workDir = path.join(ROOT, 'work');
try {
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
    const probe = path.join(workDir, 'env-probe.tmp');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    ok('work\\ 可写');
} catch (e) {
    fail('work\\ 写不进去：' + e.message, '换个不是只读的位置放工程，或检查杀软拦截');
}

/* ---- 6. 出图用的 API Key（只看有没有，不打印内容） ---- */
lines.push('');
lines.push('[6] 出图用的 Gemini Key（只在真出图时用到，手动出图可忽略）');
const envKey = (process.env.GEMINI_API_KEY || '').trim();
const keyFile = path.join(workDir, 'gemini.key');
if (envKey) ok('环境变量 GEMINI_API_KEY 已设置', '长度 ' + envKey.length + '，不打印内容');
else if (fs.existsSync(keyFile)) ok('work\\gemini.key 存在', '长度 ' + String(fs.readFileSync(keyFile, 'utf8')).trim().length);
else warn('没有 Key', '设置环境变量 GEMINI_API_KEY，或把 key 写进 work\\gemini.key（一行）');
note('Key 不要写进命令行、不要提交到仓库：work\\ 已经在 .gitignore 里');

/* ---- 7. git ---- */
lines.push('');
lines.push('[7] 版本管理');
const gitVer = spawnSync('git', ['--version'], { encoding: 'utf8' });
if (gitVer.status === 0 && gitVer.stdout) ok(String(gitVer.stdout).trim());
else warn('没找到 git', '要建 GitHub 仓库的话先去装 Git for Windows');
if (fs.existsSync(path.join(ROOT, '.git'))) note('这个目录已经是 git 仓库了，注意别把 work\\ 提交上去');
else note('还不是 git 仓库（上线建库前版本号冻结在 0.1.0，见 CHANGELOG.md）');

/* ---- 8. 当前产物 ---- */
lines.push('');
lines.push('[8] 当前产物');
const dist = path.join(ROOT, 'dist', 'echoes-of-doom.html');
if (fs.existsSync(dist)) {
    ok('单文件版存在', Math.round(fs.statSync(dist).size / 1024) + ' KB —— 双击就能玩');
} else {
    warn('还没有单文件版', '跑 tools\\run.ps1 tools\\build-single-file.js 生成');
}
const portDir = path.join(ROOT, 'assets', 'portraits');
const sceneDir = path.join(ROOT, 'assets', 'scenes');
const count = function (d) {
    if (!fs.existsSync(d)) return 0;
    return fs.readdirSync(d).filter(function (f) { return /\.(png|jpg|jpeg|webp)$/i.test(f); }).length;
};
note('已有图片：立绘 ' + count(portDir) + ' 张、地点背景 ' + count(sceneDir) + ' 张（没图也能玩，界面画占位框）');

/* ---- 总结 ---- */
lines.push('');
lines.push('---- 结果 ----');
lines.push(fails === 0
    ? (warns === 0 ? '全部通过。接着跑：tools\\check.ps1' : '没有硬伤，' + warns + ' 条提醒（多半是可选依赖）。接着跑：tools\\check.ps1')
    : fails + ' 项没过，先把上面标 FAIL 的解决掉。');

console.log(lines.join('\n'));
if (fails > 0) process.exitCode = 1;

/* ---- 浏览器探测：与 tools/lib-chrome.ps1 保持同一套查找顺序 ---- */
function findBrowser() {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    const cands = [];
    if (process.env.CHROME_PATH) cands.push(process.env.CHROME_PATH);
    cands.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    cands.push(path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (local) cands.push(path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    cands.push(path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    cands.push(path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    if (local) cands.push(path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    for (const c of cands) {
        try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ }
    }
    for (const name of ['chrome.exe', 'msedge.exe']) {
        const r = spawnSync('where', [name], { encoding: 'utf8' });
        if (r.status === 0 && r.stdout) {
            const first = String(r.stdout).split(/\r?\n/).filter(Boolean)[0];
            if (first) return first.trim();
        }
    }
    return null;
}
