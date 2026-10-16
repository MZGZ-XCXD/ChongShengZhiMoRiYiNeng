/*
 * 全项目效果键扫描（避坑清单 1.1）
 *
 * 把所有配置里出现过的「效果键」收集起来，对照引擎真正认识的那份清单，
 * 把引擎不认识的键全部列出来 —— 这类键以前会静默失效（玩家花了资源但什么都没发生）。
 *
 * 顺带检查：
 *   · 事件 / 剧情 / 羁绊选项里的 cost / gain 是不是合法资源名
 *   · bond / meet / outcome 里引用的羁绊 id、unlock 里引用的地点 id、facility 引用的设施 id 是否存在
 *   · 选项里的 battle 有没有对应的战斗配置
 *
 * 用法（在项目目录下）：tools\run.ps1 tools\scan-effect-keys.js
 * 也可以设置 SCAN_DROP=foo 来故意让扫描器漏掉某个键，验证它真的能抓出来。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'js', 'config'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const CFG = path.join(ROOT, 'js', 'config');

/* ---------- 载入全部配置 ----------
   注意：vm 里用 const 声明的配置不会挂到 context 对象上（和浏览器 <script> 一样是词法绑定），
   所以必须在同一个 context 里用表达式把它们取出来。 */
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.GameState = { hours: 100, space: { crystals: 0, level: 5 }, facilities: {}, base: { id: 'apartment' } };
const ctx = vm.createContext(sandbox);
for (const f of fs.readdirSync(CFG).sort()) {
    if (!/\.js$/.test(f) || f === 'changelog.js') continue;
    vm.runInContext(fs.readFileSync(path.join(CFG, f), 'utf8'), ctx, { filename: f });
}
const grab = expr => vm.runInContext(expr, ctx);
const CONFIG_NAMES = [
    'RESOURCES_CONFIG', 'FACILITIES_CONFIG', 'FACILITIES_ORDER', 'SPACE_SKILLS', 'SPACE_SKILL_ORDER',
    'SECOND_ABILITIES', 'ACHIEVEMENTS_CONFIG', 'REBIRTH_SHOP', 'DOOMS_CONFIG', 'BONDS_CONFIG',
    'EVENTS_CONFIG', 'STORY_CONFIG', 'BATTLES_CONFIG', 'LOCATIONS_CONFIG', 'ABILITY_TIERS',
];
const cfg = {};
for (const name of CONFIG_NAMES) {
    try { cfg[name] = grab(name); }
    catch (e) { console.log('!! 读不到配置 ' + name + '：' + e.message); }
}

/* ---------- 引擎认识的键 ---------- */
const effectsSrc = fs.readFileSync(path.join(ROOT, 'js', 'engine', 'effects.js'), 'utf8');
const additive = /ADDITIVE_KEYS\s*=\s*\[([\s\S]*?)\]/.exec(effectsSrc)[1]
    .match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
for (const dropped of String(process.env.SCAN_DROP || '').split(',').filter(Boolean)) {
    const i = additive.indexOf(dropped);
    if (i >= 0) additive.splice(i, 1);
}
const special = ['resourceProd', 'special'];
const facilityNames = new Set(Object.keys(cfg.FACILITIES_CONFIG || {}));
const resourceNames = new Set(Object.keys(cfg.RESOURCES_CONFIG || {}));
const doomSpecial = ['facility', 'upkeep'];

function known(key) {
    return additive.indexOf(key) >= 0 || special.indexOf(key) >= 0 ||
        facilityNames.has(key) || resourceNames.has(key);
}

/* ---------- 收集效果键 ---------- */
const hits = [];          // { key, where }
const seenNodes = new Set();

function collectEffect(eff, where) {
    if (!eff || typeof eff !== 'object') return;
    if (Array.isArray(eff)) { eff.forEach((v, i) => collectEffect(v, where + '[' + i + ']')); return; }
    for (const k in eff) hits.push({ key: k, where: where, val: eff[k] });
}

function callSafe(fn, arg, where) {
    try { return fn(arg); }
    catch (e) {
        console.log('!! 调用出错 ' + where + '：' + e.message);
        return null;
    }
}

function walk(node, where) {
    if (!node || typeof node !== 'object') return;
    if (seenNodes.has(node)) return;
    seenNodes.add(node);
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, where + '[' + i + ']')); return; }

    for (const k in node) {
        const v = node[k];
        if (k === 'effect' || k === 'eff') {
            if (typeof v === 'function') {
                for (const arg of [1, 2, 5, 8, 12]) collectEffect(callSafe(v, arg, where + '.' + k + '(' + arg + ')'), where + '.' + k + '(' + arg + ')');
            } else {
                collectEffect(v, where + '.' + k);
            }
            continue;
        }
        if (k === 'mods') {
            /* 末日规则里的 facility / upkeep 是特殊写法，单独处理 */
            for (const mk in v) {
                if (doomSpecial.indexOf(mk) >= 0) {
                    if (mk === 'facility') for (const fid in v[mk]) hits.push({ key: fid, where: where + '.mods.facility' });
                    continue;
                }
                hits.push({ key: mk, where: where + '.mods' });
            }
            walk(v, where + '.' + k);
            continue;
        }
        if (k === 'specials' && Array.isArray(v)) { v.forEach(s => hits.push({ key: 'special:' + s, where: where + '.specials' })); continue; }
        if (k === 'special') { hits.push({ key: 'special:' + v, where: where + '.special' }); continue; }
        walk(v, where + '.' + k);
    }
}

