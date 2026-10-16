/* 重生：什么时候能重开、能拿多少重生点、保留什么、重生商店 */
(function () {
    function available(state) {
        return PhaseManager.isAtLeast(state, 'apocalypse');
    }

    function breakdown(state) {
        const e = EffectsManager.get(state);
        const days = state.hours / 24;
        let achieved = 0;
        for (const a of ACHIEVEMENTS_CONFIG) if (state.achievements[a.id]) achieved++;
        const base = BuildEngine.baseOf(state);
        const companions = PlayerManager.companionCount(state);
        const rows = [
            { label: '生存时长（' + days.toFixed(1) + ' 天）', value: Math.pow(Math.max(0, days), 0.75) * 1.6 },
            { label: '成就（' + achieved + ' 个）', value: achieved / 4 },
            { label: '据点等级（' + base.name + '）', value: (base.tier - 1) * 3 },
            { label: '羁绊（' + companions + ' 人）', value: companions * 0.8 },
            { label: '守住的袭击（' + state.raid.wins + ' 次）', value: state.raid.wins * 1.2 },
            { label: '空间异能（Lv' + state.space.level + '）', value: state.space.level * 1.2 },
        ];
        let total = 0;
        for (const r of rows) total += r.value;
        const mult = 1 + (e.rebirthGain || 0);
        return { rows: rows, total: total, mult: mult, points: Math.max(1, Math.floor(total * mult)) };
    }

    function pointsGain(state) { return breakdown(state).points; }

    /* ---------------- 商店 ---------------- */
    function shopStatus(state, item) {
        const lv = state.rebirth.shop[item.id] || 0;
        const maxed = lv >= item.maxLevel;
        const cost = maxed ? null : item.cost(lv + 1);
        return {
            id: item.id, item: item, level: lv, max: item.maxLevel, maxed: maxed, cost: cost,
            can: !maxed && state.rebirth.points >= cost,
        };
    }

    function buy(state, id) {
        const item = REBIRTH_SHOP.find(x => x.id === id);
        if (!item) return { ok: false, msg: '没有这一项。' };
        const st = shopStatus(state, item);
        if (st.maxed) return { ok: false, msg: '「' + item.name + '」已经满级了。' };
        if (!st.can) return { ok: false, msg: '重生点不够，还差 ' + Math.ceil(st.cost - state.rebirth.points) + ' 点。' };
        state.rebirth.points -= st.cost;
        state.rebirth.shop[id] = st.level + 1;
        EffectsManager.refreshAllEffects(state);
        ProductionEngine.computeProduction(state);
        EventEngine.addLog(state, '🔁 重生商店：' + item.name + ' Lv' + (st.level + 1));
        return { ok: true, msg: item.name + ' Lv' + (st.level + 1) };
    }

    function newDoom(state, avoid) {
        const ids = Object.keys(DOOMS_CONFIG).filter(d => d !== avoid);
        return ids.length ? Utils.pick(ids) : avoid;
    }

    /* 一轮重来：只有空间异能（等级 / 技能 / 结晶）、重生点与商店、成就、统计、设置跟着走 */
    function resetRun(state, opts) {
        const keep = {
            space: Utils.deepClone(state.space),
            rebirth: state.rebirth,
            achievements: state.achievements,
            stats: state.stats,
            settings: state.settings,
            flags: state.flags,
            storySeen: state.story.seen,
            raidHistory: state.raid.history,
            ability: Utils.deepClone(state.ability),
        };
        const byDoom = Utils.deepClone(state.rebirth.byDoom);

        initState();

        state.space = keep.space;
        state.rebirth = keep.rebirth;
        state.achievements = keep.achievements;
        state.stats = keep.stats;
        state.settings = keep.settings;
        state.flags = keep.flags;
        state.story.seen = keep.storySeen;
        state.raid.history = keep.raidHistory;
        state.rebirth.byDoom = byDoom;
        state.doom = opts.doom;
        state.rebirth.byDoom[opts.doom] = (state.rebirth.byDoom[opts.doom] || 0) + 1;
        state.raid.nextAt = PHASES_CONFIG[1].start + 18;
        state.speed = state.settings.speed || 1;

        if (opts.keepAbility) {
            state.ability = keep.ability;
            state.ability.awakened = true;
        }
        /* 先知准备：开局自带物资 */
        const prepared = state.rebirth.shop.prepared || 0;
        if (prepared) {
            const item = REBIRTH_SHOP.find(x => x.id === 'prepared');
            if (item && item.gift) ResourcesManager.add(item.gift(prepared), state);
        }
        EffectsManager.refreshAllEffects(state);
        ProductionEngine.computeProduction(state);
        return state;
    }

    function perform(state, reason) {
        if (!available(state) && reason !== 'defeat') {
            return { ok: false, msg: '重生要等到末日阶段才会开启。' };
        }
        const report = breakdown(state);
        const oldDoom = state.doom;
        const oldHours = state.hours;
        const oldBase = BuildEngine.baseOf(state).name;
        const keepAbility = (state.rebirth.shop.memoryCore || 0) > 0 && !!state.ability.id;

        state.rebirth.count += 1;
        state.rebirth.points += report.points;
        state.rebirth.total += report.points;
        if (!state.rebirth.byDoom[oldDoom]) state.rebirth.byDoom[oldDoom] = 1;

        const nextDoom = newDoom(state, oldDoom);
        resetRun(state, { doom: nextDoom, keepAbility: keepAbility });
        state.rebirth.lastReport = {
            reason: reason || 'manual',
            gain: report.points,
            rows: report.rows,
            mult: report.mult,
            oldDoom: oldDoom,
            newDoom: nextDoom,
            oldHours: oldHours,
            oldBase: oldBase,
            keepAbility: keepAbility,
        };
        state.pending = { type: 'rebirthReport', reason: reason || 'manual' };
        EventEngine.addLog(state, '🔁 重生：重生点 +' + report.points + '，新的末日是「' +
            DOOMS_CONFIG[nextDoom].name + '」。');
        if (window.UI && UI.toast) UI.toast('🔁 重生成功：重生点 +' + report.points, 'gold');
        AchievementEngine.check(state);
        return { ok: true, msg: '重生完成', report: state.rebirth.lastReport };
    }

    function onDefeat(state, rec) {
        const r = perform(state, 'defeat');
        if (state.rebirth.lastReport) state.rebirth.lastReport.defeat = rec;
        return r;
    }

    window.RebirthEngine = {
        available, breakdown, pointsGain, shopStatus, buy, perform, onDefeat, resetRun, newDoom,
    };
})();
