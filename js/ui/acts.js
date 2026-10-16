/* 所有按钮的行为分发（事件委托都走这里）+ 选项浮窗文案 */
(function () {
    const G = window.UI;

    function handle(act, a1, a2) {
        const s = GameState;
        let res = null;
    /* 只有「选项结算」才弹结果浮窗。建造 / 送礼 / 升级这些本来就用提示条反馈，
       如果也走结果浮窗，就会拿当时的 pending key 生成一个空白的「结果」页。 */
    let asResult = false;
        switch (act) {
            case 'tab': App.activeTab = a1; App.render(true); return;
            case 'pause': s.paused = !s.paused; App.render(true); return;
            case 'speed': {
                const next = (s.speed || 1) >= 4 ? 1 : (s.speed || 1) + 1;
                Actions.setSpeed(s, next);
                G.toast('世界流速 ×' + next);
                App.render(true);
                return;
            }
            case 'setspeed': Actions.setSpeed(s, Number(a1)); App.render(true); return;
            case 'theme':
                s.settings.theme = s.settings.theme === 'dark' ? 'light' : 'dark';
                App.applyTheme();
                App.render(true);
                return;
            case 'settheme':
                s.settings.theme = a1 === 'light' ? 'light' : 'dark';
                App.applyTheme();
                App.render(true);
                return;
            case 'toggle': s.settings[a1] = !s.settings[a1]; App.render(true); return;
            case 'scavenge': {
                const r = ScavengeEngine.scavenge(s, a1);
                G.toast((r.ok ? '🧺 ' : '⚠️ ') + r.msg, r.ok ? '' : 'bad');
                if (!r.ok) return;
                /* 搜刮时打输了：这里被占住了，弹窗要跟着变 */
                if (r.occupied) MapView.select(a1);
                break;
            }
            case 'reclaim': {
                const r = ScavengeEngine.reclaim(s, a1);
                if (!r.ok) { G.toast(r.msg, 'bad'); return; }
                G.toast(r.msg, r.win ? 'gold' : 'bad');
                break;
            }
            case 'borrow': {
                const r = MoneyEngine.borrow(s, a1);
                G.toast(r.msg, r.ok ? 'gold' : 'bad');
                break;
            }
            case 'rob': {
                const r = MoneyEngine.rob(s, a1);
                if (!r.ok) { G.toast(r.msg, 'bad'); return; }
                Modals.showResult(r, r.win ? '💰 抢到了' : '🩸 没抢成');
                App.render(true);
                return;
            }
            /* 遭遇战：迎战 / 逃跑 / 丢物资再跑 */
            case 'cacheopen': {
                s.pending = { type: 'cache', id: a1 };
                App.render(true);
                return;
            }
            case 'cachetake': {
                const p = s.pending;
                if (!p || p.type !== 'cache') return;
                const r = CacheEngine.take(s, p.id, a1);
                if (!r.ok) { G.toast(r.msg, 'bad'); return; }
                if (r.kept) {
                    G.toast('已在地图上记下这个物资点', 'gold');
                    MapView.select(p.id);
                    App.render(true);
                    return;
                }
                Modals.showResult(r, '📦 搬物资');
                App.render(true);
                return;
            }
            case 'encfight': {
                const r = EncounterEngine.fight(s);
                if (!r) return;
                Modals.showResult({
                    text: r.win ? '你把这批东西清干净了。' : '你没打过。他们把你赶了出去，还占住了这个地方。',
                    lines: [r.line],
                }, r.win ? '⚔️ 打赢了' : '💀 打输了');
                App.render(true);
                return;
            }
            case 'encflee': {
                const r = EncounterEngine.flee(s, {});
                if (!r.ok) { G.toast(r.msg, 'bad'); return; }
                if (r.fled) {
                    Modals.showResult({ text: r.text, lines: r.lines }, '🏃 跑掉了');
                    App.render(true);
                    return;
                }
                if (r.scattered) {
                    Modals.showResult({
                        text: r.text,
                        lines: r.lines.concat(['被冲散，又丢了一批：' + EventEngine.gainText(r.extra || {})]),
                    }, '💀 被追上了');
                    App.render(true);
                    return;
                }
                G.toast('没跑掉，物资丢了一部分', 'bad');
                App.render(true);
                return;
            }
            case 'encdump': {
                const r = EncounterEngine.flee(s, { dumping: true });
                if (!r.ok) { G.toast(r.msg, 'bad'); return; }
                if (r.fled) {
                    Modals.showResult({ text: r.text, lines: r.lines }, '🏃 丢下东西跑掉了');
                    App.render(true);
                    return;
                }
                if (r.scattered) {
                    Modals.showResult({
                        text: r.text,
                        lines: r.lines.concat(['被冲散，又丢了一批：' + EventEngine.gainText(r.extra || {})]),
                    }, '💀 被追上了');
                    App.render(true);
                    return;
                }
                G.toast('东西丢了，人还没跑掉', 'bad');
                App.render(true);
                return;
            }
            /* 地图：点节点先选中（抽屉里再确认出发），避免误触 */
            case 'mapnode': {
                const id = MapView.select(a1);
                if (id) {
                    const st = ScavengeEngine.status(s, a1);
                    if (st.occupied) G.toast('⚠️ ' + st.reason, 'bad');
                    else if (!st.ok) G.toast('⚠️ ' + st.reason, 'bad');
                }
                App.render(true);
                return;
            }
            case 'mapclose': MapView.close(); App.render(true); return;
            case 'build': res = BuildEngine.build(s, a1); break;
            case 'spaceup': res = AbilityEngine.levelUp(s); break;
            case 'skill': res = AbilityEngine.unlockSkill(s, a1); break;
            case 'awaken':
                Modals.clearCandidate();
                s.pending = { type: 'awaken' };
                App.render(true);
                return;
            case 'awakenroll':
            case 'awakenagain': {
                const pay = AbilityEngine.payForRoll(s);
                if (!pay.ok) { G.toast(pay.msg, 'bad'); return; }
                Modals.setCandidate(AbilityEngine.roll(s));
                break;
            }
            case 'awakenkeep': {
                const c = Modals.getCandidate();
                if (!c) return;
                const ab = SECOND_ABILITIES[c.id];
                const r = AbilityEngine.commit(s, c.id);
                Modals.clearCandidate();
                s.pending = null;
                Modals.showResult({ text: ab.desc, lines: ['第二异能：' + ab.name + '（' + c.tier + ' 级）'] }, '✨ 觉醒完成');
                if (!r.ok) G.toast(r.msg, 'bad');
                App.render(true);
                return;
            }
            case 'gift': {
                const r = BondEngine.gift(s, a1);
                G.toast(r.ok ? r.msg : (r.reason || '送不出去。'), r.ok ? 'gold' : 'bad');
                break;
            }
            case 'move': TabBase.moveModal(); return;
            case 'domove': {
                const r = BuildEngine.move(s, a1);
                G.toast(r.msg, r.ok ? 'gold' : 'bad');
                if (r.ok) { G.closeModal(); App.render(true); }
                return;
            }
            case 'shopbuy': res = RebirthEngine.buy(s, a1); break;
            case 'rebirth': {
                const bd = RebirthEngine.breakdown(s);
                G.confirmBox('重生', '把这一世折叠起来，带着 <b>' + bd.points + '</b> 点重生点开始新的一世。<br><br>' +
                    '会留在这一世：物资、据点与设施、所有羁绊角色。<br>' +
                    '会跟着你走：空间异能（等级 / 技能 / 结晶）、重生点、成就。<br><br>确定吗？',
                    () => {
                        const r = RebirthEngine.perform(s, 'manual');
                        if (!r.ok) G.toast(r.msg, 'bad');
                        App.activeTab = 'map';
                        App.render(true);
                    }, '确认重生');
                return;
            }
            case 'discard': {
                const half = Math.floor(ResourcesManager.amount(a1) / 2);
                const took = Actions.discard(s, a1, half);
                G.toast('丢掉了 ' + a1 + ' ' + Utils.fmtInt(took));
                Modals.cleanModal();
                return;
            }
            case 'save':
                G.toast(SaveEngine.save(s) ? '已保存。' : '保存失败（浏览器限制了本地存储）。', 'gold');
                return;
            case 'help': Modals.welcomeModal(); return;
            case 'modal':
                if (a1 === 'export') Modals.exportModal();
                else if (a1 === 'import') Modals.importModal();
                else if (a1 === 'clean') Modals.cleanModal();
                else if (a1 === 'hardreset') {
                    G.confirmBox('清除存档', '这会彻底删掉本地存档，包括这一世的物资、据点、羁绊与剧情进度，' +
                        '清完会回到最开始（重新播序章）。无法恢复，确定吗？',
                        () => SaveEngine.hardReset(), '清除存档');
                }
                return;
            case 'doimport': {
                const ta = document.querySelector('#modal-root textarea');
                const r = SaveEngine.importSave(s, ta ? ta.value : '');
                G.toast(r.msg, r.ok ? 'gold' : 'bad');
                if (r.ok) { App.applyTheme(); G.closeModal(); App.render(true); }
                return;
            }
            case 'copytext': {
                const ta = document.querySelector('#modal-root textarea');
                App.copyText(ta ? ta.value : '', '存档文本已复制。');
                return;
            }
            case 'closemodal':
                G.closeModal();
                Modals.clearCandidate();
                Modals.clearResult();
                App.render(true);
                return;
            case 'openpending': Modals.refresh(); return;
            case 'storychoice': res = StoryEngine.resolve(s, Number(a1)); asResult = true; break;
            case 'bondchoice': res = BondEngine.resolve(s, Number(a1)); asResult = true; break;
            case 'eventchoice': res = EventEngine.resolve(s, Number(a1)); asResult = true; break;
            default: return;
        }
        if (res && !res.ok) { G.toast(res.msg, 'bad'); return; }
        if (res && asResult) Modals.showResult(res);
        else if (res && res.msg) G.toast(res.msg, res.ok ? 'gold' : 'bad');
        App.render(true);
    }

    function choiceOf(kind, idx) {
        const p = GameState.pending;
        if (!p) return null;
        if (kind === 'storychoice' && p.type === 'story') {
            const cfg = STORY_CONFIG[p.id];
            return cfg ? cfg.choices[Number(idx)] : null;
        }
        if (kind === 'bondchoice' && p.type === 'bond') {
            const cfg = BondEngine.cfg(p.id);
            if (!cfg) return null;
            const block = p.stage === 'meet' ? cfg.meet : cfg.crossroad;
            return block ? block.choices[Number(idx)] : null;
        }
        if (kind === 'eventchoice' && p.type === 'event') {
            const cfg = EVENTS_CONFIG.find(x => x.id === p.id);
            return cfg ? cfg.choices[Number(idx)] : null;
        }
        return null;
    }

    /* 选项浮窗：写清 做什么 / 扣什么 / 得什么 / 持续效果 */
    function choiceTip(ch) {
        if (!ch) return null;
        let html = '<div class="tip-title">' + G.esc(ch.text) + '</div>';
        if (ch.tip) html += '<p class="tip-desc">' + G.esc(ch.tip) + '</p>';
        if (ch.cost) html += '<div class="tip-li">消耗：' + G.costHtml(ch.cost, { ignoreSpace: true }) + '</div>';
        if (ch.crystal > 0) html += '<div class="tip-li">异能结晶 +' + ch.crystal + '</div>';
        if (ch.crystal < 0) html += '<div class="tip-li">异能结晶 ' + ch.crystal + '</div>';
        if (ch.gain) {
            const parts = Object.keys(ch.gain).map(k => k + ' +' +
                (Array.isArray(ch.gain[k]) ? (ch.gain[k][0] + '~' + ch.gain[k][1]) : ch.gain[k]));
            html += '<div class="tip-li">获得：' + parts.join('、') + '</div>';
        }
        if (ch.morale) html += '<div class="tip-li">士气 ' + (ch.morale > 0 ? '+' : '') + ch.morale + '</div>';
        if (ch.value) html += '<div class="tip-li">好感 ' + (ch.value > 0 ? '+' : '') + ch.value + '</div>';
        if (ch.temp) html += '<div class="tip-li">持续效果「' + G.esc(ch.temp.name) + '」：' +
            G.esc(G.effectTextInline(ch.temp.effect, '；')) + '，' + Utils.fmtHours(ch.temp.hours) + '</div>';
        if (ch.outcome) html += '<div class="tip-li">走向：' +
            ({ ally: '成为同伴', partner: '成为伴侣', enemy: '成为敌人', dead: '死亡', left: '离开' }[ch.outcome] || ch.outcome) + '</div>';
        if (ch.battle) html += '<div class="tip-li">一场战斗（按战力判定）</div>';
        if (ch.unlock) html += '<div class="tip-li">解锁新的搜刮地点</div>';
        if (ch.facility) html += '<div class="tip-li">免费升级设施</div>';
        return html;
    }

    window.Acts = { handle, choiceOf, choiceTip };
})();
