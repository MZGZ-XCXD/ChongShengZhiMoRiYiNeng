/* 羁绊页：认识的人、好感、送礼、结局 */
(function () {
    const G = window.UI;

    function bondCard(s, cfg) {
        const st = BondEngine.get(s, cfg.id);
        const info = BondEngine.giftInfo(s, cfg.id);
        const loan = MoneyEngine.borrowInfo(s, cfg.id);
        const loanUi = PhaseManager.isAtLeast(s, 'outbreak')
            ? ''
            : (loan.ok
                ? '<button class="btn small" data-act="borrow|' + cfg.id + '">借钱 ' + Utils.fmtInt(loan.cash) +
                  '（好感 -' + loan.favorCost + '）</button>'
                : '<span class="need-chip">借钱：' + G.esc(loan.reason) + '</span>');
        const outcome = { ally: '同伴', partner: '伴侣', enemy: '敌人', dead: '已不在', left: '已离开' }[st.outcome] || '观望';
        const cls = st.outcome === 'enemy' ? 'bad' : (st.outcome === 'dead' ? 'gone' : (st.value >= 60 ? 'ok' : 'wait'));
        const assist = BondEngine.assistActive(s, cfg.id);
        return '<div class="card bond-card ' + cls + '" data-tip="bond|' + cfg.id + '">' +
            '<div class="card-head">' +
                Assets.portraitHtml(cfg, 'bond-pic') +
                '<div class="card-titles"><div class="card-title">' + cfg.icon + ' ' + G.esc(cfg.name) +
                    ' <span class="chip">' + outcome + '</span></div>' +
                '<div class="card-sub">' + G.esc(cfg.role) + (cfg.ability ? '　' + cfg.ability.tier + ' 级·' + cfg.ability.name : '　普通人') + '</div></div></div>' +
            '<div class="bond-bar">' + G.bar(Utils.clamp((st.value + 30) / 130, 0, 1)) +
                '<span class="bond-val">好感 ' + Math.round(st.value) + '</span></div>' +
            '<div class="card-foot">' +
                '<span class="' + (assist ? 'good-chip' : 'need-chip') + '">' +
                    (assist ? '协助中' : (cfg.assist ? '好感 ' + cfg.assist.at + ' 起协助' : '无协助')) + '</span>' +
                (info.ok ? '<button class="btn small" data-act="gift|' + cfg.id + '">送 ' + cfg.gift.res + ' ×' + cfg.gift.amount + '</button>'
                    : '<span class="need-chip">' + G.esc(info.reason || '') + '</span>') +
                loanUi +
            '</div>' +
            '</div>';
    }

    function render() {
        const s = GameState;
        const met = BONDS_CONFIG.filter(c => BondEngine.get(s, c.id).met);
        const notMet = BONDS_CONFIG.filter(c => !BondEngine.get(s, c.id).met);
        let html = '<div class="banner"><div class="banner-title">🤝 羁绊 ' + met.length + ' 人</div>' +
            '<div class="banner-line">好感 30 起开始协助你；到关键节点，你的选择会决定他们最终站在哪一边。' +
            '礼物每天最多送 3 次，同一天越送越少。</div></div>';
        html += '<div class="grid">' + (met.length ? met.map(c => bondCard(s, c)).join('')
            : '<div class="empty">你还没有遇到任何人。去地图上搜刮，人都在路上。</div>') + '</div>';
        if (notMet.length) {
            html += '<h3 class="sec-title">还没遇到的人（' + notMet.length + ' 个）</h3>' +
                '<div class="grid">' + notMet.map(c => {
                    const where = c.locate && c.locate.location
                        ? (LOCATIONS_CONFIG.find(l => l.id === c.locate.location) || {}).name
                        : null;
                    return '<div class="card bond-card locked" data-tip="bondhint|' + c.id + '">' +
                        '<div class="card-head"><span class="card-icon">❔</span>' +
                        '<div class="card-titles"><div class="card-title">未相识</div>' +
                        '<div class="card-sub">' + (where ? '可能出现在：' + where : '会在后面的路上遇到') + '</div></div></div>' +
                        '<div class="card-foot"><span class="need-chip">' +
                        (c.locate && c.locate.location ? '去' + where + '搜刮' : '看运气') + '</span></div></div>';
                }).join('') + '</div>';
        }
        return html;
    }

    window.TabBonds = { render };
})();
