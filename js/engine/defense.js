/* 防线：恶性事件的排期、预警、结算（守不住就直接触发重生） */
(function () {
    function warningHours(state) {
        return Math.max(2, 4 + EffectsManager.additive(state, 'warning'));
    }

    function strength(state) {
        const doom = DOOMS_CONFIG[state.doom] || {};
        const apoc = Math.max(0, state.hours - PHASES_CONFIG[1].start);
        /* 乘数型成长一定要递减（避坑清单第 3 节）：用 sqrt。
           apoc / 6 意味着 200 小时之后，只加固门窗的据点已经顶不住了 —— 逼玩家修工事、换大据点。 */
        const timeFactor = 1 + Math.sqrt(apoc / 6);
        const rebirthFactor = 1 + state.rebirth.count * 0.28;
        const base = BuildEngine.baseOf(state);
        let s = 14 * (doom.raidPower || 1) * timeFactor * rebirthFactor * (1 + (base.raidPower || 0));
        s *= (1 + EffectsManager.additive(state, 'raidPower'));
        s *= MoneyEngine.raidMultiplier(state);      // 仇家越多，来的越狠
        return Math.max(5, Math.round(s));
    }

    /* 仇家攒够了，袭击就不再是「末日里的事」，而是有人专门来清算 */
    function raidName(state) {
        const doom = DOOMS_CONFIG[state.doom] || {};
        if (state.heat >= HEAT_RULES.raidAt) return '仇家清算';
        return doom.raidName || '恶性事件';
    }

    function schedule(state) {
        const rate = Math.max(-0.5, EffectsManager.additive(state, 'raidRate'));
        let interval = Math.max(6, 30 - state.hours / 60);
        interval *= (1 + rate);
        /* 第一场袭击不会早于爆发阶段的第 18 小时（重生之后也一样） */
        const earliest = PHASES_CONFIG[1].start + 18;
        state.raid.nextAt = Math.max(state.hours + Math.max(5, interval), earliest);
        state.raid.warned = false;
    }

    function inWarning(state) {
        if (!PhaseManager.isAtLeast(state, 'outbreak')) return false;
        if (!state.raid.nextAt) return false;
        return state.hours >= state.raid.nextAt - warningHours(state);
    }

    function info(state) {
        const def = PlayerManager.defense(state);
        const str = strength(state);
        const doom = DOOMS_CONFIG[state.doom] || {};
        let verdict = '危险';
        if (def >= str * 1.3) verdict = '稳';
        else if (def >= str) verdict = '勉强能守';
        return {
            nextAt: state.raid.nextAt,
            etaHours: Math.max(0, (state.raid.nextAt || 0) - state.hours),
            warning: warningHours(state),
            inWarning: inWarning(state),
            strength: str,
            defense: def,
            ratio: def / Math.max(1, str),
            verdict: verdict,
            doomName: raidName(state),
            heat: state.heat,
            active: PhaseManager.isAtLeast(state, 'outbreak'),
        };
    }

    function tick(state) {
        if (!PhaseManager.isAtLeast(state, 'outbreak')) return;
        if (!state.raid.nextAt) { schedule(state); return; }
        if (!state.raid.warned && inWarning(state)) {
            state.raid.warned = true;
            StoryEngine.trigger(state, 'firstRaid');
            EventEngine.addLog(state, '🚨 预警：「' + info(state).doomName + '」大约还有 ' +
                Utils.fmtCountdown(Math.max(0, state.raid.nextAt - state.hours)) + ' 就到了。');
        }
        if (state.hours < state.raid.nextAt) return;
        resolve(state);
    }

    function resolve(state) {
        const def = PlayerManager.defense(state);
        const str = strength(state);
        const rec = {
            hours: state.hours, name: raidName(state),
            strength: str, defense: def, win: def >= str, doom: state.doom,
        };
        state.raid.count += 1;
        if (def >= str) {
            state.raid.wins += 1;
            state.stats.raidsWon += 1;
            PlayerManager.addMorale(state, 6);
            const crystal = PlayerManager.addCrystal(state, 6 + Math.floor(str / 30), '守住「' + rec.name + '」');
            const loot = ResourcesManager.add({
                '弹药': Math.round(2 + str / 25),
                '食物': Math.round(4 + str / 20),
            }, state);
            rec.crystal = crystal;
            EventEngine.addLog(state, '🛡️ 守住了「' + rec.name + '」（防御 ' + def + ' vs 强度 ' + str + '）' +
                (Object.keys(loot).length ? '，缴获 ' + EventEngine.gainText(loot) : ''));
            if (window.UI && UI.toast) UI.toast('🛡️ 守住了：' + rec.name, 'gold');
        } else {
            state.raid.losses += 1;
            state.stats.raidsLost += 1;
            rec.lost = true;
            EventEngine.addLog(state, '💀 「' + rec.name + '」没能守住（防御 ' + def + ' vs 强度 ' + str + '）。');
            state.raid.history.unshift(rec);
            if (state.raid.history.length > 20) state.raid.history.length = 20;
            RebirthEngine.onDefeat(state, rec);
            schedule(state);
            AchievementEngine.check(state);
            return rec;
        }
        state.raid.history.unshift(rec);
        if (state.raid.history.length > 20) state.raid.history.length = 20;
        schedule(state);
        AchievementEngine.check(state);
        return rec;
    }

    window.DefenseEngine = { strength, schedule, tick, resolve, info, warningHours, inWarning, raidName };
})();
