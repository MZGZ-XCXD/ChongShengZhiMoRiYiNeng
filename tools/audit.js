/*
 * 配置体检（避坑清单 2.7 / 3 / 7）：
 *   · id 引用完整性：羁绊 / 地点 / 设施 / 异能 / 战斗 / 末日 里引用的 id 是否都存在
 *   · 依赖链死循环：设施前置、空间技能前置（假设自己一无所有地推一遍）
 *   · 门槛可达性：任何「出现条件」用到的数值，玩家能不能真的达到
 *   · 数值极值：恶性事件强度 vs 防御、重生点收益、结晶收支
 *
 * 用法（在项目目录下）：tools\run.ps1 tools\audit.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'js', 'config'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const CFG = path.join(ROOT, 'js', 'config');

const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of fs.readdirSync(CFG).sort()) {
    if (!/\.js$/.test(f) || f === 'changelog.js') continue;
    vm.runInContext(fs.readFileSync(path.join(CFG, f), 'utf8'), ctx, { filename: f });
}
const grab = expr => vm.runInContext(expr, ctx);

const RES = grab('Object.keys(RESOURCES_CONFIG)');
const FAC = grab('FACILITIES_CONFIG');
const FAC_ORDER = grab('FACILITIES_ORDER');
const LOC = grab('LOCATIONS_CONFIG');
const BONDS = grab('BONDS_CONFIG');
const EVENTS = grab('EVENTS_CONFIG');
const STORY = grab('STORY_CONFIG');
const SKILLS = grab('SPACE_SKILLS');
const SHOP = grab('REBIRTH_SHOP');
const ACH = grab('ACHIEVEMENTS_CONFIG');
const ABIL = grab('SECOND_ABILITIES');
const TIERS = grab('ABILITY_TIERS');
const BATTLES = grab('BATTLES_CONFIG');
const DOOMS = grab('DOOMS_CONFIG');
const BASES = grab('BASES_CONFIG');
const SPACE_LEVELS = grab('SPACE_LEVELS');

const resSet = new Set(RES);
const facIds = new Set(Object.keys(FAC));
const locIds = new Set(LOC.map(l => l.id));
const bondIds = new Set(BONDS.map(b => b.id));
const abilities = new Set(Object.keys(ABIL));
const problems = [];
const notes = [];
const VALID_OUTCOME = ['ally', 'partner', 'enemy', 'dead', 'left', 'neutral'];

function bad(msg) { problems.push(msg); }
function note(msg) { notes.push(msg); }

/* ---------- 1. 资源名 ---------- */
function checkResMap(map, where) {
    for (const k in (map || {})) if (!resSet.has(k)) bad(where + ' 用了未知资源：' + k);
}

/* ---------- 2. 地点 ---------- */
for (const l of LOC) {
    for (const x of l.loot) checkResMap({ [x.res]: 1 }, 'LOCATIONS.' + l.id + '.loot');
    if (l.bond && !bondIds.has(l.bond)) bad('LOCATIONS.' + l.id + ' 指向不存在的羁绊：' + l.bond);
    if (l.event && !EVENTS.some(e => e.id === l.event)) bad('LOCATIONS.' + l.id + ' 指向不存在的事件：' + l.event);
}
for (const d in DOOMS) {
    for (const id of (DOOMS[d].disabledLocations || [])) {
        if (!locIds.has(id)) bad('DOOMS.' + d + '.disabledLocations 里有不存在的点：' + id);
    }
    checkResMap(DOOMS[d].lootBias, 'DOOMS.' + d + '.lootBias');
    const mods = DOOMS[d].mods || {};
    checkResMap(mods.upkeep, 'DOOMS.' + d + '.mods.upkeep');
    checkResMap(mods.resourceProd, 'DOOMS.' + d + '.mods.resourceProd');
    for (const fid in (mods.facility || {})) if (!facIds.has(fid)) bad('DOOMS.' + d + ' 的 facility 规则指向不存在的设施：' + fid);
}

/* ---------- 3. 羁绊 ---------- */
for (const b of BONDS) {
    if (b.locate && b.locate.location && !locIds.has(b.locate.location)) bad('BONDS.' + b.id + ' 的相遇地点不存在：' + b.locate.location);
    if (b.locate && b.locate.event && !EVENTS.some(e => e.id === b.locate.event)) bad('BONDS.' + b.id + ' 的相遇事件不存在：' + b.locate.event);
    if (b.gift && !resSet.has(b.gift.res)) bad('BONDS.' + b.id + '.gift 用了未知资源：' + b.gift.res);
    if (b.giftLike && !resSet.has(b.giftLike.res)) bad('BONDS.' + b.id + '.giftLike 用了未知资源：' + b.giftLike.res);
    if (b.assist && b.assist.at > 100) bad('BONDS.' + b.id + '.assist.at 超过好感上限 100');
    if (b.crossroad && b.crossroad.at > 100 && b.crossroad.at !== 999) bad('BONDS.' + b.id + '.crossroad.at 超过好感上限 100');
    const blocks = [['meet', b.meet], ['crossroad', b.crossroad]];
    for (const [kind, block] of blocks) {
        if (!block || !block.choices) continue;
        block.choices.forEach((ch, i) => checkChoice(ch, 'BONDS.' + b.id + '.' + kind + '[' + i + ']'));
    }
}

