/* 软窗（鼠标悬浮 / 手指点按）里显示的内容。数值 → 文案统一走 UI.effectLines */
(function () {
    const G = window.UI;

    function box(title, body) {
        return '<div class="tip-title">' + title + '</div>' + body;
    }
    function kv(k, v) {
        return '<div class="tip-kv"><span>' + k + '</span><span>' + v + '</span></div>';
    }
    function li(t) { return '<div class="tip-li">' + t + '</div>'; }

    function tipHtml(key) {
        if (!key) return null;
        const s = GameState;
        const parts = key.split('|');
        const kind = parts[0], arg = parts[1];

        if (kind === 'res') {
            const cfg = RESOURCES_CONFIG[arg];
            const r = s.resources[arg];
            if (!cfg || !r) return null;
            const rate = ProductionEngine.rateOf(s, arg);
            return box(cfg.icon + ' ' + arg,
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                kv('存量', Utils.fmtInt(r.amount)) +
                kv('每小时产出', Utils.fmtNum(rate.prod || 0, 2)) +
                kv('每小时消耗', Utils.fmtNum(rate.use || 0, 2)) +
                (cfg.space ? kv('占用空间', Utils.fmtInt(r.amount * cfg.space) + ' 格（每单位 ' + cfg.space + '）') : ''));
        }
        if (kind === 'space') {
            const e = EffectsManager.get(s);
            return box('💠 异能空间（S 级）',
                '<p class="tip-desc">主角自带的空间异能。容量靠异能结晶扩容，重生也不会丢。</p>' +
                kv('等级', 'Lv' + s.space.level) +
                kv('容量', Utils.fmtInt(ResourcesManager.spaceCap(s)) + ' 格') +
                kv('已用', Utils.fmtInt(ResourcesManager.spaceUsed(s)) + ' 格') +
                kv('结晶', Utils.fmtInt(s.space.crystals) + ' 💎') +
                '<p class="tip-hint">容量加成 ' + Utils.fmtPct(e.spaceCap || 0, 0) +
                '，固定加成 ' + Utils.fmtInt(e.spaceCapFlat || 0) + ' 格。</p>');
        }
        if (kind === 'phase' || kind === 'clock' || kind === 'countdown') {
            const p = PhaseManager.current(s);
            const remain = Math.max(0, PHASES_CONFIG[1].start - s.hours);
            return box('⏱️ ' + p.name,
                '<p class="tip-desc">' + p.desc + '</p>' +
                kv('已过', Utils.fmtHours(s.hours)) +
                (p.end !== Infinity ? kv('本阶段还有', Utils.fmtCountdown(Math.max(0, p.end - s.hours))) : '') +
                (p.id === 'pre'
                    ? li('这一阶段按行动推进：出门搜一趟 ' + ACTION_COSTS.scavenge + ' 小时（危险区 ' +
                        ACTION_COSTS.scavengeFar + ' 小时）、施工一次 ' + ACTION_COSTS.build + ' 小时、送礼物 ' +
                        ACTION_COSTS.gift + ' 小时。') +
                      li('现在还能出门大约 <b>' + Math.floor(remain / ACTION_COSTS.scavenge) + '</b> 次。') +
                      '<p class="tip-hint">不操作时间不会走，所以没有「等一等」这回事。</p>'
                    : ''));
        }
        if (kind === 'speed') {
            const pre = PhaseManager.id(s) === 'pre';
            return box('⏳ 世界流速',
                pre
                    ? '<p class="tip-desc">末日前那三天是按行动回合算的，点一次搜刮才走一格时间，' +
                      '所以流速现在是禁用的（加速也没用，反而会白吃准备时间）。</p>' +
                      li('末日爆发之后时间会自己走，那时流速才生效：×1 ~ ×4。')
                    : '<p class="tip-desc">时间会自己走：资源产出、地点刷新、袭击倒计时都按这个速度推进。</p>' +
                      kv('当前流速', '×' + (s.speed || 1)));
        }
        if (kind === 'doom') {
            const d = DOOMS_CONFIG[s.doom] || {};
            return box(d.icon + ' ' + d.name,
                '<p class="tip-desc">' + d.desc + '</p>' +
                (d.rules || []).map(t => li(t)).join('') +
                '<p class="tip-hint">末日类型每次重生都会换，只有空间异能一直跟着你。</p>');
        }
        if (kind === 'morale') {
            return box('🔥 士气 ' + Math.round(s.morale) + '%',
                '<p class="tip-desc">士气影响设施产出与据点防御。缺物资、打输、失去同伴都会掉士气。</p>' +
                kv('产出乘数', '×' + ProductionEngine.moraleMult(s).toFixed(2)) +
                kv('防御乘数', '×' + (0.85 + s.morale / 100 * 0.3).toFixed(2)));
        }
        if (kind === 'crystal') {
            return box('💎 异能结晶',
                '<p class="tip-desc">会用光的石头：升级空间异能、解锁空间技能、重抽第二异能都要它。跨重生保留。</p>' +
                kv('当前', Utils.fmtInt(s.space.crystals)) +
                kv('累计获得', Utils.fmtInt(s.space.totalCrystals)));
        }
        if (kind === 'heat') {
            return box('🔥 仇家 ' + s.heat + ' / ' + HEAT_RULES.max,
                '<p class="tip-desc">搜刮搜不出钱：现金只能向人借（花好感）或者抢（记仇）。' +
                '抢了一次，就有人记账。</p>' +
                li('仇家 ≥ ' + HEAT_RULES.visitAt + '：会有人上门来「聊聊那笔账」。') +
                li('仇家 ≥ ' + HEAT_RULES.raidAt + '：袭击直接变成「仇家清算」，强度随仇家上涨。') +
                li('每 ' + HEAT_RULES.coolHours + ' 小时没人来算账，仇家会淡 1 点。') +
                kv('当前影响', '袭击强度 ×' + MoneyEngine.raidMultiplier(s).toFixed(2)));
        }
        if (kind === 'raid') {
            const info = DefenseEngine.info(s);
            return box('🚨 ' + info.doomName,
                '<p class="tip-desc">恶性事件随阶段推进越来越频繁、越来越强。防御不够，据点会被攻占 —— 那一刻直接触发重生。</p>' +
                kv('预计强度', info.strength) +
                kv('我方防御', info.defense) +
                kv('预警时间', info.warning + ' 小时') +
                kv('历史', '守住 ' + s.raid.wins + ' 次 / 失守 ' + s.raid.losses + ' 次'));
        }
        if (kind === 'loc') {
            const loc = LOCATIONS_CONFIG.find(l => l.id === arg);
            if (!loc) return null;
            const st = ScavengeEngine.status(s, arg);
            return box(loc.icon + ' ' + loc.name,
                '<p class="tip-desc">' + loc.desc + '</p>' +
                kv('可能找到', loc.loot.map(x => x.res).join('、')) +
                kv('危险度', Math.round(loc.danger * 100) + '%（遭遇概率 ' +
                    Math.round(ScavengeEngine.encounterChance(s, loc) * 100) + '%）') +
                kv('次数', (st.max - st.uses) + ' / ' + st.max) +
                kv('刷新', '用完 ' + Utils.fmtHours(ScavengeEngine.refreshHours(s, loc)) + ' 后恢复') +
                (st.medCost ? '<p class="tip-hint">放射尘环境下每次搜刮额外消耗药品 ' + st.medCost + '。</p>' : ''));
        }
        if (kind === 'fac') {
            const cfg = FACILITIES_CONFIG[arg];
            if (!cfg) return null;
            const st = BuildEngine.status(s, arg);
            const lv = Math.max(1, st.level);
            const lines = [];
            if (cfg.effect) lines.push('效果：' + G.effectTextInline(cfg.effect(lv), '；'));
            if (cfg.produce) {
                const out = cfg.produce(lv);
                lines.push('产出：' + Object.keys(out).map(k => k + ' ' + Utils.fmtNum(out[k], 1) + '/时').join('、'));
            }
            if (cfg.power) lines.push('耗电：' + Utils.fmtNum(cfg.power(lv), 2) + ' 燃料/时');
            return box(cfg.icon + ' ' + cfg.name + ' Lv' + st.level,
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                lines.map(t => li(t)).join('') +
                kv('等级', st.level + ' / ' + cfg.maxLevel) +
                (st.maxed ? '<p class="tip-hint">已经满级。</p>'
                    : (st.tierAllowed ? kv('升到 Lv' + (st.level + 1), G.costHtml(st.cost || {}))
                        : '<p class="tip-hint">需要更高级的据点才能建。</p>')) +
                (BuildEngine.reqListFor(arg, st.target).length
                    ? '<p class="tip-hint">升到 Lv' + st.target + ' 的前置：' + BuildEngine.reqTextFor(arg, st.target) + '</p>'
                    : '') +
                (!st.tierAllowed ? '<p class="tip-hint">需要更高级的据点（' + cfg.tier + ' 级设施）。</p>' : ''));
        }
        if (kind === 'skill') {
            const cfg = SPACE_SKILLS[arg];
            if (!cfg) return null;
            const st = AbilityEngine.skillStatus(s, arg);
            return box(cfg.icon + ' ' + cfg.name,
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                li('效果：' + G.effectTextInline(cfg.effect, '；')) +
                kv('消耗', cfg.cost + ' 💎') +
                '<p class="tip-hint">' + (st.unlocked ? '已解锁。' : st.reason) + '</p>');
        }
        if (kind === 'ab') {
            const cfg = SECOND_ABILITIES[arg];
            if (!cfg) return null;
            const tier = ABILITY_TIERS[cfg.tier];
            return box(cfg.icon + ' ' + cfg.name,
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                li('等级：<b style="color:' + tier.color + '">' + tier.name + '</b>（' + tier.desc + '）　战力 +' + cfg.power) +
                li('效果：' + G.effectTextInline(cfg.effect, '；')));
        }
        if (kind === 'bond') {
            const cfg = BondEngine.cfg(arg);
            const st = BondEngine.get(s, arg);
            if (!cfg || !st) return null;
            const info = BondEngine.giftInfo(s, arg);
            const outcome = { ally: '同伴', partner: '伴侣', enemy: '敌人', dead: '已不在', left: '已离开' }[st.outcome] || '还在观望';
            return box(cfg.icon + ' ' + cfg.name + '（' + outcome + '）',
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                kv('身份', cfg.role) +
                kv('异能', cfg.ability ? cfg.ability.tier + ' 级 · ' + cfg.ability.name : '普通人') +
                kv('好感', Math.round(st.value) + ' / 100') +
                (cfg.assist ? li('协助（好感 ' + cfg.assist.at + ' 起）：' + cfg.assist.desc) : '') +
                (cfg.fight ? li('并肩作战：战力 +' + cfg.fight.power + '（好感 ' + (cfg.fight.at || 0) + ' 起）') : '') +
                li('礼物偏好：' + cfg.gift.res + ' ×' + cfg.gift.amount +
                    (cfg.giftLike && cfg.giftLike.res !== cfg.gift.res ? '（更喜欢 ' + cfg.giftLike.res + '）' : '')) +
                '<p class="tip-hint">' + (info.ok
                    ? '今天还可以送 ' + info.left + ' 次，这次大约 +' + info.value + ' 好感。'
                    : (info.reason || '')) + '</p>');
        }
        if (kind === 'ach') {
            const cfg = ACHIEVEMENTS_CONFIG.find(a => a.id === arg);
            if (!cfg) return null;
            const done = !!s.achievements[arg];
            return box((done ? '🏆 ' : '🔒 ') + cfg.name,
                '<p class="tip-desc">' + cfg.desc + '</p>' +
                kv('奖励', '异能结晶 +' + cfg.crystal) +
                (cfg.effect ? li('附带：' + G.effectTextInline(cfg.effect, '；')) : '') +
                '<p class="tip-hint">' + (done ? '已完成。' : '还没有完成。') + '</p>');
        }
        if (kind === 'shop') {
            const item = REBIRTH_SHOP.find(x => x.id === arg);
            if (!item) return null;
            const st = RebirthEngine.shopStatus(s, item);
            return box(item.icon + ' ' + item.name + ' Lv' + st.level,
                '<p class="tip-desc">' + item.desc + '</p>' +
                (item.effect ? li('当前：' + G.effectTextInline(item.effect(Math.max(1, st.level)), '；')) : '') +
                (st.maxed ? '<p class="tip-hint">已满级。</p>' : kv('下一级', st.cost + ' 重生点')) +
                '<p class="tip-hint">重生商店的加成永久生效，跨重生保留。</p>');
        }
        if (kind === 'def') {
            const e = EffectsManager.get(s);
            const base = BuildEngine.baseOf(s);
            return box('🛡️ 防御构成',
                kv('据点基础', base.defense) +
                kv('战力贡献', Math.round(PlayerManager.combatPower(s) * 0.8)) +
                kv('固定加成', '+' + Math.round(e.defenseFlat || 0)) +
                kv('百分比加成', Utils.fmtPct(e.defense || 0, 0)) +
                kv('士气乘数', '×' + (0.85 + s.morale / 100 * 0.3).toFixed(2)) +
                kv('合计', '<b>' + PlayerManager.defense(s) + '</b>'));
        }
        return null;
    }

    window.Tips = { tipHtml };
})();
