/* 存档：localStorage、导入导出、离线结算、版本迁移（迁移必须幂等） */
(function () {
    const SAVE_KEY = 'echoes-of-doom-save';
    const LEGACY_SAVE_KEYS = [];
    const RESET_MARK = 'echoes-of-doom-just-reset';
    /* 清档之后要立刻重载页面，而重载会触发 beforeunload —— 那里的自动保存
       会把内存里的旧进度又写回来（等于删完就长回来）。这个开关用来按住它。 */
    let suspended = false;

    function readRaw() {
        try {
            const cur = localStorage.getItem(SAVE_KEY);
            if (cur) return { raw: cur, key: SAVE_KEY };
        } catch (e) { /* 忽略 */ }
        for (const k of LEGACY_SAVE_KEYS) {
            try {
                const old = localStorage.getItem(k);
                if (old) return { raw: old, key: k };
            } catch (e) { /* 忽略 */ }
        }
        return null;
    }

    function serialize(state) {
        const data = {};
        for (const k in state) {
            if (k === 'effects') continue;
            data[k] = state[k];
        }
        data.lastSave = Date.now();
        return JSON.stringify(data);
    }

    function save(state) {
        if (suspended && !window.__DOOM_TEST_IGNORE_SUSPEND) return false;
        try {
            localStorage.setItem(SAVE_KEY, serialize(state));
            state.lastSave = Date.now();
            return true;
        } catch (e) {
            console.warn('保存失败', e);
            return false;
        }
    }

    function hasSave() { return !!readRaw(); }

    /* ---------------------------------------------------------
       迁移：把旧结构升到当前 SAVE_VERSION。
       规则（避坑清单 1.3）：
       1) 每个迁移只做一件事，并且必须幂等 —— 连续跑两次结果一致，
          不能重复发奖励、重复扣材料。
       2) 迁移完必须做一次「补齐缺失字段」，新加的配置项对老档自动生效。
       3) 影响老档进度的迁移要写进 CHANGELOG。
       --------------------------------------------------------- */
    const MIGRATIONS = {
        /* 1: 首个公开版本，没有历史结构需要迁移。
              留一个显式的空实现，后续版本往这里加 2、3、…… */
    };

    function runMigrations(data) {
        const from = typeof data.version === 'number' ? data.version : 0;
        const notes = [];
        for (let v = from + 1; v <= SAVE_VERSION; v++) {
            const fn = MIGRATIONS[v];
            if (typeof fn === 'function') {
                fn(data);
                notes.push(v);
            }
        }
        data.version = SAVE_VERSION;
        return notes;
    }

    /* 把配置里新出现的东西补进存档（幂等；漏掉就会变成「界面里没有这一项」） */
    function ensureShape(state) {
        if (!state.space) state.space = freshSpace();
        if (!state.space.skills) state.space.skills = {};
        if (typeof state.space.level !== 'number') state.space.level = 1;
        if (typeof state.space.crystals !== 'number') state.space.crystals = 0;
        if (typeof state.space.totalCrystals !== 'number') state.space.totalCrystals = state.space.crystals;
        if (!state.ability) state.ability = freshAbility();
        if (!Array.isArray(state.ability.history)) state.ability.history = [];
        if (typeof state.ability.draws !== 'number') state.ability.draws = 0;
        if (typeof state.ability.rolls !== 'number') state.ability.rolls = state.ability.draws;
        if (typeof state.ability.pity !== 'number') state.ability.pity = 0;
        if (typeof state.ability.awakened !== 'boolean') state.ability.awakened = !!state.ability.id;
        if (!state.base) state.base = freshBase();
        if (!state.raid) state.raid = freshRaid();
        if (!Array.isArray(state.raid.history)) state.raid.history = [];
        if (!state.story) state.story = freshStory();
        if (!state.story.seen) state.story.seen = {};
        if (!Array.isArray(state.story.queue)) state.story.queue = [];
        if (typeof state.story.revenge !== 'number') state.story.revenge = 0;
        if (!state.rebirth) state.rebirth = freshRebirth();
        if (!state.rebirth.shop) state.rebirth.shop = {};
        if (!state.rebirth.byDoom) state.rebirth.byDoom = {};
        if (typeof state.rebirth.count !== 'number') state.rebirth.count = 0;
        if (typeof state.rebirth.points !== 'number') state.rebirth.points = 0;
        if (typeof state.rebirth.total !== 'number') state.rebirth.total = state.rebirth.points;
        if (!state.events) state.events = { pending: null, nextAt: 6, count: 0, lastAt: 0 };
        if (state.pending === undefined) state.pending = null;
        if (state.encounter === undefined) state.encounter = null;
        if (typeof state.heat !== 'number') state.heat = 0;
        if (typeof state.heatCoolAt !== 'number') state.heatCoolAt = state.hours + 24;
        if (!Array.isArray(state.tempEffects)) state.tempEffects = [];
        if (!Array.isArray(state.logs)) state.logs = [];
        if (!state.flags) state.flags = {};
        if (typeof state.morale !== 'number') state.morale = 60;
        if (typeof state.hours !== 'number') state.hours = 0;
        if (!DOOMS_CONFIG[state.doom]) state.doom = pickDoom();
        if (!state.stats) state.stats = freshStats();
        for (const k in freshStats()) if (state.stats[k] === undefined) state.stats[k] = freshStats()[k];
        if (!state.stats.scavengesByLocation) state.stats.scavengesByLocation = {};
        if (!state.settings) state.settings = freshSettings();
        for (const k in freshSettings()) if (state.settings[k] === undefined) state.settings[k] = freshSettings()[k];

        for (const k in RESOURCES_CONFIG) {
            if (!state.resources[k]) state.resources[k] = { amount: 0, visible: false };
            if (typeof state.resources[k].visible !== 'boolean') {
                state.resources[k].visible = state.resources[k].amount > 0;
            }
        }
        for (const loc of LOCATIONS_CONFIG) {
            if (!state.locations[loc.id]) state.locations[loc.id] = { uses: 0, at: 0, seen: false, total: 0, hidden: false };
            const l = state.locations[loc.id];
            if (typeof l.total !== 'number') l.total = 0;
            if (typeof l.hidden !== 'boolean') l.hidden = false;
        }
        for (const id of FACILITIES_ORDER) {
            if (!state.facilities[id]) state.facilities[id] = { level: 0, visible: false };
            if (typeof state.facilities[id].level !== 'number') state.facilities[id].level = 0;
        }
        for (const b of BONDS_CONFIG) {
            if (!state.bonds[b.id]) state.bonds[b.id] = { met: false, value: 0, outcome: null, gifts: 0, lastGiftAt: -999, stage: 0, flag: {} };
            const st = state.bonds[b.id];
            if (!st.flag) st.flag = {};
            if (typeof st.gifts !== 'number') st.gifts = 0;
            if (typeof st.lastGiftAt !== 'number') st.lastGiftAt = -999;
        }
        for (const a of ACHIEVEMENTS_CONFIG) {
            if (typeof state.achievements[a.id] !== 'boolean') state.achievements[a.id] = false;
        }
        for (const it of REBIRTH_SHOP) {
            if (typeof state.rebirth.shop[it.id] !== 'number') state.rebirth.shop[it.id] = 0;
        }
        return state;
    }

    function applyData(state, data) {
        initState();
        runMigrations(data);
        for (const k in data) {
            if (k === 'effects') continue;
            state[k] = data[k];
        }
        ensureShape(state);
        ProductionEngine.computeProduction(state);
        EffectsManager.refreshAllEffects(state);
        AchievementEngine.check(state, true);
        return state;
    }

    function load(state) {
        const found = readRaw();
        if (!found) return false;
        try {
            const data = JSON.parse(found.raw);
            if (!data || typeof data !== 'object') return false;
            const seconds = data.lastTick ? Math.max(0, (Date.now() - data.lastTick) / 1000) : 0;
            applyData(state, data);
            state.story.current = null;
            state.pending = null;
            state.encounter = null;
            if (seconds > 60) applyOffline(state, seconds);
            state.lastTick = Date.now();
            if (found.key !== SAVE_KEY) {
                save(state);
                try { localStorage.removeItem(found.key); } catch (e) { /* 忽略 */ }
            }
            return true;
        } catch (e) {
            console.error('读档失败', e);
            return false;
        }
    }

    /* 离线结算：设施照常产出（有上限），恶性事件不结算 —— 免得回来就发现据点没了 */
    function applyOffline(state, seconds) {
        /* 末日前是回合制：你不在的时候那三天不会自己往前走，也就没有离线收益 */
        if (PhaseManager.id(state) === 'pre') { state.offlineReport = null; return null; }
        const maxSec = (2 + EffectsManager.additive(state, 'offlineHours')) * 3600;
        const capped = Math.min(seconds, maxSec);
        if (capped < 60) return null;
        const gameHours = capped * (window.HOURS_PER_SECOND || 0.05) * (state.speed || 1);
        const factor = EffectsManager.hasSpecial(state, 'offlinePerfect') ? 1 : 0.6;
        const before = {};
        for (const k in state.resources) before[k] = state.resources[k].amount;
        ProductionEngine.advance(state, gameHours * factor, true);
        const gains = {};
        for (const k in state.resources) {
            const d = state.resources[k].amount - (before[k] || 0);
            if (d > 1e-6) gains[k] = d;
        }
        state.offlineReport = {
            seconds: capped, realSeconds: seconds, hours: gameHours * factor,
            factor: factor, gains: gains,
        };
        EventEngine.addLog(state, '🌙 离线 ' + Utils.fmtHours(gameHours) +
            '（效率 ' + Math.round(factor * 100) + '%）');
        return state.offlineReport;
    }

    function exportSave(state) {
        const json = serialize(state);
        try { return btoa(unescape(encodeURIComponent(json))); }
        catch (e) { return json; }
    }

    function importSave(state, text) {
        text = (text || '').trim();
        if (!text) return { ok: false, msg: '存档内容为空。' };
        let json = text;
        if (text[0] !== '{') {
            try { json = decodeURIComponent(escape(atob(text))); }
            catch (e) { return { ok: false, msg: '无法解析这段存档文本。' }; }
        }
        try {
            const data = JSON.parse(json);
            applyData(state, data);
            state.lastTick = Date.now();
            state.offlineReport = null;
            save(state);
            return { ok: true, msg: '存档导入成功。' };
        } catch (e) {
            return { ok: false, msg: '存档格式错误。' };
        }
    }

    function hardReset() {
        clearStorage();
        location.reload();
    }

    /* 真正把存档抹掉（不发重载，方便自检单独调用）：
       1) 先挂起保存，2) 删键，3) 留一个「刚清过档」的临时标记给刷新后的页面用 */
    function clearStorage() {
        suspended = true;
        try {
            /* __DOOM_TEST_IGNORE_SUSPEND 是给自检留的「拆掉守卫」开关（平时没人设置它）：
               用来验证 tools/check-reset.ps1 真的能抓到这个 bug —— 见 tools/check-reset.ps1 -UrlHash '#prefixbug' */
            if (typeof GameState !== 'undefined' && GameState.settings && !window.__DOOM_TEST_IGNORE_SUSPEND) {
                GameState.settings.autosave = false;
            }
            localStorage.removeItem(SAVE_KEY);
            for (const k of LEGACY_SAVE_KEYS) localStorage.removeItem(k);
        } catch (e) { /* 忽略 */ }
        try { sessionStorage.setItem(RESET_MARK, '1'); } catch (e) { /* 忽略 */ }
    }

    /* 刷新后的第一件事：看看上一页是不是刚清过档（是的话给玩家一句明确的反馈） */
    function consumeResetMark() {
        let hit = false;
        try {
            hit = sessionStorage.getItem(RESET_MARK) === '1';
            if (hit) sessionStorage.removeItem(RESET_MARK);
        } catch (e) { /* 忽略 */ }
        return hit;
    }

    window.SaveEngine = {
        save, load, hasSave, exportSave, importSave, hardReset,
        applyData, applyOffline, ensureShape, runMigrations,
        clearStorage, consumeResetMark,
        isSuspended() { return suspended; },
        SAVE_KEY, LEGACY_SAVE_KEYS, RESET_MARK, MIGRATIONS,
    };
})();
