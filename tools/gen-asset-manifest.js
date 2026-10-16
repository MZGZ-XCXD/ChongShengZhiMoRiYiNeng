/*
 * 扫描 assets/ 目录，生成 js/config/assets.js（图片清单）。
 *
 * 约定（文件名就是 id，扩展名看下面优先级）：
 *   assets/portraits/<羁绊id>.png   立绘       建议 768×1024（3:4），背景透明或深色
 *   assets/scenes/<地点id>.jpg      地点背景   建议 1280×720（16:9）
 *   assets/dooms/<末日id>.jpg       末日氛围图 建议 1280×720（doom/ 也认）
 * 支持 .webp / .png / .jpg / .jpeg，同 id 有多个时按 webp > png > jpg 取。
 *
 * 用法（在项目目录下）：tools\run.ps1 tools/gen-asset-manifest.js
 * 没有图片也能跑：清单会是空的，界面上会画「档案占位框」，不会报错。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'js', 'config'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'js', 'config', 'assets.js');
const EXTS = ['.webp', '.png', '.jpg', '.jpeg'];

/* ---- 从配置里取合法 id ---- */
const CFG = path.join(ROOT, 'js', 'config');
const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of fs.readdirSync(CFG).sort()) {
    if (!/\.js$/.test(f) || f === 'changelog.js' || f === 'assets.js') continue;
    vm.runInContext(fs.readFileSync(path.join(CFG, f), 'utf8'), ctx, { filename: f });
}
const grab = expr => vm.runInContext(expr, ctx);
const ids = {
    portraits: grab('BONDS_CONFIG').map(b => b.id),
    scenes: grab('LOCATIONS_CONFIG').map(l => l.id),
    dooms: Object.keys(grab('DOOMS_CONFIG')),
};

/* ---- 扫描 ---- */
/* 目录名容错：末日氛围图的目录早期文档里写成 assets/doom/，两种拼法都认 */
const DIR_ALIASES = { portraits: ['portraits'], scenes: ['scenes'], dooms: ['dooms', 'doom'] };

function scan(kind) {
    const found = {};
    const unknown = [];
    const dirs = (DIR_ALIASES[kind] || [kind]).filter(function (d) {
        return fs.existsSync(path.join(ASSETS, d));
    });
    for (const sub of dirs) {
        for (const name of fs.readdirSync(path.join(ASSETS, sub))) {
            const ext = path.extname(name).toLowerCase();
            if (EXTS.indexOf(ext) < 0) continue;
            const id = path.basename(name, ext);
            if (ids[kind].indexOf(id) < 0) { unknown.push(name); continue; }
            /* 同 id 多格式时按优先级取第一个 */
            const rank = EXTS.indexOf(ext);
            if (found[id] && found[id].rank <= rank) continue;
            found[id] = { rank: rank, path: 'assets/' + sub + '/' + name };
        }
    }
    return { found: found, unknown: unknown };
}

const res = { portraits: scan('portraits'), scenes: scan('scenes'), dooms: scan('dooms') };
const manifest = {
    generated: new Date().toISOString().slice(0, 10),
    portraits: {}, scenes: {}, dooms: {},
};
for (const kind of ['portraits', 'scenes', 'dooms']) {
    for (const id in res[kind].found) manifest[kind][id] = res[kind].found[id].path;
}

const js = '/* 由 tools/gen-asset-manifest.js 自动生成，请勿直接编辑。\n' +
    '   往 assets/ 里丢图之后重新跑一次脚本即可（再跑一次 tools/build-single-file.js）。 */\n' +
    'window.ASSET_MANIFEST = ' + JSON.stringify(manifest, null, 4) + ';\n';
fs.writeFileSync(OUT, js);

/* ---- 报告 ---- */
const count = k => Object.keys(manifest[k]).length;
console.log('图片清单：立绘 ' + count('portraits') + '/' + ids.portraits.length +
    '，地点背景 ' + count('scenes') + '/' + ids.scenes.length +
    '，末日氛围 ' + count('dooms') + '/' + ids.dooms.length);
console.log('已写入 ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
for (const kind of ['portraits', 'scenes', 'dooms']) {
    const missing = ids[kind].filter(id => !manifest[kind][id]);
    if (missing.length) console.log('· 还缺 ' + kind + '：' + missing.join('、'));
    if (res[kind].unknown.length) console.log('!! ' + kind + ' 里有对不上配置的文件名：' + res[kind].unknown.join('、'));
}
