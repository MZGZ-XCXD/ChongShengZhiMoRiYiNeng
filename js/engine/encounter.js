/* 遭遇战：搜刮时撞上敌人不再自动结算，而是弹窗让你决定「打还是跑」。
   战力判定和 battleSpec 用同一条公式（战力 × 0.85~1.15 对撞），所以界面上显示的胜率是准的。 */
(function () {
    function namesOf(doom) {
        const list = ENEMIES_CONFIG[doom] || ENEMIES_CONFIG.zombie;
        return list.map(e => e.name);
    }

    /* 胜率：mine × r ≥ enemy，其中 r 均匀落在 [rollLow, rollHigh] */
    function winOdds(mine, enemy) {
        const R = ENCOUNTER_RULES;
        if (enemy <= 0) return 1;
        const ratio = enemy / Math.max(1, mine);
        return Utils.clamp((R.rollHigh - ratio) / (R.rollHigh - R.rollLow), 0, 1);
    }

    function fleeOdds(state, enc, dumping) {
        const R = ENCOUNTER_RULES;
        const ratio = enc.power / Math.max(1, PlayerManager.combatPower(state));
        const p = R.fleeBase - Math.min(R.fleePenaltyCap, Math.max(0, ratio - 1) * R.fleePenalty) +
            (dumping ? R.dumpFleeBonus : 0);
        return Utils.clamp(p, 0.12, 0.92);
    }

    /* 组一支敌人：种类随机、个数看数量区间、战力随时间和危险度上浮 */
    function roll(state, loc) {
        const R = ENCOUNTER_RULES;
        const list = ENEMIES_CONFIG[state.doom] || ENEMIES_CONFIG.zombie;
        const kind = Utils.pick(list);
        const scale = 1 + state.hours / R.powerOverTime;
        const count = Utils.rndInt(kind.count[0], kind.count[1]) + (loc.danger >= R.extraAtDanger ? 1 : 0);
        const unit = Math.max(1, Math.round(kind.power * scale));
        const power = Math.max(1, Math.round(unit * count * (1 + loc.danger * R.dangerBonus)));
        return {
            kind: kind, unit: unit, count: count, power: power,
            seq: (state.encounter && state.encounter.seq ? state.encounter.seq : 0) + 1,
            location: loc.id, locationName: loc.name,
            tries: 0, dumped: {}, log: [],
        };
    }

    /* 开始一次遭遇：一半是事，一半是打（打的这一半交给玩家决定） */
    function start(state, loc, opts) {
        opts = opts || {};
        if (state.pending) return null;
        if (Math.random() < (1 - ENCOUNTER_RULES.battleChance)) {
            const ev = EventEngine.pickEvent(state);
            if (ev && EventEngine.trigger(state, ev.id)) return { kind: 'event', id: ev.id };
        }
        const enc = roll(state, loc);
        state.encounter = enc;
        if (opts.interactive === false) {
            /* 自动搜刮不弹窗：直接按战力结算，输了照样被占 */
            const res = fight(state, true);
            return { kind: 'battle', result: res, enemy: { name: enc.kind.name, power: enc.power }, auto: true };
        }
        state.pending = { type: 'encounter' };
        EventEngine.addLog(state, '⚠️ 在' + loc.name + '撞上了 ' + enc.count + ' 只「' + enc.kind.name +
            '」（对方战力 ' + enc.power + '）。');
        return { kind: 'encounter', encounter: enc };
    }

    /* 迎战 */
    function fight(state, auto) {
        const enc = state.encounter;
        if (!enc) return null;
        const loc = ScavengeEngine.locOf(enc.location);
        const res = EventEngine.battleSpec(state, {
            name: enc.count + ' 只' + enc.kind.name, power: enc.power,
            winLoot: { '食物': Utils.rndInt(8, 20), '弹药': Utils.rndInt(2, 8) },
            loseLoot: { '食物': Utils.rndInt(8, 18), '药品': Utils.rndInt(1, 5) },
            crystal: 2 + Math.floor(enc.power / 40), winMorale: 5, loseMorale: -8,
        });
        if (!res.win && loc) {
            ScavengeEngine.occupy(state, loc, enc.count + ' 只' + enc.kind.name, enc.power);
            res.occupied = true;
        }
        if (!auto) {
            state.encounter = null;
            state.pending = null;
        }
        return res;
    }

    /* 逃跑：失败就丢一部分物资，然后还得再选一次 */
    function flee(state, opts) {
        opts = opts || {};
        const enc = state.encounter;
        if (!enc) return { ok: false, msg: '没有正在进行的遭遇。' };
        const R = ENCOUNTER_RULES;
        const loc = ScavengeEngine.locOf(enc.location);
        const p = fleeOdds(state, enc, opts.dumping);

        if (opts.dumping) {
            /* 主动放下一些东西，换更高的成功率 */
            const dropped = ResourcesManager.add({}, state) || {};
            const lost = {};
            for (const k in R.dumpCost) {
                const take = Math.min(ResourcesManager.amount(k), R.dumpCost[k]);
                if (take > 0) { ResourcesManager.discard(state, k, take); lost[k] = take; }
            }
            enc.dumped = lost;
            enc.log.push('丢下了 ' + EventEngine.gainText(lost));
        }

        if (Math.random() < p) {
            enc.log.push('甩掉了他们');
            PlayerManager.addMorale(state, -2);
            const text = (opts.dumping ? '你把东西扔在巷子里，趁他们去抢的时候翻过了墙。' : '你转身就跑，一直跑到听不见为止。');
            state.encounter = null;
            state.pending = null;
            EventEngine.addLog(state, '🏃 在' + (loc ? loc.name : '废墟') + '甩掉了' + enc.count + ' 只' + enc.kind.name + '。');
            return { ok: true, fled: true, text: text, lines: enc.log };
        }

        /* 没跑掉 */
        enc.tries += 1;
        const lost = {};
        for (const k in R.fleeLoss) {
            const r = R.fleeLoss[k];
            const take = Math.min(ResourcesManager.amount(k), Utils.rndInt(r[0], r[1]));
            if (take > 0) { ResourcesManager.discard(state, k, take); lost[k] = take; }
        }
        PlayerManager.addMorale(state, -3);
        enc.log.push('第 ' + enc.tries + ' 次没跑掉：' + EventEngine.gainText(lost));

        if (enc.tries >= R.maxFleeTries) {
            /* 被冲散：损失更重，而且这个地方被他们占了 */
            const heavy = {};
            for (const k in R.scatterLoss) {
                const r = R.scatterLoss[k];
                const take = Math.min(ResourcesManager.amount(k), Utils.rndInt(r[0], r[1]));
                if (take > 0) { ResourcesManager.discard(state, k, take); heavy[k] = take; }
            }
            PlayerManager.addMorale(state, -8);
            if (loc) ScavengeEngine.occupy(state, loc, enc.count + ' 只' + enc.kind.name, enc.power);
            state.encounter = null;
            state.pending = null;
            return {
                ok: true, fled: false, scattered: true, lines: enc.log,
                text: '你被追上了。东西散了一地，你只捡回了半条命 —— 他们也记住了这里。',
                extra: heavy,
            };
        }
        EventEngine.addLog(state, '🏃 没跑掉：' + EventEngine.gainText(lost) + '在混乱中丢了。');
        return { ok: true, fled: false, lines: enc.log, odds: p };
    }

    function info(state) {
        const enc = state.encounter;
        if (!enc) return null;
        const mine = PlayerManager.combatPower(state);
        const odds = winOdds(mine, enc.power);
        return {
            enc: enc, mine: mine, odds: odds,
            canFight: odds > 0,
            verdict: odds >= 0.85 ? '稳赢' : (odds >= 0.35 ? '有得打' : (odds > 0 ? '很勉强' : '打不过')),
            flee: fleeOdds(state, enc, false),
            fleeDump: fleeOdds(state, enc, true),
            dumpCost: ENCOUNTER_RULES.dumpCost,
            tries: enc.tries, maxTries: ENCOUNTER_RULES.maxFleeTries,
        };
    }

    window.EncounterEngine = { namesOf, winOdds, fleeOdds, roll, start, fight, flee, info };
})();
