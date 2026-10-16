/* 成就（纯数据）：每完成一个给异能结晶，部分还给永久小加成 */
const ACHIEVEMENTS_CONFIG = [
    { id: 'firstCash', name: '第一桶金', icon: '💵', desc: '手里攒到 2000 现金。', crystal: 1, cond: s => ResourcesManager.amount('现金') >= 2000 },
    { id: 'scav10', name: '拾荒入门', icon: '🧺', desc: '累计搜刮 10 次。', crystal: 1, cond: s => s.stats.scavenges >= 10 },
    { id: 'scav50', name: '熟门熟路', icon: '🗺️', desc: '累计搜刮 50 次。', crystal: 2, cond: s => s.stats.scavenges >= 50 },
    { id: 'scav150', name: '扫荡专家', icon: '🧹', desc: '累计搜刮 150 次。', crystal: 3, cond: s => s.stats.scavenges >= 150 },
    { id: 'space2', name: '空间初启', icon: '💎', desc: '空间异能升到 Lv2。', crystal: 1, cond: s => s.space.level >= 2 },
    { id: 'space5', name: '空间扩容', icon: '💠', desc: '空间异能升到 Lv5。', crystal: 2, cond: s => s.space.level >= 5 },
    { id: 'space8', name: '空间大师', icon: '🔷', desc: '空间异能升到 Lv8。', crystal: 3, cond: s => s.space.level >= 8 },
    { id: 'cap2000', name: '一角变一室', icon: '🗄️', desc: '空间容量达到 2000 格。', crystal: 2, cond: s => ResourcesManager.spaceCap(s) >= 2000 },
    { id: 'hoarder', name: '囤货癖', icon: '📦', desc: '同时持有 6 种各 20 以上的资源。', crystal: 2, cond: s => {
        let n = 0;
        for (const k in s.resources) if (s.resources[k].amount >= 20) n++;
        return n >= 6;
    } },
    { id: 'clearHome', name: '家里翻了个底朝天', icon: '🏠', desc: '在自家公寓累计搜刮 20 次。', crystal: 1, cond: s => (s.stats.scavengesByLocation.home || 0) >= 20 },
    { id: 'clearStreet', name: '整条街都是我的', icon: '🏬', desc: '有 6 个地点各累计搜刮 10 次。', crystal: 2, cond: s => {
        let n = 0;
        for (const k in s.stats.scavengesByLocation) if (s.stats.scavengesByLocation[k] >= 10) n++;
        return n >= 6;
    } },
    { id: 'marketSweep', name: '超市清仓', icon: '🛒', desc: '在大型超市累计搜刮 16 次。', crystal: 2, cond: s => (s.stats.scavengesByLocation.market || 0) >= 16 },
    { id: 'hospitalRun', name: '医院夜行', icon: '🏥', desc: '在市立医院累计搜刮 10 次。', crystal: 2, cond: s => (s.stats.scavengesByLocation.hospital || 0) >= 10 },
    { id: 'policeRun', name: '警局开门', icon: '🚓', desc: '在辖区警局累计搜刮 8 次。', crystal: 2, cond: s => (s.stats.scavengesByLocation.police || 0) >= 8 },
    { id: 'prep', name: '未雨绸缪', icon: '🗓️', desc: '在末日爆发前建成 5 类设施。', crystal: 2, cond: s => {
        if (s.hours >= 72) return false;
        let n = 0;
        for (const id in s.facilities) if (s.facilities[id].level > 0) n++;
        return n >= 5;
    } },
    { id: 'fortress', name: '堡垒初成', icon: '🏰', desc: '据点防御达到 120。', crystal: 2, cond: s => PlayerManager.defense(s) >= 120 },
    { id: 'wallMaster', name: '铜墙铁壁', icon: '🧱', desc: '据点防御达到 600。', crystal: 3, cond: s => PlayerManager.defense(s) >= 600 },
    { id: 'lit', name: '灯火通明', icon: '💡', desc: '发电机 / 太阳能板 / 发电站合计等级 ≥ 8。', crystal: 2, cond: s => {
        return (s.facilities.generator.level + s.facilities.solarPanel.level + s.facilities.powerStation.level) >= 8;
    } },
    { id: 'selfSuff', name: '自给自足', icon: '🌾', desc: '食物与净水的每小时净产出都 ≥ 3。', crystal: 3, cond: s => {
        const r = s.rates || {};
        const f = (r['食物'] ? r['食物'].prod - r['食物'].use : 0);
        const w = (r['净水'] ? r['净水'].prod - r['净水'].use : 0);
        return f >= 3 && w >= 3;
    } },
    { id: 'firstBond', name: '第一个朋友', icon: '🤝', desc: '结识 1 个羁绊角色。', crystal: 1, cond: s => PlayerManager.companionCount(s) >= 1 },
    { id: 'crew', name: '队伍成型', icon: '👥', desc: '结识 6 个羁绊角色。', crystal: 2, cond: s => PlayerManager.companionCount(s) >= 6 },
    { id: 'closeBond', name: '生死之交', icon: '💞', desc: '有羁绊角色的好感达到 80。', crystal: 2, cond: s => {
        for (const id in s.bonds) if (s.bonds[id].value >= 80) return true;
        return false;
    } },
    { id: 'partner', name: '有人等你回家', icon: '💗', desc: '有人成为你的伴侣。', crystal: 3, cond: s => {
        for (const id in s.bonds) if (s.bonds[id].outcome === 'partner') return true;
        return false;
    } },
    { id: 'noOneLeft', name: '众叛亲离', icon: '🗡️', desc: '有人成了你的敌人。', crystal: 1, cond: s => {
        for (const id in s.bonds) if (s.bonds[id].outcome === 'enemy') return true;
        return false;
    } },
    { id: 'awaken', name: '觉醒', icon: '✨', desc: '完成觉醒仪式，得到第二异能。', crystal: 2, cond: s => !!s.ability.id },
    { id: 'tierS', name: '顶尖', icon: '🌟', desc: '第二异能抽到 S 级以上。', crystal: 3, cond: s => s.ability.tier === 'S' || s.ability.tier === 'EX' },
    { id: 'tierEX', name: '常理之外', icon: '💥', desc: '第二异能抽到 EX 级。', crystal: 5, cond: s => s.ability.tier === 'EX' },
    { id: 'survive24', name: '撑过第一夜', icon: '🕯️', desc: '进入末日爆发阶段。', crystal: 2, cond: s => PhaseManager.isAtLeast(s, 'outbreak') },
    { id: 'survive7d', name: '一周生存', icon: '📆', desc: '一轮里存活 7 天（168 小时）。', crystal: 2, cond: s => s.hours >= 168 },
    { id: 'survive30d', name: '一月生存', icon: '🗓️', desc: '一轮里存活 30 天（720 小时）。', crystal: 3, cond: s => s.hours >= 720 },
    { id: 'firstRaidWin', name: '守住一次', icon: '🛡️', desc: '成功抵御一次恶性事件。', crystal: 2, cond: s => s.raid.wins >= 1 },
    { id: 'raid5', name: '五连胜', icon: '🎖️', desc: '累计抵御 5 次恶性事件。', crystal: 3, cond: s => s.raid.wins >= 5 },
    { id: 'revenge', name: '手刃仇人', icon: '🔪', desc: '了结上一世背叛你的人。', crystal: 3, effect: { crystalGain: 0.05 }, cond: s => s.story.revenge >= 1 },
    { id: 'firstRebirth', name: '重回原点', icon: '🔁', desc: '完成第一次重生。', crystal: 3, cond: s => s.rebirth.count >= 1 },
    { id: 'rebirth5', name: '时间旅人', icon: '⏳', desc: '累计重生 5 次。', crystal: 4, cond: s => s.rebirth.count >= 5 },
    { id: 'allDooms', name: '四种末日都见过', icon: '🌍', desc: '经历过全部 4 种末日类型。', crystal: 4, cond: s => {
        let n = 0;
        for (const k in s.rebirth.byDoom) if (s.rebirth.byDoom[k] > 0) n++;
        return n >= 4;
    } },
];
