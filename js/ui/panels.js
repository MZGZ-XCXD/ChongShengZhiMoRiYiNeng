/* 顶栏与侧栏：资源、空间、防线预警、事件入口、日志、状态 */
(function () {
    const G = window.UI;

    function renderHeader() {
        const s = GameState;
        const p = PhaseManager.current(s);
        const doom = DOOMS_CONFIG[s.doom] || {};
        const remain = Math.max(0, PHASES_CONFIG[1].start - s.hours);
        const html =
            '<div class="brand">' +
                '<span class="brand-mark">💠</span>' +
                '<h1>末日轮回</h1>' +
                '<span class="brand-sub">从S级空间异能开始</span>' +
            '</div>' +
            '<div class="topbar-stats">' +
                '<div class="top-stat" data-tip="phase"><span class="top-label">阶段</span>' +
                    '<span>' + p.icon + ' ' + p.name + '</span></div>' +
                '<div class="top-stat" data-tip="clock"><span class="top-label">生存</span>' +
                    '<span>' + Utils.fmtClock(s.hours) + '</span></div>' +
                '<div class="top-stat" data-tip="doom"><span class="top-label">末日</span>' +
                    '<span style="color:' + (doom.color || 'inherit') + '">' +
                    (doom.icon || '') + ' ' + (doom.name || '未知') + '</span></div>' +
                (p.id === 'pre'
                    ? '<div class="top-stat hot" data-tip="countdown"><span class="top-label">爆发倒计时</span>' +
                      '<span>' + Utils.fmtCountdown(remain) + '</span>' +
                      '<span class="top-sub">约 ' + Math.floor(remain / ACTION_COSTS.scavenge) + ' 次出门</span></div>'
                    : '') +
                '<div class="top-stat" data-tip="morale"><span class="top-label">士气</span><span>' +
                    Math.round(s.morale) + '%</span></div>' +
            '</div>' +
            '<div class="topbar-actions">' +
                '<button class="icon-btn' + (s.paused ? ' on' : '') + '" data-act="pause" title="暂停 / 继续">' +
                    (s.paused ? '▶' : '⏸') + '</button>' +
                (p.id === 'pre'
                    ? '<button class="icon-btn" disabled data-tip="speed">⏳</button>'
                    : '<button class="icon-btn" data-act="speed" data-tip="speed">×' + (s.speed || 1) + '</button>') +
                '<button class="icon-btn" data-act="theme" title="切换明暗主题">' +
                    (s.settings.theme === 'dark' ? '🌙' : '☀️') + '</button>' +
                '<button class="icon-btn" data-act="tab|settings" title="设置 / 存档 / 更新日志">⚙</button>' +
            '</div>';
        G.setHTML(document.getElementById('topbar-inner'), html);
    }

    function renderResources() {
        const s = GameState;
        const rows = [];
        for (const k of RESOURCES_ORDER) {
            const r = s.resources[k];
            if (!r) continue;
            if (!(r.visible || r.amount > 0)) continue;
            const rate = ProductionEngine.rateOf(s, k);
            const net = (rate.prod || 0) - (rate.use || 0);
            const cfg = RESOURCES_CONFIG[k];
            rows.push('<div class="res-row" data-tip="res|' + G.esc(k) + '">' +
                '<span class="nm">' + cfg.icon + ' ' + k + '</span>' +
                '<span class="amt">' + Utils.fmtInt(r.amount) + '</span>' +
                '<span class="rate ' + G.rateClass(net) + '">' +
                    (Math.abs(net) < 1e-9 ? '—' : Utils.fmtRate(net, 1) + '/时') + '</span>' +
                '</div>');
        }
        const resourceList = '<div class="res-grid">' +
            (rows.length ? rows.join('') : '<div class="empty">空间里空空的。</div>') +
            '</div>';
        const used = ResourcesManager.spaceUsed(s);
        const cap = ResourcesManager.spaceCap(s);
        const full = cap ? used / cap : 0;
        const html =
            '<div class="panel-head"><span class="panel-title">物资</span>' +
            '<span class="panel-extra" data-tip="crystal">💎 ' + Utils.fmtInt(s.space.crystals) + '</span></div>' +
            resourceList +
            '<div class="space-box" data-tip="space">' +
                '<div class="space-line"><span>异能空间</span><span>' +
                    Utils.fmtInt(used) + ' / ' + Utils.fmtInt(cap) + ' 格</span></div>' +
                G.bar(full, full > 0.92 ? 'bad' : '') +
                '<div class="space-sub">Lv' + s.space.level + '　' +
                    (full > 0.92 ? '快装不下了' : '还有空位') + '</div>' +
            '</div>' +
            '<div class="panel-actions"><button class="btn ghost small" data-act="modal|clean">整理空间</button></div>';
        G.setHTML(document.getElementById('panel-resources'), html);
    }

    function renderAlert() {
        const s = GameState;
        let html = '';
        const info = DefenseEngine.info(s);
        if (info.active) {
            html += '<div class="panel-head"><span class="panel-title">防线</span></div>' +
                '<div class="alert-box' + (info.inWarning ? ' danger' : '') + '" data-tip="raid">' +
                '<div class="alert-title">🚨 ' + info.doomName + '</div>' +
                '<div class="alert-line">还有 <b>' + Utils.fmtCountdown(info.etaHours) + '</b></div>' +
                '<div class="alert-line">强度 <b>' + info.strength + '</b>　防御 <b>' + info.defense + '</b>　' +
                    '<span class="verdict v-' + (info.verdict === '稳' ? 'good' : (info.verdict === '危险' ? 'bad' : 'warn')) + '">' +
                    info.verdict + '</span></div>' +
                '</div>';
        } else {
            html += '<div class="panel-head"><span class="panel-title">防线</span></div>' +
                '<div class="alert-box calm" data-tip="countdown">' +
                '<div class="alert-title">🌤️ 爆发倒计时 ' + Utils.fmtCountdown(Math.max(0, 72 - s.hours)) + '</div>' +
                '<div class="alert-line">在世界安静下来之前，能搬多少搬多少。</div></div>';
        }
        if (s.shortages && s.shortages.length) {
            html += '<div class="alert-box danger"><div class="alert-title">⚠️ 物资见底</div>' +
                '<div class="alert-line">' + s.shortages.join('、') + ' 断了，士气在掉。</div></div>';
        }
        G.setHTML(document.getElementById('panel-alert'), html);
    }

    function renderEvent() {
        const s = GameState;
        const box = document.getElementById('panel-event');
        if (!s.pending || s.pending.type !== 'event') {
            box.style.display = 'none';
            G.setHTML(box, '');
            return;
        }
        const ev = EVENTS_CONFIG.find(x => x.id === s.pending.id);
        if (!ev) return;
        G.setHTML(box, '<div class="panel-head"><span class="panel-title">' + ev.icon + ' ' + G.esc(ev.name) + '</span></div>' +
            '<div class="event-card"><p>' + G.esc(ev.text) + '</p>' +
            '<button class="btn primary" data-act="openpending">做决定</button></div>');
        box.style.display = '';
    }

    function renderLog() {
        const s = GameState;
        const items = s.logs.slice(0, 12).map(l =>
            '<div class="log-item"><span class="log-time">' + Utils.fmtHours(l.t) + '</span>' + G.esc(l.text) + '</div>').join('');
        G.setHTML(document.getElementById('panel-log'),
            '<div class="panel-head"><span class="panel-title">日志</span></div>' +
            '<div class="log-list">' + (items || '<div class="empty">还没有发生什么。</div>') + '</div>');
    }

    function renderStats() {
        const s = GameState;
        const base = BuildEngine.baseOf(s);
        const counts = BuildEngine.counts(s);
        const rows = [
            ['据点', base.icon + ' ' + base.name],
            ['战力', String(PlayerManager.combatPower(s))],
            ['防御', String(PlayerManager.defense(s))],
            ['同伴', PlayerManager.companionCount(s) + ' / ' + PlayerManager.residentCap(s)],
            ['设施', counts.built + ' 类'],
            ['搜刮', s.stats.scavenges + ' 次'],
            ['成就', AchievementEngine.count(s) + ' / ' + ACHIEVEMENTS_CONFIG.length],
            ['重生', s.rebirth.count + ' 次'],
            ['现金', Utils.fmtInt(ResourcesManager.amount('现金'))],
            ['仇家', '<span data-tip="heat" class="' + (s.heat >= HEAT_RULES.raidAt ? 'neg' : (s.heat > 0 ? '' : 'neu')) +
                '">' + s.heat + ' / ' + HEAT_RULES.max + '</span>', true],
        ];
        G.setHTML(document.getElementById('panel-stats'),
            '<div class="panel-head"><span class="panel-title">状态</span></div>' +
            '<div class="stat-list">' + rows.map(r =>
                '<div class="stat-row"><span>' + r[0] + '</span><span>' +
                (r[2] ? r[1] : G.esc(r[1])) + '</span></div>').join('') + '</div>');
    }

    window.Panels = { renderHeader, renderResources, renderAlert, renderEvent, renderLog, renderStats };
})();
