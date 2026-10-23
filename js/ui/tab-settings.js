/* 设置页：存档、运行、自动化、统计、更新日志、关于
   每一行都写清「这是什么 / 现在什么状态 / 没解锁的话去哪儿解锁」 */
(function () {
    const G = window.UI;

    function switchRow(label, note, on, opts) {
        opts = opts || {};
        const cls = opts.locked ? 'switch locked' : ('switch ' + (on ? 'on' : 'off'));
        const text = opts.locked ? '未解锁' : (on ? '已开启' : '已关闭');
        return '<div class="set-row">' +
            '<div class="set-info">' +
                '<div class="set-label">' + label + '</div>' +
                '<div class="set-note' + (opts.locked ? ' locked' : '') + '">' + note + '</div>' +
            '</div>' +
            '<div class="set-ctl">' +
                '<button class="' + cls + '"' +
                    (opts.locked ? ' disabled' : ' data-act="toggle|' + opts.id + '"') +
                    ' role="switch" aria-checked="' + (on ? 'true' : 'false') + '">' +
                    '<span class="knob"></span><span class="switch-text">' + text + '</span>' +
                '</button>' +
            '</div>' +
            '</div>';
    }

    function segRow(label, note, options, current, act) {
        return '<div class="set-row">' +
            '<div class="set-info"><div class="set-label">' + label + '</div>' +
            '<div class="set-note">' + note + '</div></div>' +
            '<div class="set-ctl"><div class="seg">' + options.map(o =>
                '<button class="seg-btn' + (o.value === current ? ' active' : '') + '" data-act="' +
                act + '|' + o.value + '">' + o.label + '</button>').join('') + '</div></div>' +
            '</div>';
    }

    function saveGroup(s) {
        return '<div class="panel-box set-group">' +
            '<div class="panel-head"><span class="panel-title">存档</span>' +
                '<span class="panel-extra">结构版本 v' + SAVE_VERSION + '</span></div>' +
            switchRow('自动保存', '每 20 秒存一次，离开页面时也会存。关掉它就得手动点「立即保存」。',
                s.settings.autosave, { id: 'autosave' }) +
            '<div class="set-row">' +
                '<div class="set-info"><div class="set-label">手动备份</div>' +
                '<div class="set-note">导出成一段文本存起来；换设备或清浏览器数据之前建议先导一份。</div></div>' +
            '</div>' +
            '<div class="panel-actions">' +
                '<button class="btn small" data-act="save">立即保存</button>' +
                '<button class="btn small" data-act="modal|export">导出存档</button>' +
                '<button class="btn small" data-act="modal|import">导入存档</button>' +
                '<button class="btn small danger" data-act="modal|hardreset">清除存档</button>' +
            '</div>' +
            '<div class="hint">旧存档会自动补齐新加的字段，进度不会丢。</div>' +
            '</div>';
    }

    function runGroup(s) {
        return '<div class="panel-box set-group">' +
            '<div class="panel-head"><span class="panel-title">运行</span></div>' +
            segRow('世界流速', '末日前是按行动推进的回合制（点搜刮一次才走 1 小时），流速只对末日爆发之后的' +
                '时间生效：资源产出、地点刷新、袭击倒计时。当前 ×' + (s.speed || 1) + '。',
                [{ value: 1, label: '×1' }, { value: 2, label: '×2' }, { value: 3, label: '×3' }, { value: 4, label: '×4' }],
                s.speed || 1, 'setspeed') +
            segRow('界面主题', '深色是「废土夜色」，浅色是「灰白晨雾」。',
                [{ value: 'dark', label: '🌙 深色' }, { value: 'light', label: '☀️ 浅色' }],
                s.settings.theme, 'settheme') +
            '</div>';
    }

    function autoGroup(s) {
        const e = EffectsManager.get(s);
        const has = !!e.specials.autoBuild;
        const lockNote = '在重生商店买「自动之手」（22 重生点）之后解锁。';
        return '<div class="panel-box set-group">' +
            '<div class="panel-head"><span class="panel-title">自动化</span>' +
                '<span class="panel-extra">' + (has ? '已解锁' : '未解锁') + '</span></div>' +
            (has ? '' : '<div class="hint">' + lockNote + '</div>') +
            switchRow('自动搜刮', has
                    ? '每隔几小时自己去搜一趟，产出按效率折算（当前 ' + Utils.fmtPct(e.autoScavenge || 0, 0) + '）。'
                    : lockNote,
                s.settings.autoScavenge, { id: 'autoScavenge', locked: !has }) +
            switchRow('自动建设', has ? '按「先修工事、再补产出」的顺序自动升级设施。' : lockNote,
                s.settings.autoBuild, { id: 'autoBuild', locked: !has }) +
            switchRow('自动送礼', has ? '自动给好感最低的同伴送礼物，省得一个个点。' : lockNote,
                s.settings.autoGift, { id: 'autoGift', locked: !has }) +
            '</div>';
    }

    function statsGroup(s) {
        const rows = [
            ['末日类型', (DOOMS_CONFIG[s.doom] || {}).name || '—'],
            ['生存时间', Utils.fmtHours(s.hours)],
            ['重生次数', s.rebirth.count + ' 次'],
            ['累计搜刮', s.stats.scavenges + ' 次'],
            ['累计战斗', s.stats.battles + ' 次（胜 ' + s.stats.battlesWon + '）'],
            ['累计结晶', Utils.fmtInt(s.space.totalCrystals) + ' 💎'],
        ];
        return '<div class="panel-box set-group">' +
            '<div class="panel-head"><span class="panel-title">这一世</span></div>' +
            '<div class="stat-list">' + rows.map(r =>
                '<div class="stat-row"><span>' + r[0] + '</span><span>' + G.esc(r[1]) + '</span></div>').join('') +
            '</div></div>';
    }

    function changelogBox() {
        const data = window.CHANGELOG_DATA || { overview: [], versions: [] };
        let html = '<div class="panel-box set-group"><div class="panel-head">' +
            '<span class="panel-title">更新日志</span>' +
            '<span class="panel-extra">v' + (data.currentVersion || '0.0.0') + '</span></div>';
        if (data.overview && data.overview.length) {
            html += '<div class="cl-list">' + data.overview.map(r =>
                '<div class="cl-row"><span class="cl-ver">' + r.version + '</span>' +
                '<span class="cl-date">' + r.date + '</span>' +
                '<span class="cl-sum">' + r.summary + '</span></div>').join('') + '</div>';
        } else {
            html += '<div class="empty">还没有更新日志。</div>';
        }
        html += '</div>';
        return html;
    }

    function aboutGroup() {
        return '<div class="panel-box set-group">' +
            '<div class="panel-head"><span class="panel-title">关于</span></div>' +
            '<div class="set-row"><div class="set-info">' +
                '<div class="set-label">末日轮回：从S级空间异能开始</div>' +
                '<div class="set-note">纯前端单机放置游戏，存档在浏览器本地（localStorage），' +
                '不联网、不安装，双击 HTML 就能玩。</div></div>' +
                '<div class="set-ctl"><button class="btn small" data-act="help">开头引导</button></div>' +
            '</div>' +
            '</div>';
    }

    function render() {
        const s = GameState;
        return saveGroup(s) + runGroup(s) + autoGroup(s) + statsGroup(s) + changelogBox() + aboutGroup();
    }

    window.TabSettings = { render };
})();
