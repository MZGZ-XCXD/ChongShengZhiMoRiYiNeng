/* 羁绊：相遇、好感、送礼、关键节点 */
(function () {
    function cfg(id) { return BONDS_CONFIG.find(b => b.id === id); }
    function get(state, id) { return state.bonds[id]; }

    function markMet(state, id) {
        const st = get(state, id);
        if (!st || st.met) return false;
        const c = cfg(id);
        st.met = true;
        EventEngine.addLog(state, '🤝 你认识了「' + (c ? c.name : id) + '」。');
        return true;
    }

    function setOutcome(state, id, outcome) {
        const st = get(state, id);
        const c = cfg(id);
        if (!st) return;
        st.met = true;
        if (outcome) st.outcome = outcome;
        const label = {
            ally: '成了你的同伴', partner: '和你走到了一起', enemy: '成了你的敌人',
            dead: '死在了这一世', left: '离开了这里', neutral: '保持着距离',
        }[outcome] || outcome;
        if (label && c) EventEngine.push(state, '🤝 ' + c.name + label + '。');
        EffectsManager.refreshAllEffects(state);
    }

    /* 好感：正收益吃「好感获取」加成，负收益不打折 */
    function addValue(state, id, delta, reason) {
        const st = get(state, id);
        const c = cfg(id);
        if (!st || !c || !delta) return 0;
        const e = EffectsManager.get(state);
        const gain = delta > 0 ? delta * (1 + (e.bondGain || 0)) : delta;
        const before = st.value;
        st.value = Utils.clamp(st.value + gain, -30, 100);
        const diff = Math.round(st.value - before);
        if (diff) {
            EventEngine.addLog(state, (diff > 0 ? '💬 ' : '💔 ') + c.name + ' 好感 ' +
                (diff > 0 ? '+' : '') + diff + '（' + (reason || '剧情') + '）' +
                '，现在是 ' + Math.round(st.value));
        }
        return diff;
    }

    function assistActive(state, id) {
        const st = get(state, id);
        const c = cfg(id);
        if (!st || !st.met || !c || !c.assist) return false;
        if (st.outcome === 'enemy' || st.outcome === 'dead' || st.outcome === 'left') return false;
        return st.value >= (c.assist.at || 0);
    }

    /* 在某个地点搜刮时遇到人 */
    function tryMeet(state, loc) {
        if (state.pending) return false;
        /* 地点可以指定一个人（loc.bond），否则按配置顺序找出「住在这个地点、还没认识」的角色 */
        let c = null;
        if (loc.bond) {
            const st = get(state, loc.bond);
            if (st && !st.met) c = cfg(loc.bond);
        }
        if (!c) {
            c = BONDS_CONFIG.find(b => b.locate && b.locate.location === loc.id && !get(state, b.id).met) || null;
        }
        if (!c) return false;
        if (c.phase && !phaseOk(state, c.phase)) return false;
        markMet(state, c.id);
        present(state, c.id, 'meet');
        return true;
    }

    function phaseOk(state, phase) {
        const order = PHASES_CONFIG.map(p => p.id);
        return order.indexOf(PhaseManager.id(state)) >= order.indexOf(phase);
    }

    function present(state, id, stage) {
        state.pending = { type: 'bond', id: id, stage: stage };
    }

    function crossroadReady(state, id) {
        const st = get(state, id);
        const c = cfg(id);
        if (!st || !c || !c.crossroad) return false;
        if (!st.met || st.flag.crossroadDone) return false;
        if (st.outcome === 'dead' || st.outcome === 'left') return false;
        return st.value >= c.crossroad.at;
    }

    function tick(state) {
        /* 关键节点：好感够了就触发（一次只弹一个） */
        if (!state.pending) {
            for (const c of BONDS_CONFIG) {
                if (!crossroadReady(state, c.id)) continue;
                present(state, c.id, 'crossroad');
                break;
            }
        }
        /* 自动送礼 */
        const e = EffectsManager.get(state);
        if (!e.specials.autoGift || !state.settings.autoGift) return;
        if (state.hours < (state.autoGiftAt || 0)) return;
        state.autoGiftAt = state.hours + 8;
        for (const c of BONDS_CONFIG) {
            const info = giftInfo(state, c.id);
            if (info.ok && info.value < 70) { gift(state, c.id); break; }
        }
    }

    /* ---------------- 送礼 ---------------- */
    function giftInfo(state, id) {
        const c = cfg(id);
        const st = get(state, id);
        const e = EffectsManager.get(state);
        if (!c || !st) return { ok: false, reason: '没有这个人。' };
        if (!st.met) return { ok: false, reason: '还没认识他/她。' };
        if (st.outcome === 'dead' || st.outcome === 'left') return { ok: false, reason: '已经不在了。' };
        const day = Math.floor(state.hours / 24);
        const today = st.giftDay === day ? (st.giftsToday || 0) : 0;
        const limit = (c.giftLimit || 3) + Math.floor(e.giftExtra || 0);
        const same = c.giftLike && c.giftLike.res === c.gift.res;
        const base = 6 + (same ? (c.giftLike.bonus || 0) : 0);
        const value = Math.max(1, Math.round(base * Math.pow(0.6, today) * (1 + (e.giftEffect || 0)) * (1 + (e.bondGain || 0))));
        const cost = {}; cost[c.gift.res] = c.gift.amount;
        const liked = c.giftLike && c.giftLike.res !== c.gift.res;
        if (today >= limit) return { ok: false, reason: '今天已经收过 ' + limit + ' 次礼物了。', value: value, cost: cost, left: 0 };
        if (!ResourcesManager.canAfford(cost, state)) {
            return { ok: false, reason: '还差 ' + c.gift.res + ' ' + c.gift.amount, value: value, cost: cost, left: limit - today };
        }
        return { ok: true, value: value, cost: cost, left: limit - today, res: c.gift.res, amount: c.gift.amount, liked: liked };
    }

    function gift(state, id) {
        const info = giftInfo(state, id);
        if (!info.ok) return info;
        ResourcesManager.spend(info.cost, state);
        const c = cfg(id);
        const st = get(state, id);
        const day = Math.floor(state.hours / 24);
        if (st.giftDay !== day) { st.giftDay = day; st.giftsToday = 0; }
        st.giftsToday += 1;
        st.gifts += 1;
        st.lastGiftAt = state.hours;
        const diff = addValue(state, id, info.value, '送礼物');
        PlayerManager.addMorale(state, 1);
        state.stats.gifts += 1;
        Actions.spend(state, 'gift');
        return { ok: true, value: diff, msg: '送出了 ' + c.gift.res + ' ' + c.gift.amount + '，' + c.name + ' 好感 +' + diff };
    }

    /* 结算羁绊浮窗（相遇 / 关键节点） */
    function resolve(state, choiceIndex) {
        const p = state.pending;
        if (!p || p.type !== 'bond') return { ok: false, msg: '现在没有待处理的事。' };
        const c = cfg(p.id);
        if (!c) { state.pending = null; return { ok: false, msg: '数据丢了。' }; }
        const block = p.stage === 'meet' ? c.meet : c.crossroad;
        const ch = block && block.choices ? block.choices[choiceIndex] : null;
        if (!ch) return { ok: false, msg: '没有这个选项。' };
        const st = get(state, p.id);
        if (!st) { state.pending = null; return { ok: false, msg: '数据丢了。' }; }
        if (ch.value === undefined && ch.result === undefined && !ch.cost && !ch.gain) {
            /* 允许只有文案的选项 */
        }
        const res = EventEngine.applyChoice(state, ch, { bondId: p.id });
        if (!res.ok) return res;
        if (p.stage === 'crossroad') st.flag.crossroadDone = true;
        if (res.action === 'awaken') return res;
        state.pending = null;
        return res;
    }

    function listMet(state) {
        return BONDS_CONFIG.filter(c => get(state, c.id).met);
    }

    function assistText(state, id) {
        const c = cfg(id);
        if (!c || !c.assist) return '';
        return c.assist.desc || '';
    }

    window.BondEngine = {
        cfg, get, markMet, setOutcome, addValue, assistActive, tryMeet, present,
        crossroadReady, tick, giftInfo, gift, resolve, listMet, assistText, phaseOk,
    };
})();