/* ---------- 4. 事件 / 剧情 ---------- */
EVENTS.forEach(ev => {
    if (ev.bond && !bondIds.has(ev.bond)) bad('EVENTS.' + ev.id + ' 指向不存在的羁绊：' + ev.bond);
    ev.choices.forEach((ch, i) => checkChoice(ch, 'EVENTS.' + ev.id + '[' + i + ']'));
});
Object.keys(STORY).forEach(id => {
    const st = STORY[id];
    if (st.location && !locIds.has(st.location)) bad('STORY.' + id + ' 的地点不存在：' + st.location);
    (st.choices || []).forEach((ch, i) => checkChoice(ch, 'STORY.' + id + '[' + i + ']'));
});

function checkChoice(ch, where) {
    checkResMap(ch.cost, where + '.cost');
    checkResMap(ch.gain, where + '.gain');
    if (ch.value !== undefined && Math.abs(ch.value) > 60) bad(where + '.value 太大（' + ch.value + '）');
    if (ch.outcome && VALID_OUTCOME.indexOf(ch.outcome) < 0) bad(where + '.outcome 不是合法走向：' + ch.outcome);
    if (ch.meet && !bondIds.has(ch.meet)) bad(where + '.meet 指向不存在的羁绊：' + ch.meet);
    if (ch.bonds) for (const k in ch.bonds) {
        if (!bondIds.has(k)) bad(where + '.bonds 指向不存在的羁绊：' + k);
        if (VALID_OUTCOME.indexOf(ch.bonds[k]) < 0) bad(where + '.bonds 里方向不合法：' + ch.bonds[k]);
    }
    if (ch.unlock) for (const id of ch.unlock) if (!locIds.has(id)) bad(where + '.unlock 指向不存在的地点：' + id);
    if (ch.facility) for (const id in ch.facility) if (!facIds.has(id)) bad(where + '.facility 指向不存在的设施：' + id);
    if (ch.battle && !BATTLES[ch.battle]) bad(where + '.battle 指向不存在的战斗：' + ch.battle);
    if (ch.duel && !BATTLES[ch.duel]) bad(where + '.duel 指向不存在的战斗：' + ch.duel);
    if (ch.gamble && !bondIds.has(ch.gamble)) bad(where + '.gamble 指向不存在的羁绊：' + ch.gamble);
}

/* ---------- 5. 设施：前置 id、死循环、据点等级 ---------- */
for (const id of FAC_ORDER) if (!FAC[id]) bad('FACILITIES_ORDER 里有不存在的设施：' + id);
for (const id in FAC) {
    const f = FAC[id];
    if (FAC_ORDER.indexOf(id) < 0) bad('设施没写进 FACILITIES_ORDER：' + id);
    if (f.maxLevel < 1) bad('设施 ' + id + ' 的 maxLevel 不合法');
    for (const r of (f.req || [])) {
        if (!facIds.has(r[0])) bad('设施 ' + id + ' 的前置不存在：' + r[0]);
        if (r[1] > FAC[r[0]].maxLevel) bad('设施 ' + id + ' 要求 ' + r[0] + ' Lv' + r[1] + '，超过了它的满级 ' + FAC[r[0]].maxLevel);
    }
    for (const ra of (f.reqAt || [])) {
        if (ra.level > f.maxLevel) bad('设施 ' + id + ' 的 reqAt 写在 Lv' + ra.level + '，超过了它的满级 ' + f.maxLevel);
        if (ra.level < 1) bad('设施 ' + id + ' 的 reqAt 等级不合法：' + ra.level);
        for (const r of (ra.req || [])) {
            if (!facIds.has(r[0])) bad('设施 ' + id + ' 在 Lv' + ra.level + ' 的前置不存在：' + r[0]);
            if (r[1] > FAC[r[0]].maxLevel) bad('设施 ' + id + ' 在 Lv' + ra.level + ' 要求 ' + r[0] + ' Lv' + r[1] + '，超过满级');
        }
        note('分级前置：' + f.name + ' Lv' + ra.level + ' 起需要 ' +
            (ra.req || []).map(r => (FAC[r[0]] ? FAC[r[0]].name : r[0]) + ' Lv' + r[1]).join('、'));
    }
    if (f.tier < 1 || f.tier > BASES[BASES.length - 1].tier) bad('设施 ' + id + ' 的 tier 没有据点能建');
    for (let lv = 1; lv <= f.maxLevel; lv++) {
        const c = f.cost(lv);
        if (!c || !Object.keys(c).length) bad('设施 ' + id + ' Lv' + lv + ' 没有成本');
        if (f.produce) { const p = f.produce(lv); if (!p) bad('设施 ' + id + ' Lv' + lv + ' 的产出是空的'); }
    }
}

