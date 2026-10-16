/* 现金的来源（纯数据）：搜刮搜不到钱，钱只能「借」或者「抢」。
   借来的钱记在好感上，抢来的钱记在仇家头上 —— 两条路都要还。 */

/* 向羁绊角色借钱：花好感度，一个人借多了就不好再开口 */
const BORROW_RULES = {
    minFavor: 25,      // 好感低于这个数开不了口
    favorCost: 8,      // 第一次借花多少好感
    favorCostStep: 4,  // 同一个人每借一次，下次多花这么多好感
    maxPerBond: 3,     // 一个人最多借几次（再借他也没钱了）
    cashDecay: 0.25,   // 同一个人每借一次，能借到的钱少四分之一
};

/* 每个人手头的宽裕程度（没写的就是默认值） */
const BOND_WEALTH = {
    anqi: 2600,      // 富商之女
    zhouheng: 900,   // 便利店老板
    oldk: 520,       // 修车工
    zhengdui: 700,   // 警队队长
    yanprof: 600,    // 退休教授
    lutie: 420,      // 退伍教官
    shenxue: 380,    // 护士
    wangyi: 320,     // 食堂退休
    laozhao: 300,    // 保安
    xiaoma: 240,     // 快递员
    taotao: 200,     // 农庄女孩
    default: 300,
};

/* 抢钱：靠战力硬拿，钱来得快，但会记仇 */
const ROB_RULES = {
    /* 目标需要的战力：越危险的地方，看场子的人越硬 */
    powerNeed: loc => Math.round(30 + loc.danger * 120),
    /* 成功率：战力压过对方越多越稳 */
    odds: ratio => Math.min(0.92, Math.max(0.1, 0.35 + (ratio - 1) * 0.35)),
    /* 抢到多少：跟地点危险度与时间走 */
    haul: (loc, hours) => Math.round((70 + loc.danger * 260 + hours * 0.35) * (0.85 + Math.random() * 0.3)),
    moraleCost: 2,                 // 抢完心里不踏实
    heatOnSuccess: 2,              // 成功招来的仇家
    heatOnFail: 1,                 // 失败他们记住了你的脸
    failLoss: { '药品': [1, 4], '弹药': [1, 3] },
};

/* 仇家：抢得越多，后面越难安生 */
const HEAT_RULES = {
    max: 10,
    /* 每 X 小时没人来算账，仇家就淡一点 */
    coolHours: 24,
    /* 仇家让袭击更狠：强度 ×(1 + 仇家值 × 这个数) */
    raidPowerPerHeat: 0.04,
    /* 超过这个值，袭击直接变成「仇家清算」 */
    raidAt: 6,
    /* 仇家找上门的事件门槛 */
    visitAt: 3,
};
