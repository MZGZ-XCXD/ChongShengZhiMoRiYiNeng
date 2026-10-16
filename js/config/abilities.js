/* 异能系统（纯数据）
   空间异能（S 级，主角自带，永远跟着你） + 第二异能（末日爆发后觉醒抽卡） */

/* 空间异能等级表：容量按「格」算；Lv 越高每一格能装的东西也越稳 */
const SPACE_LEVELS = [
    { lv: 1, cap: 120, cost: 0 },
    { lv: 2, cap: 220, cost: 5 },
    { lv: 3, cap: 380, cost: 10 },
    { lv: 4, cap: 620, cost: 18 },
    { lv: 5, cap: 1000, cost: 28 },
    { lv: 6, cap: 1550, cost: 42 },
    { lv: 7, cap: 2300, cost: 60 },
    { lv: 8, cap: 3400, cost: 82 },
    { lv: 9, cap: 5000, cost: 110 },
    { lv: 10, cap: 7200, cost: 145 },
    { lv: 11, cap: 10000, cost: 190 },
    { lv: 12, cap: 14000, cost: 245 },
];
/* 12 级之后按固定倍率继续长（重生次数越多，上限越高） */
const SPACE_LEVEL_GROWTH = { cap: 1.35, cost: 1.3 };
const SPACE_MAX_BASE = 12;

/* 空间异能技能树：结晶解锁。
   branch：vault 容积 / plunder 掠夺 / guard 守护 / void 虚空（需要重生次数） */
