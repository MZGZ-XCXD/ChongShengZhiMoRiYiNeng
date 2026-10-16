/* 全局状态、资源与空间容量管理 */
(function () {
    const SAVE_VERSION = 1;

    const GameState = {
        version: SAVE_VERSION,
        hours: 0,               // 本轮已经过去的小时数（每轮重生都从 0 开始）
        phase: 'pre',
        doom: 'zombie',         // 本轮末日类型
        paused: false,
        speed: 1,
        morale: 60,             // 士气：影响设施产出与防御
        resources: {},
        space: null,            // 空间异能：等级 / 技能 / 结晶
        ability: null,          // 第二异能（觉醒抽卡）
        facilities: {},         // 据点设施
        base: null,
        locations: {},
        bonds: {},
        achievements: {},
        events: null,
        tempEffects: [],
        logs: [],
        pending: null,          // 当前弹出的剧情 / 事件 / 羁绊浮窗
        encounter: null,        // 正在进行的一场遭遇战（弹窗里选打或跑）
        heat: 0,                // 仇家：抢钱、动手都会记账
        heatCoolAt: 24,         // 下一次「仇家淡一点」的时间点
        raid: null,
        story: null,
        rebirth: null,
        flags: {},
        effects: null,
        stats: null,
        settings: null,
        lastSave: 0,
        lastTick: 0,
        offlineReport: null,
    };

    function freshSpace() {
        return {
            level: 1,
            skills: {},          // 技能 id → true
            crystals: 0,         // 异能结晶（重生也保留）
            totalCrystals: 0,
        };
    }

    function freshAbility() {
        return {
            id: null,            // 当前第二异能 id
            tier: null,
            history: [],         // 抽卡记录
            draws: 0,
            rolls: 0,            // 抽过多少次（每次抽都消耗结晶，费用按这个涨）
            pity: 0,             // 距上次抽到 A 级以上的次数
            awakened: false,     // 是否已经办过觉醒仪式（免费抽）
        };
    }

    function freshBase() {
        return { id: 'apartment', moved: 0, defenseBonus: 0 };
    }

    function freshRaid() {
        return {
            nextAt: 0, count: 0, wins: 0, losses: 0,
            history: [], warned: false, lastResult: null,
        };
    }

    function freshStory() {
        return { seen: {}, current: null, queue: [], revenge: 0, chapter: 0 };
    }

    function freshRebirth() {
        return {
            count: 0, points: 0, total: 0, shop: {},
            pending: null, lastReport: null, byDoom: {},
        };
    }

    function freshStats() {
        return {
            playSeconds: 0,
            startedAt: Date.now(),
            scavenges: 0,
            scavengesByLocation: {},
            crystalsEarned: 0,
            battles: 0, battlesWon: 0,
            raidsWon: 0, raidsLost: 0,
            gifts: 0,
            eventsResolved: 0,
            mates: 0,
            bestHours: 0,
            peakDefense: 0,
        };
    }

    function freshSettings() {
        return {
            theme: 'dark',
            autosave: true,
            speed: 1,
            autoScavenge: false,
            autoBuild: false,
            autoGift: false,
            confirmRebirth: true,
            hideWelcome: false,
        };
    }

    function initState() {
        const s = GameState;
        s.version = SAVE_VERSION;
        s.hours = 0;
        s.phase = 'pre';
        s.doom = pickDoom();
        s.paused = false;
        s.speed = 1;
        s.morale = 60;
        s.resources = {};
        s.space = freshSpace();
        s.ability = freshAbility();
        s.facilities = {};
        s.base = freshBase();
        s.locations = {};
        s.bonds = {};
        s.achievements = {};
        s.events = { pending: null, nextAt: 6, count: 0, lastAt: 0 };
        s.tempEffects = [];
        s.logs = [];
        s.pending = null;
        s.encounter = null;
        s.heat = 0;
        s.heatCoolAt = 24;
        s.raid = freshRaid();
        s.story = freshStory();
        s.rebirth = freshRebirth();
        s.flags = {};
        s.effects = null;
        s.stats = freshStats();
        s.settings = freshSettings();
        s.lastSave = Date.now();
        s.lastTick = Date.now();
        s.offlineReport = null;

        for (const k in RESOURCES_CONFIG) s.resources[k] = { amount: 0, visible: false };
        for (const loc of LOCATIONS_CONFIG) {
            s.locations[loc.id] = { uses: 0, at: 0, seen: false, total: 0, hidden: false };
        }
        for (const f of FACILITIES_ORDER) s.facilities[f] = { level: 0, visible: false };
        for (const b of BONDS_CONFIG) {
            s.bonds[b.id] = { met: false, value: 0, outcome: null, gifts: 0, lastGiftAt: -999, stage: 0, flag: {} };
        }
        for (const a of ACHIEVEMENTS_CONFIG) s.achievements[a.id] = false;
        for (const it of REBIRTH_SHOP) s.rebirth.shop[it.id] = 0;

        /* 开局：口袋里的东西 + 空间异能刚觉醒的一角 */
        s.resources['食物'].amount = 0;
        s.resources['现金'].amount = 800;
        s.resources['建材'].amount = 0;
        s.locations['home'].seen = true;
        s.locations['home'].uses = 0;
        s.events.nextAt = 4;
        s.raid.nextAt = PHASES_CONFIG[1].start + 18;
        s.rebirth.byDoom[s.doom] = (s.rebirth.byDoom[s.doom] || 0) + 1;
        return s;
    }

    function pickDoom() {
        const ids = Object.keys(DOOMS_CONFIG);
        return ids[Math.floor(Math.random() * ids.length)];
    }

    /* ---------------- 阶段 ---------------- */
    const PhaseManager = {
        current(state) {
            const h = state.hours;
            let cur = PHASES_CONFIG[0];
            for (const p of PHASES_CONFIG) if (h >= p.start) cur = p;
            return cur;
        },
        id(state) { return this.current(state).id; },
        isAtLeast(state, id) {
            const order = PHASES_CONFIG.map(p => p.id);
            return order.indexOf(this.id(state)) >= order.indexOf(id);
        },
        remainToOutbreak(state) { return Math.max(0, PHASES_CONFIG[1].start - state.hours); },
        crisis(state) {
            /* 0（刚重生）→ 1（末日就在眼前）：暴乱与危险度随时间上升 */
            return Utils.clamp(state.hours / PHASES_CONFIG[1].start, 0, 1);
        },
    };

    /* ---------------- 资源与空间 ---------------- */
    const ResourcesManager = {
        get(name) { return GameState.resources[name]; },
        amount(name) {
            const r = GameState.resources[name];
            return r ? r.amount : 0;
        },
        spaceOf(name) {
            const cfg = RESOURCES_CONFIG[name];
            return cfg && cfg.space ? cfg.space : 0;
        },
        spaceUsed(state) {
            let used = 0;
            for (const k in state.resources) {
                const sp = this.spaceOf(k);
                if (sp) used += state.resources[k].amount * sp;
            }
            return used;
        },
        spaceCap(state) {
            return window.AbilityEngine ? AbilityEngine.spaceCap(state) : 120;
        },
        spaceLeft(state) { return Math.max(0, this.spaceCap(state) - this.spaceUsed(state)); },
        /* 空间里还能装多少「单位」的这种资源 */
        room(state, name) {
            const sp = this.spaceOf(name);
            if (!sp) return Infinity;
            return Math.max(0, Math.floor(this.spaceLeft(state) / sp));
        },
        add(map, state) {
            state = state || GameState;
            const added = {};
            for (const k in map) {
                const r = state.resources[k];
                if (!r || !map[k]) continue;
                let v = map[k];
                if (v < 0) v = 0;
                const sp = this.spaceOf(k);
                if (sp) {
                    const room = this.spaceLeft(state);
                    const maxUnits = Math.floor(room / sp);
                    if (maxUnits <= 0) continue;
                    v = Math.min(v, maxUnits);
                }
                r.amount += v;
                if (!isFinite(r.amount)) r.amount = 0;
                r.visible = true;
                added[k] = (added[k] || 0) + v;
            }
            return added;
        },
        canAfford(map, state) {
            state = state || GameState;
            for (const k in map) {
                if (!map[k]) continue;
                const r = state.resources[k];
                if (!r || r.amount + 1e-9 < map[k]) return false;
            }
            return true;
        },
        spend(map, state) {
            state = state || GameState;
            if (!this.canAfford(map, state)) return false;
            for (const k in map) {
                if (!map[k]) continue;
                state.resources[k].amount -= map[k];
            }
            return true;
        },
        missing(map, state) {
            state = state || GameState;
            const out = {};
            for (const k in map) {
                const r = state.resources[k];
                const lack = map[k] - (r ? r.amount : 0);
                if (lack > 1e-9) out[k] = lack;
            }
            return out;
        },
        discard(state, name, amount) {
            const r = state.resources[name];
            if (!r) return 0;
            const take = Math.min(r.amount, amount === undefined ? r.amount : amount);
            r.amount -= take;
            if (r.amount < 1e-9) r.amount = 0;
            return take;
        },
    };

    /* ---------------- 结晶 / 士气 ---------------- */
    const PlayerManager = {
        addCrystal(state, n, reason) {
            if (!n) return 0;
            const gain = Math.max(0, Math.round(n * (1 + EffectsManager.additive(state, 'crystalGain'))));
            if (!gain) return 0;
            state.space.crystals += gain;
            state.space.totalCrystals += gain;
            state.stats.crystalsEarned += gain;
            if (reason) EventEngine.addLog(state, '💎 获得异能结晶 ×' + gain + '（' + reason + '）');
            return gain;
        },
        addMorale(state, n) {
            state.morale = Utils.clamp(state.morale + n, 0, 100);
        },
        combatPower(state) {
            const e = EffectsManager.get(state);
            const lv = state.space.level;
            let base = 6 + lv * 4;
            if (state.ability.id) {
                const ab = SECOND_ABILITIES[state.ability.id];
                if (ab) base += ab.power;
            }
            base += (e.combatPowerFlat || 0);
            let power = base * (1 + (e.combatPower || 0));
            for (const b of BONDS_CONFIG) {
                const st = state.bonds[b.id];
                if (!st || !st.met || st.outcome === 'enemy' || st.outcome === 'dead') continue;
                if (b.fight && st.value >= (b.fight.at || 0)) power += b.fight.power * (1 + st.value / 100);
            }
            return Math.round(power);
        },
        /* 据点防御 = 设施防御 + 主角/同伴战力 + 基础防御 */
        defense(state) {
            const e = EffectsManager.get(state);
            const base = BASES_CONFIG.find(b => b.id === state.base.id) || BASES_CONFIG[0];
            let def = base.defense + PlayerManager.combatPower(state) * 0.8 + (e.defenseFlat || 0);
            let mult = 1 + (e.defense || 0);
            mult *= 0.85 + state.morale / 100 * 0.3;
            return Math.round(def * mult);
        },
        residentCap(state) {
            const base = BASES_CONFIG.find(b => b.id === state.base.id) || BASES_CONFIG[0];
            const e = EffectsManager.get(state);
            return Math.floor(base.residentCap * (1 + (e.residentCap || 0)));
        },
        companionCount(state) {
            let n = 0;
            for (const b of BONDS_CONFIG) {
                const st = state.bonds[b.id];
                if (st && st.met && st.outcome !== 'enemy' && st.outcome !== 'dead' && st.outcome !== 'left') n++;
            }
            return n;
        },
    };

    window.GameState = GameState;
    window.initState = initState;
    window.freshSpace = freshSpace;
    window.freshAbility = freshAbility;
    window.freshBase = freshBase;
    window.freshRaid = freshRaid;
    window.freshStory = freshStory;
    window.freshRebirth = freshRebirth;
    window.freshStats = freshStats;
    window.freshSettings = freshSettings;
    window.pickDoom = pickDoom;
    window.SAVE_VERSION = SAVE_VERSION;
    window.ResourcesManager = ResourcesManager;
    window.PhaseManager = PhaseManager;
    window.PlayerManager = PlayerManager;
})();
