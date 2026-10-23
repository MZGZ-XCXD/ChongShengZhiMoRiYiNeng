/* 浮窗：剧情 / 事件 / 羁绊 / 觉醒 / 重生报告，以及欢迎、离线、存档等弹窗 */
(function () {
    const G = window.UI;
    let shownKey = '';
    let resultPage = null;
    let seq = 0;
    let candidate = null;

    function pendingKey(s) {
        const p = s && s.pending;
        if (!p) return '';
        const seq = (p.type === 'encounter' && s.encounter) ? s.encounter.seq + ':' + s.encounter.tries : '';
        return [p.type, p.id || '', p.stage || '', p.reason || '', seq].join('|');
    }

    /* 隐藏物资点：先说清在哪儿、怎么发现的，再让你决定怎么搬 */
    function renderCache(locId) {
        const loc = LOCATIONS_CONFIG.find(l => l.id === locId);
        const c = CacheEngine.of(GameState, locId);
        if (!loc || !c) { G.closeModal(); return; }
        const note = CacheEngine.spaceNote(GameState, c);
        const rows = Object.keys(c.loot).map(r => '<div class="kv-line"><span>' +
            ((RESOURCES_CONFIG[r] || {}).icon || '') + ' ' + r + '</span><span>' + c.loot[r] +
            '（' + Math.round(c.loot[r] * ResourcesManager.spaceOf(r)) + ' 格）</span></div>').join('');
        const allBtn = note.enough
            ? '<button class="choice" data-act="cachetake|all"><b>全搬进空间</b>' +
              '<div class="choice-lack">一次搬完，占 ' + note.need + ' 格</div></button>'
            : '<button class="choice disabled" disabled><b>空间装不下</b>' +
              '<div class="choice-lack">要 ' + note.need + ' 格，你只剩 ' + note.left +
              ' 格 —— 先整理空间，或者升级异能再来</div></button>';
        G.openModal('<h2>' + c.kind.icon + ' 隐藏物资点 · ' + G.esc(c.kind.name) + '</h2>' +
            '<p class="modal-intro">在哪：<b>' + G.esc(loc.name) + '</b>　' +
            '（' + Utils.fmtHours(GameState.hours) + ' 发现的）</p>' +
            '<div class="story-pages"><p>' + G.esc(c.kind.find) + '</p></div>' +
            '<div class="kv-box"><div class="kv-title">里面有什么</div>' + rows +
                '<div class="kv-line"><span>异能结晶</span><span>' + c.crystal + ' 💎</span></div>' +
                '<div class="kv-line"><span>空间</span><span>需要 ' + note.need + ' 格，还剩 ' + note.left + ' 格</span></div>' +
            '</div>' +
            '<div class="choices">' + allBtn +
                '<button class="choice" data-act="cachetake|best"><b>只挑最值钱的</b>' +
                '<div class="choice-lack">拿一半的大件，不拿结晶；搬完这里的提示就消失</div></button>' +
                '<button class="choice" data-act="cachetake|later"><b>先记下来，回头再搬</b>' +
                '<div class="choice-lack">地图上这个地点会留一个 📦 标记，物资点不会自己消失</div></button>' +
            '</div>', { wide: true, closable: false });
    }

    /* 遭遇战：对方几个人、多少战力、打不打得过、跑得掉吗，都摆在明面上 */
    function renderEncounter() {
        const info = EncounterEngine.info(GameState);
        if (!info) { G.closeModal(); return; }
        const k = info.enc.kind;
        const fmt = map => Object.keys(map).map(r => r + ' ' + map[r]).join('、');
        const log = info.enc.log.length
            ? '<div class="kv-box">' + info.enc.log.map(t => '<div class="kv-line">' + G.esc(t) + '</div>').join('') + '</div>'
            : '';
        const fightBtn = info.canFight
            ? '<button class="choice" data-act="encfight"><b>迎战（胜率 ' + Math.round(info.odds * 100) + '%）</b>' +
              '<div class="choice-lack">对方 ' + info.enc.count + ' 只 × 单只 ' + info.enc.unit + ' 战力</div></button>'
            : '<button class="choice disabled" disabled><b>打不过，不能迎战</b>' +
              '<div class="choice-lack">战力差太多（你 ' + info.mine + ' vs 对方 ' + info.enc.power + '），硬拼等于送死</div></button>';
        G.openModal('<h2>' + k.icon + ' 遭遇 · ' + info.enc.count + ' 只' + G.esc(k.name) + '</h2>' +
            '<p class="modal-intro">在' + G.esc(info.enc.locationName) + '。' + G.esc(k.desc) + '</p>' +
            '<div class="vs-box">' +
                '<div class="vs-side"><span class="vs-label">对方</span>' +
                    '<b>' + info.enc.count + ' × ' + G.esc(k.name) + '</b>' +
                    '<span class="vs-power">战力 ' + info.enc.power + '</span>' +
                    '<span class="vs-note">单只 ' + info.enc.unit + ' × ' + info.enc.count + ' 只</span></div>' +
                '<div class="vs-mid">' + (info.verdict === '稳赢' ? '✅' : (info.canFight ? '⚠️' : '💀')) + '</div>' +
                '<div class="vs-side mine"><span class="vs-label">你</span>' +
                    '<b>战力 ' + info.mine + '</b>' +
                    '<span class="vs-power vs-' + (info.canFight ? 'ok' : 'bad') + '">' +
                        (info.mine >= info.enc.power ? '领先 ' : '落后 ') + Math.abs(info.mine - info.enc.power) + '</span>' +
                    '<span class="vs-note">判定：' + info.verdict + '</span></div>' +
            '</div>' +
            log +
            '<div class="choices">' + fightBtn +
                '<button class="choice" data-act="encflee"><b>逃跑（成功率 ' + Math.round(info.flee * 100) + '%）</b>' +
                '<div class="choice-lack">跑不掉会丢一部分物资，然后还得再选一次（第 ' +
                    (info.tries + 1) + ' / ' + info.maxTries + ' 次）</div></button>' +
                (info.tries > 0
                    ? '<button class="choice" data-act="encdump"><b>丢下物资再跑（成功率 ' +
                      Math.round(info.fleeDump * 100) + '%）</b>' +
                      '<div class="choice-lack">放弃：' + G.esc(fmt(info.dumpCost)) + '</div></button>'
                    : '<button class="choice disabled" disabled><b>丢下物资再跑</b>' +
                      '<div class="choice-lack">先自己跑一次，跑不掉才会有这个选择</div></button>') +
            '</div>', { wide: true, closable: false });
    }

    function choiceBtn(ch, act, i, extra) {
        const usable = EventEngine.choiceUsable(GameState, ch);
        const cls = 'choice' + (usable.ok ? '' : ' disabled') + (extra || '');
        const lack = usable.ok ? '' : '<div class="choice-lack">' + usable.lack + '</div>';
        return '<button class="' + cls + '" data-tip="choice|' + act + '|' + i + '"' +
            (usable.ok ? ' data-act="' + act + '|' + i + '"' : ' disabled') + '>' +
            '<b>' + G.esc(ch.text) + '</b>' + lack + '</button>';
    }

    function pagesHtml(pages) {
        return '<div class="story-pages">' + pages.map(t => '<p>' + G.esc(t) + '</p>').join('') + '</div>';
    }

    function renderStory(cfg) {
        if (!cfg) { G.closeModal(); return; }
        G.openModal('<h2>' + cfg.icon + ' ' + G.esc(cfg.title) + '</h2>' +
            (Assets.doom(GameState.doom) ? '<img class="story-art" src="' + Assets.doom(GameState.doom) + '" alt="" loading="lazy">' : '') +
            pagesHtml(cfg.pages || []) +
            '<div class="choices">' + cfg.choices.map((ch, i) => choiceBtn(ch, 'storychoice', i)).join('') + '</div>',
            { wide: true, closable: false });
    }

    function renderBond(p) {
        const cfg = BondEngine.cfg(p.id);
        if (!cfg) { G.closeModal(); return; }
        const block = p.stage === 'meet' ? cfg.meet : cfg.crossroad;
        const st = BondEngine.get(GameState, p.id);
        const head = p.stage === 'meet' ? ('遇见 · ' + cfg.name) : block.title;
        G.openModal('<h2>' + cfg.icon + ' ' + G.esc(head) + '</h2>' +
            '<div class="bond-modal">' +
                '<div class="bond-art">' + Assets.portraitHtml(cfg, 'portrait-pic', 'large') +
                    '<div class="bond-art-name">' + G.esc(cfg.name) + '</div>' +
                    '<div class="bond-art-sub">' + G.esc(cfg.role) + '</div>' +
                    '<div class="bond-art-sub">' + (cfg.ability ? cfg.ability.tier + ' 级 · ' + G.esc(cfg.ability.name) : '普通人') + '</div>' +
                '</div>' +
                '<div class="bond-text">' +
                    '<div class="story-pages"><p>' + G.esc(block.text) + '</p></div>' +
                    '<div class="bond-meta">好感 ' + Math.round(st.value) + ' / 100</div>' +
                    '<div class="choices">' + block.choices.map((ch, i) => choiceBtn(ch, 'bondchoice', i)).join('') + '</div>' +
                '</div>' +
            '</div>',
            { wide: true, closable: false });
    }

    function renderEvent(ev) {
        if (!ev) { G.closeModal(); return; }
        G.openModal('<h2>' + ev.icon + ' ' + G.esc(ev.name) + '</h2>' +
            '<div class="story-pages"><p>' + G.esc(ev.text) + '</p></div>' +
            '<div class="choices">' + ev.choices.map((ch, i) => choiceBtn(ch, 'eventchoice', i)).join('') + '</div>',
            { wide: true, closable: false });
    }

    function renderAwaken() {
        const s = GameState;
        const avail = AbilityEngine.canDraw(s);
        const pity = AbilityEngine.pityInfo(s);
        const table = AbilityEngine.tierChanceTable(pity.ready);
        let body = '';
        if (s.ability.id) {
            const ab = SECOND_ABILITIES[s.ability.id];
            body += '<div class="kv-box"><div class="kv-title">当前的第二异能</div>' +
                '<div class="kv-main">' + ab.icon + ' <b>' + G.esc(ab.name) + '</b>（' +
                ABILITY_TIERS[ab.tier].name + '）</div>' +
                '<div class="kv-line">' + G.esc(ab.desc) + '</div>' +
                '<div class="kv-line">效果：' + G.effectTextInline(ab.effect, '；') + '</div></div>';
        }
        if (candidate) {
            const ab = candidate.ability;
            const tier = ABILITY_TIERS[ab.tier];
            body += '<div class="kv-box highlight"><div class="kv-title">这次的觉醒结果</div>' +
                '<div class="kv-main" style="color:' + tier.color + '">' + ab.icon + ' <b>' + G.esc(ab.name) + '</b>（' + tier.name + '）</div>' +
                '<div class="kv-line">' + G.esc(ab.desc) + '</div>' +
                '<div class="kv-line">效果：' + G.effectTextInline(ab.effect, '；') + '　战力 +' + ab.power + '</div>' +
                '</div><div class="choices">' +
                '<button class="choice" data-act="awakenkeep"><b>保留这个</b><div class="choice-lack">' +
                (s.ability.id ? '替换掉现在的' : '成为你的第二异能') + '</div></button>' +
                '<button class="choice" data-act="awakenagain"><b>再抽一次</b><div class="choice-lack">消耗 ' +
                AbilityEngine.drawCost(s) + ' 💎</div></button>' +
                '</div>';
        } else {
            body += '<div class="kv-line">消耗 ' + avail.cost + ' 💎　距上次 A 级以上：' + pity.count + ' / ' + pity.need +
                (pity.ready ? '（下一次必出 A 级以上）' : '') + '</div>' +
                '<div class="chance-row">' + table.map(t =>
                    '<span style="color:' + ABILITY_TIERS[t.tier].color + '">' + t.tier + ' ' +
                    (t.pct * 100).toFixed(1) + '%</span>').join('') + '</div>' +
                '<div class="choices">' + (avail.ok
                    ? '<button class="choice" data-act="awakenroll"><b>开始觉醒</b><div class="choice-lack">消耗 ' +
                      avail.cost + ' 💎</div></button>'
                    : '<button class="choice disabled" disabled><b>还不能觉醒</b><div class="choice-lack">' +
                      G.esc(avail.reason) + '</div></button>') + '</div>';
        }
        G.openModal('<h2>✨ 异能觉醒</h2>' +
            '<p class="modal-intro">觉醒只能抽一次，之后每次「再抽」都会消耗结晶替换掉现有的第二异能。' +
            '抽到 A 级以上会重置保底计数。</p>' + body, { wide: true, closable: true });
    }

    function renderRebirthReport() {
        const s = GameState;
        const r = s.rebirth.lastReport || {};
        const doom = DOOMS_CONFIG[r.newDoom] || {};
        const old = DOOMS_CONFIG[r.oldDoom] || {};
        const title = r.reason === 'defeat' ? '💀 据点失守 · 于是重来' : '🔁 重生';
        let html = '<h2>' + title + '</h2>';
        if (r.reason === 'defeat' && r.defeat) {
            html += '<p class="modal-intro">「' + G.esc(r.defeat.name) + '」的强度是 <b>' + r.defeat.strength +
                '</b>，而你的防御只有 <b>' + r.defeat.defense + '</b>。据点被攻占的那一刻，这一世就结束了。</p>';
        } else {
            html += '<p class="modal-intro">你闭上眼，再睁开时还是那个早上七点二十。</p>';
        }
        html += '<div class="kv-box"><div class="kv-title">重生点结算</div>' +
            (r.rows || []).map(row => '<div class="kv-line"><span>' + G.esc(row.label) + '</span><span>' +
                Utils.fmtNum(row.value, 1) + '</span></div>').join('') +
            (r.mult && Math.abs(r.mult - 1) > 1e-6 ? '<div class="kv-line"><span>加成</span><span>×' +
                r.mult.toFixed(2) + '</span></div>' : '') +
            '<div class="kv-main">共 <b>' + (r.gain || 0) + '</b> 点（累计 ' + s.rebirth.points + ' 点可用）</div></div>';
        html += '<div class="kv-box"><div class="kv-title">跟着你走的</div>' +
            '<div class="kv-line">空间异能 Lv' + s.space.level + '（技能与 ' + Utils.fmtInt(s.space.crystals) + ' 💎 结晶）</div>' +
            '<div class="kv-line">重生点、成就、统计数据' +
            (r.keepAbility ? '、第二异能（异能记忆）' : '') + '</div>' +
            '<div class="kv-title">留在上一世的</div>' +
            '<div class="kv-line">物资、据点与设施、所有羁绊角色</div>' +
            (r.keepAbility ? '' : '<div class="kv-line">第二异能（可以在重生商店买「异能记忆」保留它）</div>') +
            '</div>';
        html += '<div class="kv-box"><div class="kv-title">这一次的末日</div>' +
            '<div class="kv-main">' + old.icon + ' ' + G.esc(old.name) + ' → <b style="color:' + doom.color + '">' +
            doom.icon + ' ' + G.esc(doom.name) + '</b></div>' +
            (doom.rules || []).map(t => '<div class="kv-line">· ' + G.esc(t) + '</div>').join('') + '</div>';
        html += '<div class="modal-actions"><button class="btn primary" data-act="closemodal">开始这一世</button></div>';
        G.openModal(html, { wide: true });
    }

    function render() {
        const s = GameState;
        const pending = pendingKey(s);
        /* 结果浮窗有自己的生命周期：选项结算完之后 pending 就空了，
           但玩家还得看到「你选了什么、发生了什么」，所以不能跟着 pending 一起关掉。 */
        if (resultPage && !pending) {
            const rkey = 'result#' + resultPage.seq;
            if (rkey !== shownKey) { shownKey = rkey; renderResult(); }
            return;
        }
        /* 有新的剧情 / 事件要弹时，结果页让位（结果已经写进日志了） */
        if (resultPage && pending) resultPage = null;
        const full = pending + (candidate ? '|c' + candidate.id : '');
        if (full === shownKey) return;
        if (!pending) {
            if (shownKey) { G.closeModal(); shownKey = ''; candidate = null; }
            return;
        }
        shownKey = full;
        const p = s.pending;
        if (p.type === 'story') renderStory(STORY_CONFIG[p.id]);
        else if (p.type === 'bond') renderBond(p);
        else if (p.type === 'event') renderEvent(EVENTS_CONFIG.find(e => e.id === p.id));
        else if (p.type === 'encounter') renderEncounter();
        else if (p.type === 'cache') renderCache(p.id);
        else if (p.type === 'awaken') renderAwaken();
        else if (p.type === 'rebirthReport') renderRebirthReport();
    }

    function renderResult() {
        const r = resultPage;
        let html = '<h2>' + G.esc(r.title || '结果') + '</h2>';
        if (r.text) html += '<div class="story-pages"><p>' + G.esc(r.text) + '</p></div>';
        if (r.lines && r.lines.length) {
            html += '<div class="kv-box">' + r.lines.map(t => '<div class="kv-line">' + t + '</div>').join('') + '</div>';
        }
        html += '<div class="modal-actions"><button class="btn primary" data-act="closemodal">继续</button></div>';
        G.openModal(html, { wide: true });
    }

    function showResult(res, title) {
        resultPage = {
            seq: ++seq, title: title || '发生了这些',
            text: res.text || '', lines: res.lines || [], battle: res.battle || null,
        };
        render();
    }

    /* 玩家点「继续」之后才丢掉结果页 */
    function clearResult() { resultPage = null; }

    function refresh() { shownKey = ''; render(); }

    /* ---------------- 欢迎 / 离线 / 存档 ---------------- */
    function welcomeModal() {
        const wrap = G.openModal('<h2>💠 末日轮回</h2>' +
            '<div class="story-pages">' +
            '<p>上一世，你在末日里活了三个月，最后被自己最信的两个人关在仓库里。</p>' +
            '<p>再睁开眼，是三天前的早上七点二十。城市还在正常运转，快递还在派送，' +
            '只多了手心里那一片看不见的空间。</p>' +
            '<p>七十二小时后，一切都会开始。这一次，你先动手。</p>' +
            '</div>' +
            '<h3>先做这几件事</h3><ul class="tip-list">' +
            '<li>在「地图」从自家公寓开始搜刮，所有东西都装进空间。</li>' +
            '<li>在「异能」里用异能结晶升级空间等级、解锁技能。</li>' +
            '<li>在「据点」把门窗加固、攒食物与水。</li>' +
            '<li>搜刮会遇到人：有的人这一世还是你的兄弟，有的不是。</li>' +
            '</ul>' +
            '<p class="hint">数字键 1-8 切换页面，空格暂停，进度自动保存在浏览器里。</p>' +
            '<div class="modal-actions"><label class="hint"><input type="checkbox" id="welcome-skip"> 以后不再显示</label>' +
            '<button class="btn primary" data-act="closemodal">开始</button></div>', { wide: true });
        const skip = wrap.querySelector('#welcome-skip');
        wrap.addEventListener('click', e => {
            if (e.target.getAttribute && e.target.getAttribute('data-act') === 'closemodal' && skip && skip.checked) {
                GameState.settings.hideWelcome = true;
                SaveEngine.save(GameState);
            }
        });
    }

    function offlineModal() {
        const r = GameState.offlineReport;
        if (!r) return;
        const lines = Object.keys(r.gains || {}).map(k => '<div class="kv-line"><span>' + k + '</span><span>+' +
            Utils.fmtInt(r.gains[k]) + '</span></div>').join('');
        G.openModal('<h2>🌙 你不在的时候</h2>' +
            '<p class="modal-intro">离线 ' + Utils.fmtHours(r.realSeconds * (window.HOURS_PER_SECOND || 0.05)) +
            '（结算 ' + Utils.fmtHours(r.hours) + '，效率 ' + Math.round(r.factor * 100) + '%）。</p>' +
            '<div class="kv-box">' + (lines || '<div class="kv-line">设施没有产出。</div>') + '</div>' +
            '<p class="hint">离线只算产出、不扣消耗（伙伴会自己找吃的），也不会结算恶性事件。</p>' +
            '<div class="modal-actions"><button class="btn primary" data-act="closemodal">知道了</button></div>');
    }

    function exportModal() {
        const text = SaveEngine.exportSave(GameState);
        G.openModal('<h2>导出存档</h2><p>复制下面这段文本保存起来，换设备时用「导入存档」恢复。</p>' +
            '<textarea id="save-text" readonly>' + G.esc(text) + '</textarea>' +
            '<div class="modal-actions"><button class="btn" data-act="copytext">复制</button>' +
            '<button class="btn primary" data-act="closemodal">关闭</button></div>', { wide: true });
    }

    function importModal() {
        G.openModal('<h2>导入存档</h2><p>把之前导出的文本粘贴进来，会覆盖当前进度。</p>' +
            '<textarea id="save-text" placeholder="粘贴存档文本"></textarea>' +
            '<div class="modal-actions"><button class="btn" data-act="closemodal">取消</button>' +
            '<button class="btn primary" data-act="doimport">导入</button></div>', { wide: true });
    }

    function cleanModal() {
        const s = GameState;
        const rows = RESOURCES_ORDER.filter(k => s.resources[k] && s.resources[k].amount > 0).map(k => {
            const r = s.resources[k];
            const cfg = RESOURCES_CONFIG[k];
            return '<div class="clean-row"><span>' + cfg.icon + ' ' + k + '　' + Utils.fmtInt(r.amount) +
                '（' + Utils.fmtInt(r.amount * cfg.space) + ' 格）</span>' +
                '<span><button class="btn ghost small" data-act="discard|' + k + '">丢一半</button></span></div>';
        }).join('');
        G.openModal('<h2>整理空间</h2>' +
            '<p class="modal-intro">空间满了就没法再装新东西。丢掉暂时用不上的物资，能腾出格子。' +
            '（丢掉会掉一点点士气）</p>' +
            '<div class="kv-box">' + (rows || '<div class="kv-line">空间是空的。</div>') + '</div>' +
            '<div class="modal-actions"><button class="btn primary" data-act="closemodal">关闭</button></div>', { wide: true });
    }

    window.Modals = {
        render, refresh, showResult, clearResult, welcomeModal, offlineModal, exportModal, importModal, cleanModal,
        setCandidate(c) { candidate = c; refresh(); },
        getCandidate() { return candidate; },
        clearCandidate() { candidate = null; },
    };
})();