const SPACE_SKILLS = {
    vault1: {
        id: 'vault1', name: '结构扩张 I', icon: '🧱', branch: 'vault', cost: 6,
        req: [], reqLevel: 2, reqRebirth: 0,
        desc: '把空间的边界往外推一圈。容量 +35%。',
        effect: { spaceCap: 0.35 },
    },
    vault2: {
        id: 'vault2', name: '结构扩张 II', icon: '🧱', branch: 'vault', cost: 18,
        req: ['vault1'], reqLevel: 3, reqRebirth: 0,
        desc: '边界变得结实。容量再 +50%。',
        effect: { spaceCap: 0.5 },
    },
    vault3: {
        id: 'vault3', name: '结构扩张 III', icon: '🏗️', branch: 'vault', cost: 45,
        req: ['vault2'], reqLevel: 5, reqRebirth: 0,
        desc: '空间开始有自己的「形状」。容量再 +75%。',
        effect: { spaceCap: 0.75 },
    },
    vaultStable: {
        id: 'vaultStable', name: '稳定结构', icon: '🗄️', branch: 'vault', cost: 90,
        req: ['vault3'], reqLevel: 7, reqRebirth: 0,
        desc: '不再靠意志硬撑，容量直接 +2500 格。',
        effect: { spaceCapFlat: 2500 },
    },
    vaultDry: {
        id: 'vaultDry', name: '真空保鲜', icon: '🧊', branch: 'vault', cost: 30,
        req: ['vault2'], reqLevel: 4, reqRebirth: 0,
        desc: '空间里没有细菌也没有时间。食物与净水消耗 -18%。',
        effect: { foodUse: -0.18 },
    },
    plunder1: {
        id: 'plunder1', name: '空间感知', icon: '📡', branch: 'plunder', cost: 5,
        req: [], reqLevel: 1, reqRebirth: 0,
        desc: '能「摸到」附近的东西：预警时间 +2 小时，发现隐藏物资点的几率 +30%。',
        effect: { warning: 2, hiddenFind: 0.3 },
    },
    plunder2: {
        id: 'plunder2', name: '快速收纳', icon: '🫳', branch: 'plunder', cost: 16,
        req: ['plunder1'], reqLevel: 2, reqRebirth: 0,
        desc: '一挥手，半个货架就没了。每个地点的搜刮次数 +1。',
        effect: { scavengeUses: 1 },
    },
    plunder3: {
        id: 'plunder3', name: '物资解析', icon: '🔍', branch: 'plunder', cost: 32,
        req: ['plunder2'], reqLevel: 3, reqRebirth: 0,
        desc: '一眼就知道什么值钱。稀有掉落 +30%，搜刮产出 +10%。',
        effect: { lootLuck: 0.3, scavengeYield: 0.1 },
    },
    plunder4: {
        id: 'plunder4', name: '空间门', icon: '🚪', branch: 'plunder', cost: 60,
        req: ['plunder3'], reqLevel: 5, reqRebirth: 0,
        desc: '开一道短距离的门：地点刷新速度 +35%，建设成本 -10%。',
        effect: { scavengeRefresh: 0.35, buildCost: -0.1 },
    },
    plunder5: {
        id: 'plunder5', name: '活物领域', icon: '🐾', branch: 'plunder', cost: 95,
        req: ['plunder4'], reqLevel: 7, reqRebirth: 1,
        desc: '空间里能养活的，不只是东西。据点容纳 +35%，士气恢复 +0.05/小时。',
        effect: { residentCap: 0.35, moraleRate: 0.05 },
    },
    guard1: {
        id: 'guard1', name: '空间屏障', icon: '🛡️', branch: 'guard', cost: 8,
        req: [], reqLevel: 2, reqRebirth: 0,
        desc: '把空间压成一层看不见的墙。据点防御 +20%。',
        effect: { defense: 0.2 },
    },
    guard2: {
        id: 'guard2', name: '空间刃', icon: '🔪', branch: 'guard', cost: 22,
        req: ['guard1'], reqLevel: 3, reqRebirth: 0,
        desc: '一道薄到看不见的切口。战力 +10。',
        effect: { combatPowerFlat: 10 },
    },
    guard3: {
        id: 'guard3', name: '空间放逐', icon: '🌀', branch: 'guard', cost: 45,
        req: ['guard2'], reqLevel: 4, reqRebirth: 0,
        desc: '把冲在最前面的那批直接送走。恶性事件强度 -15%。',
        effect: { raidPower: -0.15 },
    },
    guard4: {
        id: 'guard4', name: '折叠囚笼', icon: '🧿', branch: 'guard', cost: 80,
        req: ['guard3'], reqLevel: 6, reqRebirth: 0,
        desc: '战场被折成一张纸。战力 +35%，恶性事件强度再 -10%。',
        effect: { combatPower: 0.35, raidPower: -0.1 },
    },
    void1: {
        id: 'void1', name: '次元口袋', icon: '🕳️', branch: 'void', cost: 150,
        req: ['vaultStable'], reqLevel: 9, reqRebirth: 1,
        desc: '第二层空间。容量翻倍（+100%）。',
        effect: { spaceCap: 1.0 },
    },
    void2: {
        id: 'void2', name: '虚无之刃', icon: '⚔️', branch: 'void', cost: 220,
        req: ['guard4'], reqLevel: 9, reqRebirth: 2,
        desc: '连光都会被切开的刃。战力 +30，防御 +15。',
        effect: { combatPowerFlat: 30, defenseFlat: 15 },
    },
    void3: {
        id: 'void3', name: '领域展开', icon: '🌌', branch: 'void', cost: 300,
        req: ['void1'], reqLevel: 10, reqRebirth: 2,
        desc: '以自己为中心，把一片空间改成自己的规则。防御 +60%，事件强度 -20%。',
        effect: { defense: 0.6, raidPower: -0.2 },
    },
    void4: {
        id: 'void4', name: '时空锚点', icon: '⚓', branch: 'void', cost: 420,
        req: ['void3', 'void2'], reqLevel: 11, reqRebirth: 3,
        desc: '把这一世的记忆钉在时间线上：重生点 +50%，离线结算拉满效率。',
        effect: { rebirthGain: 0.5, offlineHours: 12, special: 'offlinePerfect' },
    },
};
const SPACE_SKILL_BRANCHES = [
    { id: 'vault', name: '容积', icon: '🗄️', desc: '空间能装多少东西。' },
    { id: 'plunder', name: '掠夺', icon: '🫳', desc: '更快地找到、更快地拿走。' },
    { id: 'guard', name: '守护', icon: '🛡️', desc: '把空间变成武器与墙。' },
    { id: 'void', name: '虚空', icon: '🌌', desc: '重生之后才会显现的深层。' },
];
const SPACE_SKILL_ORDER = [
    'vault1', 'vault2', 'vault3', 'vaultStable', 'vaultDry',
    'plunder1', 'plunder2', 'plunder3', 'plunder4', 'plunder5',
    'guard1', 'guard2', 'guard3', 'guard4',
    'void1', 'void2', 'void3', 'void4',
];

