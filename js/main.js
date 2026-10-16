/* 入口：初始化或读档 → 主题 → 渲染 → 启动主循环 */
(function () {
    /* 1 现实秒 = 0.05 游戏小时（3 游戏分钟）：末日前 72 小时约等于 24 分钟 */
    window.HOURS_PER_SECOND = 0.05;

    const s = GameState;
    initState();

    const hadSave = SaveEngine.hasSave();
    let loaded = false;
    if (hadSave) {
        try { loaded = SaveEngine.load(s); }
        catch (e) { console.error('读档失败', e); loaded = false; }
    }
    if (!loaded) {
        EffectsManager.refreshAllEffects(s);
        ProductionEngine.computeProduction(s);
    }
    s.speed = s.settings.speed || 1;

    App.applyTheme();
    App.render(true);
    GameLoop.start();

    /* 新档：从序章开始（用剧情浮窗当引导，比额外弹一个欢迎窗更连贯） */
    if (!loaded) {
        if (SaveEngine.consumeResetMark()) {
            EventEngine.addLog(s, '🧹 存档已清除，从头开始。');
            setTimeout(() => UI.toast('🧹 存档已清除，从头开始', 'gold'), 500);
        }
        if (!StoryEngine.seen(s, 'prologue')) StoryEngine.startNewGame(s);
        App.render(true);
    } else if (s.offlineReport && s.offlineReport.seconds >= 60) {
        setTimeout(() => Modals.offlineModal(), 350);
    }

    /* 离开页面时保存 */
    window.addEventListener('beforeunload', () => {
        if (s.settings.autosave) SaveEngine.save(s);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && s.settings.autosave) SaveEngine.save(s);
    });
    window.addEventListener('error', e => {
        console.error('运行时错误', e.error || e.message);
    });
})();
