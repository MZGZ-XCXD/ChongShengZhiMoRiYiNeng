/* 主线剧情：什么时候弹、选项怎么走 */
(function () {
    function seen(state, id) { return !!state.story.seen[id]; }

    function present(state, id) {
        const cfg = STORY_CONFIG[id];
        if (!cfg) return false;
        if (cfg.once && seen(state, id)) return false;
        if (state.pending) return false;
        state.story.seen[id] = true;
        state.story.current = id;
        state.pending = { type: 'story', id: id };
        return true;
    }

    function trigger(state, id) { return present(state, id); }

    function tick(state) {
        if (state.pending) return;
        for (const id in STORY_CONFIG) {
            const cfg = STORY_CONFIG[id];
            if (cfg.trigger !== 'hours') continue;
            if (cfg.once && seen(state, id)) continue;
            if (cfg.phase && !BondEngine.phaseOk(state, cfg.phase)) continue;
            if (state.hours >= cfg.at) { present(state, id); return; }
        }
        if (PhaseManager.isAtLeast(state, 'apocalypse')) {
            if (present(state, 'apocalypse')) return;
            present(state, 'rebirthIntro');
        }
    }

    function resolve(state, choiceIndex) {
        const p = state.pending;
        if (!p || p.type !== 'story') return { ok: false, msg: '现在没有待处理的剧情。' };
        const cfg = STORY_CONFIG[p.id];
        if (!cfg) { state.pending = null; return { ok: false, msg: '剧情数据丢了。' }; }
        const ch = cfg.choices[choiceIndex];
        if (!ch) return { ok: false, msg: '没有这个选项。' };
        const res = EventEngine.applyChoice(state, ch, {});
        if (!res.ok) return res;
        state.story.current = null;
        if (res.action === 'awaken') return res;
        state.pending = null;
        return res;
    }

    function startNewGame(state) {
        return present(state, 'prologue');
    }

    function cfgText(id) {
        const cfg = STORY_CONFIG[id];
        return cfg ? cfg.title : '';
    }

    window.StoryEngine = { present, trigger, tick, resolve, startNewGame, seen, cfgText };
})();