/* ---------------- 第二异能（抽卡） ---------------- */
const ABILITY_TIERS = {
    D: { key: 'D', name: 'D 级', color: '#8d9aa6', weight: 46, desc: '比普通人强一点，也就一点。' },
    C: { key: 'C', name: 'C 级', color: '#6fb46f', weight: 28, desc: '能在末日里活下去的水平。' },
    B: { key: 'B', name: 'B 级', color: '#5c9ae8', weight: 16, desc: '一个小队里能当核心。' },
    A: { key: 'A', name: 'A 级', color: '#c07ce8', weight: 7.5, desc: '一个人能守住一段防线。' },
    S: { key: 'S', name: 'S 级', color: '#e8a33c', weight: 2.2, desc: '整座城市里的顶尖。' },
    EX: { key: 'EX', name: 'EX 级', color: '#ff5470', weight: 0.3, desc: '常理之外的东西，规则为它让路。' },
};
const ABILITY_TIER_ORDER = ['D', 'C', 'B', 'A', 'S', 'EX'];

const SECOND_ABILITIES = {
    /* D 级 */
    brute: { id: 'brute', name: '蛮力增幅', tier: 'D', icon: '🦾', power: 4, desc: '搬得起两个人搬不动的东西。', effect: { combatPowerFlat: 6 } },
    nighteye: { id: 'nighteye', name: '夜视', tier: 'D', icon: '🌙', power: 4, desc: '黑暗中也能看清十五米。', effect: { warning: 1, hiddenFind: 0.1 } },
    ironbelly: { id: 'ironbelly', name: '铁胃', tier: 'D', icon: '🍽️', power: 3, desc: '坏了的东西也能吃下去。', effect: { foodUse: -0.12 } },
    regenWeak: { id: 'regenWeak', name: '微弱再生', tier: 'D', icon: '🩹', power: 4, desc: '小伤口自己就会合上。', effect: { moraleRate: 0.03 } },
    /* C 级 */
    hardskin: { id: 'hardskin', name: '硬化皮肤', tier: 'C', icon: '🐗', power: 9, desc: '普通刀刃切不进去。', effect: { defense: 0.12 } },
    dash: { id: 'dash', name: '疾行术', tier: 'C', icon: '💨', power: 9, desc: '想跑的时候，没人追得上。', effect: { scavengeRefresh: 0.15 } },
    shardblade: { id: 'shardblade', name: '短刃生成', tier: 'C', icon: '🔪', power: 10, desc: '手里随时能长出一把刀。', effect: { combatPowerFlat: 12 } },
    coldblood: { id: 'coldblood', name: '低温耐受', tier: 'C', icon: '❄️', power: 8, desc: '零下二十度也敢出门。', effect: { doomResist: 0.15 } },
    toxsense: { id: 'toxsense', name: '毒感', tier: 'C', icon: '☣️', power: 8, desc: '闻得出哪袋米还能吃。', effect: { lootLuck: 0.1, foodUse: -0.05 } },
    /* B 级 */
    fire: { id: 'fire', name: '火焰掌控', tier: 'B', icon: '🔥', power: 18, desc: '指尖亮起的那一下，什么都能点着。', effect: { combatPower: 0.2 } },
    frost: { id: 'frost', name: '冰霜凝结', tier: 'B', icon: '🧊', power: 18, desc: '空气里的水会听你的话。', effect: { defense: 0.25, resourceProd: { '净水': 0.2 } } },
    spark: { id: 'spark', name: '电流操弄', tier: 'B', icon: '⚡', power: 18, desc: '发电机不用油也能转。', effect: { facilityProd: 0.25, powerUse: -0.2 } },
    telekinesis: { id: 'telekinesis', name: '念动力', tier: 'B', icon: '🌀', power: 19, desc: '隔着十米把东西搬进空间。', effect: { scavengeYield: 0.25, lootLuck: 0.1 } },
    mindwhisper: { id: 'mindwhisper', name: '读心低语', tier: 'B', icon: '🧠', power: 17, desc: '知道对方想听什么。', effect: { bondGain: 0.3, eventRate: 0.2 } },
    /* A 级 */
    thunder: { id: 'thunder', name: '雷霆之力', tier: 'A', icon: '🌩️', power: 34, desc: '一记落雷，尸群中间会空出一块。', effect: { combatPowerFlat: 40 } },
    bloodflame: { id: 'bloodflame', name: '血焰', tier: 'A', icon: '🩸', power: 36, desc: '烧自己的血，换一次碾压。', effect: { combatPower: 0.35, moraleRate: -0.04 } },
    metalmaster: { id: 'metalmaster', name: '金属支配', tier: 'A', icon: '⛓️', power: 33, desc: '钢筋自己会站成一堵墙。', effect: { defenseFlat: 25, buildCost: -0.15 } },
    shadowstep: { id: 'shadowstep', name: '暗影潜行', tier: 'A', icon: '🌑', power: 33, desc: '没人能埋伏一个影子。', effect: { lootLuck: 0.35, special: 'noAmbush' } },
    foresee: { id: 'foresee', name: '预知残影', tier: 'A', icon: '🔮', power: 32, desc: '危险来临前几秒，你会先看到。', effect: { warning: 6, raidPower: -0.1 } },
    /* S 级 */
    timeslow: { id: 'timeslow', name: '时间减缓', tier: 'S', icon: '⏳', power: 55, desc: '在你的半径里，一切慢半拍。', effect: { runSpeed: 0.35, scavengeRefresh: 0.3 } },
    gravity: { id: 'gravity', name: '重力领域', tier: 'S', icon: '🌐', power: 56, desc: '冲上来的人会先跪下。', effect: { defense: 0.8, raidPower: -0.2 } },
    drain: { id: 'drain', name: '生命汲取', tier: 'S', icon: '🌱', power: 54, desc: '把别人的生机拿过来用。', effect: { moraleRate: 0.15, foodUse: -0.25, resourceProd: { '食物': 0.25 } } },
    fusion: { id: 'fusion', name: '元素融合', tier: 'S', icon: '🌈', power: 57, desc: '火与水在你手里可以同时存在。', effect: { facilityProd: 0.6, crystalGain: 0.2 } },
    /* EX 级 */
    voiddevour: { id: 'voiddevour', name: '虚空吞噬', tier: 'EX', icon: '🕳️', power: 92, desc: '你张开手，那一片东西就不存在了。', effect: { spaceCap: 1.5, scavengeYield: 0.5, lootLuck: 0.5 } },
    causalloop: { id: 'causalloop', name: '因果逆转', tier: 'EX', icon: '♾️', power: 95, desc: '这一次的结局，你已经看过一遍。', effect: { rebirthGain: 0.6, warning: 12, offlineHours: 12, special: 'offlinePerfect' } },
    spiritcall: { id: 'spiritcall', name: '万灵召唤', tier: 'EX', icon: '👥', power: 94, desc: '路过的人会莫名其妙地愿意留下。', effect: { residentCap: 0.6, bondGain: 0.5, moraleRate: 0.12 } },
};
const SECOND_ABILITY_ORDER = [
    'brute', 'nighteye', 'ironbelly', 'regenWeak',
    'hardskin', 'dash', 'shardblade', 'coldblood', 'toxsense',
    'fire', 'frost', 'spark', 'telekinesis', 'mindwhisper',
    'thunder', 'bloodflame', 'metalmaster', 'shadowstep', 'foresee',
    'timeslow', 'gravity', 'drain', 'fusion',
    'voiddevour', 'causalloop', 'spiritcall',
];

/* 抽卡规则 */
const AWAKEN_RULES = {
    firstFree: true,           // 觉醒仪式第一次免费
    cost: 12,                  // 之后每次重抽消耗的异能结晶
    costGrowth: 0.15,          // 每次重抽后消耗按此比例上浮
    pityA: 10,                 // 连续 10 次没抽到 A 级以上，下一次必出 A 级以上
    exNoPity: true,            // EX 永远没有保底
};
