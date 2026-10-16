/* 主循环：推进时间、结算产出、驱动各子系统 */
(function () {
    const state = GameState;
    let last = 0, acc = 0, renderAcc = 0, saveAcc = 0, secondAcc = 0, autoAcc = 0;
    let running = false;
    const seenErrors = {};

    /* 任何一步抛错都只跳过这一帧，绝不打断 rAF 链（否则玩家看到的是「卡死要刷新」） */
    function safeCall(tag, fn) {
        try { fn(); }
        catch (err) {
            const key = tag + ':' + (err && err.message ? err.message : String(err));
            if (!seenErrors[key]) {
                seenErrors[key] = 1;
                console.error('[主循环] ' + tag + ' 出错：', err);
                if (window.UI && UI.toast) UI.toast('内部错误，已跳过这一帧（详情见控制台）。', 'bad');
            }
        }
    }

    function gameHoursPerSecond() {
        const e = EffectsManager.get(state);
        return (window.HOURS_PER_SECOND || 0.05) * (state.speed || 1) * (1 + (e.runSpeed || 0));
    }

    function advance(dtReal) {
        if (dtReal <= 0) return;
        /* 末日前的三天是按行动回合算的：没人操作就不会到爆发。
           时间推进交给 GameLoop.passTime（由搜刮 / 施工 / 送礼这些动作触发）。 */
        if (PhaseManager.id(state) === 'pre') return;
        const hours = dtReal * gameHoursPerSecond();
        const before = state.hours;
        state.hours += hours;
        state.stats.playSeconds += dtReal;
        if (state.hours > state.stats.bestHours) state.stats.bestHours = state.hours;

        ProductionEngine.advance(state, hours);

        safeCall('story', () => StoryEngine.tick(state, before, state.hours));
        safeCall('scavenge', () => ScavengeEngine.tick(state, hours));
        safeCall('events', () => EventEngine.tick(state, hours));
        safeCall('bonds', () => BondEngine.tick(state, hours));
        safeCall('defense', () => DefenseEngine.tick(state, before, state.hours));
        safeCall('money', () => MoneyEngine.tick(state));
        safeCall('achievements', () => AchievementEngine.check(state));

        const p = PhaseManager.current(state);
        if (p.id !== state.phase) {
            state.phase = p.id;
            EventEngine.addLog(state, '⏱️ 进入「' + p.name + '」阶段。');
        }
    }

    /* 按「游戏小时」推进（行动回合、离线结算、自检都用它）：
       走同一套子系统，所以时间一到该刷新的刷新、该来的袭击还是会来。 */
    function passTime(hours) {
        if (hours <= 0) return state.hours;
        const before = state.hours;
        state.hours += hours;
        if (state.hours > state.stats.bestHours) state.stats.bestHours = state.hours;
        safeCall('production', () => ProductionEngine.advance(state, hours));
        safeCall('story', () => StoryEngine.tick(state, before, state.hours));
        safeCall('scavenge', () => ScavengeEngine.tick(state));
        safeCall('events', () => EventEngine.tick(state, hours));
        safeCall('bonds', () => BondEngine.tick(state, hours));
        safeCall('defense', () => DefenseEngine.tick(state, before, state.hours));
        safeCall('money', () => MoneyEngine.tick(state));
        safeCall('achievements', () => AchievementEngine.check(state));
        const p = PhaseManager.current(state);
        if (p.id !== state.phase) {
            state.phase = p.id;
            EventEngine.addLog(state, '⏱️ 进入「' + p.name + '」阶段。');
        }
        return state.hours;
    }

    function tick(now) {
        if (!running) return;
        const dtReal = last ? Math.min(1.5, (now - last) / 1000) : 0;
        last = now;

        if (!state.paused) {
            acc += dtReal;
            let guard = 0;
            while (acc > 0.0001 && guard++ < 40) {
                const step = Math.min(0.1, acc);
                safeCall('advance', () => advance(step));
                acc -= step;
            }
            secondAcc += dtReal;
            if (secondAcc >= 1) {
                secondAcc = 0;
                safeCall('effects', () => EffectsManager.refreshAllEffects(state));
                state.stats.peakDefense = Math.max(state.stats.peakDefense || 0, PlayerManager.defense(state));
            }
            autoAcc += dtReal;
            if (autoAcc >= 0.6) {
                autoAcc = 0;
                safeCall('auto', () => Actions.autoStep(state));
            }
            saveAcc += dtReal;
            if (saveAcc >= 20 && state.settings.autosave) {
                saveAcc = 0;
                SaveEngine.save(state);
            }
        }

        renderAcc += dtReal;
        if (renderAcc >= 0.1) {
            renderAcc = 0;
            if (window.UI && UI.render) safeCall('render', () => UI.render());
        }
        requestAnimationFrame(tick);
    }

    function start() {
        if (running) return;
        running = true;
        last = 0;
        requestAnimationFrame(tick);
    }

    window.GameLoop = {
        start, advance, passTime, gameHoursPerSecond,
        actionCost(state, kind) { return Actions.actionCost(state, kind); },
        get running() { return running; },
    };
})();