/* 死循环检查：把每个设施当作「必须先有别人」的图，走一遍能不能全部到达 */
{
    const done = new Set();
    let progress = true;
    while (progress) {
        progress = false;
        for (const id in FAC) {
            if (done.has(id)) continue;
            const need = (FAC[id].req || []).concat((FAC[id].reqAt || []).reduce((a, x) => a.concat(x.req || []), []));
            const ok = need.every(r => done.has(r[0]));
            if (ok) { done.add(id); progress = true; }
        }
    }
    for (const id in FAC) if (!done.has(id)) bad('设施前置成环（永远建不出来）：' + id);
}

/* ---------- 6. 空间技能：前置 / 等级 / 重生次数 ---------- */
{
    const maxLevelWithRebirth = SPACE_LEVELS.length + 3 * 2;
    const doneSkills = new Set();
    let progress = true;
    while (progress) {
        progress = false;
        for (const id in SKILLS) {
            if (doneSkills.has(id)) continue;
            if ((SKILLS[id].req || []).every(r => doneSkills.has(r))) { doneSkills.add(id); progress = true; }
        }
    }
    for (const id in SKILLS) {
        const s = SKILLS[id];
        if (!doneSkills.has(id)) bad('空间技能前置成环：' + id);
        for (const r of (s.req || [])) if (!SKILLS[r]) bad('空间技能 ' + id + ' 的前置不存在：' + r);
        if (s.reqLevel > maxLevelWithRebirth) bad('空间技能 ' + id + ' 要求 Lv' + s.reqLevel + '，超过上限 ' + maxLevelWithRebirth);
        if (s.reqRebirth > 3) bad('空间技能 ' + id + ' 要求重生 ' + s.reqRebirth + ' 次，太深了');
        if (!s.effect) bad('空间技能 ' + id + ' 没有效果');
    }
}

/* ---------- 7. 第二异能 / 抽卡 ---------- */
{
    let weights = 0;
    for (const t in TIERS) weights += TIERS[t].weight;
    for (const id in ABIL) {
        const a = ABIL[id];
        if (!TIERS[a.tier]) bad('异能 ' + id + ' 的等级不存在：' + a.tier);
        if (!a.effect) bad('异能 ' + id + ' 没有效果');
    }
    for (const t in TIERS) {
        const n = Object.keys(ABIL).filter(id => ABIL[id].tier === t).length;
        if (!n) bad('等级 ' + t + ' 的卡池是空的');
        note('卡池 ' + t + '：' + n + ' 个（权重 ' + TIERS[t].weight + '，占比 ' +
            (TIERS[t].weight / weights * 100).toFixed(2) + '%）');
    }
}

/* ---------- 8. 重生商店 ---------- */
for (const it of SHOP) {
    if (!it.desc) bad('重生商店 ' + it.id + ' 没有说明');
    if (!it.effect && !it.gift && !it.special && !it.specials) bad('重生商店 ' + it.id + ' 什么都不做');
    for (let lv = 1; lv <= it.maxLevel; lv++) {
        if (typeof it.cost(lv) !== 'number') bad('重生商店 ' + it.id + ' Lv' + lv + ' 价格不是数字');
        if (it.effect && typeof it.effect(lv) !== 'object') bad('重生商店 ' + it.id + ' Lv' + lv + ' 的 effect 不是对象');
    }
}

/* ---------- 9. 成就 ---------- */
for (const a of ACH) {
    if (typeof a.cond !== 'function') bad('成就 ' + a.id + ' 没有条件函数');
    if (!a.crystal || a.crystal < 1) bad('成就 ' + a.id + ' 没有结晶奖励');
    if (ACH.filter(x => x.id === a.id).length !== 1) bad('成就 id 重复：' + a.id);
}
const totalCrystal = ACH.reduce((n, a) => n + (a.crystal || 0), 0);
note('成就一共给 ' + totalCrystal + ' 颗异能结晶');

