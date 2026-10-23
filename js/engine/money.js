/* 钱：借（花好感）与抢（记仇）。
   搜刮不再出钱，所以现金只能从人身上来 —— 借来的要还人情，抢来的要防着仇家。 */
(function () {
    function wealthOf(bondId) {
        const w = BOND_WEALTH[bondId];
        return typeof w === 'number' ? w : BOND_WEALTH.default;
    }

    /* ---------------- 借钱 ---------------- */
    function borrowInfo(state, id) {
        const c = BondEngine.cfg(id);
        const st = BondEngine.get(state, id);
        const R = BORROW_RULES;
        if (!c || !st) return { ok: false, reason: '没有这个人。' };
        if (PhaseManager.isAtLeast(state, 'outbreak')) {
            return { ok: false, hidden: true, reason: '末日爆发后，已经没人愿意借钱了。' };
        }
        if (!st.met) return { ok: false, reason: '还不认识他/她。' };
        if (st.outcome === 'enemy' || st.outcome === 'dead' || st.outcome === 'left') {
            return { ok: false, reason: '现在开不了这个口。' };
        }
        const loans = st.loans || 0;
        if (loans >= R.maxPerBond) return { ok: false, reason: '他已经借过 ' + loans + ' 次了，再开口就伤感情。' };
        const favorCost = R.favorCost + loans * R.favorCostStep;
        const cash = Math.round(wealthOf(id) * (1 - R.cashDecay * loans));
        if (st.value < R.minFavor + favorCost) {
            return { ok: false, reason: '好感不够（要 ' + (R.minFavor + favorCost) + '，现在 ' + Math.round(st.value) + '）',
                favorCost: favorCost, cash: cash };
        }
        return { ok: true, favorCost: favorCost, cash: cash, loans: loans, left: R.maxPerBond - loans };
    }

    function borrow(state, id) {
        const info = borrowInfo(state, id);
        if (!info.ok) return { ok: false, msg: info.reason };
        const c = BondEngine.cfg(id);
        const st = BondEngine.get(state, id);
        st.loans = (st.loans || 0) + 1;
        BondEngine.addValue(state, id, -info.favorCost, '借钱');
        ResourcesManager.add({ '现金': info.cash }, state);
        EventEngine.addLog(state, '💸 向' + c.name + '借了 ' + Utils.fmtInt(info.cash) + ' 现金（好感 -' + info.favorCost + '）。');
        return {
            ok: true, cash: info.cash, favorCost: info.favorCost,
            msg: '向' + c.name + '借到 ' + Utils.fmtInt(info.cash) + ' 现金，欠的是人情（好感 -' + info.favorCost + '）',
        };
    }

    /* ---------------- 抢钱 ---------------- */
    function robPowerNeed(state, loc) {
        return Math.round(ROB_RULES.powerNeed(loc) * (1 + state.hours / 400));
    }

    function robInfo(state, loc) {
        const need = robPowerNeed(state, loc);
        const mine = PlayerManager.combatPower(state);
        return {
            need: need, mine: mine,
            ok: mine >= need,
            odds: ROB_RULES.odds(mine / Math.max(1, need)),
            haul: ROB_RULES.haul(loc, state.hours),
            reason: mine >= need ? '' : '看场子的比你能打（需要战力 ' + need + '，你 ' + mine + '）',
        };
    }

    function rob(state, locId) {
        const loc = ScavengeEngine.locOf(locId);
        if (!loc) return { ok: false, msg: '没有这个地方。' };
        const st = ScavengeEngine.status(state, locId);
        if (!st.unlocked) return { ok: false, msg: st.reason };
        if (st.disabled) return { ok: false, msg: '这里已经被淹了，抢不出东西。' };
        const info = robInfo(state, loc);
        if (!info.ok) return { ok: false, msg: info.reason };

        Actions.spend(state, 'scavenge');            // 抢一趟也要花时间
        if (Math.random() < info.odds) {
            const cash = ROB_RULES.haul(loc, state.hours);
            ResourcesManager.add({ '现金': cash }, state);
            PlayerManager.addMorale(state, -ROB_RULES.moraleCost);
            addHeat(state, ROB_RULES.heatOnSuccess, '在' + loc.name + '抢了一票');
            EventEngine.addLog(state, '💰 在' + loc.name + '抢到 ' + Utils.fmtInt(cash) + ' 现金（仇家 +' +
                ROB_RULES.heatOnSuccess + '）。');
            return {
                ok: true, win: true, cash: cash, msg: '抢到 ' + Utils.fmtInt(cash) + ' 现金',
                text: '你把这地方的人按住，翻走了他们身上和抽屉里的钱。他们记住了你的脸。',
                lines: ['现金 +' + Utils.fmtInt(cash), '士气 -' + ROB_RULES.moraleCost,
                    '仇家 +' + ROB_RULES.heatOnSuccess + '（现在是 ' + state.heat + '）'],
            };
        }
        const lost = {};
        for (const k in ROB_RULES.failLoss) {
            const r = ROB_RULES.failLoss[k];
            const take = Math.min(ResourcesManager.amount(k), Utils.rndInt(r[0], r[1]));
            if (take > 0) { ResourcesManager.discard(state, k, take); lost[k] = take; }
        }
        PlayerManager.addMorale(state, -5);
        addHeat(state, ROB_RULES.heatOnFail, '抢' + loc.name + '没得手');
        EventEngine.addLog(state, '🩸 抢' + loc.name + '没得手，自己挂彩回来（仇家 +' + ROB_RULES.heatOnFail + '）。');
        return {
            ok: true, win: false, msg: '没抢成，还挂了彩',
            text: '对方比你想的硬。你退了出来，衣服上多了两道口子。',
            lines: ['损失 ' + EventEngine.gainText(lost), '士气 -5', '仇家 +' + ROB_RULES.heatOnFail],
        };
    }

    /* ---------------- 仇家 ---------------- */
    function addHeat(state, n, why) {
        if (!n) return state.heat;
        const before = state.heat;
        state.heat = Utils.clamp(state.heat + n, 0, HEAT_RULES.max);
        state.heatCoolAt = state.hours + HEAT_RULES.coolHours;
        if (state.heat > before) {
            EventEngine.addLog(state, '🔥 ' + (why || '有人记账') + '：仇家 ' + before + ' → ' + state.heat +
                (state.heat >= HEAT_RULES.visitAt ? '（已经有人开始打听你了）' : ''));
        }
        return state.heat;
    }

    function reduceHeat(state, n, why) {
        const before = state.heat;
        state.heat = Utils.clamp(state.heat - n, 0, HEAT_RULES.max);
        if (state.heat < before) EventEngine.addLog(state, '🧯 ' + (why || '了结了一桩') + '：仇家 ' + before + ' → ' + state.heat);
        return state.heat;
    }

    /* 每小时：没人来算账，仇家会淡一点 */
    function tick(state) {
        if (state.heat <= 0) return;
        if (state.hours < state.heatCoolAt) return;
        state.heatCoolAt = state.hours + HEAT_RULES.coolHours;
        reduceHeat(state, 1, '时间冲淡');
    }

    function raidMultiplier(state) {
        return 1 + state.heat * HEAT_RULES.raidPowerPerHeat;
    }

    window.MoneyEngine = {
        wealthOf, borrowInfo, borrow, robInfo, rob, robPowerNeed,
        addHeat, reduceHeat, tick, raidMultiplier,
    };
})();
