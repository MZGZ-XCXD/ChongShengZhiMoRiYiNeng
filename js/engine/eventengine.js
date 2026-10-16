/* 随机事件、遭遇、战斗，以及「选项」这套通用动作脚本 */
(function () {
    function addLog(state, text) {
        state.logs.unshift({ t: state.hours, text: text });
        if (state.logs.length > 80) state.logs.length = 80;
    }

    function push(state, text) {
        addLog(state, text);
        if (window.UI && UI.toast) UI.toast(text);
    }

    function gainText(map) {
        const parts = [];
        for (const k in map) {
            const v = map[k];
            if (!v) continue;
            parts.push(k + (v > 0 ? ' +' : ' ') + Utils.fmtInt(v));
        }
        return parts.join('　') || '无';
    }

    function rollGain(map) {
        const out = {};
        for (const k in map) {
            const v = map[k];
            out[k] = Array.isArray(v) ? Math.round(Utils.rnd(v[0], v[1])) : v;
        }
        return out;
    }

    function safeCond(state, fn) {
        try { return !!fn(state); }
        catch (e) { console.error('[事件条件] 出错：', e); return false; }
    }

    /* ---------------- 事件池 ---------------- */
    function poolFor(state) {
        const phase = PhaseManager.id(state);
        return EVENTS_CONFIG.filter(ev => {
            if (ev.phases && ev.phases.indexOf(phase) < 0) return false;
            if (ev.dooms && ev.dooms.indexOf(state.doom) < 0) return false;
            if (ev.once && state.flags['ev_seen_' + ev.id]) return false;
            const last = state.flags['ev_at_' + ev.id];
            if (last !== undefined && state.hours - last < 24) return false;
            if (ev.cond && !safeCond(state, ev.cond)) return false;
            return true;
        });
    }

    function pickEvent(state) {
        return Utils.weightedPick(poolFor(state), ev => ev.weight);
    }

    function trigger(state, id) {
        const ev = EVENTS_CONFIG.find(x => x.id === id);
        if (!ev) return false;
        if (ev.once && state.flags['ev_seen_' + id]) return false;
        if (state.pending) return false;
        const phase = PhaseManager.id(state);
        if (ev.phases && ev.phases.indexOf(phase) < 0) return false;
        state.flags['ev_at_' + id] = state.hours;
        if (ev.once) state.flags['ev_seen_' + id] = true;
        state.events.count = (state.events.count || 0) + 1;
        state.pending = { type: 'event', id: id };
        return true;
    }

    function tick(state, hours) {
        /* 临时效果到期 */
        const alive = [];
        for (const t of state.tempEffects) {
            if (t.until <= state.hours) addLog(state, '⌛ 「' + t.name + '」的效果结束了。');
            else alive.push(t);
        }
        state.tempEffects = alive;

        const e = EffectsManager.get(state);
        if (state.hours < (state.events.nextAt || 0)) return;
        const rate = Math.max(-0.6, e.eventRate || 0);
        const interval = Math.max(2, Utils.rnd(5, 9) / (1 + rate));
        state.events.nextAt = state.hours + interval;
        if (state.pending) return;
        const ev = pickEvent(state);
        if (ev) trigger(state, ev.id);
    }

    /* ---------------- 战斗 ---------------- */
    function battleSpec(state, spec) {
        const power = PlayerManager.combatPower(state);
        const win = power * Utils.rnd(0.85, 1.15) >= spec.power;
        state.stats.battles += 1;
        if (win) {
            state.stats.battlesWon += 1;
            const added = spec.winLoot ? ResourcesManager.add(rollGain(spec.winLoot), state) : {};
            let crystal = 0;
            if (spec.crystal) crystal = PlayerManager.addCrystal(state, spec.crystal, null);
            if (spec.winMorale) PlayerManager.addMorale(state, spec.winMorale);
            const line = '⚔️ 赢了：' + (spec.name || '对手') + '。' +
                (Object.keys(added).length ? '缴获 ' + gainText(added) : '') +
                (crystal ? '（结晶 +' + crystal + '）' : '');
            push(state, line);
            return { win: true, line: line, gains: added, crystal: crystal };
        }
        const lost = {};
        if (spec.loseLoot) {
            for (const k in spec.loseLoot) {
                const take = Math.min(ResourcesManager.amount(k), spec.loseLoot[k]);
                if (take > 0) { ResourcesManager.discard(state, k, take); lost[k] = take; }
            }
        }
        if (spec.loseMorale) PlayerManager.addMorale(state, spec.loseMorale);
        const line = '🩸 输了：' + (spec.name || '对手') + '。' +
            (Object.keys(lost).length ? '损失 ' + gainText(lost) : '被打退了');
        push(state, line);
        return { win: false, line: line, lost: lost };
    }

    function resolveBattle(state, key) {
        const cfg = BATTLES_CONFIG[key] || BATTLES_CONFIG.enemy;
        /* 仇家越多，对面越舍得下本钱雇人 */
        const heat = state.heat ? (1 + state.heat * 0.05) : 1;
        return battleSpec(state, {
            name: cfg.name, power: Math.round(cfg.power * heat),
            winLoot: cfg.winLoot, loseLoot: cfg.loseLoot, crystal: cfg.crystal,
            winMorale: cfg.winMorale, loseMorale: cfg.loseMorale,
        });
    }

    /* ---------------- 选项动作脚本 ----------------
       事件 / 羁绊 / 剧情共用这一套：
       cost 扣资源、gain 得资源、crystal 结晶、morale 士气、value 好感、
       temp 限时效果、facility 免费升级、unlock 解锁地点、set 记标记、battle 打一场。 */
    function applyChoice(state, ch, ctx) {
        ctx = ctx || {};
        const res = { ok: true, lines: [] };

        if (ch.crystal && ch.crystal < 0) {
            const need = -ch.crystal;
            if (state.space.crystals < need) return { ok: false, msg: '异能结晶不够（需要 ' + need + ' 颗）。' };
        }
        if (ch.cost && !ResourcesManager.canAfford(ch.cost, state)) {
            const miss = ResourcesManager.missing(ch.cost, state);
            return { ok: false, msg: '物资不够：还差 ' + gainText(miss) };
        }

        if (ch.cost) {
            ResourcesManager.spend(ch.cost, state);
            res.lines.push('消耗 ' + gainText(ch.cost));
        }
        if (ch.crystal < 0) {
            state.space.crystals += ch.crystal;
            res.lines.push('异能结晶 ' + ch.crystal);
        }
        if (ch.gain) {
            const added = ResourcesManager.add(rollGain(ch.gain), state);
            if (Object.keys(added).length) res.lines.push('获得 ' + gainText(added));
        }
        if (ch.crystal > 0) {
            const g = PlayerManager.addCrystal(state, ch.crystal, '事件');
            if (g) res.lines.push('异能结晶 +' + g);
        }
        if (ch.morale) {
            PlayerManager.addMorale(state, ch.morale);
            res.lines.push('士气 ' + (ch.morale > 0 ? '+' : '') + ch.morale);
        }
        if (ctx.bondId) {
            BondEngine.markMet(state, ctx.bondId);
            if (ch.value) BondEngine.addValue(state, ctx.bondId, ch.value, '剧情');
            if (ch.outcome) BondEngine.setOutcome(state, ctx.bondId, ch.outcome);
        }
        if (ch.bonds) {
            for (const id in ch.bonds) {
                BondEngine.markMet(state, id);
                BondEngine.setOutcome(state, id, ch.bonds[id]);
            }
        }
        if (ch.temp) {
            state.tempEffects.push({ name: ch.temp.name, effect: ch.temp.effect, until: state.hours + ch.temp.hours });
            res.lines.push('持续效果「' + ch.temp.name + '」' + Utils.fmtHours(ch.temp.hours));
        }
        if (ch.facility) {
            for (const id in ch.facility) {
                const r = BuildEngine.freeLevel(state, id, ch.facility[id]);
                if (r.ok) res.lines.push('设施「' + r.name + '」+1 级');
            }
        }
        if (ch.unlock) {
            let n = 0;
            for (const lid of ch.unlock) {
                if (state.locations[lid] && !state.locations[lid].seen) {
                    state.locations[lid].seen = true;
                    const lc = LOCATIONS_CONFIG.find(x => x.id === lid);
                    if (lc) res.lines.push('新地点：' + lc.name);
                    n++;
                }
            }
            if (!n) res.lines.push('地图没有变化');
        }
        if (ch.set) {
            for (const k in ch.set) state.flags[k] = ch.set[k];
            if (ch.set.revenge) state.story.revenge = 1;
        }
        if (ch.battle) {
            const b = resolveBattle(state, ch.battle);
            res.battle = b;
            res.lines.push(b.line);
                if (b.win && ch.heatOnWin) MoneyEngine.addHeat(state, ch.heatOnWin, '打退了一波');
                if (!b.win && ch.heatOnLose) MoneyEngine.addHeat(state, ch.heatOnLose, '被人打上门');
            }
            if (ch.heat) {
                if (ch.heat > 0) MoneyEngine.addHeat(state, ch.heat, '你的选择');
                else MoneyEngine.reduceHeat(state, -ch.heat, '你的选择');
                res.lines.push('仇家 ' + (ch.heat > 0 ? '+' : '') + ch.heat);
        }
        if (ch.duel) {
            const b = resolveBattle(state, ch.duel === 'guchangan' ? 'guchangan' : 'enemy');
            res.battle = b;
            if (b.win) {
                BondEngine.setOutcome(state, 'guchangan', 'ally');
                BondEngine.addValue(state, 'guchangan', 30, '决斗');
                res.lines.push('他拍掉身上的灰："行，我跟你走。"');
            } else {
                const take = Math.min(ResourcesManager.amount('食物'), 40);
                ResourcesManager.discard(state, '食物', take);
                res.lines.push('你输了。按约定，你留下了一批物资。');
            }
        }
        if (ch.gamble) {
            const id = ch.gamble;
            const st = BondEngine.get(state, id);
            const trust = st.value >= 60;
            res.lines.push(trust
                ? '他确实把货分了你一半，还多塞给你两卷电线。'
                : '回程时他"不小心"把一箱罐头掉在了路边——你看见了，他就笑。');
            if (trust) {
                BondEngine.addValue(state, id, 10, '同行');
                const added = ResourcesManager.add({ '食物': 30, '弹药': 12 }, state);
                res.lines.push('获得 ' + gainText(added));
            } else {
                BondEngine.addValue(state, id, -5, '同行');
                BondEngine.setOutcome(state, id, 'left');
            }
        }
        if (ch.action === 'awaken') {
            state.pending = { type: 'awaken' };
            res.action = 'awaken';
        }
        state.stats.eventsResolved += 1;
        EffectsManager.refreshAllEffects(state);
        AchievementEngine.check(state);
        res.text = ch.result || '';
        return res;
    }

    /* 结算一个待处理的事件浮窗 */
    function resolve(state, choiceIndex) {
        const p = state.pending;
        if (!p || p.type !== 'event') return { ok: false, msg: '现在没有待处理的事件。' };
        const ev = EVENTS_CONFIG.find(x => x.id === p.id);
        if (!ev) { state.pending = null; return { ok: false, msg: '事件数据丢了。' }; }
        const ch = ev.choices[choiceIndex];
        if (!ch) return { ok: false, msg: '没有这个选项。' };
        const ctx = ev.bond ? { bondId: ev.bond } : {};
        const res = applyChoice(state, ch, ctx);
        if (!res.ok) return res;
        if (res.action === 'awaken') return res;      // 觉醒浮窗接替
        state.pending = null;
        return res;
    }

    /* 选项能不能点（可点性只看当前资源） */
    function choiceUsable(state, ch) {
        if (ch.crystal && ch.crystal < 0 && state.space.crystals < -ch.crystal) {
            return { ok: false, lack: '还差异能结晶 ' + (-ch.crystal - state.space.crystals) + ' 颗' };
        }
        if (ch.cost && !ResourcesManager.canAfford(ch.cost, state)) {
            return { ok: false, lack: '还差 ' + gainText(ResourcesManager.missing(ch.cost, state)) };
        }
        return { ok: true };
    }

    window.EventEngine = {
        addLog, push, gainText, rollGain, trigger, tick, poolFor, pickEvent,
        battleSpec, resolveBattle, applyChoice, resolve, choiceUsable,
    };
})();
