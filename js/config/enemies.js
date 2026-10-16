/* 遭遇战的敌人图鉴（纯数据）
   每种敌人有「单个战力」和「出现个数」，遭遇时的总战力 = 单个战力 × 个数 × 地点危险度修正。
   战力会随时间缓慢上浮（末日越往后，活下来的东西越凶）。 */
const ENEMIES_CONFIG = {
    zombie: [
        { id: 'walker', name: '游荡者', icon: '🧟', power: 5, count: [1, 4], desc: '动作慢，但从来不止一个。' },
        { id: 'howler', name: '嘶吼者', icon: '📣', power: 10, count: [1, 3], desc: '它会喊人 —— 打它要快。' },
        { id: 'bloat', name: '肿胀体', icon: '🎈', power: 17, count: [1, 2], desc: '一碰就炸，气味能引来一整条街。' },
        { id: 'bonepick', name: '碎骨者', icon: '🦴', power: 26, count: [1, 2], desc: '骨头长在体外，像一层裂开的甲。' },
        { id: 'hordeboss', name: '尸群头目', icon: '👑', power: 44, count: [1, 1], desc: '它走过的楼道，墙上都是抓痕。' },
    ],
    frost: [
        { id: 'militia', name: '民兵巡逻队', icon: '🥾', power: 12, count: [2, 4], desc: '裹着棉被改的护甲，手里有猎枪。' },
        { id: 'raider', name: '劫掠者', icon: '🪓', power: 18, count: [1, 3], desc: '他们只要东西，不看你死活。' },
        { id: 'cryomancer', name: '低温异能者', icon: '🧊', power: 30, count: [1, 2], desc: '呼出的白气会凝成刀。' },
        { id: 'warlord', name: '军阀私兵', icon: '🎖️', power: 40, count: [1, 2], desc: '车灯照着的地方归他们。' },
    ],
    flood: [
        { id: 'boatcrew', name: '水上掠夺队', icon: '🛶', power: 14, count: [2, 4], desc: '划着改装过的橡皮艇挨家搜。' },
        { id: 'drowned', name: '水下潜伏体', icon: '🐟', power: 22, count: [1, 2], desc: '水面只冒出一串气泡。' },
        { id: 'smuggler', name: '走私船长', icon: '⚓', power: 36, count: [1, 1], desc: '他的船上有货，也有一整排枪眼。' },
    ],
    nuclear: [
        { id: 'muttdogs', name: '变异犬群', icon: '🐕', power: 9, count: [2, 5], desc: '多长了一排牙，跑得比狗快。' },
        { id: 'radbear', name: '辐射熊', icon: '🐻', power: 24, count: [1, 2], desc: '毛掉光了，皮是灰的，还会站起来。' },
        { id: 'twohead', name: '双头鹿', icon: '🦌', power: 30, count: [1, 2], desc: '两个头会轮流撞你。' },
        { id: 'ashhunter', name: '灰烬游猎者', icon: '🎯', power: 44, count: [1, 1], desc: '看不出是动物还是人，只认得热量。' },
    ],
};

/* 遭遇战规则（调这几个数就等于调整室外危险程度） */
const ENCOUNTER_RULES = {
    battleChance: 0.5,       // 遭遇里「是战斗」的概率（另一半是随机事件）
    powerOverTime: 300,      // 单个敌人战力随时间上浮：×(1 + 小时 / 这个数)
    dangerBonus: 0.5,        // 危险度对总战力的加成：×(1 + 危险度 × 这个数)
    extraAtDanger: 0.45,     // 超过这个危险度，敌人个数 +1
    fleeBase: 0.72,          // 基础逃跑成功率
    fleePenalty: 0.22,       // 每超出 1 倍战力，逃跑难度增加多少
    fleePenaltyCap: 0.45,    // 战力差带来的最大惩罚
    dumpFleeBonus: 0.18,     // 丢物资换来的逃跑成功率
    maxFleeTries: 3,         // 连续逃跑失败到这个次数就会被冲散（地点被占）
    rollLow: 0.85,           // 战斗判定：战力 × 这个区间内的随机数（和 battleSpec 保持一致）
    rollHigh: 1.15,
    fleeLoss: { '食物': [5, 15], '药品': [1, 4], '弹药': [1, 3] },   // 逃跑失败丢的东西
    dumpCost: { '食物': 15, '药品': 3, '弹药': 2 },                    // 「丢东西跑」要放下的东西
    scatterLoss: { '食物': [12, 26], '药品': [2, 6], '弹药': [2, 6] }, // 被冲散时的损失
};
