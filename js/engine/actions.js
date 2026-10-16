/* 统一动作：自动化推进、丢弃资源、速度设置 */
(function () {
    const AUTO_BUILD_ORDER = [
        'wall', 'tower', 'traps', 'doorReinforce', 'fence', 'farm', 'purifier', 'planter',
        'waterTank', 'generator', 'clinic', 'dorm', 'workshop', 'greenhouse', 'radar',
        'armory', 'powerStation', 'solarPanel', 'storeroom', 'medkit', 'toolbox', 'camera',
    ];

    /* 行动耗时：只在末日前那一阶段花时间（回合制）。
       爆发之后时间本来就在自己走，再额外扣时间就变成双重计时了。 */
    function actionCost(state, kind) {
        if (PhaseManager.id(state) !== 'pre') return 0;
        const c = ACTION_COSTS[kind];
        return typeof c === 'number' ? c : 0;
    }

    /* 花掉这次行动的时间，并让世界跟着走一格 */
    function spend(state, kind) {
        const hours = actionCost(state, kind);
        if (hours > 0) GameLoop.passTime(hours);
        return hours;
    }

    function autoBuild(state) {
        if (state.hours < (state.autoBuildAt || 0)) return 0;
        state.autoBuildAt = state.hours + 1.5;
        for (const id of AUTO_BUILD_ORDER) {
            const st = BuildEngine.status(state, id);
            if (!st.can) continue;
            BuildEngine.build(state, id);
            return 1;
        }
        return 0;
    }

    function autoStep(state) {
        if (state.paused) return;
        const e = EffectsManager.get(state);
        if (e.specials.autoBuild && state.settings.autoBuild) autoBuild(state);
        ScavengeEngine.autoStep(state);
    }

    function discard(state, name, amount) {
        const took = ResourcesManager.discard(state, name, amount);
        if (took > 0) {
            EventEngine.addLog(state, '🗑️ 丢掉了 ' + name + ' ' + Utils.fmtInt(took) + '。');
            PlayerManager.addMorale(state, -0.5);
        }
        return took;
    }

    function discardAll(state, name) {
        return discard(state, name, undefined);
    }

    function setSpeed(state, v) {
        state.speed = Utils.clamp(Number(v) || 1, 1, 4);
        state.settings.speed = state.speed;
        return state.speed;
    }

    window.Actions = { autoStep, autoBuild, discard, discardAll, setSpeed, actionCost, spend };
})();