/* ---------- 10. 数值极值：袭击强度 vs 可达防御 ---------- */
function facFlat(ids) {
    let flat = 0;
    for (const id of ids) {
        const f = FAC[id];
        if (!f || !f.effect) continue;
        const e = f.effect(f.maxLevel);
        flat += (e.defenseFlat || 0);
    }
    return flat;
}
function estimateDefense(baseIdx, skillBonus, shopBonus, combatAbility) {
    const base = BASES[baseIdx].defense;
    const flat = facFlat(['doorReinforce', 'fence', 'wall', 'tower', 'traps', 'armory', 'toolbox', 'camera', 'clinic']);
    const combat = 6 + 10 * 4 + combatAbility;              // 空间 Lv10 + 第二异能战力
    const pct = 1 + skillBonus + shopBonus;                 // 技能与重生商店的百分比
    const morale = 0.85 + 72 / 100 * 0.3;
    return Math.round((base + combat * 0.8 + flat) * pct * morale);
}
function raidStrength(doomId, hours, rebirth) {
    const doom = DOOMS[doomId];
    const apoc = Math.max(0, hours - 72);
    const timeFactor = 1 + Math.sqrt(apoc / 6);
    return Math.round(14 * (doom.raidPower || 1) * timeFactor * (1 + rebirth * 0.28) *
        (1 + (BASES[0].raidPower || 0)));
}
{
    const phases = [
        { label: '爆发初期 90 小时', hours: 90, tab: '（公寓 + 门窗加固 Lv2 左右）' },
        { label: '末日 200 小时', hours: 200, tab: '' },
        { label: '末日 400 小时', hours: 400, tab: '' },
        { label: '末日 800 小时', hours: 800, tab: '' },
        { label: '末日 1600 小时（约 66 天）', hours: 1600, tab: '' },
    ];
    for (const p of phases) {
        const row = Object.keys(DOOMS).map(d => d + ' ' + raidStrength(d, p.hours, 0) +
            (raidStrength(d, p.hours, 3) !== raidStrength(d, p.hours, 0) ? '/' + raidStrength(d, p.hours, 3) : ''));
        note('强度 ' + p.label + '：' + row.join('，'));
    }
    const early = Math.round((BASES[0].defense + (6 + 3 * 4) * 0.8 + (FAC.doorReinforce.effect(2).defenseFlat || 0)) * (0.85 + 0.6 * 0.3));
    note('参考防御：只修门窗加固的公寓约 ' + early + '（勉强顶住爆发初期的一次袭击）');
    note('参考防御：小区满工事 + 空间 Lv10 + B 级异能约 ' + estimateDefense(1, 0.2, 0.3, 18));
    note('参考防御：避难所满工事 + 深层技能 + 商店约 ' + estimateDefense(3, 1.0, 0.5, 95) +
        '（对比上面 1600 小时的强度，仍然要靠技能与商店才能长期守住）');
}

/* ---------- 11. 结晶收支：整条成长线要多少、一轮能来多少 ---------- */
{
    let skillCost = 0;
    for (const id in SKILLS) skillCost += SKILLS[id].cost;
    let spaceCost = 0;
    for (const row of SPACE_LEVELS) spaceCost += row.cost;
    let expected = 0;
    for (const l of LOC) {
        if (!l.rare) continue;
        let per = 0;
        for (const r of l.rare) per += (r.w * 0.025) * ((r.min + r.max) / 2);
        expected += per / LOC.length;
    }
    expected += 0.12;      // 每个地点都可能摸到的碎片
    const perRunScavenges = 150;
    note('结晶支出：空间 Lv1→12 共 ' + spaceCost + ' 颗，技能树全解锁共 ' + skillCost + ' 颗（合计 ' + (spaceCost + skillCost) + '）');
    note('结晶收入：成就一次性 ' + totalCrystal + ' 颗；搜刮稀有掉落期望约 ' + expected.toFixed(3) +
        ' 颗/次，一轮 150 次约 ' + Math.round(expected * perRunScavenges) + ' 颗（外加战斗与事件）');
    note('结论：技能树是长期目标，需要多轮积累（结晶跨重生保留，不会白攒）');
}

/* ---------- 报告 ---------- */
console.log('=== 配置体检 ===');
console.log('资源 ' + RES.length + ' 种 / 设施 ' + Object.keys(FAC).length + ' 项 / 地点 ' + LOC.length +
    ' 个 / 羁绊 ' + BONDS.length + ' 人 / 事件 ' + EVENTS.length + ' 个 / 成就 ' + ACH.length +
    ' 项 / 重生商店 ' + SHOP.length + ' 项 / 异能 ' + Object.keys(ABIL).length + ' 种');
console.log('');
notes.forEach(n => console.log('· ' + n));
console.log('');
if (problems.length) {
    console.log('!! 发现 ' + problems.length + ' 个问题：');
    problems.forEach(p => console.log('   - ' + p));
    process.exitCode = 1;
} else {
    console.log('OK：引用完整、前置链没有死循环、数值门槛都在可达范围内。');
}

