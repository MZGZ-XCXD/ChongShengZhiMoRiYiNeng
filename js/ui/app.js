/* 界面装配：标签页、渲染循环、指针冻结、键盘与主题 */
(function () {
    const G = window.UI;

    const TABS = [
        { id: 'map', name: '地图', icon: '🗺️', render: () => TabMap.render() },
        { id: 'base', name: '据点', icon: '🏢', render: () => TabBase.render() },
        { id: 'defense', name: '防线', icon: '🛡️', render: () => TabDefense.render() },
        { id: 'bonds', name: '羁绊', icon: '🤝', render: () => TabBonds.render() },
        { id: 'ability', name: '异能', icon: '💠', render: () => TabAbility.render() },
        { id: 'rebirth', name: '重生', icon: '🔁', render: () => TabRebirth.render() },
        { id: 'achievements', name: '成就', icon: '🏆', render: () => TabAchievements.render() },
        { id: 'settings', name: '设置', icon: '⚙', render: () => TabSettings.render() },
    ];

    let activeTab = 'map';
    let tabBody = null;
    let pointerDown = false;
    let renderQueued = false;

    function badges() {
        const s = GameState;
        const out = {};
        let ready = 0;
        for (const st of ScavengeEngine.listStatus(s)) if (st.ok) ready++;
        out.map = ready;
        let build = 0;
        for (const st of BuildEngine.listFor(s)) if (st.can) build++;
        out.base = build;
        if (DefenseEngine.info(s).inWarning) out.defense = 1;
        let bond = 0;
        for (const c of BONDS_CONFIG) if (BondEngine.crossroadReady(s, c.id)) bond++;
        out.bonds = bond;
        let skill = 0;
        for (const id of SPACE_SKILL_ORDER) if (AbilityEngine.skillStatus(s, id).ready) skill++;
        if (AbilityEngine.canDraw(s).ok) skill++;
        out.ability = skill;
        out.rebirth = RebirthEngine.available(s) ? 1 : 0;
        return out;
    }

    function renderTabs() {
        const b = badges();
        let html = '';
        for (const t of TABS) {
            const n = b[t.id] || 0;
            html += '<div class="tab' + (activeTab === t.id ? ' active' : '') + '" data-act="tab|' + t.id + '">' +
                '<span>' + t.icon + '</span><span>' + t.name + '</span>' +
                (n ? '<span class="badge' + (t.id === 'rebirth' ? ' gold' : '') + '">' + n + '</span>' : '') + '</div>';
        }
        G.setHTML(document.getElementById('tabs'), html);
    }

    function render(force) {
        /* 按下鼠标期间冻结重绘：否则节点会在 mousedown 与 mouseup 之间被换掉，点击会丢 */
        if (pointerDown && !force) { renderQueued = true; return; }
        renderQueued = false;

        Panels.renderHeader();
        Panels.renderResources();
        Panels.renderAlert();
        Panels.renderEvent();
        Panels.renderLog();
        Panels.renderStats();
        renderTabs();

        const content = document.getElementById('tab-content');
        if (!tabBody || !content.contains(tabBody)) {
            content.innerHTML = '<div id="tab-body"></div>';
            tabBody = document.getElementById('tab-body');
        }
        const tab = TABS.find(t => t.id === activeTab) || TABS[0];
        activeTab = tab.id;
        G.setHTML(tabBody, tab.render());
        /* 地点弹窗单独挂在 body 上：不跟标签内容一起滚，不会被挤到屏幕外 */
        if (window.MapView && MapView.syncPopup) MapView.syncPopup(GameState, activeTab);
        Modals.render();
    }

    window.UI.render = render;

    function beginPointer() { pointerDown = true; }
    function endPointer() {
        if (!pointerDown) return;
        pointerDown = false;
        if (renderQueued) render(true);
    }
    document.addEventListener('pointerdown', e => { if (e.button === 0 || e.pointerType !== 'mouse') beginPointer(); }, true);
    window.addEventListener('pointerup', endPointer, true);
    window.addEventListener('pointercancel', endPointer, true);
    window.addEventListener('blur', endPointer);
    document.addEventListener('mouseleave', endPointer);

    function copyText(text, okMsg) {
        const ok = () => G.toast(okMsg || '已复制。', 'gold');
        const fallback = () => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.top = '-1000px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                ok();
            } catch (e) { G.toast('复制失败，请手动选中复制。', 'bad'); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
        else fallback();
    }

    document.addEventListener('click', e => {
        const node = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!node) return;
        const act = node.getAttribute('data-act');
        if (!act) return;
        if (node.tagName === 'INPUT' && node.type === 'checkbox') return;
        const parts = act.split('|');
        e.preventDefault();
        Acts.handle(parts[0], parts[1], parts[2]);
    });

    document.addEventListener('change', e => {
        const node = e.target;
        if (!node.getAttribute) return;
        if (node.type === 'checkbox' && node.getAttribute('data-act')) {
            Acts.handle(node.getAttribute('data-act'), null, null);
        }
    });

    function applyTheme() {
        /* 主题 class 放在 <html> 上：token 定义在 :root，body 才能正确解析自己用到的每个 token */
        document.documentElement.className = GameState.settings.theme === 'dark' ? 'dark-theme' : 'light-theme';
    }

    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const idx = Number(e.key);
        if (idx >= 1 && idx <= TABS.length) { activeTab = TABS[idx - 1].id; render(true); }
        if (e.key === ' ') { GameState.paused = !GameState.paused; e.preventDefault(); render(true); }
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) { SaveEngine.save(GameState); G.toast('已保存。'); e.preventDefault(); }
        if (e.key === 'Escape' && !GameState.pending) G.closeModal();
        if (e.key === 'Escape' && window.MapView && MapView.selected()) {
            MapView.close();
            render(true);
        }
    });

    G.setTipProvider(key => {
        if (key.indexOf('choice|') === 0) {
            const parts = key.split('|');
            return Acts.choiceTip(Acts.choiceOf(parts[1], parts[2]));
        }
        return Tips.tipHtml(key);
    });
    G.bindTips(document.body);

    window.App = {
        render, applyTheme, TABS, copyText,
        get activeTab() { return activeTab; },
        set activeTab(v) { activeTab = v; },
    };
})();