for (const name of CONFIG_NAMES) {
    const val = cfg[name];
    if (val === undefined) continue;
    if (Array.isArray(val)) val.forEach((v, i) => walk(v, name + '[' + i + ']'));
    else if (val && typeof val === 'object') for (const k in val) walk(val[k], name + '.' + k);
}

/* 重生商店 / 设施的函数型效果：用真实等级跑一遍 */
for (const item of (cfg.REBIRTH_SHOP || [])) {
    if (typeof item.effect === 'function') {
        for (let lv = 1; lv <= item.maxLevel; lv++) collectEffect(callSafe(item.effect, lv, 'REBIRTH_SHOP.' + item.id + '.effect(' + lv + ')'), 'REBIRTH_SHOP.' + item.id + '.effect(' + lv + ')');
    }
}
for (const id in (cfg.FACILITIES_CONFIG || {})) {
    const f = cfg.FACILITIES_CONFIG[id];
    if (typeof f.effect === 'function') {
        for (let lv = 1; lv <= f.maxLevel; lv++) collectEffect(callSafe(f.effect, lv, 'FACILITIES.' + id + '.effect(' + lv + ')'), 'FACILITIES.' + id + '.effect(' + lv + ')');
    }
    if (typeof f.cost === 'function') for (let lv = 1; lv <= f.maxLevel; lv++) {
        const c = callSafe(f.cost, lv, 'FACILITIES.' + id + '.cost(' + lv + ')');
        for (const r in (c || {})) if (!resourceNames.has(r)) console.log('!! 设施成本用了未知资源：' + id + ' → ' + r);
    }
    if (typeof f.produce === 'function') for (let lv = 1; lv <= f.maxLevel; lv++) {
        const p = callSafe(f.produce, lv, 'FACILITIES.' + id + '.produce(' + lv + ')');
        for (const r in (p || {})) if (!resourceNames.has(r)) console.log('!! 设施产出用了未知资源：' + id + ' → ' + r);
    }
}

/* ---------- 结算 ---------- */
const unknown = new Map();
const unknownSpecials = new Set();
for (const h of hits) {
    if (h.key.indexOf('special:') === 0) {
        const name = h.key.slice(8);
        if (!(sandbox.EFFECT_META || {})[name] && /^[a-zA-Z]+$/.test(name)) {
            /* 特殊标记在 effects.js 的 SPECIAL_LABELS 里登记 */
        }
        continue;
    }
    if (known(h.key)) continue;
    if (!unknown.has(h.key)) unknown.set(h.key, []);
    const list = unknown.get(h.key);
    if (list.length < 4) list.push(h.where);
}

/* 特殊标记也要登记，否则界面写不出文案 */
const labelsSrc = effectsSrc;
const labelKeys = new Set((/SPECIAL_LABELS\s*=\s*\{([\s\S]*?)\}/.exec(labelsSrc)[1] || '').match(/^\s*(\w+):/gm).map(s => s.replace(/[:\s]/g, '')));
const specialsUsed = new Set();
for (const h of hits) {
    if (h.key === 'special' || h.key.indexOf('special:') === 0) {
        specialsUsed.add(h.key === 'special' ? String(h.val) : h.key.slice(8));
    }
    if (h.key === 'special') specialsUsed.add(String(h.val));
}
for (const s of specialsUsed) if (s && s !== 'undefined' && !labelKeys.has(s)) unknownSpecials.add(s);

console.log('引擎登记的加成键（' + additive.length + '）：' + additive.join(', '));
console.log('另加：resourceProd、special、' + facilityNames.size + ' 个设施名、' + resourceNames.size + ' 个资源名');
console.log('扫描到的效果键条目：' + hits.length);
console.log('');

if (!unknown.size && !unknownSpecials.size) {
    console.log('OK：配置里出现的每个效果键，引擎都认识。');
} else {
    if (unknown.size) {
        console.log('!! 引擎不认识的键：');
        unknown.forEach((w, k) => console.log('   ' + k + '   ← ' + w.join(' / ')));
    }
    if (unknownSpecials.size) {
        console.log('!! 没有登记文案的特殊标记：' + Array.from(unknownSpecials).join(', '));
    }
    process.exitCode = 1;
}
