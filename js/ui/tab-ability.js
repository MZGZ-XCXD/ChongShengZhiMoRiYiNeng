/* 异能页：空间异能、技能树、第二异能 */
(function () {
    const G = window.UI;

    function spacePanel(s) {
        const st = AbilityEngine.levelStatus(s);
        const row = AbilityEngine.spaceRow(s, s.space.level);
        const used = ResourcesManager.spaceUsed(s);
        const cap = ResourcesManager.spaceCap(s);
        const branches = AbilityEngine.unlockedSkillCount(s);
        return '<div class="banner"><div class="banner-title">💠 空间异能（S 级）　Lv' + s.space.level + ' / ' + st.max + '</div>' +
            '<div class="banner-line">容量 <b>' + Utils.fmtInt(cap) + '</b> 格（已用 ' + Utils.fmtInt(used) + '）　' +
                '已解锁技能 ' + branches + ' 个　异能结晶 <b>' + Utils.fmtInt(s.space.crystals) + '</b> 💎</div>' +
            '<div class="banner-line">吸收异能结晶能把这个空间往里推。等级越高，每升一级的空间越大——' +
                '一部分空间是你自己「开」出来的，一部分来自重生次数。</div>' +
            '<div class="panel-actions">' +
                (st.atMax ? '<span class="need-chip">已经到当前上限（重生可以提高上限）</span>'
                    : '<button class="btn primary" data-act="spaceup"' + (st.can ? '' : ' disabled') + '>' +
                      '吸收结晶升级（' + st.cost + ' 💎 → ' + Utils.fmtInt(st.nextCap) + ' 格）</button>') +
            '</div></div>';
    }

    function skillNode(s, id) {
        const cfg = SPACE_SKILLS[id];
        const st = AbilityEngine.skillStatus(s, id);
        const cls = st.unlocked ? 'done' : (st.ready ? 'ok' : 'wait');
        return '<div class="card skill-card ' + cls + '" data-tip="skill|' + id + '"' +
            (st.ready && !st.unlocked ? ' data-act="skill|' + id + '"' : '') + '>' +
            '<div class="card-head"><span class="card-icon">' + cfg.icon + '</span>' +
            '<div class="card-titles"><div class="card-title">' + G.esc(cfg.name) + '</div>' +
            '<div class="card-sub">' + Utils.fmtNum(cfg.cost, 0) + ' 💎　' +
                G.effectTextInline(cfg.effect, '、') + '</div></div></div>' +
            '<div class="card-foot">' + (st.unlocked ? '<span class="done-chip">已解锁</span>'
                : (st.ready ? '<span class="build-go">解锁</span>'
                    : '<span class="need-chip">' + G.esc(st.reason) + '</span>')) + '</div></div>';
    }

    function abilityPanel(s) {
        const ab = s.ability.id ? SECOND_ABILITIES[s.ability.id] : null;
        const avail = AbilityEngine.canDraw(s);
        const pity = AbilityEngine.pityInfo(s);
        let html = '<div class="panel-box"><div class="panel-head"><span class="panel-title">✨ 第二异能</span>' +
            (ab ? '<span class="panel-extra" data-tip="ab|' + ab.id + '">详情</span>' : '') + '</div>';
        if (ab) {
            const tier = ABILITY_TIERS[ab.tier];
            html += '<div class="ab-card" style="border-color:' + tier.color + '">' +
                '<div class="ab-name" style="color:' + tier.color + '">' + ab.icon + ' ' + G.esc(ab.name) +
                '　<span class="chip">' + tier.name + '</span></div>' +
                '<div class="ab-desc">' + G.esc(ab.desc) + '</div>' +
                '<div class="ab-eff">' + G.effectTextInline(ab.effect, '；') + '　战力 +' + ab.power + '</div>' +
                '</div>';
        } else {
            html += '<div class="empty">' + (PhaseManager.isAtLeast(s, 'outbreak')
                ? '末日爆发那一夜，你在空间里憋出了第二种力量 —— 还没有觉醒。'
                : '末日爆发之后，才会开始觉醒第二异能。') + '</div>';
        }
        html += '<div class="banner-line">距上次 A 级以上：' + pity.count + ' / ' + pity.need +
            (pity.ready ? '（下一次必出 A 级以上）' : '') + '　共抽过 ' + s.ability.draws + ' 次</div>' +
            '<div class="panel-actions">' +
            (PhaseManager.isAtLeast(s, 'outbreak')
                ? '<button class="btn primary" data-act="awaken"' + (avail.ok ? '' : ' disabled') + '>' +
                  (ab ? '重抽（' : '觉醒（') + avail.cost + ' 💎）</button>'
                : '<span class="need-chip">末日爆发后开启</span>') +
            '</div></div>';
        if (s.ability.history.length) {
            html += '<div class="panel-box"><div class="panel-head"><span class="panel-title">觉醒记录</span></div>' +
                '<div class="stat-list">' + s.ability.history.slice(0, 8).map(h => {
                    const a = SECOND_ABILITIES[h.id] || {};
                    const t = ABILITY_TIERS[h.tier];
                    return '<div class="stat-row"><span style="color:' + (t ? t.color : 'inherit') + '">' +
                        (a.icon || '') + ' ' + G.esc(a.name || h.id) + '（' + h.tier + '）</span>' +
                        '<span>' + Utils.fmtHours(h.hours) + (h.replaced ? '　替换了 ' + G.esc(h.replaced) : '') + '</span></div>';
                }).join('') + '</div></div>';
        }
        return html;
    }

    function render() {
        const s = GameState;
        let html = spacePanel(s) + abilityPanel(s);
        for (const br of SPACE_SKILL_BRANCHES) {
            const ids = SPACE_SKILL_ORDER.filter(id => SPACE_SKILLS[id].branch === br.id);
            const shown = ids.filter(id => {
                const st = AbilityEngine.skillStatus(s, id);
                if (st.unlocked || st.ready) return true;
                const cfg = SPACE_SKILLS[id];
                return (cfg.req || []).some(r => s.space.skills[r]) || (cfg.req || []).length === 0 || s.space.level >= Math.max(1, cfg.reqLevel - 2);
            });
            if (!shown.length) continue;
            html += '<h3 class="sec-title">' + br.icon + ' ' + br.name + '　<span class="dim">' + br.desc + '</span></h3>' +
                '<div class="grid">' + shown.map(id => skillNode(s, id)).join('') + '</div>';
        }
        return html;
    }

    window.TabAbility = { render };
})();
