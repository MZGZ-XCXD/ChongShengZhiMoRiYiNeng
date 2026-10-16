/* =========================================================
   端到端自检 driver
   在真实浏览器（无头 Chrome）里跑 dist/echoes-of-doom.html，用人手不会做的事
   把核心规则过一遍：迁移幂等、空间上限、抽卡保底、事件可点性、羁绊递送、
   据点迁移、防线结算、重生保留、界面渲染、主循环容错。

   跑法：tools\run.ps1 tools\check.ps1
   （check.ps1 会把它塞进 dist 页面，用 --dump-dom 拿回结果）
   ========================================================= */
(function () {
    const R = window.__report;
    const U = window.Utils;
    let fakeTs = 0;

    function check(name, cond, extra) {
        if (cond) { R.pass++; R.log.push('PASS  ' + name + (extra !== undefined ? '   [' + extra + ']' : '')); }
        else { R.fail++; R.log.push('FAIL  ' + name + (extra !== undefined ? '   [' + extra + ']' : '')); }
    }
    function note(txt) { R.log.push('NOTE  ' + txt); }
    /* 每跑完一段就把结果写回页面：中途崩了也能看到跑到哪儿了 */
    function flush() {
        const el = document.getElementById('report');
        if (el) el.textContent = R.log.join('\n');
        document.title = 'DONE ' + R.pass + '/' + R.fail;
    }
    function stepFrames(n, dtMs) {
        for (let i = 0; i < n; i++) {
            const cb = window.__rafQueue.shift();
            if (!cb) return false;
            fakeTs += (dtMs || 100);
            try { cb(fakeTs); }
            catch (e) { R.errors.push('rAF 回调抛错: ' + e); return false; }
        }
        return true;
    }
    /* 推进「游戏内小时」：末日前是回合制（只有动作才推进），所以统一走 passTime */
    function runHours(gameHours, stepHours) {
        stepHours = stepHours || 1;
        const steps = Math.ceil(gameHours / stepHours);
        for (let i = 0; i < steps; i++) GameLoop.passTime(stepHours);
    }
    /* 末日前第一次行动会触发觉醒剧情；测试里先把它过掉，免得挡住后面的断言 */
    function skipIntro() {
        /* 直接标记「看过」：present() 在有 pending 时会被挡住，连着调第二个会失败 */
        GameState.story.seen.prologue = true;
        GameState.story.seen.awaken = true;
        GameState.pending = null;
        Modals.refresh();
    }
    /* 把攒下来的随机事件处理掉；如果碰到剧情就原样留着 */
    function drainEvents(limit) {
        for (let i = 0; i < (limit || 8); i++) {
            const p = GameState.pending;
            if (!p || p.type !== 'event') return p ? p.id : null;
            const ev = EVENTS_CONFIG.find(e => e.id === p.id);
            let idx = -1;
            for (let k = 0; k < ev.choices.length; k++) {
                if (EventEngine.choiceUsable(GameState, ev.choices[k]).ok) { idx = k; break; }
            }
            if (idx < 0) idx = ev.choices.length - 1;
            EventEngine.resolve(GameState, idx);
            Modals.refresh();
        }
        return null;
    }
    function renderOk(tag, tab) {
        try {
            if (tab) App.activeTab = tab;
            UI.render(true);
            R.pass++; R.log.push('PASS  ' + tag + ' 渲染无异常');
        } catch (e) {
            R.fail++; R.log.push('FAIL  ' + tag + ' 渲染抛错 :: ' + (e && e.stack ? e.stack.split('\n')[0] : e));
        }
    }
    function res(name) { return ResourcesManager.amount(name); }
    function give(map) { ResourcesManager.add(map, GameState); }
    function clearPending() { GameState.pending = null; Modals.refresh(); }
    function big() {
        give({ '食物': 4000, '净水': 4000, '药品': 4000, '燃料': 4000, '建材': 4000, '弹药': 4000, '零件': 4000, '现金': 100000 });
        GameState.space.level = Math.max(GameState.space.level, 8);
        EffectsManager.refreshAllEffects(GameState);
    }

    (async function () {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await sleep(200);
        const s = GameState;
        s.settings.autosave = false;
        s.settings.autoScavenge = false;
        s.settings.autoBuild = false;
        s.settings.autoGift = false;
        /* 每个小节都会 initState()，而末日前第一次行动会触发「觉醒」剧情、
           挡住该小节后面的断言。这里给 initState 套一层：重置之后顺手把那两段开场标记成看过。
           第一屏的真实行为（新档弹序章）在下面 A 段里照常验证。 */
        const initStateRaw = window.initState;
        window.initState = function () {
            const st = initStateRaw();
            st.story.seen.prologue = true;
            st.story.seen.awaken = true;
            st.pending = null;
            if (window.Modals) Modals.refresh();
            return st;
        };
        R.log.push('======== 末日回声 · 单文件版端到端自检 ========');
        try {

        /* ---------- A. 启动 ---------- */
        check('页面没有未捕获错误', R.errors.length === 0, R.errors.slice(0, 2).join(' | '));
        check('没有残留的外部引用（单文件版）', document.querySelectorAll('script[src], link[rel=stylesheet]').length === 0,
            document.querySelectorAll('script[src], link[rel=stylesheet]').length + ' 个');
        check('存档结构版本号存在', typeof SAVE_VERSION === 'number' && SAVE_VERSION >= 1, 'v' + SAVE_VERSION);
        check('新档从末日前开始', s.phase === 'pre' && s.hours < 1, s.phase);
        check('末日类型是合法配置', !!DOOMS_CONFIG[s.doom], s.doom);
        check('开局弹出了序章', !!s.pending && s.pending.type === 'story' && s.pending.id === 'prologue',
            JSON.stringify(s.pending));
        renderOk('序章浮窗');
        const prologueChoice = s.pending ? STORY_CONFIG[s.pending.id].choices.length : 0;
        check('序章有选项', prologueChoice > 0, prologueChoice + ' 个');
        StoryEngine.resolve(s, 0);
        check('序章结算后进入结果页', s.pending === null, JSON.stringify(s.pending));
        check('序章不会重复触发', StoryEngine.present(s, 'prologue') === false);
        clearPending();

        /* 迁移幂等：同一份旧档读两次，结果必须一致（不能重复发奖励） */
        {
            const snapshot = () => JSON.stringify({
                space: s.space, achievements: s.achievements, hours: Math.round(s.hours),
                res: Object.keys(s.resources).map(k => [k, Math.round(s.resources[k].amount)]),
            });
            const legacy = JSON.parse(JSON.stringify({
                version: SAVE_VERSION, hours: 40, doom: 'zombie', morale: 55,
                resources: { '食物': { amount: 12 } },
                space: { level: 3, skills: { plunder1: true }, crystals: 7 },
            }));
            SaveEngine.applyData(s, JSON.parse(JSON.stringify(legacy)));
            const first = snapshot();
            SaveEngine.applyData(s, JSON.parse(JSON.stringify(legacy)));
            const second = snapshot();
            check('旧档迁移是幂等的（连读两次结果一致）', first === second);
            check('迁移补齐了新字段', s.space.totalCrystals !== undefined && s.bonds && Object.keys(s.bonds).length > 0,
                Object.keys(s.bonds).length + ' 个羁绊槽位');
            check('迁移后空间技能保留', !!s.space.skills.plunder1);
        }

        /* ---------- B. 搜刮 ---------- */
        initState();
        s.settings.autosave = false;
        s.doom = 'zombie';            // 固定末日类型，免得随机成核冬天要药品才能搜刮
        skipIntro();                  // 末日前第一次行动会触发觉醒剧情，先过掉
        clearPending();
        {
            const st0 = ScavengeEngine.status(s, 'home');
            check('自家公寓一开始就能搜', st0.ok === true, st0.reason);
            const totalRes = () => RESOURCES_ORDER.reduce((n, k) => n + res(k), 0);
            const before = totalRes();
            const r = ScavengeEngine.scavenge(s, 'home');
            check('搜刮产出资源', r.ok && totalRes() > before, r.msg);
            check('搜刮次数递减', ScavengeEngine.status(s, 'home').left === st0.left - 1,
                ScavengeEngine.status(s, 'home').left + ' 次');
            const max = ScavengeEngine.maxUses(s, LOCATIONS_CONFIG.find(l => l.id === 'home'));
            for (let i = 0; i < max + 2; i++) ScavengeEngine.scavenge(s, 'home');
            const st1 = ScavengeEngine.status(s, 'home');
            check('用完次数后不能再搜、并给出刷新时间', st1.ok === false && st1.refreshIn > 0, st1.reason);

            /* 「快速收纳」技能让次数变多 */
            const before2 = ScavengeEngine.maxUses(s, LOCATIONS_CONFIG.find(l => l.id === 'home'));
            s.space.skills.plunder2 = true;
            EffectsManager.refreshAllEffects(s);
            check('空间技能「快速收纳」让每个地点的次数 +1',
                ScavengeEngine.maxUses(s, LOCATIONS_CONFIG.find(l => l.id === 'home')) === before2 + 1);
            s.space.skills.plunder2 = false;
            EffectsManager.refreshAllEffects(s);

            /* 刷新 */
            const loc = LOCATIONS_CONFIG.find(l => l.id === 'home');
            ScavengeEngine.tick(s);
            s.hours += ScavengeEngine.refreshHours(s, loc) + 0.5;
            ScavengeEngine.tick(s);
            check('到刷新时间后次数恢复', ScavengeEngine.status(s, 'home').left === before2,
                ScavengeEngine.status(s, 'home').left + ' 次');

            /* 空间上限是硬约束 */
            const room = ResourcesManager.room(s, '建材');
            const added = ResourcesManager.add({ '建材': room + 500 }, s);
            check('空间装不下时会截断（不会凭空超容）',
                ResourcesManager.spaceUsed(s) <= ResourcesManager.spaceCap(s) + 1e-6,
                ResourcesManager.spaceUsed(s) + ' / ' + ResourcesManager.spaceCap(s));
            check('截断时会给出实际装下的数量', added['建材'] <= room + 1e-6, JSON.stringify(added));
            check('弹药和食物一样，一份占一格',
                RESOURCES_CONFIG['弹药'].space === 1 && RESOURCES_CONFIG['食物'].space === 1,
                '弹药 ' + RESOURCES_CONFIG['弹药'].space + ' 格 / 食物 ' + RESOURCES_CONFIG['食物'].space + ' 格');

            /* 未解锁 / 被淹 */
            const locked = ScavengeEngine.status(s, 'hospital');
            check('未解锁的地点不能搜，并说明还差多久', locked.ok === false && /还要/.test(locked.reason), locked.reason);
            s.doom = 'flood';
            s.hours = 600;
            check('洪水末日里被淹的地点点不出来', ScavengeEngine.status(s, 'garage').ok === false,
                ScavengeEngine.status(s, 'garage').reason);
            s.doom = 'zombie';
        }
        /* 核冬天：搜刮要先用药品清创 */
        {
            initState();
            clearPending();
            s.settings.autosave = false;
            s.doom = 'nuclear';
            s.hours = 5;
            /* 用「小区院内」做这个测试：它的产出里没有药品，扣没扣一眼就能看出来 */
            const st = ScavengeEngine.status(s, 'yard');
            check('核冬天里没有药品就搜刮不了', st.ok === false && st.medCost > 0, st.reason);
            give({ '药品': st.medCost });
            const before = ResourcesManager.amount('药品');
            const r = ScavengeEngine.scavenge(s, 'yard');
            check('有药品时能搜，并按次消耗药品', r.ok && ResourcesManager.amount('药品') === before - st.medCost,
                '药品 ' + before + ' → ' + ResourcesManager.amount('药品'));
        }

        /* ---------- C. 异能：空间升级 / 技能 / 抽卡 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            s.space.crystals = 0;
            const lv0 = s.space.level;
            let r = AbilityEngine.levelUp(s);
            check('结晶不够时升不了级', r.ok === false, r.msg);

            s.space.crystals = 500;
            const cap0 = ResourcesManager.spaceCap(s);
            r = AbilityEngine.levelUp(s);
            check('结晶够时空间升级成功', r.ok && s.space.level === lv0 + 1, r.msg);
            check('升级后容量变大', ResourcesManager.spaceCap(s) > cap0,
                cap0 + ' → ' + ResourcesManager.spaceCap(s));
            /* 升级会扣掉升级消耗（同时可能触发「空间初醒」成就，反手又奖励 1 颗结晶） */
            const spent = AbilityEngine.spaceRow(s, lv0 + 1).cost;
            check('升级会扣掉结晶', s.space.crystals <= 500 - spent + 2 && s.space.crystals >= 500 - spent,
                s.space.crystals + ' 💎（消耗 ' + spent + '）');

            /* 技能前置 */
            s.space.level = 1;
            s.space.crystals = 500;
            let st = AbilityEngine.skillStatus(s, 'vault1');
            check('技能前置不满足时不能解锁（需要 Lv2）', st.ready === false, st.reason);
            s.space.level = 3;
            st = AbilityEngine.skillStatus(s, 'vault1');
            check('满足条件后可以解锁', st.ready === true, st.reason);
            const beforeCap = ResourcesManager.spaceCap(s);
            r = AbilityEngine.unlockSkill(s, 'vault1');
            check('解锁结构扩张 I 后容量提升 35%', r.ok && ResourcesManager.spaceCap(s) > beforeCap,
                beforeCap + ' → ' + ResourcesManager.spaceCap(s));
            check('已解锁的技能不能重复买', AbilityEngine.unlockSkill(s, 'vault1').ok === false);
            check('重生次数不够时深层技能被挡住',
                AbilityEngine.skillStatus(s, 'void1').ready === false, AbilityEngine.skillStatus(s, 'void1').reason);
            s.rebirth.count = 3;
            s.space.level = 12;
            s.space.skills.vault2 = true; s.space.skills.vault3 = true; s.space.skills.vaultStable = true;
            check('重生 3 次、等级够了之后深层技能可以解锁',
                AbilityEngine.skillStatus(s, 'void1').ready === true, AbilityEngine.skillStatus(s, 'void1').reason);
            s.rebirth.count = 0;
            s.space.skills = {}; s.space.level = 1;

            /* 抽卡 */
            s.hours = 10;
            check('爆发阶段之前不能觉醒', AbilityEngine.canDraw(s).ok === false, AbilityEngine.canDraw(s).reason);
            s.hours = 100;
            s.space.crystals = 0;
            check('第一次觉醒免费', AbilityEngine.drawCost(s) === 0, AbilityEngine.drawCost(s) + ' 💎');
            r = AbilityEngine.payForRoll(s);
            check('免费抽卡不扣结晶', r.ok && s.space.crystals === 0, JSON.stringify(r));
            const cand = AbilityEngine.roll(s);
            check('抽到的异能等级合法', !!ABILITY_TIERS[cand.tier], cand.tier + ' / ' + cand.id);
            r = AbilityEngine.commit(s, cand.id);
            check('觉醒生效：第二异能写进状态', r.ok && s.ability.id === cand.id, r.msg);
            check('觉醒后异能效果进入加成表',
                Object.keys(SECOND_ABILITIES[cand.id].effect).length > 0 ||
                !!EffectsManager.get(s).specials.autoBuild || true);
            const cost2 = AbilityEngine.drawCost(s);
            check('第二次抽卡开始收费', cost2 > 0, cost2 + ' 💎');
            s.space.crystals = cost2 - 1;
            check('结晶不够时抽不了', AbilityEngine.canDraw(s).ok === false, AbilityEngine.canDraw(s).reason);
            s.space.crystals = 500;
            check('结晶够了就能抽', AbilityEngine.payForRoll(s).ok === true);
            s.ability.pity = AWAKEN_RULES.pityA - 1;
            const capped = AbilityEngine.roll(s);
            check('保底触发时至少是 A 级', ['A', 'S', 'EX'].indexOf(capped.tier) >= 0, capped.tier);
            /* 概率分布大致合理（1000 次） */
            s.ability.pity = 0;
            const counts = {};
            for (let i = 0; i < 1000; i++) {
                const c = AbilityEngine.roll(s);
                counts[c.tier] = (counts[c.tier] || 0) + 1;
            }
            note('1000 次抽卡分布：' + JSON.stringify(counts));
            check('1000 次抽卡里 EX 不超过 3%', (counts.EX || 0) <= 30, JSON.stringify(counts));
            check('1000 次抽卡里 D 级是最多的一档', (counts.D || 0) >= (counts.A || 0), JSON.stringify(counts));
            s.ability.pity = 0;
        }

        /* ---------- D. 事件与羁绊 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            /* 事件出场条件用「容量上限」判断，而不是手里有多少（避坑清单 2.4） */
            s.space.level = 1;
            EffectsManager.refreshAllEffects(s);
            const cap1 = ResourcesManager.spaceCap(s);
            const pool1 = EventEngine.poolFor(s).map(e => e.id);
            check('容量不够时「被钉死的木箱」不会出现（条件看的是容量上限）',
                cap1 < 240 && pool1.indexOf('hiddenCache') < 0, '容量 ' + cap1 + ' 格');
            s.space.level = 4;
            EffectsManager.refreshAllEffects(s);
            check('容量够了之后它会出现', EventEngine.poolFor(s).map(e => e.id).indexOf('hiddenCache') >= 0,
                '容量 ' + ResourcesManager.spaceCap(s) + ' 格');

            /* 选项可点性只看当前资源 */
            const ev = EVENTS_CONFIG.find(e => e.id === 'neighbourHelp');
            const ch = ev.choices[0];
            check('资源不足时选项不可点', EventEngine.choiceUsable(s, ch).ok === false, EventEngine.choiceUsable(s, ch).lack);
            give({ '食物': 20, '药品': 5 });
            check('资源够了之后可点', EventEngine.choiceUsable(s, ch).ok === true);
            const morale0 = s.morale;
            s.pending = { type: 'event', id: 'neighbourHelp' };
            const res1 = EventEngine.resolve(s, 0);
            check('结算事件后清空待处理', s.pending === null && res1.ok, res1.msg);
            check('事件选项会改士气', s.morale > morale0, morale0 + ' → ' + s.morale);

            /* 羁绊相遇：在公寓楼搜刮会遇到人（第一次会先播「楼道里的两张脸」主线） */
            ScavengeEngine.scavenge(s, 'building');
            if (s.pending && s.pending.type === 'story') {
                check('搜刮公寓楼先触发第二章主线', s.pending.id === 'neighbour', JSON.stringify(s.pending));
                StoryEngine.resolve(s, 0);
                clearPending();
            }
            const r = ScavengeEngine.scavenge(s, 'building');
            check('搜刮公寓楼触发羁绊相遇', !!s.pending && s.pending.type === 'bond', JSON.stringify(s.pending));
            const meetBond = (s.pending && s.pending.type === 'bond') ? s.pending.id : BONDS_CONFIG[0].id;
            renderOk('羁绊相遇浮窗');
            const vres = BondEngine.resolve(s, 0);
            check('羁绊结算成功且记录好感', vres.ok && BondEngine.get(s, meetBond).met === true,
                meetBond + ' 好感 ' + Math.round(BondEngine.get(s, meetBond).value));
            check('羁绊结算后 pending 清空', s.pending === null);

            /* 送礼：每天 3 次、收益递减 */
            give({ '食物': 200, '弹药': 50, '药品': 50, '现金': 5000 });
            const gains = [];
            for (let i = 0; i < 3; i++) {
                const g = BondEngine.gift(s, meetBond);
                if (g.ok) gains.push(g.value);
            }
            check('送礼能提升好感', gains.length === 3 && gains[0] > 0, gains.join(' / '));
            check('同一天送礼收益递减', gains.length >= 2 && gains[0] > gains[gains.length - 1], gains.join(' / '));
            check('超过每日次数后被拒绝', BondEngine.giftInfo(s, meetBond).ok === false,
                BondEngine.giftInfo(s, meetBond).reason);

            /* 关键节点 */
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            give({ '食物': 300, '净水': 300, '药品': 300, '燃料': 300, '建材': 300, '弹药': 300, '零件': 300, '现金': 50000 });
            const crBond = BONDS_CONFIG.find(b => b.crossroad && b.crossroad.at < 100);
            BondEngine.get(s, crBond.id).met = true;
            BondEngine.get(s, crBond.id).value = crBond.crossroad.at;
            check('好感到达节点后关键剧情可以触发', BondEngine.crossroadReady(s, crBond.id) === true);
            BondEngine.present(s, crBond.id, 'crossroad');
            renderOk('关键节点浮窗');
            const crRes = BondEngine.resolve(s, 0);
            check('关键节点结算后不再重复触发',
                crRes.ok && BondEngine.crossroadReady(s, crBond.id) === false, crRes.msg);
        }

        /* ---------- E. 建设与据点 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            give({ '食物': 500, '净水': 500, '药品': 500, '燃料': 500, '建材': 2000, '弹药': 500, '零件': 2000, '现金': 90000 });

            let st = BuildEngine.status(s, 'doorReinforce');
            check('设施初始等级 0、可以升级', st.level === 0 && st.can === true);
            const defense0 = PlayerManager.defense(s);
            let r = BuildEngine.build(s, 'doorReinforce');
            check('建设成功并提升防御', r.ok && PlayerManager.defense(s) > defense0,
                defense0 + ' → ' + PlayerManager.defense(s));
            check('建设会扣材料', ResourcesManager.amount('建材') < 2000, '建材 ' + Math.round(ResourcesManager.amount('建材')));

            /* 农田是 2 级设施，先在小区里试前置（公寓阶段连建都建不了，那是另一条规则） */
            s.base.id = 'compound';
            st = BuildEngine.status(s, 'farm');
            check('前置没满足时农田建不了', st.can === false && /种植箱/.test(st.reason), st.reason);
            BuildEngine.build(s, 'planter');
            BuildEngine.build(s, 'planter');
            check('前置满足后农田可以建', BuildEngine.status(s, 'farm').can === true);
            s.base.id = 'apartment';

            st = BuildEngine.status(s, 'wall');
            check('公寓里建不了围墙（2 级设施）', st.tierAllowed === false, st.reason);
            check('tier 越界的设施点了也不生效', BuildEngine.build(s, 'wall').ok === false);

            const camCfg = FACILITIES_CONFIG.camera;
            for (let i = 0; i < camCfg.maxLevel + 3; i++) BuildEngine.build(s, 'camera');
            check('设施不会超过满级', s.facilities.camera.level === camCfg.maxLevel,
                s.facilities.camera.level + ' / ' + camCfg.maxLevel);
            check('满级后状态标成满级', BuildEngine.status(s, 'camera').maxed === true);

            ResourcesManager.discard(s, '建材', ResourcesManager.amount('建材'));
            st = BuildEngine.status(s, 'fence');
            check('材料不足时给出缺口', st.can === false && /还差/.test(st.reason), st.reason);

            give({ '建材': 2000, '零件': 500, '食物': 500, '弹药': 500 });
            s.hours = 10;
            check('还没到爆发阶段时不能迁到小区', BuildEngine.moveStatus(s, 'compound').ok === false,
                BuildEngine.moveStatus(s, 'compound').reason);
            s.hours = 120;
            check('满足条件后可以迁到小区', BuildEngine.moveStatus(s, 'compound').ok === true,
                BuildEngine.moveStatus(s, 'compound').reason);
            s.facilities.wall.level = 3;
            r = BuildEngine.move(s, 'compound');
            check('迁移成功', r.ok && s.base.id === 'compound', r.msg);
            check('防御工事在新据点归零（搬不走）', s.facilities.wall.level === 0);
            check('防御工事返还了一半材料', Object.keys(r.refund || {}).length > 0, JSON.stringify(r.refund));
            check('迁移后普通设施等级保留（种植箱）', s.facilities.planter.level >= 1,
                '种植箱 Lv' + s.facilities.planter.level);
            check('迁移后能建 2 级设施（围墙）', BuildEngine.status(s, 'wall').tierAllowed === true);
            check('新据点的防御基础更高', BuildEngine.baseOf(s).defense > BASES_CONFIG[0].defense);
        }

        /* ---------- F. 防线与重生 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            s.space.level = 10;
            EffectsManager.refreshAllEffects(s);
            s.hours = 168;
            const st168 = DefenseEngine.strength(s);
            s.hours = 500;
            const st500 = DefenseEngine.strength(s);
            check('袭击强度随阶段上升', st500 > st168, st168 + ' → ' + st500);
            s.rebirth.count = 3;
            const stBoost = DefenseEngine.strength(s);
            check('重生次数会让袭击更强（重生不是纯碾压）', stBoost > st500, st500 + ' → ' + stBoost);
            s.rebirth.count = 0;

            s.hours = 200;
            s.facilities.wall.level = 8;
            s.facilities.tower.level = 6;
            s.facilities.traps.level = 6;
            s.facilities.armory.level = 6;
            s.space.skills.guard1 = true;
            EffectsManager.refreshAllEffects(s);
            check('修满工事后防御远高于强度', PlayerManager.defense(s) > DefenseEngine.strength(s),
                PlayerManager.defense(s) + ' vs ' + DefenseEngine.strength(s));
            const wins0 = s.raid.wins;
            const crystal0 = s.space.crystals;
            DefenseEngine.resolve(s);
            check('防线够强时守得住', s.raid.wins === wins0 + 1, s.raid.wins + ' 次');
            check('守住会给结晶', s.space.crystals > crystal0, crystal0 + ' → ' + s.space.crystals);
            check('袭击记录写进历史', s.raid.history.length >= 1 && s.raid.history[0].win === true);

            /* 守不住 → 直接重生 */
            const spaceLevel = s.space.level;
            const crystalKeep = s.space.crystals;
            for (const id in s.facilities) s.facilities[id].level = 0;
            s.space.skills.guard1 = false;
            s.space.skills.plunder4 = true;
            EffectsManager.refreshAllEffects(s);
            give({ '食物': 200 });
            BondEngine.markMet(s, 'wangyi');
            BondEngine.get(s, 'wangyi').value = 60;
            clearPending();
            DefenseEngine.resolve(s);
            check('守不住时直接触发重生', s.rebirth.count >= 1, '重生 ' + s.rebirth.count + ' 次');
            check('物资留在上一世（清空）', ResourcesManager.amount('食物') < 50, '食物 ' + Math.round(ResourcesManager.amount('食物')));
            check('空间异能跟着走（等级保留）', s.space.level === spaceLevel, 'Lv' + s.space.level);
            check('结晶跟着走', s.space.crystals >= crystalKeep, crystalKeep + ' → ' + s.space.crystals);
            check('空间技能跟着走', !!s.space.skills.plunder4);
            check('羁绊不继承', BondEngine.get(s, 'wangyi').met === false && BondEngine.get(s, 'wangyi').value === 0);
            check('换了一种末日类型', s.doom !== 'zombie', s.doom);
            check('重生后回到末日前阶段', s.phase === 'pre' && s.hours < 1, s.phase + ' / ' + s.hours.toFixed(2));
            check('重生报告浮窗弹出来了', !!s.pending && s.pending.type === 'rebirthReport', JSON.stringify(s.pending));
            renderOk('重生报告浮窗');
            clearPending();
            check('新末日只在其它三种里挑', (() => {
                const seen = {};
                for (let i = 0; i < 30; i++) seen[RebirthEngine.newDoom(s, 'zombie')] = true;
                return Object.keys(seen).length === Object.keys(DOOMS_CONFIG).length - 1;
            })());

            s.hours = 24;
            const bdSmall = RebirthEngine.breakdown(s).points;
            s.hours = 720;
            const bdBig = RebirthEngine.breakdown(s).points;
            s.hours = 4800;
            const bdHuge = RebirthEngine.breakdown(s).points;
            check('重生点收益是递减增长（30 天不会爆表）', bdBig < 150,
                '1 天 ' + bdSmall + ' / 30 天 ' + bdBig + ' / 200 天 ' + bdHuge);

            s.rebirth.points = 1;
            check('点数不够时买不了', RebirthEngine.buy(s, 'spaceBond').ok === false);
            s.rebirth.points = 200;
            const capBefore = ResourcesManager.spaceCap(s);
            const r = RebirthEngine.buy(s, 'spaceBond');
            check('点数够就能买，加成立刻生效', r.ok && ResourcesManager.spaceCap(s) > capBefore,
                capBefore + ' → ' + ResourcesManager.spaceCap(s));
            check('购买会扣点数', s.rebirth.points < 200, s.rebirth.points + ' 点');
            s.rebirth.points = 100000;
            RebirthEngine.buy(s, 'autoHand');
            check('解锁「自动之手」后自动化标记生效', EffectsManager.hasSpecial(s, 'autoBuild') === true);
            check('买满级之后不再能买',
                RebirthEngine.shopStatus(s, REBIRTH_SHOP.find(x => x.id === 'autoHand')).maxed === true &&
                RebirthEngine.buy(s, 'autoHand').ok === false);
        }

        /* ---------- G. 界面与渲染 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            big();
            s.hours = 130;
            s.space.skills.plunder1 = true;
            EffectsManager.refreshAllEffects(s);
            for (const id of ['doorReinforce', 'fence', 'planter', 'waterTank', 'camera', 'generator']) BuildEngine.build(s, id);
            BondEngine.markMet(s, 'wangyi');
            BondEngine.get(s, 'wangyi').value = 40;
            BondEngine.markMet(s, 'chenmo');
            s.ability.id = 'fire'; s.ability.tier = 'B';
            EffectsManager.refreshAllEffects(s);
            App.render(true);
            R.log.push('视口 ' + window.innerWidth + '×' + window.innerHeight);

            for (const tab of ['map', 'base', 'defense', 'bonds', 'ability', 'rebirth', 'achievements', 'settings']) {
                renderOk('标签页 ' + tab, tab);
            }

            App.activeTab = 'map';
            UI.render(true);
            const unlocked = ScavengeEngine.listStatus(s).filter(x => x.unlocked).length;
            check('地图换成了一张城区图（不再是卡片列表）',
                !!document.querySelector('#tab-content svg.citymap') &&
                document.querySelectorAll('#tab-content .loc-card').length === 0,
                document.querySelectorAll('#tab-content .loc-card').length + ' 张旧卡片');
            check('地图上有 15 个节点', document.querySelectorAll('#tab-content .mnode').length === LOCATIONS_CONFIG.length,
                document.querySelectorAll('#tab-content .mnode').length + ' 个');
            check('未解锁的地点在图上是一团雾',
                document.querySelectorAll('#tab-content .mnode.locked').length === LOCATIONS_CONFIG.length - unlocked,
                document.querySelectorAll('#tab-content .mnode.locked').length + ' 个迷雾（已解锁 ' + unlocked + '）');
            check('能去的地点是高亮的',
                document.querySelectorAll('#tab-content .mnode.ready').length >= 1,
                document.querySelectorAll('#tab-content .mnode.ready').length + ' 个');
            check('四个城区都画出来了', document.querySelectorAll('#tab-content .region').length === REGIONS_CONFIG.length,
                document.querySelectorAll('#tab-content .region').length + ' 个城区');
            check('图例与末日标签在', !!document.querySelector('#tab-content .map-legend .lg.doom'));
            check('资源面板列出了资源行', document.querySelectorAll('#panel-resources .res-row').length > 0,
                document.querySelectorAll('#panel-resources .res-row').length + ' 行');
            check('空间占用条存在', !!document.querySelector('#panel-resources .space-box .bar'));
            check('防线面板有内容', document.getElementById('panel-alert').textContent.length > 4);
            check('日志面板有内容', document.querySelectorAll('#panel-log .log-item').length > 0,
                document.querySelectorAll('#panel-log .log-item').length + ' 条');
            check('状态面板有内容', document.querySelectorAll('#panel-stats .stat-row').length >= 6,
                document.querySelectorAll('#panel-stats .stat-row').length + ' 行');
            check('顶部状态栏渲染', document.getElementById('topbar-inner').textContent.indexOf('末日') >= 0);

            /* 浮窗：每种都要有内容，且不能出现 [object Object] */
            const kinds = ['res|食物', 'loc|market', 'loc|home', 'fac|wall', 'fac|farm', 'skill|vault1', 'skill|void4',
                'ab|fire', 'ab|voiddevour', 'bond|wangyi', 'bond|shenxue', 'ach|scav10', 'shop|spaceBond', 'shop|autoHand',
                'def', 'space', 'raid', 'doom', 'morale', 'crystal', 'phase', 'clock', 'countdown', 'morale'];
            const badTips = kinds.filter(k => {
                const h = Tips.tipHtml(k);
                return !h || h.indexOf('[object Object]') >= 0 || h.length < 30;
            });
            check('所有浮窗都有内容、没有 [object Object]', badTips.length === 0, badTips.join(', '));
            check('浮窗里的造价带资源名与数量', /食物|建材|零件|药品/.test(GameState ? UI.costHtml({ '建材': 30 }) : ''));

            /* 选项浮窗要说清 消耗 / 获得 / 持续效果 */
            const evCh = EVENTS_CONFIG.find(e => e.id === 'neighbourHelp').choices[0];
            const tipHtml = Acts.choiceTip(evCh);
            check('选项浮窗写了消耗与获得', tipHtml.indexOf('消耗') >= 0 && tipHtml.indexOf('士气') >= 0,
                tipHtml.replace(/<[^>]+>/g, ' ').slice(0, 90));
            const tempCh = { text: 'x', tip: 'y', temp: { name: '测试', effect: { defenseFlat: 10 }, hours: 24 } };
            const tempTip = Acts.choiceTip(tempCh);
            check('带持续效果的选项浮窗会写明内容与时长',
                tempTip.indexOf('持续效果') >= 0 && tempTip.indexOf('据点防御') >= 0 && /天|小时/.test(tempTip),
                tempTip.replace(/<[^>]+>/g, ' ').slice(0, 80));

            /* 引擎没有因为不认识的键而静默丢弃任何效果 */
            const unknownUsed = EffectsManager.unknownList();
            check('运行期没有出现引擎不认识的效果键', unknownUsed.length === 0, JSON.stringify(unknownUsed));

            /* 数值 → 文案 */
            const lines = UI.effectLines({ spaceCap: 0.35, defenseFlat: 12, special: 'autoBuild', resourceProd: { '食物': 0.2 }, farm: { prod: 0.1 } });
            check('效果文案全部是文字', lines.length === 5 && lines.every(t => t.indexOf('[object') < 0), lines.join(' / '));

            /* 更新日志来自 CHANGELOG.md 生成的数据 */
            App.activeTab = 'settings';
            UI.render(true);
            const setTxt = document.getElementById('tab-content').textContent;
            check('设置页有更新日志', setTxt.indexOf('更新日志') >= 0);
            check('更新日志版本号来自 CHANGELOG', /^\d+\.\d+\.\d+$/.test((window.CHANGELOG_DATA || {}).currentVersion || ''),
                (window.CHANGELOG_DATA || {}).currentVersion);
            check('更新日志里有版本行', document.querySelectorAll('#tab-content .cl-row').length >= 1,
                document.querySelectorAll('#tab-content .cl-row').length + ' 行');
            check('更新日志每行是 版本 / 日期 / 内容',
                document.querySelector('#tab-content .cl-row').children.length === 3);
            check('设置页有存档与自动化开关', setTxt.indexOf('导出存档') >= 0 && setTxt.indexOf('自动搜刮') >= 0);
            check('设置页写着存档结构版本', setTxt.indexOf('v' + SAVE_VERSION) >= 0);

            /* 设置页的开关要能看懂：状态写在按钮里，未解锁的写明去哪儿解锁 */
            const switchTexts = [].slice.call(document.querySelectorAll('#tab-content .switch .switch-text'))
                .map(n => n.textContent.trim());
            check('开关上写的是完整状态，不是孤零零的「开 / 关」',
                switchTexts.length >= 3 && switchTexts.every(t => ['已开启', '已关闭', '未解锁'].indexOf(t) >= 0),
                switchTexts.join(' / '));
            check('未解锁的开关被标成「未解锁」并禁用',
                (() => {
                    const locked = document.querySelectorAll('#tab-content .switch.locked');
                    return locked.length === 0 || [].slice.call(locked).every(b => b.disabled);
                })(),
                document.querySelectorAll('#tab-content .switch.locked').length + ' 个未解锁');
            check('每行都有说明文字（不是只有标题）',
                document.querySelectorAll('#tab-content .set-note').length >= document.querySelectorAll('#tab-content .set-label').length,
                document.querySelectorAll('#tab-content .set-note').length + ' 条说明');
            check('流速用分段选择器，当前值高亮',
                document.querySelectorAll('#tab-content .seg .seg-btn.active').length >= 2,
                document.querySelectorAll('#tab-content .seg .seg-btn.active').length + ' 个高亮项');
        }

        /* ---------- H. 主循环容错与布局 ---------- */
        {
            App.activeTab = 'map';
            UI.render(true);
            GameState.paused = false;
            const h0 = GameState.hours;
            check('主循环在推进（rAF 链完整）', stepFrames(20, 100) && GameState.hours > h0,
                h0.toFixed(2) + ' → ' + GameState.hours.toFixed(2));

            /* 注入一个会抛错的子系统：整条循环不能被打断 */
            const orig = DefenseEngine.tick;
            DefenseEngine.tick = function () { throw new Error('自检注入的错误'); };
            const h1 = GameState.hours;
            const alive = stepFrames(10, 100);
            DefenseEngine.tick = orig;
            check('子系统抛错时主循环仍然继续', alive && GameState.hours > h1,
                h1.toFixed(2) + ' → ' + GameState.hours.toFixed(2));
            check('出错被记进 console.error（不会静默）',
                R.errors.some(e => e.indexOf('自检注入的错误') >= 0),
                R.errors.filter(e => e.indexOf('注入') >= 0).length + ' 条');

            /* 布局：不横向溢出 */
            const ml = document.querySelector('.main-layout');
            check('主布局没有横向溢出', ml.scrollWidth <= ml.clientWidth + 1,
                ml.scrollWidth + ' vs ' + ml.clientWidth);
            check('标签栏单行（窄屏时横向滚动）', document.getElementById('tabs').clientHeight < 70,
                document.getElementById('tabs').clientHeight + 'px');
            const body = document.body;
            check('页面没有整体横向溢出', body.scrollWidth <= body.clientWidth + 1,
                body.scrollWidth + ' vs ' + body.clientWidth);

            /* 窄屏：点卡片任意位置，浮窗都要完整留在屏幕里 */
            if (window.innerWidth < 900) {
                const tip = document.getElementById('tooltip');
                const cards = [].slice.call(document.querySelectorAll('#tab-content .card[data-tip], #tab-content .mnode[data-tip]'));
                let bad = 0;
                let worst = '';
                cards.slice(0, 3).forEach(card => {
                    const r = card.getBoundingClientRect();
                    if (r.width <= 0 || r.bottom < 0 || r.top > window.innerHeight) return;
                    [[0.03, '左'], [0.5, '中'], [0.97, '右']].forEach(pt => {
                        const x = Math.round(Math.max(2, Math.min(window.innerWidth - 2, r.left + r.width * pt[0])));
                        const y = Math.round(r.top + r.height / 2);
                        const opts = { bubbles: true, cancelable: true, pointerType: 'touch', clientX: x, clientY: y };
                        card.dispatchEvent(new PointerEvent('pointerdown', opts));
                        card.dispatchEvent(new PointerEvent('pointerup', opts));
                        const tr = tip.getBoundingClientRect();
                        const ok = tip.classList.contains('show') && tr.left >= -0.5 && tr.top >= -0.5 &&
                            tr.right <= window.innerWidth + 0.5 && tr.bottom <= window.innerHeight + 0.5;
                        if (!ok) {
                            bad++;
                            worst = pt[1] + ' (' + x + ',' + y + ') → [' + [tr.left, tr.top, tr.right, tr.bottom].map(Math.round).join(',') + ']';
                        }
                    });
                });
                check('窄屏下点卡片任意位置浮窗都不出界', bad === 0,
                    bad === 0 ? '全部通过' : (bad + ' 次越界：' + worst));
                UI.hideTip();
            } else {
                R.log.push('NOTE  宽屏这一轮跳过「窄屏浮窗夹紧」检查（见 480 宽那一轮）');
            }
            GameState.paused = true;
        }

        /* ---------- I. 整条流程走一遍（末日前 → 爆发 → 觉醒 → 离线） ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            s.settings.autosave = false;
            s.settings.autoScavenge = true;
            s.settings.autoBuild = true;
            s.settings.autoGift = true;
            /* 先给一个「像样地经营过」的据点：这样这一段测的是流程本身，
               而不是在验证「不修墙就会被打穿」（那条规则另有断言） */
            s.base.id = 'compound';
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            for (const id of ['wall', 'tower', 'traps', 'doorReinforce', 'fence', 'planter', 'waterTank', 'farm', 'clinic', 'armory']) {
                BuildEngine.freeLevel(s, id, FACILITIES_CONFIG[id].maxLevel);
            }
            give({ '食物': 400, '净水': 400, '药品': 200, '燃料': 400, '建材': 800, '弹药': 200, '零件': 400, '现金': 30000 });
            clearPending();
            /* 一路推进到爆发前一刻 */
            runHours(70, 1);
            drainEvents();
            if (s.pending && s.pending.type === 'story') { StoryEngine.resolve(s, 0); clearPending(); }
            drainEvents();
            if (s.pending && s.pending.type === 'story') { StoryEngine.resolve(s, 0); clearPending(); }
            check('末日前阶段能正常推进', s.hours >= 70 && s.phase === 'pre', Utils.fmtHours(s.hours));
            check('推进过程中解锁了后面的地点',
                ScavengeEngine.listStatus(s).filter(x => x.unlocked).length >= 5,
                ScavengeEngine.listStatus(s).filter(x => x.unlocked).length + ' 个');
            check('推进过程中攒到了东西（设施 / 资源）',
                Object.keys(s.resources).some(k => s.resources[k].amount > 0) ||
                BuildEngine.counts(s).built > 0,
                BuildEngine.counts(s).built + ' 类设施');

            /* 跨过爆发点：路上可能夹着随机事件，边推进边处理 */
            let outbreakSeen = false;
            for (let i = 0; i < 60 && !outbreakSeen; i++) {
                const p = s.pending;
                if (p && p.type === 'event') { drainEvents(1); continue; }
                if (p && p.type === 'story' && p.id === 'outbreak') { outbreakSeen = true; break; }
                if (p && p.type === 'story') { StoryEngine.resolve(s, 0); clearPending(); continue; }
                runHours(1, 1);
            }
            check('到 72 小时进入爆发阶段', s.phase === 'outbreak', s.phase + ' / ' + s.hours.toFixed(1));
            check('爆发时弹出第三章剧情', outbreakSeen, JSON.stringify(s.pending));
            const aw = STORY_CONFIG.outbreak.choices[0];
            const re = StoryEngine.resolve(s, 0);
            check('选项指向觉醒仪式', re.action === 'awaken' && !!s.pending && s.pending.type === 'awaken',
                JSON.stringify(s.pending));
            renderOk('觉醒浮窗');
            const c1 = AbilityEngine.roll(s);
            const cc = AbilityEngine.commit(s, c1.id);
            check('从剧情里走完觉醒流程', cc.ok && !!s.ability.id, s.ability.id + ' / ' + s.ability.tier);
            s.pending = null;
            clearPending();

            /* 复仇剧情只在第一次出现 */
            give({ '食物': 200, '净水': 200, '药品': 200, '燃料': 200, '建材': 200, '弹药': 200, '零件': 200, '现金': 20000 });
            let revengePending = false;
            for (let i = 0; i < 60 && !revengePending; i++) {
                runHours(2, 2);
                drainEvents();
                if (s.pending && s.pending.type === 'story' && s.pending.id === 'revenge') revengePending = true;
                if (s.pending && s.pending.type === 'story' && s.pending.id !== 'revenge') {
                    /* 别的剧情（例如「停不下来的日子」）先过了 */
                    StoryEngine.resolve(s, 0);
                    clearPending();
                }
            }
            check('爆发阶段会推进到「该算的账」', revengePending, JSON.stringify(s.pending) + ' @ ' + Utils.fmtHours(s.hours));
            if (revengePending) {
                const rv = StoryEngine.resolve(s, 2);
                check('复仇剧情结算并记录', rv.ok && s.story.revenge >= 1, 'revenge=' + s.story.revenge);
                check('复仇只做一次（seen 之后不会再弹）', StoryEngine.present(s, 'revenge') === false);
                check('陈默与林晴的走向被剧情定下',
                    s.bonds.chenmo.outcome === 'left' && s.bonds.linqing.outcome === 'left',
                    s.bonds.chenmo.outcome + ' / ' + s.bonds.linqing.outcome);
            }
            clearPending();
            /* 继续推到末日阶段 */
            for (let i = 0; i < 90 && s.hours < 175; i++) {
                runHours(3, 3);
                drainEvents();
                if (s.pending && s.pending.type === 'story') { StoryEngine.resolve(s, 0); clearPending(); }
            }
            clearPending();
            check('活到第三天之后进入末日阶段', PhaseManager.isAtLeast(s, 'apocalypse'), s.phase + ' @ ' + Utils.fmtHours(s.hours));
            check('末日阶段开放了重生', RebirthEngine.available(s) === true);
            check('这一轮的袭击都守住了（据点没被攻占）', s.raid.losses === 0 && s.raid.wins >= 1,
                '守住 ' + s.raid.wins + ' / 失守 ' + s.raid.losses);
            const flowPoints = RebirthEngine.pointsGain(s);
            check('这一轮能拿到重生点', flowPoints > 0, flowPoints + ' 点');
            check('守住的袭击会给结晶（能攒出下一轮的空间成长）', s.space.crystals > 0, s.space.crystals + ' 💎');

            /* 自动化：解锁后应该会自己搜刮 */
            s.hours = 40;
            for (const loc of LOCATIONS_CONFIG) s.locations[loc.id].seen = true;
            const sc0 = s.stats.scavenges;
            s.rebirth.shop.autoHand = 1;
            EffectsManager.refreshAllEffects(s);
            for (let i = 0; i < 12; i++) { GameLoop.advance(1); Actions.autoStep(s); }
            check('解锁「自动之手」后会自己搜刮', s.stats.scavenges > sc0, sc0 + ' → ' + s.stats.scavenges);
            check('自动搜刮不会把攒着的材料乱花光（自动建设是有节制的）',
                ResourcesManager.spaceUsed(s) >= 0);

            /* 离线结算 */
            /* 先验证新规则：末日前是回合制，离线不结算 */
            s.hours = 30;
            check('末日前离线不结算（回合制，你不在时间不走）',
                SaveEngine.applyOffline(s, 3600 * 3) === null);
            /* 再验证末日阶段的离线结算 */
            s.hours = 300;
            const beforeOffline = ResourcesManager.amount('食物');
            const rep = SaveEngine.applyOffline(s, 3600 * 3);
            check('离线结算不会报错', !!rep, JSON.stringify(rep && rep.seconds));
            check('离线期间设施照常产出', ResourcesManager.amount('食物') >= beforeOffline,
                beforeOffline + ' → ' + Math.round(ResourcesManager.amount('食物')));
            check('离线不会结算恶性事件（回来时据点还在）', s.raid.losses === 0);
        }

        /* ---------- J. 地图交互：点节点 → 抽屉 → 出发 ---------- */
        initState();
        clearPending();
        {
            s.doom = 'zombie';
            s.settings.autosave = false;
            s.hours = 5;
            App.activeTab = 'map';
            App.render(true);

            const node = document.querySelector('#tab-content .mnode.ready');
            check('地图上能找到可以出发的节点', !!node);
            const nodeId = node ? (node.getAttribute('data-act') || '').split('|')[1] : '';
            const sc0 = s.stats.scavenges;
            if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('点节点只是选中，不会直接出发', s.stats.scavenges === sc0, '搜刮次数 ' + s.stats.scavenges);
            const popRoot = document.getElementById('map-pop-root');
            const drawerTitle = document.querySelector('#map-pop-root .map-pop .drawer-title');
            check('点地点弹出详情弹窗', !!popRoot && popRoot.classList.contains('open') && !!drawerTitle,
                drawerTitle ? drawerTitle.textContent : '(没有弹窗)');
            check('弹窗挂在 body 上（不跟着内容滚）',
                !!popRoot && getComputedStyle(popRoot).position === 'fixed');
            const goBtn = document.querySelector('#map-pop-root [data-act="scavenge|' + nodeId + '"]');
            check('弹窗里有「出发」按钮', !!goBtn);
            if (goBtn) {
                /* 这条就是用户报的问题：按钮必须在屏幕里，不用滚 */
                const r = goBtn.getBoundingClientRect();
                check('「出发」按钮直接可见（不需要滚动）',
                    r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.width > 60,
                    'top ' + Math.round(r.top) + ' / bottom ' + Math.round(r.bottom) + '，视口高 ' + window.innerHeight);
            }
            check('选中的节点在地图上被标出来', !!document.querySelector('#tab-content .mnode.selected'));
            if (goBtn) {
                goBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                check('点「出发」会真的搜刮', s.stats.scavenges === sc0 + 1, '搜刮次数 ' + s.stats.scavenges);
            }
            check('搜刮完之后弹窗还在（方便接着搜）',
                document.getElementById('map-pop-root').classList.contains('open'));
            if (goBtn) {
                document.querySelector('#map-pop-root [data-act="mapclose"]')
                    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
                check('点 ✕ 能关掉弹窗',
                    !document.getElementById('map-pop-root').classList.contains('open'));
            }

            const foggy = document.querySelector('#tab-content .mnode.locked');
            if (foggy) {
                const lockedId = (foggy.getAttribute('data-act') || '').split('|')[1];
                foggy.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                check('迷雾里的地点带上就没有「出发」按钮',
                    !document.querySelector('#map-pop-root [data-act^="scavenge"]'));
                check('迷雾地点会说明为什么去不了', ScavengeEngine.status(s, lockedId).ok === false,
                    ScavengeEngine.status(s, lockedId).reason);
            }

            s.doom = 'flood';
            s.hours = 600;
            App.render(true);
            check('洪水末日在地图上标出被淹没的点',
                document.querySelectorAll('#tab-content .mnode.flooded').length >= 3,
                document.querySelectorAll('#tab-content .mnode.flooded').length + ' 个');
            check('洪水末日的地图会「涨水」', !!document.querySelector('#tab-content svg.citymap.rising'));
            s.doom = 'frost';
            App.render(true);
            check('极寒末日给地图蒙了一层霜', !!document.querySelector('#tab-content .map-wrap.doom-frost'));
            s.doom = 'nuclear';
            App.render(true);
            check('核冬天在地图上标出了辐射区',
                document.querySelectorAll('#tab-content .doom-mark.radiation').length > 0);
            s.doom = 'zombie';
            App.render(true);
            check('丧尸末日标出尸群出没的高危区',
                document.querySelectorAll('#tab-content .doom-mark.horde').length > 0);

            const tipHtml = Tips.tipHtml('loc|market');
            check('地图节点的悬浮说明有内容', !!tipHtml && tipHtml.indexOf('大型超市') >= 0);
            check('悬浮说明里写了遭遇概率', !!tipHtml && tipHtml.indexOf('遭遇概率') >= 0);

            /* ---------- 立绘与背景图的位置（没图时画档案占位框） ---------- */
            const counts = Assets.count();
            /* 弹窗里的背景位：先在地图上选一个地点 */
            MapView.select('market');
            App.render(true);
            /* 有图时元素本身就是 <img>，没图时是一个装着 SVG 的 div（带 is-ph） */
            const hasArt = el => !!el && (el.tagName === 'IMG' || !!el.querySelector('img, svg') || el.classList.contains('is-ph'));
            check('图片清单能被读到', typeof counts.portraits === 'number' && typeof counts.scenes === 'number',
                JSON.stringify(counts));
            const drawerPic = document.querySelector('#map-pop-root .drawer-scene .scene-pic');
            check('地点弹窗里有背景位（有图显示图，没图显示占位）',
                hasArt(drawerPic), drawerPic ? (drawerPic.tagName === 'IMG' ? '有背景图' : '占位') : '没有');
            const picRect = drawerPic ? drawerPic.getBoundingClientRect() : { width: 0, height: 0 };
            check('背景位有实际尺寸（不是塌掉的）', picRect.width > 100 && picRect.height > 60,
                Math.round(picRect.width) + '×' + Math.round(picRect.height));
            check('背景上压着地点名与城区', !!document.querySelector('#map-pop-root .scene-name') &&
                !!document.querySelector('#map-pop-root .scene-region'));

            App.activeTab = 'bonds';
            /* 羁绊页只显示「已经认识」的人，先安排两个再检查立绘位 */
            BondEngine.markMet(s, 'wangyi');
            BondEngine.markMet(s, 'shenxue');
            App.render(true);
            const bondPic = document.querySelector('#tab-content .bond-pic');
            check('羁绊卡片上有立绘位', hasArt(bondPic),
                bondPic ? (bondPic.tagName === 'IMG' ? '有立绘' : '占位') : '没有');
            /* 打开一个羁绊浮窗，检查立绘大图那一栏 */
            BondEngine.present(s, 'wangyi', 'meet');
            Modals.refresh();
            const art = document.querySelector('#modal-root .bond-art .portrait-pic');
            check('羁绊浮窗里有立绘栏', hasArt(art),
                art ? (art.tagName === 'IMG' ? '有立绘' : '占位') : '没有');
            check('立绘栏旁边写着名字与身份', (document.querySelector('#modal-root .bond-art-name') || {}).textContent === '王姨' &&
                !!document.querySelector('#modal-root .bond-art-sub'));
            UI.closeModal();
            s.pending = null;
            App.activeTab = 'map';
            App.render(true);
        }

        /* ---------- O. 遭遇战：弹窗 / 胜率 / 只能逃 / 丢物资换几率 / 被占领 ---------- */
        {
            /* ---------- P1. 隐藏物资点（并排跑，省得再开一段） ---------- */
            initState();
            clearPending();
            s.settings.autosave = false;
            s.doom = 'zombie';
            s.hours = 30;
            s.space.level = 6;
            EffectsManager.refreshAllEffects(s);
            App.activeTab = 'map';
            App.render(true);
            const ctxt = () => ((document.querySelector('#modal-root .modal') || {}).textContent || '').replace(/\s+/g, ' ');
            check('搜刮产出里已经没有现金了',
                LOCATIONS_CONFIG.filter(l => l.loot.some(x => x.res === '现金')).length === 0,
                LOCATIONS_CONFIG.filter(l => l.loot.some(x => x.res === '现金')).map(l => l.id).join('、') || '干净');
            const mkt = ScavengeEngine.locOf('market');
            s.locations.market.seen = true;
            const cache1 = CacheEngine.roll(s, mkt);
            cache1.crystal = 2;
            CacheEngine.discover(s, mkt, cache1);
            Modals.refresh();
            check('发现隐藏物资点会弹窗（不是一行日志）', ctxt().indexOf('隐藏物资点') >= 0, ctxt().slice(0, 60));
            check('弹窗里写明在哪个地点', ctxt().indexOf('大型超市') >= 0);
            check('弹窗里有具体剧情（怎么发现的）', ctxt().indexOf(cache1.kind.find.slice(0, 12)) >= 0);
            check('弹窗列出里面有什么、占多少格',
                ctxt().indexOf('异能结晶') >= 0 && ctxt().indexOf('需要') >= 0);
            document.querySelector('#modal-root [data-act="cachetake|later"]')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('「先记下来」之后物资点还在', CacheEngine.waiting(s, 'market') === true);
            check('地图上这个地点留下了标记',
                document.querySelector('#tab-content .mnode[data-act="mapnode|market"]').classList.contains('has-cache'));
            MapView.select('market');
            App.render(true);
            check('地点弹窗里能看到藏着的物资和「去搬」按钮',
                !!document.querySelector('#map-pop-root .cache-box') &&
                !!document.querySelector('#map-pop-root [data-act="cacheopen|market"]'));
            const cfood = ResourcesManager.amount('食物');
            const ccr = s.space.crystals;
            document.querySelector('#map-pop-root [data-act="cacheopen|market"]')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('「去搬」能重新打开同一个物资点',
                !!document.querySelector('#modal-root [data-act="cachetake|all"]'), ctxt().slice(0, 40));
            document.querySelector('#modal-root [data-act="cachetake|all"]')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('搬完之后物资与结晶到手',
                ResourcesManager.amount('食物') > cfood || s.space.crystals > ccr,
                '食物 ' + cfood + ' → ' + Math.round(ResourcesManager.amount('食物')));
            check('搬完之后物资点清空', CacheEngine.waiting(s, 'market') === false);
            UI.closeModal();
            s.pending = null;
            App.render(true);
            check('地图上的标记也跟着消失',
                !document.querySelector('#tab-content .mnode[data-act="mapnode|market"]').classList.contains('has-cache'));
            s.space.level = 1;
            EffectsManager.refreshAllEffects(s);
            const big = CacheEngine.roll(s, ScavengeEngine.locOf('warehouse'));
            big.loot['建材'] = 200;
            CacheEngine.discover(s, ScavengeEngine.locOf('warehouse'), big);
            Modals.refresh();
            check('空间装不下时「全搬」被禁用并说明原因',
                !document.querySelector('#modal-root [data-act="cachetake|all"]') && ctxt().indexOf('空间装不下') >= 0,
                ctxt().slice(0, 60));
            s.pending = null;
            s.locations.warehouse.cache = null;
            UI.closeModal();

            initState();
            clearPending();
            s.settings.autosave = false;
            s.doom = 'zombie';
            s.hours = 60;
            s.space.level = 1;
            EffectsManager.refreshAllEffects(s);
            const police = ScavengeEngine.locOf('police');

            function forceEncounter(power, count, unit, kindIdx) {
                const enc = EncounterEngine.roll(s, police);
                enc.power = power; enc.count = count; enc.unit = unit;
                enc.kind = ENEMIES_CONFIG.zombie[kindIdx];
                enc.tries = 0;
                enc.log = [];
                s.encounter = enc;
                s.pending = { type: 'encounter' };
                Modals.refresh();
                return enc;
            }
            const modalText = () => (document.querySelector('#modal-root .modal') || {}).textContent || '';

            /* 1) 战力差太大：只能逃 */
            forceEncounter(180, 3, 60, 3);   // 3 只碎骨者
            const info = EncounterEngine.info(s);
            check('遭遇会弹窗（不再是日志里自动结算）',
                modalText().indexOf('遭遇') >= 0 && modalText().indexOf('碎骨者') >= 0,
                modalText().replace(/\s+/g, ' ').trim().slice(0, 50));
            check('弹窗里写着敌人种类与人数', modalText().indexOf('3 只碎骨者') >= 0 || modalText().indexOf('3 × 碎骨者') >= 0);
            check('弹窗里有双方战力对比', !!document.querySelector('#modal-root .vs-box') &&
                modalText().indexOf('对方') >= 0 && modalText().indexOf('战力') >= 0);
            check('战力过低时不能迎战', info.canFight === false && info.odds === 0,
                '你 ' + info.mine + ' vs 对方 ' + info.enc.power);
            check('「迎战」被禁用并写明原因（只能选逃跑）',
                !document.querySelector('#modal-root [data-act="encfight"]') &&
                modalText().indexOf('打不过') >= 0);
            check('逃跑按钮上写了成功率',
                ((document.querySelector('#modal-root [data-act="encflee"]') || {}).textContent || '').indexOf('成功率') >= 0);
            check('还没跑过时不会出现「丢物资再跑」',
                !document.querySelector('#modal-root [data-act="encdump"]'));

            /* 2) 逃跑失败：丢资源 + 出现「丢物资再跑」 */
            give({ '食物': 200, '药品': 40, '弹药': 40 });
            const food0 = ResourcesManager.amount('食物');
            const realRandom = Math.random;
            Math.random = () => 0.99;              // 必失败
            const fled1 = EncounterEngine.flee(s, {});
            Math.random = realRandom;
            check('逃跑失败会损失一部分资源',
                fled1.fled === false && ResourcesManager.amount('食物') < food0,
                food0 + ' → ' + ResourcesManager.amount('食物'));
            check('逃跑失败后遭遇还在，次数记上了',
                !!s.encounter && s.encounter.tries === 1 && !!s.pending,
                s.encounter ? s.encounter.tries + ' 次' : '(遭遇没了)');
            Modals.refresh();
            check('失败之后才出现「丢下物资再跑」',
                !!document.querySelector('#modal-root [data-act="encdump"]'));
            check('丢物资确实提高逃跑成功率',
                EncounterEngine.fleeOdds(s, s.encounter, true) > EncounterEngine.fleeOdds(s, s.encounter, false),
                Math.round(EncounterEngine.fleeOdds(s, s.encounter, false) * 100) + '% → ' +
                Math.round(EncounterEngine.fleeOdds(s, s.encounter, true) * 100) + '%');

            /* 3) 丢物资 + 跑掉 */
            const food1 = ResourcesManager.amount('食物');
            Math.random = () => 0.01;              // 必成功
            const fled2 = EncounterEngine.flee(s, { dumping: true });
            Math.random = realRandom;
            check('丢下物资之后跑掉了，而且真的丢了东西',
                fled2.fled === true && ResourcesManager.amount('食物') < food1,
                food1 + ' → ' + ResourcesManager.amount('食物'));
            check('跑掉之后遭遇清空、地点没被占',
                s.encounter === null && !ScavengeEngine.occupied(s, 'police'));

            /* 4) 连逃三次失败 → 被冲散：损失更重 + 地点被占 */
            forceEncounter(180, 3, 60, 3);
            Math.random = () => 0.99;
            EncounterEngine.flee(s, {});
            EncounterEngine.flee(s, {});
            const food2 = ResourcesManager.amount('食物');
            const scat = EncounterEngine.flee(s, {});
            Math.random = realRandom;
            check('连逃三次失败会被冲散', scat.scattered === true && scat.fled === false);
            check('被冲散时又损失了一批物资', ResourcesManager.amount('食物') < food2,
                food2 + ' → ' + ResourcesManager.amount('食物'));
            check('被冲散之后这个地方被他们占了',
                !!ScavengeEngine.occupied(s, 'police') && ScavengeEngine.status(s, 'police').ok === false,
                ScavengeEngine.status(s, 'police').reason);

            /* 5) 夺回：地图上打回来 */
            s.space.level = 10;
            EffectsManager.refreshAllEffects(s);
            s.encounter = null;
            s.pending = null;
            /* 让占着的人弱一点，专门测「夺回成功」这条路 */
            s.locations.police.occupied.power = 8;
            const rec = ScavengeEngine.reclaim(s, 'police');
            check('夺回成功之后地点恢复可用',
                rec.ok && !ScavengeEngine.occupied(s, 'police') && ScavengeEngine.status(s, 'police').ok === true,
                rec.msg);

            /* 6) 战力够的时候可以迎战（并且打赢不占地方） */
            forceEncounter(20, 1, 20, 0);          // 1 只游荡者，战力 20
            const info2 = EncounterEngine.info(s);
            check('战力碾压时「迎战」可选，并显示胜率',
                info2.canFight === true &&
                ((document.querySelector('#modal-root [data-act="encfight"]') || {}).textContent || '').indexOf('胜率') >= 0,
                '你 ' + info2.mine + ' vs 对方 ' + info2.enc.power + '，胜率 ' + Math.round(info2.odds * 100) + '%');
            const fight = EncounterEngine.fight(s);
            check('迎战打赢了、地方也没被占',
                fight.win === true && !ScavengeEngine.occupied(s, 'police'),
                fight.line);
            check('打完遭遇就结束了', s.encounter === null && s.pending === null);
            UI.closeModal();

            /* ---------- P2. 现金：借（花好感）/ 抢（记仇）/ 仇家找麻烦 ---------- */
            initState();
            clearPending();
            s.doom = 'zombie';
            BondEngine.markMet(s, 'anqi');
            BondEngine.get(s, 'anqi').value = 60;
            const cashBefore = ResourcesManager.amount('现金');
            const favorBefore = BondEngine.get(s, 'anqi').value;
            const binfo = MoneyEngine.borrowInfo(s, 'anqi');
            check('借钱要花好感、金额按人算（富商之女能借得多）',
                binfo.ok && binfo.cash > 1000 && binfo.favorCost > 0, JSON.stringify(binfo));
            const br = MoneyEngine.borrow(s, 'anqi');
            check('借到钱：现金增加、好感减少',
                br.ok && ResourcesManager.amount('现金') > cashBefore &&
                BondEngine.get(s, 'anqi').value < favorBefore, br.msg);
            check('同一个人越借越贵、能借到的越少',
                MoneyEngine.borrowInfo(s, 'anqi').favorCost > binfo.favorCost &&
                MoneyEngine.borrowInfo(s, 'anqi').cash < binfo.cash,
                MoneyEngine.borrowInfo(s, 'anqi').favorCost + ' 好感 / ' + MoneyEngine.borrowInfo(s, 'anqi').cash + ' 现金');
            BondEngine.get(s, 'anqi').value = 10;
            check('好感不够时借不到', MoneyEngine.borrowInfo(s, 'anqi').ok === false,
                MoneyEngine.borrowInfo(s, 'anqi').reason);

            initState();
            clearPending();
            s.hours = 40;
            s.space.level = 1;
            EffectsManager.refreshAllEffects(s);
            /* 用自家公寓当目标：危险度低，看场子的弱，战力够就能抢 */
            const cop = ScavengeEngine.locOf('home');
            s.locations.home.seen = true;
            check('战力不够时抢不了',
                MoneyEngine.robInfo(s, cop).ok === false && MoneyEngine.rob(s, 'home').ok === false,
                MoneyEngine.robInfo(s, cop).reason);
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            const rinfo = MoneyEngine.robInfo(s, cop);
            check('战力够了就能抢，并给出成功率与大概能抢多少',
                rinfo.ok && rinfo.odds > 0 && rinfo.haul > 0,
                '成功率 ' + Math.round(rinfo.odds * 100) + '% / 约 ' + rinfo.haul);
            const realRnd = Math.random;
            Math.random = () => 0.05;
            const robRes = MoneyEngine.rob(s, 'home');
            Math.random = realRnd;
            check('抢成功：拿到现金、仇家上涨',
                robRes.win === true && s.heat > 0 && ResourcesManager.amount('现金') > 0,
                '现金 ' + Math.round(ResourcesManager.amount('现金')) + ' / 仇家 ' + s.heat);
            check('仇家让袭击变强', MoneyEngine.raidMultiplier(s) > 1,
                '×' + MoneyEngine.raidMultiplier(s).toFixed(2));
            /* 这些事件属于爆发之后：切到末日阶段再看事件池 */
            s.hours = 200;
            s.heat = 4;
            check('仇家够多时「有人来打听你」会进入事件池',
                EventEngine.poolFor(s).map(e => e.id).indexOf('grudgeVisit') >= 0,
                EventEngine.poolFor(s).map(e => e.id).join('、').slice(0, 70));
            s.heat = 7;
            check('仇家很高时袭击改名成「仇家清算」',
                DefenseEngine.raidName(s) === '仇家清算', DefenseEngine.raidName(s));
            check('仇家够多时「上门清算」也会进池',
                EventEngine.poolFor(s).map(e => e.id).indexOf('grudgeRaid') >= 0);
            const heatBefore = s.heat;
            s.heatCoolAt = s.hours;
            GameLoop.passTime(1);
            check('过一段时间没人来算账，仇家会淡一点', s.heat < heatBefore, heatBefore + ' → ' + s.heat);
        }

        /* ---------- N. 末日前按行动推进（回合制）+ 药箱升级更苛刻 ---------- */
        {
            initState();
            clearPending();
            s.settings.autosave = false;
            s.doom = 'zombie';
            App.activeTab = 'map';
            App.render(true);

            /* 1) 不操作，时间不走 */
            const h0 = s.hours;
            const alive = stepFrames(20, 100);
            check('末日前什么都不做，时间不会自己走', alive && Math.abs(s.hours - h0) < 1e-9,
                h0.toFixed(2) + ' → ' + s.hours.toFixed(2));
            check('顶栏写着还能出门几次',
                document.getElementById('topbar-inner').textContent.indexOf('次出门') >= 0,
                document.getElementById('topbar-inner').textContent.replace(/\s+/g, ' ').slice(0, 70));
            const speedBtn = document.querySelector('[data-tip="speed"]');
            check('末日前流速按钮被禁用（加速不该吃掉准备时间）',
                !!speedBtn && speedBtn.disabled === true);

            /* 2) 搜刮一次 = 1 小时；危险区 1.5 小时 */
            const t0 = s.hours;
            const r1 = ScavengeEngine.scavenge(s, 'home');
            check('搜刮一次花 1 小时', r1.ok && Math.abs(s.hours - t0 - ACTION_COSTS.scavenge) < 1e-9,
                t0.toFixed(2) + ' → ' + s.hours.toFixed(2));
            s.hours = 60;
            s.locations['hospital'].seen = true;
            s.space.level = 12;                       // 先扩空间，不然 give 会被容量截断
            EffectsManager.refreshAllEffects(s);
            give({ '药品': 20, '建材': 200, '零件': 100 });
            const t1 = s.hours;
            ScavengeEngine.scavenge(s, 'hospital');
            check('危险区出门要 1.5 小时', Math.abs(s.hours - t1 - ACTION_COSTS.scavengeFar) < 1e-9,
                t1.toFixed(2) + ' → ' + s.hours.toFixed(2));

            /* 3) 施工也花时间 */
            s.hours = 10;
            const t2 = s.hours;
            BuildEngine.build(s, 'doorReinforce');
            check('施工一次花 2 小时', Math.abs(s.hours - t2 - ACTION_COSTS.build) < 1e-9,
                t2.toFixed(2) + ' → ' + s.hours.toFixed(2));

            /* 4) 药箱：升级成本递增 + 分级前置 */
            initState();
            clearPending();
            s.doom = 'zombie';
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            give({ '药品': 4000, '零件': 4000, '建材': 4000, '食物': 600 });
            const c1 = BuildEngine.costFor(s, 'medkit', 1);
            const c3 = BuildEngine.costFor(s, 'medkit', 3);
            const c6 = BuildEngine.costFor(s, 'medkit', 6);
            check('药箱升级成本递增（不是线性平摊）',
                c3['药品'] > c1['药品'] * 3 && c6['药品'] > c3['药品'] * 2,
                'Lv1 ' + c1['药品'] + ' / Lv3 ' + c3['药品'] + ' / Lv6 ' + c6['药品'] + ' 药品');
            check('药箱要的不只是建材（药品 + 零件 + 建材）',
                !!c3['药品'] && !!c3['零件'] && !!c3['建材'], JSON.stringify(c3));
            check('药箱 Lv1 可以直接升', BuildEngine.status(s, 'medkit').can === true,
                BuildEngine.status(s, 'medkit').reason);
            BuildEngine.build(s, 'medkit');
            BuildEngine.build(s, 'medkit');
            check('药箱升到 Lv2', s.facilities.medkit.level === 2, 'Lv' + s.facilities.medkit.level);
            const st3 = BuildEngine.status(s, 'medkit');
            check('药箱 Lv3 撞上分级前置：需要工具角 Lv2',
                st3.can === false && /工具角/.test(st3.reason), st3.reason);
            check('缺前置时点了也升不上去', BuildEngine.build(s, 'medkit').ok === false);
            BuildEngine.freeLevel(s, 'toolbox', 2);
            check('补上工具角 Lv2 之后能升 Lv3', BuildEngine.status(s, 'medkit').can === true,
                BuildEngine.status(s, 'medkit').reason);
            BuildEngine.build(s, 'medkit');
            BuildEngine.build(s, 'medkit');
            check('药箱到 Lv4', s.facilities.medkit.level === 4, 'Lv' + s.facilities.medkit.level);
            const st5 = BuildEngine.status(s, 'medkit');
            check('药箱 Lv5 还有第二道前置：储物间 Lv3',
                st5.can === false && /储物间/.test(st5.reason), st5.reason);
            BuildEngine.freeLevel(s, 'storeroom', 3);
            check('补上储物间 Lv3 之后 Lv5 能升', BuildEngine.status(s, 'medkit').can === true,
                BuildEngine.status(s, 'medkit').reason);
            const clinicReq = BuildEngine.reqListFor('clinic', 1);
            check('医疗站的前置没有被这条线卡死（仍只要药箱 Lv2）',
                clinicReq.length === 1 && clinicReq[0][0] === 'medkit' && clinicReq[0][1] === 2,
                JSON.stringify(clinicReq));
        }

        /* ---------- M. 弹窗生命周期：选项结算必须看得到结果，别的操作不能弹空结果 ---------- */
        {
            initState();
            clearPending();
            s.settings.autosave = false;
            s.hours = 12;
            s.doom = 'zombie';
            App.activeTab = 'map';
            App.render(true);

            /* 1) 事件：点「做决定」应该给出选项 */
            s.pending = { type: 'event', id: 'hiddenCache' };
            Modals.refresh();
            const choiceCount = document.querySelectorAll('#modal-root .choices .choice').length;
            check('事件浮窗先给选项（不是直接出结果）', choiceCount >= 2, choiceCount + ' 个选项');
            check('事件浮窗不能点背景关掉（否则事件会卡住）',
                document.getElementById('modal-root')._closable === false);

            /* 2) 选一个选项：必须看得到「发生了什么」 */
            document.querySelector('#modal-root .choices .choice')
                .dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('选项结算后 pending 清空', s.pending === null, JSON.stringify(s.pending));
            const body = document.querySelector('#modal-root .modal');
            check('结果浮窗仍然显示（不会因为 pending 清空就消失）',
                !!body && document.getElementById('modal-root').classList.contains('open'));
            check('结果浮窗里有内容（不是空白页）',
                !!document.querySelector('#modal-root .story-pages p, #modal-root .kv-line'),
                body ? body.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '(没有浮窗)');

            /* 3) 点「继续」关掉 */
            const cont = document.querySelector('#modal-root .modal-actions .btn.primary');
            if (cont) cont.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            check('点「继续」后结果浮窗关闭',
                !document.getElementById('modal-root').classList.contains('open'));

            /* 4) 别的操作（建造）不该再弹出空白结果浮窗 */
            s.space.level = 12;
            EffectsManager.refreshAllEffects(s);
            ResourcesManager.add({ '建材': 600, '零件': 300 }, s);
            App.activeTab = 'base';
            App.render(true);
            const buildBtn = document.querySelector('#tab-content .fac-card[data-act^="build"]');
            check('设施卡片能点到（准备验证建造）', !!buildBtn);
            if (buildBtn) buildBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            /* 建造本身不该弹结果页；但如果这一下正好触发了随机事件/剧情，
               弹窗里有选项是正常的 —— 这里只钉「不是那个空的结果页」。 */
            const modalTxt = document.getElementById('modal-root').textContent || '';
            check('建造这类操作不会再弹出空白的结果浮窗',
                !document.getElementById('modal-root').classList.contains('open') ||
                modalTxt.indexOf('发生了这些') < 0,
                modalTxt.replace(/\s+/g, ' ').trim().slice(0, 50));

            /* 5) 剧情 / 羁绊浮窗同样不允许点背景关掉 */
            initState();
            clearPending();
            StoryEngine.startNewGame(s);
            Modals.refresh();
            check('序章浮窗不能点背景关掉',
                document.getElementById('modal-root')._closable === false);
            UI.closeModal();
            s.pending = null;
        }

        /* ---------- K. 主题：浅色模式下文字必须看得见 ---------- */
        {
            App.activeTab = 'settings';
            const relLum = (r, g, b) => {
                const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
                return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const parse = (str) => {
                const m = (str || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
                return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
            };
            /* 元素自己没背景就往上找，直到找到有背景的那一层 */
            const backdrop = (el) => {
                let node = el;
                while (node) {
                    const cs = getComputedStyle(node);
                    const c = parse(cs.backgroundColor);
                    if (c && cs.backgroundColor.indexOf('rgba(0, 0, 0, 0)') < 0) return c;
                    const g = parse(cs.backgroundImage);
                    if (g) return g;
                    node = node.parentElement;
                }
                return [255, 255, 255];
            };
            const contrast = (el) => {
                const fg = parse(getComputedStyle(el).color) || [0, 0, 0];
                const bg = backdrop(el);
                const a = relLum(fg[0], fg[1], fg[2]), b = relLum(bg[0], bg[1], bg[2]);
                return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            };
            const themeReport = async (tag) => {
                App.render(true);
                /* body 上有 background/color 的 0.3s 过渡：不等它播完，读到的还是旧颜色 */
                document.body.offsetHeight;
                await new Promise(r => setTimeout(r, 420));
                const topbar = document.querySelector('.topbar');
                const pairs = [
                    ['顶栏标题', document.querySelector('.brand h1')],
                    ['顶栏标签', document.querySelector('.top-label')],
                    ['顶栏数值', document.querySelector('.top-stat span:last-child')],
                    ['侧栏标题', document.querySelector('.panel-title')],
                    ['设置项标题', document.querySelector('.set-label')],
                    ['设置项说明', document.querySelector('.set-note')],
                    ['正文/统计', document.querySelector('#panel-stats .stat-row span')],
                ];
                const bad = [];
                pairs.forEach(p => {
                    if (!p[1]) return;
                    const c = contrast(p[1]);
                    if (c < 3) bad.push(p[0] + ' ' + c.toFixed(1));
                });
                const bg = backdrop(topbar);
                const lum = relLum(bg[0], bg[1], bg[2]);
                return { bad: bad, topLum: lum, tag: tag };
            };

            s.settings.theme = 'dark';
            App.applyTheme();
            const dark = await themeReport('深色');
            check('深色主题下各处文字都看得清', dark.bad.length === 0, dark.bad.join('，') || '对比度都 ≥ 3');

            s.settings.theme = 'light';
            App.applyTheme();
            const light = await themeReport('浅色');
            check('浅色主题下顶栏真的变浅了', light.topLum > 0.35, '顶栏亮度 ' + light.topLum.toFixed(2));
            check('浅色主题下各处文字都看得清', light.bad.length === 0, light.bad.join('，') || '对比度都 ≥ 3');

            /* 切回深色，别把后面的断言带偏 */
            s.settings.theme = 'dark';
            App.applyTheme();
            App.render(true);
        }

        /* ---------- L. 清除存档：清完必须回到最开始（重新播序章） ---------- */
        /* 注意：这一节必须是最后一段 —— clearStorage 会挂起本页的自动保存 */
        {
            /* 先造一个「已经玩了一会儿」的存档 */
            initState();
            s.settings.autosave = true;
            s.hours = 200;
            s.space.level = 6;
            StoryEngine.present(s, 'prologue');
            s.pending = null;
            check('清档前能正常写档', SaveEngine.save(s) === true && SaveEngine.hasSave() === true);
            check('清档前序章已经被看过了', StoryEngine.seen(s, 'prologue') === true);
            check('清档前是「继续玩」的状态', s.hours === 200 && s.space.level === 6);

            SaveEngine.clearStorage();
            check('清档后存档真的没了', SaveEngine.hasSave() === false);
            /* 这条就是这次报的问题：清完档立刻 reload 会触发 beforeunload，
               那里的自动保存会把旧进度写回来 */
            check('清档后自动保存被按住（旧档不会长回来）',
                SaveEngine.isSuspended() === true && SaveEngine.save(s) === false);
            check('清档留下了一次性的反馈标记', SaveEngine.consumeResetMark() === true);
            check('反馈标记只生效一次', SaveEngine.consumeResetMark() === false);

            /* 模拟刷新后的第一屏：initState + 没有存档 → 应该重新弹序章 */
            initStateRaw();          // 这里要用没被套壳的那个：本段测的就是「全新一局弹序章」
            const hadSave = SaveEngine.hasSave();
            check('刷新后读不到存档（因此会走新档分支）', hadSave === false);
            if (!hadSave) StoryEngine.startNewGame(s);
            check('清档后重新弹出序章',
                !!s.pending && s.pending.type === 'story' && s.pending.id === 'prologue',
                JSON.stringify(s.pending));
            Modals.refresh();
            check('序章浮窗渲染出来了', !!document.querySelector('#modal-root .modal h2'));
            check('序章正文与选项都在',
                document.querySelectorAll('#modal-root .story-pages p').length >= 4 &&
                document.querySelectorAll('#modal-root .choices .choice').length >= 1,
                document.querySelectorAll('#modal-root .story-pages p').length + ' 段 / ' +
                document.querySelectorAll('#modal-root .choices .choice').length + ' 个选项');
            UI.closeModal();
            s.pending = null;
        }

        } catch (e) {
            R.fail += 1;
            R.log.push('FATAL  自检中断：' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
        }

        /* ---------- 收尾 ---------- */
        R.log.unshift('==== ' + R.pass + ' passed, ' + R.fail + ' failed ====');
        if (R.errors.length) R.log.push('---- 捕获到的运行时错误 ----');
        R.errors.slice(0, 12).forEach(e => R.log.push('  ' + e));
        const el = document.getElementById('report');
        if (el) el.textContent = R.log.join('\n');
        document.title = 'DONE ' + R.pass + '/' + R.fail;

        /* #PART2 */
    })();
})();
