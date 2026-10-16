/* 异能：空间等级、技能树、第二异能觉醒抽卡 */
(function () {
    function maxSpaceLevel(state) {
        return SPACE_MAX_BASE + state.rebirth.count * 2;
    }

    /* 等级表用显式配置（好读好调），超出表的部分按固定倍率继续长 */
    function spaceRow(state, lv) {
        if (lv <= SPACE_LEVELS.length) return SPACE_LEVELS[lv - 1];
        const last = SPACE_LEVELS[SPACE_LEVELS.length - 1];
        const extra = lv - SPACE_LEVELS.length;
        return {
            lv: lv,
            cap: Math.round(last.cap * Math.pow(SPACE_LEVEL_GROWTH.cap, extra)),
            cost: Math.round(last.cost * Math.pow(SPACE_LEVEL_GROWTH.cost, extra)),
        };
    }

    function spaceCap(state) {
        const base = spaceRow(state, state.space.level).cap;
        const e = EffectsManager.get(state);
        const cap = base * (1 + (e.spaceCap || 0)) + (e.spaceCapFlat || 0);
        return Math.max(10, Math.floor(cap));
    }

    function nextCost(state) {
        return spaceRow(state, state.space.level + 1).cost;
    }

    function levelStatus(state) {
        const max = maxSpaceLevel(state);
        const atMax = state.space.level >= max;
        const cost = atMax ? 0 : nextCost(state);
        return {
            max: max, atMax: atMax, cost: cost,
            can: !atMax && state.space.crystals >= cost,
            crystals: state.space.crystals,
            nextCap: atMax ? spaceCap(state) : spaceRow(state, state.space.level + 1).cap,
        };
    }

    function levelUp(state) {
        const st = levelStatus(state);
        if (st.atMax) return { ok: false, msg: '空间已经到当前上限了（重生可以提高上限）。' };
        if (!st.can) return { ok: false, msg: '异能结晶不够，还差 ' + Math.ceil(st.cost - state.space.crystals) + ' 颗。' };
        state.space.crystals -= st.cost;
        state.space.level += 1;
        EffectsManager.refreshAllEffects(state);
        EventEngine.addLog(state, '💠 空间异能升到 Lv' + state.space.level + '，容量 ' + Utils.fmtInt(spaceCap(state)) + ' 格。');
        AchievementEngine.check(state);
        return { ok: true, msg: '空间扩张成功：Lv' + state.space.level };
    }

    /* ---------------- 技能树 ---------------- */
    function skillStatus(state, id) {
        const cfg = SPACE_SKILLS[id];
        if (!cfg) return { known: false };
        if (state.space.skills[id]) return { known: true, unlocked: true, ready: false, reason: '已解锁' };
        const reasons = [];
        for (const r of (cfg.req || [])) {
            if (!state.space.skills[r]) reasons.push('需要先解锁「' + (SPACE_SKILLS[r] ? SPACE_SKILLS[r].name : r) + '」');
        }
        if (state.space.level < cfg.reqLevel) reasons.push('空间异能需要 Lv' + cfg.reqLevel);
        if (state.rebirth.count < cfg.reqRebirth) reasons.push('需要重生 ' + cfg.reqRebirth + ' 次');
        if (state.space.crystals < cfg.cost) reasons.push('还差 ' + Math.ceil(cfg.cost - state.space.crystals) + ' 颗结晶');
        return {
            known: true, unlocked: false, ready: reasons.length === 0,
            reason: reasons.join('；'), cost: cfg.cost, cfg: cfg,
        };
    }

    function unlockSkill(state, id) {
        const st = skillStatus(state, id);
        if (!st.known) return { ok: false, msg: '没有这个技能。' };
        if (st.unlocked) return { ok: false, msg: '已经解锁了。' };
        if (!st.ready) return { ok: false, msg: st.reason };
        state.space.crystals -= st.cost;
        state.space.skills[id] = true;
        EffectsManager.refreshAllEffects(state);
        EventEngine.addLog(state, '🌀 空间技能解锁：' + st.cfg.name + '。');
        AchievementEngine.check(state);
        return { ok: true, msg: '解锁「' + st.cfg.name + '」' };
    }

    function unlockedSkillCount(state, branch) {
        let n = 0;
        for (const id of SPACE_SKILL_ORDER) {
            if (!state.space.skills[id]) continue;
            if (branch && SPACE_SKILLS[id].branch !== branch) continue;
            n++;
        }
        return n;
    }

    /* ---------------- 第二异能 ---------------- */
    function awakened(state) { return !!state.ability.id; }

    function drawCost(state) {
        if (!state.ability.awakened) return 0;
        const n = Math.max(0, (state.ability.rolls || 0) - 1);
        return Math.round(AWAKEN_RULES.cost * Math.pow(1 + AWAKEN_RULES.costGrowth, n));
    }

    /* 抽一次的费用（点「觉醒 / 再抽」时先扣，保留结果时才落地） */
    function payForRoll(state) {
        const c = canDraw(state);
        if (!c.ok) return { ok: false, msg: c.reason };
        state.space.crystals -= c.cost;
        state.ability.rolls = (state.ability.rolls || 0) + 1;
        return { ok: true, cost: c.cost };
    }

    function canDraw(state) {
        if (!PhaseManager.isAtLeast(state, 'outbreak')) {
            return { ok: false, reason: '末日爆发之后才会觉醒第二异能。' };
        }
        const cost = drawCost(state);
        if (state.space.crystals < cost) {
            return { ok: false, reason: '还差 ' + Math.ceil(cost - state.space.crystals) + ' 颗异能结晶。', cost: cost };
        }
        return { ok: true, cost: cost };
    }

    /* 抽一个候选（不落地，先给玩家看结果） */
    function roll(state) {
        const pityReady = state.ability.pity + 1 >= AWAKEN_RULES.pityA;
        let order = ABILITY_TIER_ORDER.slice();
        if (pityReady) order = order.filter(t => t !== 'D' && t !== 'C' && t !== 'B');
        const tier = Utils.weightedPick(order, t => ABILITY_TIERS[t].weight) || 'D';
        const pool = SECOND_ABILITY_ORDER.filter(id => SECOND_ABILITIES[id].tier === tier);
        const id = pool.length ? Utils.pick(pool) : 'brute';
        return { id: id, tier: tier, ability: SECOND_ABILITIES[id], pityUsed: pityReady };
    }

    function commit(state, candidateId, opt) {
        opt = opt || {};
        const ab = SECOND_ABILITIES[candidateId];
        if (!ab) return { ok: false, msg: '没有这个异能。' };
        const old = state.ability.id ? SECOND_ABILITIES[state.ability.id] : null;
        state.ability.id = ab.id;
        state.ability.tier = ab.tier;
        state.ability.draws += 1;
        state.ability.awakened = true;
        state.ability.pity = (ab.tier === 'A' || ab.tier === 'S' || ab.tier === 'EX') ? 0 : state.ability.pity + 1;
        state.ability.history.unshift({ id: ab.id, tier: ab.tier, hours: state.hours, replaced: old ? old.name : null });
        if (state.ability.history.length > 30) state.ability.history.length = 30;
        EffectsManager.refreshAllEffects(state);
        EventEngine.addLog(state, '✨ 第二异能：' + ab.name + '（' + ABILITY_TIERS[ab.tier].name + '）' +
            (old ? '，取代了「' + old.name + '」' : ''));
        AchievementEngine.check(state);
        return { ok: true, msg: '觉醒：' + ab.name, ability: ab };
    }

    function pityInfo(state) {
        return {
            count: state.ability.pity,
            need: AWAKEN_RULES.pityA,
            ready: state.ability.pity + 1 >= AWAKEN_RULES.pityA,
        };
    }

    function tierChanceTable(pityReady) {
        const order = ABILITY_TIER_ORDER.filter(t => !(pityReady && (t === 'D' || t === 'C' || t === 'B')));
        let total = 0;
        for (const t of order) total += ABILITY_TIERS[t].weight;
        return order.map(t => ({ tier: t, pct: ABILITY_TIERS[t].weight / total }));
    }

    window.AbilityEngine = {
        maxSpaceLevel, spaceRow, spaceCap, nextCost, levelStatus, levelUp,
        skillStatus, unlockSkill, unlockedSkillCount,
        awakened, drawCost, canDraw, payForRoll, roll, commit, pityInfo, tierChanceTable,
    };
})();
