/* 成就：每达成一个给异能结晶（结晶跨重生保留，所以成就只会拿一次） */
(function () {
    const failed = {};

    function check(state, silent) {
        let got = 0;
        for (const a of ACHIEVEMENTS_CONFIG) {
            if (state.achievements[a.id]) continue;
            let ok = false;
            try { ok = !!a.cond(state); }
            catch (e) {
                if (!failed[a.id]) {
                    failed[a.id] = 1;
                    console.error('[成就条件] ' + a.id + ' 出错：', e);
                }
            }
            if (!ok) continue;
            state.achievements[a.id] = true;
            if (a.effect) EffectsManager.refreshAllEffects(state);
            const g = PlayerManager.addCrystal(state, a.crystal || 0, '成就·' + a.name);
            EventEngine.addLog(state, '🏆 成就达成：' + a.name + (g ? '（异能结晶 +' + g + '）' : ''));
            if (!silent && window.UI && UI.toast) UI.toast('🏆 成就：' + a.name, 'gold');
            got += 1;
        }
        return got;
    }

    function count(state) {
        let n = 0;
        for (const a of ACHIEVEMENTS_CONFIG) if (state.achievements[a.id]) n++;
        return n;
    }

    function list(state) {
        return ACHIEVEMENTS_CONFIG.map(a => ({ cfg: a, done: !!state.achievements[a.id] }));
    }

    window.AchievementEngine = { check, count, list };
})();
