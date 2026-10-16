/* =========================================================
   效果聚合器
   空间技能 / 第二异能 / 成就 / 重生商店 / 羁绊协助 / 设施 / 临时事件 / 末日规则
   统一汇总成一份加成表。所有「加成键」都必须登记在这里 ——
   引擎不认识的键会告警并记录（不会静默失效），tools/scan-effect-keys.js 会全量扫描。
   ========================================================= */
(function () {
    /* 扫描脚本按这行字面量数组取值，改动时保持格式 */
    const ADDITIVE_KEYS = [
        'scavengeYield', 'scavengeUses', 'scavengeRefresh', 'lootLuck', 'hiddenFind',
        'spaceCap', 'spaceCapFlat',
        'facilityProd', 'defense', 'defenseFlat',
        'combatPower', 'combatPowerFlat',
        'buildCost', 'bondGain', 'giftEffect', 'giftExtra',
        'crystalGain', 'rebirthGain',
        'raidPower', 'raidRate', 'warning', 'eventRate',
        'residentCap', 'moraleRate', 'doomResist',
        'runSpeed', 'offlineHours', 'autoScavenge',
        'foodUse', 'powerUse',
    ];

    /* 每个键的显示名与格式：数值 → 文本只在这一处实现 */
    const EFFECT_META = {
        scavengeYield: { label: '搜刮产出', fmt: 'pct' },
        scavengeUses: { label: '每个地点搜刮次数', fmt: 'flat' },
        scavengeRefresh: { label: '地点刷新速度', fmt: 'pct' },
        lootLuck: { label: '稀有掉落', fmt: 'pct' },
        hiddenFind: { label: '发现隐藏物资点', fmt: 'pct' },
        spaceCap: { label: '空间容量', fmt: 'pct' },
        spaceCapFlat: { label: '空间容量', fmt: 'flat' },
        facilityProd: { label: '设施产出', fmt: 'pct' },
        defense: { label: '据点防御', fmt: 'pct' },
        defenseFlat: { label: '据点防御', fmt: 'flat' },
        combatPower: { label: '战力', fmt: 'pct' },
        combatPowerFlat: { label: '战力', fmt: 'flat' },
        buildCost: { label: '建设成本', fmt: 'pct' },
        bondGain: { label: '好感获取', fmt: 'pct' },
        giftEffect: { label: '送礼效果', fmt: 'pct' },
        giftExtra: { label: '每日送礼次数', fmt: 'flat' },
        crystalGain: { label: '异能结晶收益', fmt: 'pct' },
        rebirthGain: { label: '重生点收益', fmt: 'pct' },
        raidPower: { label: '恶性事件强度', fmt: 'pct' },
        raidRate: { label: '恶性事件间隔', fmt: 'pct' },
        warning: { label: '预警时间', fmt: 'hours' },
        eventRate: { label: '随机事件频率', fmt: 'pct' },
        residentCap: { label: '据点容纳', fmt: 'pct' },
        moraleRate: { label: '士气恢复', fmt: 'hourly' },
        doomResist: { label: '末日环境抗性', fmt: 'pct' },
        runSpeed: { label: '世界流速', fmt: 'pct' },
        offlineHours: { label: '离线结算时长', fmt: 'hours' },
        autoScavenge: { label: '自动搜刮效率', fmt: 'pct' },
        foodUse: { label: '食物与净水消耗', fmt: 'pct' },
        powerUse: { label: '燃料消耗', fmt: 'pct' },
    };

    const SPECIAL_LABELS = {
        autoBuild: '解锁自动建设',
        autoGift: '解锁自动送礼',
        offlinePerfect: '离线收益 100% 效率',
        keepAbility: '重生后保留第二异能',
        noAmbush: '搜刮不再遭遇埋伏',
        safeMove: '迁移不损失防御',
        seeHidden: '地图上标记隐藏物资点',
        extraCrossroad: '羁绊关键节点更容易触发',
    };

    const unknownKeys = new Map();

    function emptyEffects() {
        const e = { resources: {}, facilities: {}, specials: {}, unknown: [] };
        for (const k of ADDITIVE_KEYS) e[k] = 0;
        return e;
    }

    function noteUnknown(key, source) {
        if (!unknownKeys.has(key)) {
            unknownKeys.set(key, source || '?');
            console.warn('[效果聚合器] 引擎不认识的效果键：' + key + '（来源 ' + (source || '?') + '）');
        }
        return unknownKeys.get(key);
    }

    function applyEffect(e, eff, scale, source) {
        if (!eff) return;
        scale = scale === undefined ? 1 : scale;
        for (const key in eff) {
            const val = eff[key];
            if (val === undefined || val === null) continue;

            if (ADDITIVE_KEYS.indexOf(key) >= 0) {
                if (typeof val === 'number') e[key] += val * scale;
                continue;
            }
            if (key === 'resourceProd') {
                for (const r in val) {
                    if (!e.resources[r]) e.resources[r] = { prod: 0 };
                    e.resources[r].prod += val[r] * scale;
                }
                continue;
            }
            if (key === 'special') { e.specials[val] = true; continue; }
            if (FACILITIES_CONFIG[key]) {
                if (!e.facilities[key]) e.facilities[key] = { prod: 0, def: 0, cap: 0 };
                const f = e.facilities[key];
                if (typeof val.prod === 'number') f.prod += val.prod * scale;
                if (typeof val.def === 'number') f.def += val.def * scale;
                if (typeof val.cap === 'number') f.cap += val.cap * scale;
                continue;
            }
            if (RESOURCES_CONFIG[key] && typeof val === 'number') {
                if (!e.resources[key]) e.resources[key] = { prod: 0 };
                e.resources[key].prod += val * scale;
                continue;
            }
            e.unknown.push({ key: key, source: source || '?' });
            noteUnknown(key, source);
        }
    }

    function refreshAllEffects(state) {
        const e = emptyEffects();
        state.effects = e;

        /* 空间异能技能树 */
        for (const id in state.space.skills) {
            if (!state.space.skills[id]) continue;
            const cfg = SPACE_SKILLS[id];
            if (cfg && cfg.effect) applyEffect(e, cfg.effect, 1, '空间技能·' + cfg.name);
        }

        /* 第二异能 */
        if (state.ability && state.ability.id) {
            const ab = SECOND_ABILITIES[state.ability.id];
            if (ab && ab.effect) applyEffect(e, ab.effect, 1, '异能·' + ab.name);
        }

        /* 成就 */
        for (const id in state.achievements) {
            if (!state.achievements[id]) continue;
            const cfg = ACHIEVEMENTS_CONFIG.find(a => a.id === id);
            if (cfg && cfg.effect) applyEffect(e, cfg.effect, 1, '成就·' + cfg.name);
        }

        /* 重生商店 */
        for (const it of REBIRTH_SHOP) {
            const lv = state.rebirth.shop[it.id] || 0;
            if (!lv) continue;
            if (it.effect) applyEffect(e, it.effect(lv), 1, '重生·' + it.name);
            if (it.special && lv > 0) e.specials[it.special] = true;
            if (it.specials && lv > 0) for (const sp of it.specials) e.specials[sp] = true;
        }

        /* 羁绊协助：好感越高，协助越强 */
        for (const b of BONDS_CONFIG) {
            const st = state.bonds[b.id];
            if (!st || !st.met || !b.assist) continue;
            if (st.outcome === 'enemy' || st.outcome === 'dead' || st.outcome === 'left') continue;
            if (st.value < (b.assist.at || 0)) continue;
            const power = b.assist.per * (1 + st.value / 100);
            applyEffect(e, b.assist.effect, power, '羁绊·' + b.name);
        }

        /* 设施本身提供的全局加成 */
        for (const id in state.facilities) {
            const f = state.facilities[id];
            if (!f || !f.level) continue;
            const cfg = FACILITIES_CONFIG[id];
            if (cfg && cfg.effect) applyEffect(e, cfg.effect(f.level), 1, '设施·' + cfg.name);
        }

        /* 临时事件效果（到期由主循环清理） */
        for (const t of state.tempEffects) applyEffect(e, t.effect, 1, '事件·' + t.name);

        /* 末日类型的环境规则（受「末日环境抗性」削弱） */
        const doom = DOOMS_CONFIG[state.doom];
        if (doom && doom.mods && PhaseManager.isAtLeast(state, 'outbreak')) {
            applyEffect(e, doomEffect(e, doom), 1, '末日·' + doom.name);
        }

        return e;
    }

    /* 把末日规则里的特殊写法（facility / upkeep）整理成标准效果表 */
    function doomEffect(e, doom) {
        const resist = Utils.clamp(e.doomResist || 0, 0, 0.8);
        const k = 1 - resist;
        const out = {};
        for (const key in doom.mods) {
            const val = doom.mods[key];
            if (key === 'upkeep') continue;                 // 维护消耗由 production 直接读，不走效果表
            if (key === 'facility') {
                for (const fid in val) out[fid] = { prod: (val[fid].prod || 0) * k };
                continue;
            }
            if (key === 'resourceProd') {
                out.resourceProd = {};
                for (const r in val) out.resourceProd[r] = val[r] * k;
                continue;
            }
            out[key] = typeof val === 'number' ? val * k : val;
        }
        return out;
    }

    /* 末日带来的每小时维护消耗（洪水冲刷地基这类） */
    function doomUpkeep(state) {
        const doom = DOOMS_CONFIG[state.doom];
        if (!doom || !doom.mods || !doom.mods.upkeep) return null;
        if (!PhaseManager.isAtLeast(state, 'outbreak')) return null;
        const resist = Utils.clamp(EffectsManager.get(state).doomResist || 0, 0, 0.8);
        const out = {};
        for (const r in doom.mods.upkeep) out[r] = doom.mods.upkeep[r] * (1 - resist);
        return out;
    }

    const EffectsManager = {
        ADDITIVE_KEYS, EFFECT_META, SPECIAL_LABELS,
        emptyEffects, applyEffect, refreshAllEffects, doomEffect, doomUpkeep,
        unknownKeys,
        get(state) { return state.effects || refreshAllEffects(state); },
        additive(state, key) {
            const e = this.get(state);
            return e[key] || 0;
        },
        hasSpecial(state, key) { return !!this.get(state).specials[key]; },
        resourceMult(state, res) {
            const e = this.get(state);
            const r = e.resources[res];
            return Math.max(0, 1 + (r ? r.prod : 0));
        },
        facilityMult(state, id) {
            const e = this.get(state);
            const f = e.facilities[id];
            return Math.max(0, 1 + (f ? f.prod : 0));
        },
        unknownList() {
            const out = [];
            unknownKeys.forEach((src, key) => out.push({ key: key, source: src }));
            return out;
        },
    };

    window.EffectsManager = EffectsManager;
})();
