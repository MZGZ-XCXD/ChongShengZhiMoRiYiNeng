/* 防线页：下次袭击、防御构成、历史记录 */
(function () {
    const G = window.UI;

    function render() {
        const s = GameState;
        const info = DefenseEngine.info(s);
        const doom = DOOMS_CONFIG[s.doom] || {};
        let html = '';

        if (!info.active) {
            html += '<div class="banner"><div class="banner-title">🌤️ 现在还没有袭击</div>' +
                '<div class="banner-line">末日爆发之后，' + G.esc(doom.raidName || '恶性事件') +
                ' 会一波一波地来。先把墙修起来。</div></div>';
        } else {
            html += '<div class="banner' + (info.inWarning ? ' danger' : '') + '">' +
                '<div class="banner-title">🚨 ' + G.esc(info.doomName) + '　还有 ' +
                    Utils.fmtCountdown(info.etaHours) + '</div>' +
                '<div class="banner-line">预计强度 <b>' + info.strength + '</b>　我方防御 <b>' + info.defense +
                    '</b>　判定：<b>' + info.verdict + '</b></div>' +
                '<div class="banner-line">预警时间 ' + info.warning + ' 小时（哨塔、监控、雷达站都能拉长这个时间）</div>' +
                '<div class="banner-line">这次来的是：' + EncounterEngine.namesOf(s.doom).join('、') + '</div>' +
                '</div>';
        }

        html += '<div class="panel-box"><div class="panel-head"><span class="panel-title">防御构成</span>' +
            '<span class="panel-extra" data-tip="def">明细</span></div>' +
            '<div class="stat-list">' +
            '<div class="stat-row"><span>据点基础（' + G.esc(BuildEngine.baseOf(s).name) + '）</span><span>' +
                BuildEngine.baseOf(s).defense + '</span></div>' +
            '<div class="stat-row"><span>主角与同伴战力</span><span>' + PlayerManager.combatPower(s) +
                '（×0.8 = ' + Math.round(PlayerManager.combatPower(s) * 0.8) + '）</span></div>' +
            '<div class="stat-row"><span>设施</span><span>' + Utils.fmtInt(EffectsManager.get(s).defenseFlat || 0) + '</span></div>' +
            '<div class="stat-row"><span>加成</span><span>' + Utils.fmtPct(EffectsManager.get(s).defense || 0, 0) + '</span></div>' +
            '<div class="stat-row"><span>合计</span><span><b>' + PlayerManager.defense(s) + '</b></span></div>' +
            '</div></div>';

        const defFacs = BuildEngine.DEFENSE_FACILITIES.map(id => BuildEngine.status(s, id));
        html += '<h3 class="sec-title">防御工事</h3><div class="grid">' + defFacs.map(st => {
            const cfg = st.cfg;
            const cls = !st.tierAllowed ? 'locked' : (st.maxed ? 'done' : (st.can ? 'ok' : 'wait'));
            const sub = !st.tierAllowed ? '需要更大的据点（' + cfg.tier + ' 级设施）'
                : (st.maxed ? '已满级' : ('升到 Lv' + (st.level + 1) + '：' + G.costHtml(st.cost || {})));
            return '<div class="card fac-card ' + cls + '" data-tip="fac|' + cfg.id + '"' +
                (st.can ? ' data-act="build|' + cfg.id + '"' : '') + '>' +
                '<div class="card-head"><span class="card-icon">' + cfg.icon + '</span>' +
                '<div class="card-titles"><div class="card-title">' + G.esc(cfg.name) + ' <span class="lv">Lv' + st.level + '</span></div>' +
                '<div class="card-sub">' + sub + '</div></div></div>' +
                '<div class="card-foot">' + (st.can ? '<span class="build-go">升级</span>'
                    : '<span class="need-chip">' + G.esc(st.reason) + '</span>') + '</div></div>';
        }).join('') + '</div>';

        const hist = (s.raid.history || []).slice(0, 10);
        html += '<h3 class="sec-title">袭击记录（守住 ' + s.raid.wins + ' 次 / 失守 ' + s.raid.losses + ' 次）</h3>' +
            '<div class="panel-box">' + (hist.length ? '<div class="stat-list">' + hist.map(h =>
                '<div class="stat-row"><span>' + (h.win ? '🛡️' : '💀') + ' ' + G.esc(h.name) + '　' +
                    Utils.fmtHours(h.hours) + '</span><span>强度 ' + h.strength + ' / 防御 ' + h.defense + '</span></div>').join('') +
                '</div>' : '<div class="empty">还没有打过。</div>') + '</div>';

        html += '<div class="panel-box"><div class="panel-head"><span class="panel-title">' + doom.icon + ' ' +
            G.esc(doom.name) + ' 的规矩</span></div>' +
            (doom.rules || []).map(t => '<div class="tip-li">· ' + G.esc(t) + '</div>').join('') + '</div>';
        return html;
    }

    window.TabDefense = { render };
})();
