/* 产出与消耗：设施按小时生产，幸存者按小时吃东西烧燃料 */
(function () {
    function moraleMult(state) {
        return 0.7 + state.morale / 100 * 0.6;
    }

    function rateOf(state, res) {
        return state.rates && state.rates[res] ? state.rates[res] : { prod: 0, use: 0 };
    }

    function computeProduction(state) {
        const e = EffectsManager.get(state);
        const rates = {};
        function slot(res) {
            if (!rates[res]) rates[res] = { prod: 0, use: 0 };
            return rates[res];
        }

        const mult = (1 + (e.facilityProd || 0)) * moraleMult(state);
        for (const id in state.facilities) {
            const f = state.facilities[id];
            if (!f || !f.level) continue;
            const cfg = FACILITIES_CONFIG[id];
            if (!cfg || !cfg.produce) continue;
            const out = cfg.produce(f.level) || {};
            const facMult = EffectsManager.facilityMult(state, id);
            for (const res in out) {
                slot(res).prod += out[res] * mult * facMult * EffectsManager.resourceMult(state, res);
            }
        }

        /* 消耗：同伴越多吃得越多；燃料按设施的用电量走 */
        const companions = PlayerManager.companionCount(state);
        const foodUseMult = 1 + (e.foodUse || 0);
        slot('食物').use += (0.4 + 0.18 * companions) * Math.max(0, foodUseMult);
        slot('净水').use += (0.3 + 0.1 * companions) * Math.max(0, foodUseMult);
        const powerMult = 1 + (e.powerUse || 0);
        let powerUse = 0;
        for (const id in state.facilities) {
            const f = state.facilities[id];
            if (!f || !f.level) continue;
            const cfg = FACILITIES_CONFIG[id];
            if (cfg && cfg.power) powerUse += cfg.power(f.level);
        }
        slot('燃料').use += powerUse * Math.max(0, powerMult);

        /* 末日维护消耗：洪水冲刷地基、辐射清理这类固定支出 */
        const upkeep = EffectsManager.doomUpkeep(state);
        if (upkeep) for (const res in upkeep) slot(res).use += upkeep[res];

        state.rates = rates;
        return rates;
    }

    /* 结算 hours 小时（hours 已经是游戏内小时） */
    function advance(state, hours, offline) {
        if (hours <= 0) return { gains: {}, shortages: [] };
        const rates = computeProduction(state);
        const gains = {};
        const shortages = [];
        for (const k in state.resources) {
            const r = state.resources[k];
            const rate = rates[k] || { prod: 0, use: 0 };
            /* 离线只结算产出：伙伴会自己找吃的，回来不该发现仓库被吃空 */
            const use = offline ? 0 : (rate.use || 0);
            const net = (rate.prod || 0) - use;
            if (!isFinite(r.amount)) r.amount = 0;
            if (Math.abs(net) < 1e-12) continue;
            const before = r.amount;
            r.amount += net * hours;
            if (r.amount < 0) {
                r.amount = 0;
                if (net < 0 && (rate.prod || 0) >= 0) shortages.push(k);
            }
            if (r.amount > 0) r.visible = true;
            const d = r.amount - before;
            if (d > 1e-6) gains[k] = (gains[k] || 0) + d;
        }

        /* 士气：物资短缺会掉，医疗 / 娱乐设施会回，另外向 50 缓慢回归 */
        const e = EffectsManager.get(state);
        let delta = (e.moraleRate || 0);
        if (!offline) {
            delta += (50 - state.morale) * 0.01;
            if (shortages.indexOf('食物') >= 0) delta -= 0.5;
            if (shortages.indexOf('净水') >= 0) delta -= 0.25;
            if (shortages.indexOf('燃料') >= 0) delta -= 0.12;
        }
        state.morale = Utils.clamp(state.morale + delta * hours, 0, 100);

        state.rates = rates;
        state.shortages = shortages;
        return { gains: gains, shortages: shortages };
    }

    window.ProductionEngine = { computeProduction, advance, moraleMult, rateOf };
})();
