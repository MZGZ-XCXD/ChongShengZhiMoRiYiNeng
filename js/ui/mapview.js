/* 城区地图：用 SVG 画出街区、主干道、河道与 15 个可点节点。
   节点状态（可搜 / 掏空 / 淹没 / 浓雾）直接画在地图上，末日类型换一层滤镜。
   选中节点不会立刻出发 —— 先在地图上点，再从下方的抽屉里确认，避免误触。 */
(function () {
    const G = window.UI;
    const W = 1000, H = 660;
    let selectedId = null;

    /* 街区轮廓（逻辑坐标），只为「这是个城市」的观感服务 */
    const REGION_SHAPES = {
        oldtown: '118,58 352,66 356,404 112,414',
        downtown: '404,58 672,72 646,382 402,364',
        civic: '198,436 520,428 530,626 206,636',
        outskirts: '672,74 934,120 944,486 690,542',
    };
    const REGION_LABEL = {
        oldtown: { x: 237, y: 44 },
        downtown: { x: 528, y: 44 },
        civic: { x: 232, y: 522 },
        outskirts: { x: 800, y: 60 },
    };
    /* 主干道：把四个城区连起来的骨架 */
    const ROADS = [
        { d: 'M 118 300 L 460 296 L 700 300 L 930 300', cls: 'road-main' },
        { d: 'M 250 60 L 256 300 L 240 630', cls: 'road-main' },
        { d: 'M 700 80 L 704 300 L 736 500', cls: 'road-main' },
        { d: 'M 148 112 L 262 196 L 264 322 L 148 372', cls: 'road' },
        { d: 'M 452 116 L 582 198 L 470 318', cls: 'road' },
        { d: 'M 252 556 L 330 462 L 452 540', cls: 'road' },
        { d: 'M 704 122 L 836 214 L 862 392 L 736 478', cls: 'road' },
        { d: 'M 356 200 L 402 200 M 646 200 L 700 200', cls: 'road' },
    ];
    /* 河道：洪水末日里它会变成地图上最显眼的东西 */
    const RIVER = 'M 40 470 C 190 430, 300 560, 470 566 C 640 572, 720 460, 980 452';

    function stateOf(id) { return ScavengeEngine.status(GameState, id); }

    function nodeClass(loc, st) {
        const cls = ['mnode'];
        if (!st.unlocked) cls.push('locked');
        else if (st.disabled) cls.push('flooded');
        else if (st.occupied) cls.push('occupied');
        else if (st.left <= 0) cls.push('spent');
        else cls.push('ready');
        /* 这里藏着一批物资：地图上留个标记，搬走就没了 */
        if (CacheEngine.waiting(GameState, loc.id)) cls.push('has-cache');
        if (loc.danger >= 0.4) cls.push('dangerous');
        if (selectedId === loc.id) cls.push('selected');
        return cls.join(' ');
    }

    function subText(st) {
        if (!st.unlocked) return '浓雾';
        if (st.disabled) return '已淹没';
        if (st.occupied) return '被占领';
        if (st.left <= 0) return Utils.fmtCountdown(st.refreshIn);
        return st.left + ' / ' + st.max;
    }

    function nodeSvg(loc, st) {
        const p = LOCATION_MAP[loc.id];
        const icon = st.unlocked ? loc.icon : '？';
        return '<g class="' + nodeClass(loc, st) + '" transform="translate(' + p.x + ',' + p.y + ')" ' +
            'data-act="mapnode|' + loc.id + '" data-tip="loc|' + loc.id + '">' +
            '<circle class="mnode-halo" r="40"/>' +
            (st.unlocked ? '' : '<circle class="mnode-fog" r="54"/>') +
            '<circle class="mnode-dot" r="26"/>' +
            '<text class="mnode-icon" y="9">' + icon + '</text>' +
            '<text class="mnode-name" y="52">' + (st.unlocked ? G.esc(loc.name) : '未探明') + '</text>' +
            '<text class="mnode-sub" y="70">' + G.esc(subText(st)) + '</text>' +
            '</g>';
    }

    /* 末日类型在地图上留下的痕迹 */
    function doomLayer(state) {
        const doom = state.doom;
        if (doom === 'zombie') {
            /* 危险点旁边飘着尸群的影子 */
            return LOCATIONS_CONFIG.filter(l => l.danger >= 0.4).map(l => {
                const p = LOCATION_MAP[l.id];
                return '<g class="doom-mark horde"><circle cx="' + (p.x + 38) + '" cy="' + (p.y - 26) + '" r="7"/>' +
                    '<text x="' + (p.x + 38) + '" y="' + (p.y - 34) + '">🧟</text></g>';
            }).join('');
        }
        if (doom === 'nuclear') {
            const spots = [[300, 250], [520, 470], [800, 330], [200, 520]];
            return spots.map(s => '<circle class="doom-mark radiation" cx="' + s[0] + '" cy="' + s[1] + '" r="56"/>').join('');
        }
        if (doom === 'frost') {
            return '<rect class="doom-mark frost" x="0" y="0" width="' + W + '" height="' + H + '"/>';
        }
        return '';
    }

    function mapSvg(state) {
        const doom = state.doom;
        let regions = '';
        for (const r of REGIONS_CONFIG) {
            regions += '<polygon class="region region-' + r.id + '" points="' + REGION_SHAPES[r.id] + '"/>' +
                '<text class="region-label" text-anchor="middle" x="' + REGION_LABEL[r.id].x + '" y="' +
                REGION_LABEL[r.id].y + '">' + r.name + '</text>';
        }
        const roads = ROADS.map(r => '<path class="' + r.cls + '" d="' + r.d + '"/>').join('') +
            /* 主干道上的虚线：一眼看出哪条路能走车 */
            ROADS.filter(r => r.cls === 'road-main').map(r => '<path class="road-main-dash" d="' + r.d + '"/>').join('');
        const nodes = LOCATIONS_CONFIG.map(l => nodeSvg(l, stateOf(l.id))).join('');
        return '<svg class="citymap ' + (doom === 'flood' ? 'rising' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" ' +
            'preserveAspectRatio="xMidYMid meet" role="img" aria-label="城区地图">' +
            '<defs>' +
                '<pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
                    '<line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,.05)" stroke-width="2"/>' +
                '</pattern>' +
                '<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">' +
                    '<path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="1"/>' +
                '</pattern>' +
                '<radialGradient id="fog">' +
                    '<stop offset="0%" stop-color="rgba(198,208,206,.17)"/>' +
                    '<stop offset="55%" stop-color="rgba(178,190,188,.09)"/>' +
                    '<stop offset="100%" stop-color="rgba(178,190,188,0)"/>' +
                '</radialGradient>' +
            '</defs>' +
            '<rect class="map-base" x="0" y="0" width="' + W + '" height="' + H + '"/>' +
            '<rect class="map-grid" x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#grid)"/>' +
            '<rect class="map-hatch" x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#hatch)"/>' +
            regions + roads +
            '<path class="river" d="' + RIVER + '"/>' +
            doomLayer(state) +
            nodes +
            '</svg>';
    }

    /* 选中地点后的弹窗内容：不用滚到地图下面去点「出发」 */
    function popup(state) {
        if (!selectedId) return '';
        const loc = LOCATIONS_CONFIG.find(l => l.id === selectedId);
        const st = stateOf(selectedId);
        const region = REGIONS_CONFIG.find(r => r.id === LOCATION_MAP[selectedId].region) || {};
        const loot = loc.loot.map(x => '<span class="loot-chip">' +
            ((RESOURCES_CONFIG[x.res] || {}).icon || '') + ' ' + x.res + '</span>').join('');
        const dangerPct = Math.round(loc.danger * 100);
        const enc = Math.round(ScavengeEngine.encounterChance(state, loc) * 100);
        let action;
        const rob = MoneyEngine.robInfo(state, loc);
        if (st.ok) {
            action = '<button class="btn primary big" data-act="scavenge|' + loc.id + '">出发 · 搜刮这里</button>';
        } else if (st.occupied) {
            const mine = PlayerManager.combatPower(state);
            action = '<button class="btn danger big" data-act="reclaim|' + loc.id + '">' +
                '夺回这里（战力 ' + mine + ' vs 对方 ' + st.occupied.power + '）</button>';
        } else {
            action = '<button class="btn big" disabled>' +
                (st.disabled ? '已经被淹了' : (st.unlocked ? '暂时没东西了' : '还没探明')) + '</button>';
        }
        /* 抢钱：靠战力硬拿，钱来得快，但会记仇 */
        const robRow = '<div class="drawer-row' + (rob.ok ? '' : ' warn') + '">' +
            '<span class="drawer-label">抢钱</span><span>' +
                (rob.ok
                    ? '成功率 ' + Math.round(rob.odds * 100) + '%　大概能抢到 ' + Utils.fmtInt(rob.haul) + ' 现金（仇家 +' + ROB_RULES.heatOnSuccess + '）'
                    : G.esc(rob.reason)) +
            '</span></div>';
        const robBtn = rob.ok
            ? '<div class="drawer-actions"><button class="btn big danger" data-act="rob|' + loc.id + '">抢这里的钱</button></div>'
            : '';
        return '<div class="map-pop">' +
            '<div class="drawer-scene">' + Assets.sceneHtml(loc, 'scene-pic') +
                '<span class="scene-name">' + loc.icon + ' ' + G.esc(loc.name) + '</span>' +
                (region.name ? '<span class="scene-region">' + G.esc(region.name) + '</span>' : '') +
                (Assets.scene(loc.id) ? '' : '<span class="scene-missing">背景未归档</span>') +
            '</div>' +
            '<div class="drawer-head">' +
                '<div><div class="drawer-title">' + loc.icon + ' ' + G.esc(loc.name) + '</div>' +
                '<div class="drawer-sub">危险度 ' + dangerPct + '%　遭遇概率 ' + enc + '%　剩余 ' +
                    (st.unlocked ? st.left + '/' + st.max : '—') + '</div></div>' +
                '<button class="btn ghost small drawer-close" data-act="mapclose">✕</button>' +
            '</div>' +
            '<p class="drawer-desc">' + G.esc(loc.desc) + '</p>' +
            (st.occupied ? '<div class="occupy-box"><b>「' + G.esc(st.occupied.name) + '」占着这里</b>' +
                '<span>对方战力 ' + st.occupied.power + '　还有 ' + Utils.fmtCountdown(st.occupied.until - state.hours) +
                ' 他们会自己撤走，也可以现在就打回去。</span></div>' : '') +
            (CacheEngine.waiting(state, loc.id) ? '<div class="cache-box">📦 这里藏着一处「' +
                G.esc(CacheEngine.of(state, loc.id).kind.name) + '」，搬到手就算你的。</div>' : '') +
            '<div class="drawer-row"><span class="drawer-label">可能找到</span><span class="loot-chips">' + loot + '</span></div>' +
            '<div class="drawer-row"><span class="drawer-label">剩余次数</span><span>' +
                (st.unlocked ? (st.left + ' / ' + st.max + (st.left <= 0 ? '（' + Utils.fmtCountdown(st.refreshIn) + '后恢复）' : '')) : '—') +
            '</span></div>' +
            '<div class="drawer-row"><span class="drawer-label">出门耗时</span><span>' +
                (PhaseManager.id(state) === 'pre'
                    ? (loc.danger >= 0.4 ? ACTION_COSTS.scavengeFar : ACTION_COSTS.scavenge) + ' 小时（回合制，倒计时跟着走）'
                    : '时间会自己走，不影响倒计时') +
            '</span></div>' +
            (st.medCost ? '<div class="drawer-row warn"><span class="drawer-label">放射尘</span><span>每次需要药品 ×' + st.medCost + '</span></div>' : '') +
            robRow +
            (st.reason ? '<div class="drawer-row warn"><span class="drawer-label">状态</span><span>' + G.esc(st.reason) + '</span></div>' : '') +
            '<div class="drawer-actions">' + action + '</div>' +
            robBtn +
            (CacheEngine.waiting(state, loc.id)
                ? '<div class="drawer-actions"><button class="btn big" data-act="cacheopen|' + loc.id + '">去搬藏起来的东西</button></div>'
                : '') +
            '</div>';
    }

    /* 把弹窗内容同步到 #map-pop-root；没有选中或不在地图页就隐藏 */
    function syncPopup(state, activeTab) {
        const root = document.getElementById('map-pop-root');
        if (!root) return;
        if (!root.__bound) {
            root.__bound = true;
            /* 点弹窗外面的地方关掉它（和弹窗系统一致：只在点到背景时关） */
            root.addEventListener('click', e => {
                if (e.target === root) { close(); if (window.App) App.render(true); }
            });
        }
        const show = !!selectedId && (!activeTab || activeTab === 'map');
        G.setHTML(root, show ? popup(state) : '');
        if (show) root.classList.add('open');
        else root.classList.remove('open');
    }

    function legend(state) {
        const doom = DOOMS_CONFIG[state.doom] || {};
        return '<div class="map-legend">' +
            '<span class="lg"><i class="dot ready"></i>可搜刮</span>' +
            '<span class="lg"><i class="dot spent"></i>已掏空</span>' +
            '<span class="lg"><i class="dot locked"></i>浓雾未探明</span>' +
            '<span class="lg"><i class="dot dangerous"></i>高危区</span>' +
            (state.doom === 'flood' ? '<span class="lg"><i class="dot flooded"></i>已被淹没</span>' : '') +
            '<span class="lg doom">' + (doom.icon || '') + ' ' + (doom.name || '') + '：' +
                (doom.tagline || '') + '</span>' +
            '<span class="lg pan-hint">← 左右拖动看全城 →</span>' +
            '</div>';
    }

    function select(id) {
        selectedId = (selectedId === id) ? null : id;
        return selectedId;
    }
    function close() { selectedId = null; }
    function selected() { return selectedId; }
    /* 换一轮 / 换地图时把选中清掉 */
    function clearIfGone(state) {
        if (selectedId && !LOCATIONS_CONFIG.some(l => l.id === selectedId)) selectedId = null;
    }

    function render(state) {
        clearIfGone(state);
        return '<div class="map-wrap doom-' + state.doom + '">' +
            legend(state) + '<div class="map-scroll">' + mapSvg(state) + '</div>' +
            '<div class="map-tip-line">点地图上的地点看详情，弹窗里直接出发。</div>' +
            '</div>';
    }

    window.MapView = { render, select, close, selected, syncPopup, popup, WIDTH: W, HEIGHT: H };
})();
