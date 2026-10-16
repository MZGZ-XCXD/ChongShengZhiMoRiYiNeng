/* 成就页 */
(function () {
    const G = window.UI;

    function render() {
        const s = GameState;
        const list = AchievementEngine.list(s);
        const done = list.filter(x => x.done);
        const todo = list.filter(x => !x.done);
        const crystals = done.reduce((n, x) => n + (x.cfg.crystal || 0), 0);
        let html = '<div class="banner"><div class="banner-title">🏆 成就 ' + done.length + ' / ' + list.length + '</div>' +
            '<div class="banner-line">每完成一个成就给异能结晶（已从这里拿到 ' + crystals + ' 💎），' +
            '结晶跨重生保留，所以成就只需要做一次。</div></div>';
        html += '<div class="grid">' + done.map(card).join('') + '</div>';
        if (todo.length) {
            html += '<h3 class="sec-title">还没完成（' + todo.length + ' 个）</h3><div class="grid">' + todo.map(card).join('') + '</div>';
        }
        return html;
    }

    function card(x) {
        const a = x.cfg;
        return '<div class="card ach-card ' + (x.done ? 'done' : 'locked') + '" data-tip="ach|' + a.id + '">' +
            '<div class="card-head"><span class="card-icon">' + (x.done ? a.icon : '🔒') + '</span>' +
            '<div class="card-titles"><div class="card-title">' + G.esc(a.name) + '</div>' +
            '<div class="card-sub">' + G.esc(a.desc) + '</div></div></div>' +
            '<div class="card-foot"><span class="' + (x.done ? 'done-chip' : 'need-chip') + '">' +
            (x.done ? '已完成' : '未完成') + '　💎 ' + a.crystal + '</span></div></div>';
    }

    window.TabAchievements = { render };
})();
