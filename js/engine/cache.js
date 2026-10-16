/* 隐藏物资点：发现 → 弹窗（剧情 + 地点）→ 搬走 / 只挑值钱的 / 先记下来 */
(function () {
    function of(state, locId) {
        const rec = state.locations[locId];
        return rec && rec.cache ? rec.cache : null;
    }
    function waiting(state, locId) {
        return !!of(state, locId);
    }

    function chance(state, loc) {
        const e = EffectsManager.get(state);
        return Utils.clamp(CACHE_RULES.baseChance * (1 + (e.hiddenFind || 0)), 0, 0.5);
    }

    /* 掷一个物资点：从地点自己的产出表里抓，量比正常搜刮多不少 */
    function roll(state, loc) {
        const kind = Utils.pick(CACHE_KINDS);
        const boost = kind.boost * Utils.rnd(CACHE_RULES.boostMin, CACHE_RULES.boostMax);
        const loot = {};
        const picks = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < picks; i++) {
            const entry = Utils.weightedPick(loc.loot, x => x.w);
            if (!entry) break;
            const amt = Math.max(1, Math.round(Utils.rnd(entry.min, entry.max) * boost));
            loot[entry.res] = (loot[entry.res] || 0) + amt;
        }
        return {
            kindId: kind.id, kind: kind,
            loot: loot,
            crystal: Utils.rndInt(kind.crystal[0], kind.crystal[1]),
            at: state.hours,
            location: loc.id, locationName: loc.name,
        };
    }

    /* 发现了：记在地点上，挂一个待处理的浮窗 */
    function discover(state, loc, cache) {
        if (state.pending) return null;
        const c = cache || roll(state, loc);
        state.locations[loc.id].cache = c;
        state.pending = { type: 'cache', id: loc.id };
        EventEngine.addLog(state, '📦 在' + loc.name + '发现了「' + c.kind.name + '」。');
        return c;
    }

    /* 空间还够装多少（提示用） */
    function spaceNote(state, cache) {
        let need = 0;
        for (const r in cache.loot) need += cache.loot[r] * ResourcesManager.spaceOf(r);
        const left = ResourcesManager.spaceLeft(state);
        return { need: Math.round(need), left: Math.round(left), enough: need <= left + 1e-6 };
    }

    /* 最值钱的那一样（按占用格数排序，占得多的通常是大件） */
    function bestRes(cache) {
        let best = null, bestW = -1;
        for (const r in cache.loot) {
            const w = ResourcesManager.spaceOf(r);
            if (w > bestW) { bestW = w; best = r; }
        }
        return best;
    }

    /* 搬走：'all' 全搬 / 'best' 只挑值钱的 / 'later' 先记下来 */
    function take(state, locId, mode) {
        const loc = ScavengeEngine.locOf(locId);
        const cache = of(state, locId);
        if (!loc || !cache) return { ok: false, msg: '这里没有藏起来的物资。' };
        if (mode === 'later') {
            state.pending = null;
            EventEngine.addLog(state, '📝 你记下了' + loc.name + '的「' + cache.kind.name + '」，准备回头再来搬。');
            return { ok: true, kept: true, text: '你记下了位置。地图上那个地点会留一个标记，物资点不会自己消失。' };
        }
        const want = {};
        if (mode === 'best') {
            const keep = bestRes(cache);
            if (keep) want[keep] = Math.max(1, Math.round(cache.loot[keep] / 2));
        } else {
            for (const r in cache.loot) want[r] = cache.loot[r];
        }
        const added = ResourcesManager.add(want, state);
        let crystal = 0;
        if (mode === 'all') crystal = PlayerManager.addCrystal(state, cache.crystal, '隐藏物资点');
        const lines = [];
        const got = EventEngine.gainText(added);
        if (got !== '无') lines.push('搬走：' + got);
        let leftOver = false;
        for (const r in want) if ((added[r] || 0) < want[r] - 0.5) leftOver = true;
        if (leftOver) lines.push('空间装不下，剩下一部分只能留在原地');
        if (crystal) lines.push('异能结晶 +' + crystal);
        if (mode === 'best') lines.push('大件太重，你只挑了最值钱的一批');
        /* 搬过 / 挑过之后，这里的提示就消失了 */
        state.locations[locId].cache = null;
        state.pending = null;
        EventEngine.addLog(state, '📦 ' + loc.name + '的「' + cache.kind.name + '」' +
            (mode === 'all' ? '搬空了。' : '挑走了一部分，剩下的留在了原地。'));
        AchievementEngine.check(state);
        return {
            ok: true, done: true, added: added, crystal: crystal, lines: lines,
            text: cache.kind.find,
        };
    }

    /* 自动搜刮时不弹窗：直接按「全搬」结算 */
    function autoTake(state, loc) {
        const c = roll(state, loc);
        state.locations[loc.id].cache = c;
        const r = take(state, loc.id, 'all');
        return r;
    }

    window.CacheEngine = { of, waiting, chance, roll, discover, take, autoTake, spaceNote, bestRes };
})();
