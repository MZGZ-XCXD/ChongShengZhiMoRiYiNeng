/* 搜刮：地点的次数 / 刷新 / 危险遭遇 / 隐藏物资点 */
(function () {
    function locOf(id) { return LOCATIONS_CONFIG.find(l => l.id === id); }

    function isDisabled(state, loc) {
        const doom = DOOMS_CONFIG[state.doom];
        return !!(doom && doom.disabledLocations && doom.disabledLocations.indexOf(loc.id) >= 0);
    }

    function maxUses(state, loc) {
        return Math.max(1, loc.uses + Math.floor(EffectsManager.additive(state, 'scavengeUses')));
    }

    function refreshHours(state, loc) {
        return loc.refresh / (1 + Math.max(0, EffectsManager.additive(state, 'scavengeRefresh')));
    }

    function unlocked(state, loc) {
        const st = state.locations[loc.id];
        if (st && st.seen) return true;
        const gate = loc.unlock || {};
        if (gate.hours !== undefined && state.hours >= gate.hours) return true;
        return false;
    }

    function lockReason(state, loc) {
        const gate = loc.unlock || {};
        if (gate.hours !== undefined && state.hours < gate.hours) {
            return '还要 ' + Utils.fmtCountdown(gate.hours - state.hours) + ' 才会进入你的活动范围';
        }
        return '还没有发现这个地方';
    }

    function medCost(state) {
        const doom = DOOMS_CONFIG[state.doom];
        return (doom && doom.scavengeMedUse) ? doom.scavengeMedUse : 0;
    }

    /* ---------------- 被敌人占领 ----------------
       搜刮时打输了，对方会占住这里：东西被搬走、正常刷新也填不满，
       想提前拿回来只能在地图上点「夺回」打一场；不管它，到点对方自己会撤。 */
    function occupied(state, id) {
        const rec = state.locations[id];
        if (!rec || !rec.occupied) return null;
        return rec.occupied.until > state.hours ? rec.occupied : null;
    }

    function holdHours(loc) {
        return Math.max(4, Math.round(OCCUPY_HOURS.base + OCCUPY_HOURS.perDanger * loc.danger));
    }

    function occupy(state, loc, enemyName, power) {
        const rec = state.locations[loc.id];
        const hold = holdHours(loc);
        rec.occupied = {
            name: enemyName,
            power: Math.max(1, Math.round(power || 1)),
            at: state.hours,
            until: state.hours + hold,
            times: (rec.occupied && rec.occupied.times ? rec.occupied.times : 0) + 1,
        };
        rec.uses = maxUses(state, loc);
        rec.at = rec.occupied.until;
        EventEngine.addLog(state, '💀 「' + enemyName + '」占了' + loc.name + '，' +
            Utils.fmtHours(hold) + '内搜不了（在地图上点这里可以夺回）。');
        return rec.occupied;
    }

    /* 解除占领：次数归零、按正常节奏重新刷新 */
    function release(state, id, why) {
        const rec = state.locations[id];
        const loc = locOf(id);
        if (!rec || !rec.occupied || !loc) return false;
        const name = rec.occupied.name;
        rec.occupied = null;
        rec.uses = 0;
        rec.at = state.hours + refreshHours(state, loc);
        EventEngine.addLog(state, (why === 'reclaimed' ? '⚔️ 你夺回了' : '🌫️ 「' + name + '」撤了，')
            + loc.name + (why === 'reclaimed' ? '，这里又能搜了。' : '又能去了。'));
        return true;
    }

    /* 夺回：和占着这里的敌人正面打一场 */
    function reclaim(state, id) {
        const st = status(state, id);
        if (!st.unlocked) return { ok: false, msg: st.reason };
        const occ = st.occupied;
        if (!occ) return { ok: false, msg: '这里没有被占。' };
        const loc = st.loc;
        const res = EventEngine.battleSpec(state, {
            name: occ.name, power: occ.power,
            winLoot: { '食物': Utils.rndInt(8, 22), '弹药': Utils.rndInt(2, 8), '零件': Utils.rndInt(2, 6) },
            loseLoot: { '食物': Utils.rndInt(6, 16), '药品': Utils.rndInt(1, 4) },
            crystal: 3, winMorale: 8, loseMorale: -8,
        });
        if (res.win) {
            release(state, id, 'reclaimed');
        } else {
            /* 又输了：他们把东西搬得更干净，也更赖着不走 */
            const rec = state.locations[id];
            rec.uses = maxUses(state, loc);
            rec.occupied.until = state.hours + Math.max(4, Math.round(holdHours(loc) * 0.6));
            rec.at = rec.occupied.until;
            EventEngine.addLog(state, '💀 夺回失败，「' + occ.name + '」还在' + loc.name + '。');
        }
        Actions.spend(state, 'reclaim');
        AchievementEngine.check(state);
        return { ok: true, msg: res.line, battle: res, win: res.win, held: !res.win };
    }

    /* 地点当前状态（界面与判断都走这里，避免两处算法不一致） */
    function status(state, id) {
        const loc = locOf(id);
        const st = state.locations[id];
        const out = {
            id: id, loc: loc, unlocked: unlocked(state, loc), disabled: isDisabled(state, loc),
            max: maxUses(state, loc), uses: st.uses, left: Math.max(0, maxUses(state, loc) - st.uses),
            refreshIn: 0, medCost: medCost(state), ok: false, reason: '',
            occupied: occupied(state, id),
        };
        if (!out.unlocked) { out.reason = lockReason(state, loc); return out; }
        if (out.disabled) { out.reason = '已经被淹了，进不去'; return out; }
        if (out.occupied) {
            out.reason = '被「' + out.occupied.name + '」占着，还有 ' +
                Utils.fmtCountdown(out.occupied.until - state.hours);
            return out;
        }
        if (out.left <= 0) {
            out.refreshIn = Math.max(0, st.at - state.hours);
            out.reason = '要等 ' + Utils.fmtCountdown(out.refreshIn) + ' 才会重新有东西';
            return out;
        }
        const c = medCost(state);
        if (c && ResourcesManager.amount('药品') < c) {
            out.reason = '放射尘太大，需要药品 ' + c + ' 做清创';
            return out;
        }
        out.ok = true;
        return out;
    }

    function yieldMult(state, res, loc) {
        const e = EffectsManager.get(state);
        const doom = DOOMS_CONFIG[state.doom] || {};
        const bias = doom.lootBias && doom.lootBias[res] !== undefined ? doom.lootBias[res] : 1;
        const phaseBonus = PhaseManager.isAtLeast(state, 'apocalypse') ? 1.25 : 1;
        const risk = 1 - Math.min(0.35, loc.danger * 0.35);
        return Math.max(0, (1 + (e.scavengeYield || 0)) * bias * phaseBonus * risk);
    }

    function rollLoot(state, loc, mult) {
        const gains = {};
        mult = mult === undefined ? 1 : mult;
        const picks = 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.18 ? 1 : 0);
        for (let i = 0; i < picks; i++) {
            const entry = Utils.weightedPick(loc.loot, x => x.w);
            if (!entry) break;
            const amt = Utils.rnd(entry.min, entry.max) * yieldMult(state, entry.res, loc) * mult;
            gains[entry.res] = (gains[entry.res] || 0) + Math.max(1, Math.round(amt));
        }
        return gains;
    }

    function rollRare(state, loc, mult) {
        const e = EffectsManager.get(state);
        const out = { crystal: 0 };
        const luck = 1 + (e.lootLuck || 0) * 1.5;
        /* 碎片：任何地点都可能摸到一点结晶，这是成长线的底噪 */
        if (Math.random() < 0.12 * luck) out.crystal += 1;
        if (!loc.rare) return out;
        for (const r of loc.rare) {
            const p = r.w * (window.CRYSTAL_DROP_RATE || 0.025) * luck * mult;
            if (Math.random() < p) out.crystal += Utils.rndInt(r.min, r.max);
        }
        return out;
    }

    function encounterChance(state, loc) {
        if (EffectsManager.hasSpecial(state, 'noAmbush')) return 0;
        const doom = DOOMS_CONFIG[state.doom] || {};
        const crisis = PhaseManager.crisis(state);
        const stage = PhaseManager.isAtLeast(state, 'outbreak') ? 1.15 : (0.45 + crisis * 0.9);
        return Utils.clamp(loc.danger * stage * (doom.scavengeDanger || 1), 0, 0.75);
    }

    function scavenge(state, id, opts) {
        opts = opts || {};
        const st = status(state, id);
        if (!st.unlocked) return { ok: false, msg: st.reason };
        if (st.disabled) return { ok: false, msg: st.reason };
        if (st.left <= 0) return { ok: false, msg: st.reason };
        if (st.medCost && ResourcesManager.amount('药品') < st.medCost) return { ok: false, msg: st.reason };
        if (st.medCost) ResourcesManager.spend({ '药品': st.medCost });

        const loc = st.loc;
        const rec = state.locations[id];
        rec.uses += 1;
        rec.total = (rec.total || 0) + 1;
        if (rec.uses >= st.max) rec.at = state.hours + refreshHours(state, loc);
        state.stats.scavenges += 1;
        state.stats.scavengesByLocation[id] = (state.stats.scavengesByLocation[id] || 0) + 1;

        const mult = opts.mult === undefined ? 1 : opts.mult;
        let gains = rollLoot(state, loc, mult);
        const rare = rollRare(state, loc, mult);

        const added = ResourcesManager.add(gains, state);
        let wasted = false;
        for (const k in gains) if ((added[k] || 0) < gains[k] - 0.5) wasted = true;

        let crystal = rare.crystal;
        if (crystal > 0) {
            crystal = PlayerManager.addCrystal(state, crystal, null);
        }

        const lines = [];
        for (const k in added) if (added[k] > 0) lines.push(k + ' +' + Utils.fmtInt(added[k]));
        if (wasted) lines.push('（空间装不下了，一部分只能留在原地）');
        if (crystal) lines.push('异能结晶 +' + crystal);

        /* 剧情 / 事件 / 羁绊的触发点 */
        const result = {
            ok: true, msg: lines.join('　') || '什么也没找到。',
            gains: added, crystal: crystal, wasted: wasted,
            encounter: null, battle: null, location: loc.name,
        };

        if (!opts.silent) {
            EventEngine.addLog(state, (opts.auto ? '🤖 ' : '🧺 ') + loc.name + '：' + result.msg);
        }

        if (!opts.auto) {
            /* 出门这一趟要花时间（末日前是按行动回合算的）：时间先走，然后才可能碰上事 */
            const timeCost = Actions.spend(state, loc.danger >= 0.4 ? 'scavengeFar' : 'scavenge');
            if (timeCost) result.timeCost = timeCost;
            BondEngine.tryMeet(state, loc);
            if (loc.story) StoryEngine.trigger(state, loc.story);
            if (loc.event && !state.flags['locev_' + loc.id] && Math.random() < 0.4) {
                state.flags['locev_' + loc.id] = true;
                EventEngine.trigger(state, loc.event);
            }
            if (Math.random() < encounterChance(state, loc)) {
                /* 遭遇会弹窗让玩家自己决定打还是跑（自动搜刮时不弹窗，直接结算） */
                const enc = EncounterEngine.start(state, loc, { interactive: !opts.auto });
                result.encounter = enc;
                if (enc && enc.kind === 'battle' && enc.result && enc.result.occupied) result.occupied = true;
            }
            /* 隐藏物资点：不是直接塞给你，而是弹窗告诉你藏在哪儿、怎么发现的 */
            if (!CacheEngine.waiting(state, loc.id) && !state.pending && Math.random() < CacheEngine.chance(state, loc)) {
                const c = CacheEngine.discover(state, loc);
                if (c) result.cacheFound = c.kind.name;
            }
        } else if (!CacheEngine.waiting(state, loc.id) && Math.random() < CacheEngine.chance(state, loc)) {
            /* 自动搜刮不弹窗：直接搬走，日志里提一句 */
            const r = CacheEngine.autoTake(state, loc);
            if (r && r.ok) result.cacheFound = '（自动搬走了藏起来的物资）';
        }
        AchievementEngine.check(state);
        return result;
    }

    /* 每小时：地点刷新 */
    function tick(state) {
        for (const loc of LOCATIONS_CONFIG) {
            const rec = state.locations[loc.id];
            if (!rec) continue;
            /* 占领到期：对方自己撤了 */
            if (rec.occupied && rec.occupied.until <= state.hours) release(state, loc.id, 'left');
            const max = maxUses(state, loc);
            if (rec.uses >= max && state.hours >= rec.at) {
                rec.uses = 0;
                if (rec.seen && !isDisabled(state, loc)) {
                    EventEngine.addLog(state, '🔄 ' + loc.name + '又有新的东西了。');
                }
            }
        }
    }

    function listStatus(state) {
        return LOCATIONS_CONFIG.map(l => status(state, l.id));
    }

    /* 自动搜刮：优先空投到「能搜且产出高」的地点 */
    function autoStep(state, hours) {
        const e = EffectsManager.get(state);
        if (!e.autoScavenge) return 0;
        if (!state.settings.autoScavenge) return 0;
        const interval = 5 / Math.max(0.2, e.autoScavenge);
        if (state.hours < (state.autoAt || 0)) return 0;
        state.autoAt = state.hours + interval;
        const pool = LOCATIONS_CONFIG.filter(l => {
            const st = status(state, l.id);
            return st.ok && !isDisabled(state, l);
        });
        if (!pool.length) return 0;
        const best = pool.reduce((a, b) => {
            const va = a.loot.reduce((s, x) => s + x.w, 0) / a.refresh;
            const vb = b.loot.reduce((s, x) => s + x.w, 0) / b.refresh;
            return va >= vb ? a : b;
        });
        scavenge(state, best.id, { auto: true, silent: false, mult: 0.85 });
        return 1;
    }

    window.ScavengeEngine = {
        locOf, status, listStatus, unlocked, lockReason, maxUses, refreshHours,
        yieldMult, scavenge, tick, autoStep, encounterChance, isDisabled,
        occupied, occupy, release, reclaim, holdHours,
    };
})();
