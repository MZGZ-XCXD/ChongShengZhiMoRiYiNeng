/* 建设：设施升级与据点迁移 */
(function () {
    /* 迁移时搬不走的设施（防御工事），会按投入返还一半材料 */
    const DEFENSE_FACILITIES = ['doorReinforce', 'fence', 'wall', 'tower', 'traps', 'armory'];

    function baseOf(state) {
        return BASES_CONFIG.find(b => b.id === state.base.id) || BASES_CONFIG[0];
    }

    function tierAllowed(state, id) {
        const cfg = FACILITIES_CONFIG[id];
        const base = baseOf(state);
        return base.tiers.indexOf(cfg.tier) >= 0;
    }

    function reqMet(state, id, targetLevel) {
        for (const r of reqListFor(id, targetLevel)) {
            const cur = state.facilities[r[0]] ? state.facilities[r[0]].level : 0;
            if (cur < r[1]) return false;
        }
        return true;
    }

    function reqText(id) {
        const cfg = FACILITIES_CONFIG[id];
        if (!cfg.req) return '';
        return cfg.req.map(r => (FACILITIES_CONFIG[r[0]] ? FACILITIES_CONFIG[r[0]].name : r[0]) + ' Lv' + r[1]).join('、');
    }

    /* 升到某一级要满足的前置：cfg.req 是一直有效的基础前置，
       cfg.reqAt 是「升到某一级之后追加的前置」—— 越往上越苛刻靠它。 */
    function reqListFor(id, targetLevel) {
        const cfg = FACILITIES_CONFIG[id];
        const need = (cfg.req || []).slice();
        for (const r of (cfg.reqAt || [])) {
            if ((targetLevel || 1) >= r.level) for (const q of r.req) need.push(q);
        }
        return need;
    }

    function reqTextFor(id, targetLevel) {
        const need = reqListFor(id, targetLevel);
        if (!need.length) return '';
        return need.map(r => (FACILITIES_CONFIG[r[0]] ? FACILITIES_CONFIG[r[0]].name : r[0]) + ' Lv' + r[1]).join('、');
    }

    function costFor(state, id, level) {
        const cfg = FACILITIES_CONFIG[id];
        const raw = (cfg.cost && cfg.cost(level)) || {};
        const e = EffectsManager.get(state);
        const k = Math.max(0.3, 1 + (e.buildCost || 0));
        const out = {};
        for (const r in raw) out[r] = Math.max(1, Math.round(raw[r] * k));
        return out;
    }

    function status(state, id) {
        const cfg = FACILITIES_CONFIG[id];
        const rec = state.facilities[id];
        const target = rec.level + 1;
        const out = {
            id: id, cfg: cfg, level: rec.level, max: cfg.maxLevel,
            tierAllowed: tierAllowed(state, id), reqOk: reqMet(state, id, target), target: target,
            cost: null, can: false, reason: '', maxed: rec.level >= cfg.maxLevel,
        };
        if (!out.tierAllowed) {
            out.reason = '这是 ' + cfg.tier + ' 级设施，需要更大的据点';
            return out;
        }
        if (out.maxed) { out.reason = '已经满级'; return out; }
        if (!out.reqOk) { out.reason = '升到 Lv' + target + ' 需要先有：' + reqTextFor(id, target); return out; }
        out.cost = costFor(state, id, target);
        out.can = ResourcesManager.canAfford(out.cost, state);
        if (!out.can) out.reason = '还差 ' + EventEngine.gainText(ResourcesManager.missing(out.cost, state));
        return out;
    }

    function build(state, id) {
        const st = status(state, id);
        if (st.maxed) return { ok: false, msg: '「' + st.cfg.name + '」已经满级了。' };
        if (!st.tierAllowed) return { ok: false, msg: st.reason };
        if (!st.reqOk) return { ok: false, msg: st.reason };
        if (!st.can) return { ok: false, msg: '物资不够，' + st.reason };
        ResourcesManager.spend(st.cost, state);
        state.facilities[id].level += 1;
        state.facilities[id].visible = true;
        EffectsManager.refreshAllEffects(state);
        ProductionEngine.computeProduction(state);
        EventEngine.addLog(state, '🏗️ 「' + st.cfg.name + '」升到 Lv' + state.facilities[id].level + '。');
        Actions.spend(state, 'build');
        AchievementEngine.check(state);
        return { ok: true, msg: '「' + st.cfg.name + '」Lv' + state.facilities[id].level };
    }

    /* 事件 / 剧情赠送的免费升级 */
    function freeLevel(state, id, n) {
        const rec = state.facilities[id];
        const cfg = FACILITIES_CONFIG[id];
        if (!rec || !cfg) return { ok: false, name: '' };
        const before = rec.level;
        rec.level = Math.min(cfg.maxLevel, rec.level + (n || 1));
        rec.visible = true;
        if (rec.level === before) return { ok: false, name: cfg.name };
        EffectsManager.refreshAllEffects(state);
        ProductionEngine.computeProduction(state);
        return { ok: true, name: cfg.name };
    }

    function listFor(state) {
        return FACILITIES_ORDER.map(id => status(state, id));
    }

    function counts(state) {
        let built = 0, defense = 0;
        for (const id in state.facilities) {
            const lv = state.facilities[id].level;
            if (!lv) continue;
            built += 1;
            if (DEFENSE_FACILITIES.indexOf(id) >= 0) defense += lv;
        }
        return { built: built, defenseLevels: defense };
    }

    /* ---------------- 据点迁移 ---------------- */
    function moveStatus(state, id) {
        const cfg = BASES_CONFIG.find(b => b.id === id);
        if (!cfg) return { ok: false, reason: '没有这个据点。', cfg: null };
        if (cfg.id === state.base.id) return { ok: false, reason: '已经在这里了。', cfg: cfg };
        const reasons = [];
        if (cfg.req) {
            if (cfg.req.hours && state.hours < cfg.req.hours) reasons.push('需要存活 ' + Utils.fmtHours(cfg.req.hours));
            if (cfg.req.raidsWon && state.raid.wins < cfg.req.raidsWon) reasons.push('需要守住 ' + cfg.req.raidsWon + ' 次恶性事件');
            if (cfg.req.rebirth && state.rebirth.count < cfg.req.rebirth) reasons.push('需要重生 ' + cfg.req.rebirth + ' 次');
        }
        if (cfg.moveCost && !ResourcesManager.canAfford(cfg.moveCost, state)) {
            reasons.push('还差 ' + EventEngine.gainText(ResourcesManager.missing(cfg.moveCost, state)));
        }
        return { ok: reasons.length === 0, reason: reasons.join('；'), cfg: cfg };
    }

    /* 防御工事的投入（返还一半用） */
    function refundOf(state) {
        const refund = {};
        for (const id of DEFENSE_FACILITIES) {
            const lv = state.facilities[id] ? state.facilities[id].level : 0;
            const cfg = FACILITIES_CONFIG[id];
            for (let l = 1; l <= lv; l++) {
                const c = (cfg.cost && cfg.cost(l)) || {};
                for (const r in c) refund[r] = (refund[r] || 0) + c[r] * 0.5;
            }
        }
        const out = {};
        for (const r in refund) out[r] = Math.round(refund[r]);
        return out;
    }

    function move(state, id) {
        const st = moveStatus(state, id);
        if (!st.ok) return { ok: false, msg: st.reason };
        const cfg = st.cfg;
        if (cfg.moveCost) ResourcesManager.spend(cfg.moveCost, state);
        const refund = refundOf(state);
        const oldBase = baseOf(state);
        state.base.id = cfg.id;
        state.base.moved += 1;
        /* 防御工事搬不走：等级清零，返还一半材料（界面里提前写明，不做突然的永久损失） */
        for (const fid of DEFENSE_FACILITIES) state.facilities[fid].level = 0;
        const added = ResourcesManager.add(refund, state);
        EffectsManager.refreshAllEffects(state);
        ProductionEngine.computeProduction(state);
        EventEngine.addLog(state, '🚚 据点迁往「' + cfg.name + '」（从「' + oldBase.name + '」）。防御工事重建，返还 ' +
            EventEngine.gainText(added));
        AchievementEngine.check(state);
        return { ok: true, msg: '已迁往「' + cfg.name + '」', refund: added };
    }

    window.BuildEngine = {
        DEFENSE_FACILITIES, baseOf, tierAllowed, reqMet, reqText, reqListFor, reqTextFor, costFor, status,
        build, freeLevel, listFor, counts, moveStatus, move, refundOf,
    };
})();
