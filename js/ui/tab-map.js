/* 地图页：一张城区地图 + 地图下方的行动抽屉 */
(function () {
    const G = window.UI;

    function doomBanner(s) {
        const d = DOOMS_CONFIG[s.doom] || {};
        const pre = PhaseManager.id(s) === 'pre';
        const ready = ScavengeEngine.listStatus(s).filter(x => x.ok).length;
        return '<div class="strip banner-doom" data-tip="doom">' +
            '<span class="strip-tag">' + (d.icon || '') + ' ' + G.esc(d.name || '') + '</span>' +
            '<span class="strip-main">' + G.esc(pre
                ? '你知道接下来会发生什么。趁世界还安静，把能搬的都搬进空间。'
                : (d.tagline || '')) + '</span>' +
            (pre ? '<span class="strip-clock" data-tip="countdown">还有 ' +
                Utils.fmtCountdown(Math.max(0, 72 - s.hours)) + '</span>' : '') +
            '<span class="strip-count">现在能去 ' + ready + ' 个地方</span>' +
            (pre ? '<span class="strip-count">每次出门 ' + ACTION_COSTS.scavenge + ' 小时</span>' : '') +
            '</div>';
    }

    function render() {
        const s = GameState;
        return doomBanner(s) + MapView.render(s);
    }

    window.TabMap = { render, doomBanner };
})();
