/* 重生页：重生点、重生按钮、重生商店 */
(function () {
    const G = window.UI;

    function render() {
        const s = GameState;
        const can = RebirthEngine.available(s);
        const bd = RebirthEngine.breakdown(s);
        const doom = DOOMS_CONFIG[s.doom] || {};
        let html = '';

        if (!can) {
            html += '<div class="banner"><div class="banner-title">🔁 重生还没开启</div>' +
                '<div class="banner-line">要等到末日阶段（爆发后第 3 天）才会开启。' +
                '在那之前，先想办法活到那一天。</div></div>';
        } else {
            html += '<div class="banner"><div class="banner-title">🔁 重生　现在可换 ' + bd.points + ' 点</div>' +
                '<div class="banner-line">重来一次：这一世的物资、据点、设施、羁绊全部留在这一世；' +
                '空间异能（等级 / 技能 / 结晶）、重生点、成就、统计跟着你走。</div>' +
                '<div class="banner-line">每一次重来，末日类型都会换 —— 这一世是 ' + doom.icon + ' ' + G.esc(doom.name) + '。</div>' +
                '<div class="panel-actions"><button class="btn danger" data-act="rebirth">立刻重生</button></div></div>';
        }

        html += '<div class="panel-box"><div class="panel-head"><span class="panel-title">重生点结算</span></div>' +
            '<div class="stat-list">' + bd.rows.map(r =>
                '<div class="stat-row"><span>' + G.esc(r.label) + '</span><span>' + Utils.fmtNum(r.value, 1) + '</span></div>').join('') +
            (Math.abs(bd.mult - 1) > 1e-6 ? '<div class="stat-row"><span>重生点加成</span><span>×' + bd.mult.toFixed(2) + '</span></div>' : '') +
            '<div class="stat-row"><span><b>本次可得</b></span><span><b>' + bd.points + '</b></span></div>' +
            '<div class="stat-row"><span>可用重生点</span><span>' + s.rebirth.points + '</span></div>' +
            '<div class="stat-row"><span>重生次数</span><span>' + s.rebirth.count + '</span></div>' +
            '</div></div>';

        html += '<h3 class="sec-title">重生商店　<span class="dim">用重生点买的加成永久生效</span></h3><div class="grid">' +
            REBIRTH_SHOP.map(item => {
                const st = RebirthEngine.shopStatus(s, item);
                const cls = st.maxed ? 'done' : (st.can ? 'ok' : 'wait');
                return '<div class="card shop-card ' + cls + '" data-tip="shop|' + item.id + '"' +
                    (st.can ? ' data-act="shopbuy|' + item.id + '"' : '') + '>' +
                    '<div class="card-head"><span class="card-icon">' + item.icon + '</span>' +
                    '<div class="card-titles"><div class="card-title">' + G.esc(item.name) +
                        ' <span class="lv">Lv' + st.level + '/' + st.max + '</span></div>' +
                    '<div class="card-sub">' + G.esc(item.desc) + '</div></div></div>' +
                    '<div class="card-foot">' + (st.maxed ? '<span class="done-chip">已满级</span>'
                        : (st.can ? '<span class="build-go">购买（' + st.cost + ' 点）</span>'
                            : '<span class="need-chip">需要 ' + st.cost + ' 点</span>')) + '</div></div>';
            }).join('') + '</div>';
        return html;
    }

    window.TabRebirth = { render };
})();
