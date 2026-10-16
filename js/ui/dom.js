/* 界面基础件：DOM 构造、浮窗、弹窗、轻量 DOM 补丁、数值文案 */
(function () {
    const U = window.Utils;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function h(html) {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    }

    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function num(n, digits) { return U.fmtNum(n, digits); }
    function hours(h) { return U.fmtHours(h); }
    function countdown(h) { return U.fmtCountdown(h); }
    function rateClass(n) { return n > 1e-9 ? 'pos' : (n < -1e-9 ? 'neg' : 'neu'); }

    /* ---------------- 浮窗（定位必须夹紧，绝不跑出屏幕） ---------------- */
    const tipEl = document.getElementById('tooltip');
    let tipProvider = null;

    function setTipProvider(fn) { tipProvider = fn; }

    function showTip(html, x, y) {
        if (tipEl.__html !== html) {
            tipEl.__html = html;
            tipEl.innerHTML = html;
        }
        tipEl.classList.add('show');
        const vv = window.visualViewport;
        const vw = Math.round(Math.min(window.innerWidth, vv && vv.width ? vv.width : Infinity));
        const vh = Math.round(Math.min(window.innerHeight, vv && vv.height ? vv.height : Infinity));
        const pad = 8;
        if (vh > 0) tipEl.style.maxHeight = Math.max(140, vh - pad * 2) + 'px';
        const rect = tipEl.getBoundingClientRect();
        let left = x + 16;
        let top = y + 16;
        if (left + rect.width > vw - pad) left = x - rect.width - 12;
        if (top + rect.height > vh - pad) top = y - rect.height - 12;
        left = Math.min(Math.max(pad, left), Math.max(pad, vw - rect.width - pad));
        top = Math.min(Math.max(pad, top), Math.max(pad, vh - rect.height - pad));
        tipEl.style.left = left + 'px';
        tipEl.style.top = top + 'px';
    }

    function hideTip() { tipEl.classList.remove('show'); }

    function bindTips(root) {
        let touchStart = null;
        let touchTip = false;

        root.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY };
        }, true);

        root.addEventListener('pointerup', e => {
            if (e.pointerType !== 'touch') return;
            const moved = touchStart && (Math.abs(e.clientX - touchStart.x) + Math.abs(e.clientY - touchStart.y) > 12);
            touchStart = null;
            if (moved) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (!target || !tipProvider) { hideTip(); tipEl._target = null; touchTip = false; return; }
            const html = tipProvider(target.getAttribute('data-tip'));
            if (!html) return;
            tipEl._target = target;
            touchTip = true;
            showTip(html, e.clientX, e.clientY);
            clearTimeout(tipEl._touchTimer);
            tipEl._touchTimer = setTimeout(() => { hideTip(); tipEl._target = null; touchTip = false; }, 5200);
        }, true);

        root.addEventListener('mouseover', e => {
            if (touchTip) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (!target || !tipProvider) return;
            const html = tipProvider(target.getAttribute('data-tip'));
            if (!html) return;
            tipEl._target = target;
            showTip(html, e.clientX, e.clientY);
        });
        root.addEventListener('mousemove', e => {
            if (touchTip) return;
            if (!tipEl.classList.contains('show') || !tipEl._target) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (target !== tipEl._target) { hideTip(); tipEl._target = null; return; }
            showTip(tipEl.__html || '', e.clientX, e.clientY);
        });
        root.addEventListener('mouseout', e => {
            if (touchTip) return;
            const target = e.target.closest ? e.target.closest('[data-tip]') : null;
            if (target && target === tipEl._target) { hideTip(); tipEl._target = null; }
        });
    }

    /* ---------------- 提示条 ---------------- */
    const toastRoot = document.getElementById('toast-root');
    function toast(msg, type) {
        const node = h('<div class="toast ' + (type || '') + '">' + esc(msg) + '</div>');
        toastRoot.appendChild(node);
        setTimeout(() => { node.style.transition = 'opacity .4s'; node.style.opacity = '0'; }, 2600);
        setTimeout(() => node.remove(), 3100);
        while (toastRoot.children.length > 4) toastRoot.firstElementChild.remove();
    }

    /* ---------------- 弹窗 ---------------- */
    const modalRoot = document.getElementById('modal-root');

    function openModal(html, opts) {
        opts = opts || {};
        const wrap = h('<div class="modal' + (opts.wide ? ' wide' : '') + '">' + html + '</div>');
        modalRoot.innerHTML = '';
        modalRoot.appendChild(wrap);
        modalRoot.classList.add('open');
        modalRoot._closable = opts.closable !== false;
        return wrap;
    }

    function closeModal() {
        modalRoot.classList.remove('open');
        modalRoot.innerHTML = '';
    }

    function confirmBox(title, text, onOk, okLabel) {
        const wrap = openModal(
            '<h2>' + esc(title) + '</h2><p>' + text + '</p>' +
            '<div class="modal-actions"><button class="btn" data-modal-act="cancel">取消</button>' +
            '<button class="btn danger" data-modal-act="ok">' + esc(okLabel || '确定') + '</button></div>'
        );
        wrap.addEventListener('click', e => {
            const act = e.target.getAttribute && e.target.getAttribute('data-modal-act');
            if (act === 'cancel') closeModal();
            if (act === 'ok') { closeModal(); onOk(); }
        });
    }

    modalRoot.addEventListener('click', e => {
        if (e.target === modalRoot && modalRoot._closable !== false) closeModal();
    });

    /* ---------------- 进度条 ---------------- */
    function bar(pct, cls) {
        return '<div class="bar ' + (cls || '') + '"><i style="width:' + U.clamp(pct * 100, 0, 100).toFixed(1) + '%"></i></div>';
    }

    /* ---------------------------------------------------------
       轻量 DOM 补丁：只改动变化的部分，复用已有节点。
       这样 hover 不会被打断（按钮不闪）、按下与松开之间节点不被换掉（点击不丢）。
       --------------------------------------------------------- */
    function syncAttrs(oldEl, newEl) {
        const oa = oldEl.attributes;
        for (let i = oa.length - 1; i >= 0; i--) {
            const name = oa[i].name;
            if (!newEl.hasAttribute(name)) oldEl.removeAttribute(name);
        }
        const na = newEl.attributes;
        for (let i = 0; i < na.length; i++) {
            const a = na[i];
            if (oldEl.getAttribute(a.name) !== a.value) oldEl.setAttribute(a.name, a.value);
        }
    }

    function syncChildren(oldParent, newParent) {
        const olds = Array.prototype.slice.call(oldParent.childNodes);
        const news = Array.prototype.slice.call(newParent.childNodes);
        for (let i = 0; i < news.length; i++) {
            const n = news[i];
            const o = olds[i];
            if (!o) { oldParent.appendChild(n.cloneNode(true)); continue; }
            if (o.nodeType !== n.nodeType) { oldParent.replaceChild(n.cloneNode(true), o); continue; }
            if (n.nodeType === 3) {
                if (o.data !== n.data) o.data = n.data;
                continue;
            }
            if (n.nodeType === 8) continue;
            if (o.tagName !== n.tagName) { oldParent.replaceChild(n.cloneNode(true), o); continue; }
            /* 复用的节点要清掉文本缓存，否则补丁过的节点会「数字凭空消失」 */
            o.__lastText = undefined;
            syncAttrs(o, n);
            syncChildren(o, n);
        }
        for (let i = news.length; i < olds.length; i++) {
            if (olds[i].parentNode === oldParent) oldParent.removeChild(olds[i]);
        }
    }

    function patchDOM(node, html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        syncChildren(node, tpl.content);
    }

    function setHTML(node, html) {
        if (!node) return false;
        if (node.__lastHTML === html) return false;
        const first = !node.__lastHTML;
        node.__lastHTML = html;
        if (first && !node.firstChild) node.innerHTML = html;
        else patchDOM(node, html);
        return true;
    }

    function setText(node, text) {
        if (!node) return false;
        if (node.__lastText === text) return false;
        node.__lastText = text;
        node.textContent = text;
        return true;
    }

    /* ---------------- 造价 / 消耗文本 ---------------- */
    function costHtml(cost, opts) {
        opts = opts || {};
        const parts = [];
        for (const k in cost) {
            const have = ResourcesManager.amount(k);
            const lack = have + 1e-6 < cost[k];
            const cfg = RESOURCES_CONFIG[k] || {};
            const room = ResourcesManager.room(GameState, k);
            const spaceIssue = !opts.ignoreSpace && room !== Infinity && room < cost[k];
            parts.push('<span class="' + (lack ? 'lack' : '') + '" data-tip="res|' + esc(k) + '">' +
                (cfg.icon || '') + ' ' + esc(k) + ' ' + num(cost[k]) + (spaceIssue ? ' ⚠空间' : '') + '</span>');
        }
        return parts.join(' ') || '<span class="free">免费</span>';
    }

    /* ---------------- 效果文本：数值 → 文案只在这里实现 ---------------- */
    function effectValueText(key, v) {
        const meta = EffectsManager.EFFECT_META[key];
        const fmt = meta ? meta.fmt : 'flat';
        if (fmt === 'pct') return U.fmtPct(v, v === Math.round(v) ? 0 : 1).replace('0%', '0%');
        if (fmt === 'hours') return (v > 0 ? '+' : '') + v + ' 小时';
        if (fmt === 'hourly') return (v > 0 ? '+' : '') + v + ' / 小时';
        return (v > 0 ? '+' : '') + U.fmtNum(v);
    }

    function effectLines(eff) {
        const out = [];
        for (const key in eff) {
            const v = eff[key];
            if (key === 'special') {
                out.push(EffectsManager.SPECIAL_LABELS[v] || v);
                continue;
            }
            if (key === 'resourceProd') {
                for (const r in v) out.push(r + ' 产出 ' + U.fmtPct(v[r], 0));
                continue;
            }
            if (FACILITIES_CONFIG[key] && typeof v === 'object') {
                const bits = [];
                if (typeof v.prod === 'number') bits.push('产出 ' + U.fmtPct(v.prod, 0));
                if (typeof v.def === 'number') bits.push('防御 ' + U.fmtPct(v.def, 0));
                if (typeof v.cap === 'number') bits.push('容量 ' + U.fmtPct(v.cap, 0));
                out.push('「' + FACILITIES_CONFIG[key].name + '」' + bits.join('，'));
                continue;
            }
            const meta = EffectsManager.EFFECT_META[key];
            const label = meta ? meta.label : key;
            out.push(label + ' ' + effectValueText(key, v));
        }
        return out;
    }

    function effectTextInline(eff, sep) {
        return effectLines(eff).join(sep || '　');
    }

    window.UI = window.UI || {};
    Object.assign(window.UI, {
        $, $$, h, esc, num, hours, countdown, rateClass, bar,
        setHTML, setText, costHtml, effectLines, effectTextInline, effectValueText,
        setTipProvider, bindTips, showTip, hideTip, toast, openModal, closeModal, confirmBox,
    });
})();
