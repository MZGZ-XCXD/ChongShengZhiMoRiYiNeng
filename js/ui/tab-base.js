/* 据点页：设施建设、产出、据点迁移 */
(function () {
    const G = window.UI;

    function basePanel(s) {
        const base = BuildEngine.baseOf(s);
        const counts = BuildEngine.counts(s);
        const next = BASES_CONFIG.find(b => b.tier === base.tier + 1);
        return '<div class="banner" data-tip="def">' +
            '<div class="banner-title">' + base.icon + ' ' + G.esc(base.name) + '　<span class="chip">防御 ' +
                PlayerManager.defense(s) + '</span>　<span class="chip">容纳 ' +
                PlayerManager.companionCount(s) + ' / ' + PlayerManager.residentCap(s) + '</span></div>' +
            '<div class="banner-line">' + G.esc(base.desc) + '</div>' +
            '<div class="banner-line">据点特性：' + G.esc(base.perk) + '　已建设施 ' + counts.built + ' 类</div>' +
            '<div class="panel-actions">' +
                '<button class="btn small" data-act="move">迁移据点</button>' +
                (next ? '' : '') +
            '</div>' +
            '</div>';
    }

    function ratePanel(s) {
        const rows = [];
        for (const k of RESOURCES_ORDER) {
            const r = ProductionEngine.rateOf(s, k);
            const prod = r.prod || 0, use = r.use || 0;
            if (Math.abs(prod) < 1e-9 && Math.abs(use) < 1e-9) continue;
            const net = prod - use;
            rows.push('<div class="stat-row"><span>' + (RESOURCES_CONFIG[k] || {}).icon + ' ' + k + '</span>' +
                '<span class="' + G.rateClass(net) + '">' + Utils.fmtRate(net, 1) + ' /时' +
                '<span class="dim">（产 ' + Utils.fmtNum(prod, 1) + '　耗 ' + Utils.fmtNum(use, 1) + '）</span></span></div>');
        }
        return '<div class="panel-box"><div class="panel-head"><span class="panel-title">每小时收支</span></div>' +
            (rows.length ? '<div class="stat-list">' + rows.join('') + '</div>'
                : '<div class="empty">还没有任何产出，先建几个设施。</div>') + '</div>';
    }

    function facCard(st) {
        const cfg = st.cfg;
        const cls = !st.tierAllowed ? 'locked' : (st.maxed ? 'done' : (st.can ? 'ok' : 'wait'));
        const sub = !st.tierAllowed ? '需要更大的据点（' + cfg.tier + ' 级设施）'
            : (st.maxed ? '已满级' : ('升到 Lv' + (st.level + 1) + '：' + G.costHtml(st.cost || {})));
        return '<div class="card fac-card ' + cls + '" data-tip="fac|' + cfg.id + '"' +
            (st.can ? ' data-act="build|' + cfg.id + '"' : '') + '>' +
            '<div class="card-head">' +
                '<span class="card-icon">' + cfg.icon + '</span>' +
                '<div class="card-titles">' +
                    '<div class="card-title">' + G.esc(cfg.name) + ' <span class="lv">Lv' + st.level + '</span>' +
                        '<span class="dim"> / ' + cfg.maxLevel + '</span></div>' +
                    '<div class="card-sub">' + sub + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="card-foot">' +
                (st.tierAllowed ? (st.maxed ? '<span class="done-chip">已完成</span>'
                    : (st.can ? '<span class="build-go">升级</span>' : '<span class="need-chip">' + G.esc(st.reason) + '</span>'))
                    : '<span class="need-chip">' + G.esc(st.reason) + '</span>') +
            '</div>' +
            '</div>';
    }

    function render() {
        const s = GameState;
        const list = BuildEngine.listFor(s);
        const allowed = list.filter(x => x.tierAllowed);
        const blocked = list.filter(x => !x.tierAllowed);
        let html = basePanel(s) + ratePanel(s);
        html += '<h3 class="sec-title">设施</h3><div class="grid">' + allowed.map(facCard).join('') + '</div>';
        if (blocked.length) {
            html += '<h3 class="sec-title">需要更大的据点（' + blocked.length + ' 项）</h3>' +
                '<div class="grid">' + blocked.map(facCard).join('') + '</div>';
        }
        return html;
    }

    function moveModal() {
        const s = GameState;
        const rows = BASES_CONFIG.map(base => {
            const st = BuildEngine.moveStatus(s, base.id);
            const here = base.id === s.base.id;
            const cost = base.moveCost ? G.costHtml(base.moveCost) : '（起点）';
            return '<div class="card move-card ' + (here ? 'done' : (st.ok ? 'ok' : 'wait')) + '"' +
                (st.ok && !here ? ' data-act="domove|' + base.id + '"' : '') + '>' +
                '<div class="card-head"><span class="card-icon">' + base.icon + '</span>' +
                '<div class="card-titles"><div class="card-title">' + base.name +
                    (here ? ' <span class="chip">当前</span>' : '') + '</div>' +
                '<div class="card-sub">防御基础 ' + base.defense + '　容纳 ' + base.residentCap + '　' + base.perk + '</div></div></div>' +
                '<div class="card-foot">' + (here ? '<span class="done-chip">已经在这里</span>'
                    : (st.ok ? '<span class="build-go">迁移（' + cost + '）</span>'
                        : '<span class="need-chip">' + G.esc(st.reason) + '</span>')) + '</div>' +
                '</div>';
        }).join('');
        G.openModal('<h2>🚚 迁移据点</h2>' +
            '<p class="modal-intro">更大的据点能建更高级的设施、容纳更多人。' +
            '但防御工事（门窗加固、铁栅栏、围墙、哨塔、陷阱区、军械库）搬不走：' +
            '迁移后这些归零，并返还一半材料。其他设施等级保留。</p>' +
            '<div class="grid">' + rows + '</div>' +
            '<div class="modal-actions"><button class="btn primary" data-act="closemodal">关闭</button></div>', { wide: true });
    }

    window.TabBase = { render, moveModal };
})();
