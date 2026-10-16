/* 立绘与背景图：查清单 → 有图用 <img>，没图画「档案占位框」。
   清单由 tools/gen-asset-manifest.js 扫 assets/ 生成，图片路径写死在
   js/config/assets.js 里（单文件版构建靠这个把图内联成 data URI）。 */
(function () {
    const G = window.UI;

    function manifest() { return window.ASSET_MANIFEST || { portraits: {}, scenes: {}, dooms: {} }; }

    function portrait(id) {
        const m = manifest().portraits || {};
        return m[id] || null;
    }
    function scene(id) {
        const m = manifest().scenes || {};
        return m[id] || null;
    }
    function doom(id) {
        const m = manifest().dooms || {};
        return m[id] || null;
    }
    function count() {
        const m = manifest();
        return {
            portraits: Object.keys(m.portraits || {}).length,
            scenes: Object.keys(m.scenes || {}).length,
            dooms: Object.keys(m.dooms || {}).length,
        };
    }

    /* 同一个 id 每次都得到同样的色调：没有真图的时候也不会看起来乱 */
    function hash(str) {
        let h = 2166136261;
        for (let i = 0; i < String(str).length; i++) {
            h ^= String(str).charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return Math.abs(h);
    }
    function hue(id) { return hash(id) % 360; }

    /* 立绘占位：一张「档案照」——人形剪影 + 编号，明确是空位而不是画坏了 */
    function portraitPlaceholder(cfg, opts) {
        opts = opts || {};
        const h = hue(cfg.id);
        const big = opts.size === 'large';
        const w = big ? 300 : 96, hh = big ? 380 : 120;
        const num = String(hash(cfg.id)).slice(0, 4);
        return '<svg class="ph ph-portrait" viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="xMidYMid slice">' +
            '<defs><linearGradient id="pg' + cfg.id + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%" stop-color="hsl(' + h + ',14%,20%)"/>' +
                '<stop offset="100%" stop-color="hsl(' + ((h + 40) % 360) + ',16%,9%)"/>' +
            '</linearGradient></defs>' +
            '<rect width="' + w + '" height="' + hh + '" fill="url(#pg' + cfg.id + ')"/>' +
            '<g fill="hsl(' + h + ',18%,34%)">' +
                '<circle cx="' + (w / 2) + '" cy="' + (hh * 0.36) + '" r="' + (w * 0.16) + '"/>' +
                '<path d="M ' + (w * 0.20) + ' ' + hh + ' q ' + (w * 0.30) + ' -' + (hh * 0.34) + ' ' + (w * 0.60) + ' 0 z"/>' +
            '</g>' +
            (big ? '<text x="' + (w / 2) + '" y="' + (hh - 34) + '" text-anchor="middle" fill="rgba(255,255,255,.5)"' +
                ' font-size="15" font-family="monospace">立绘未归档 · NO.' + num + '</text>' : '') +
            '</svg>';
    }

    /* 地点背景占位：一条街的剪影 + 地点名，同样是「照片还没归档」 */
    function scenePlaceholder(loc) {
        const h = hue(loc.id);
        return '<svg class="ph ph-scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">' +
            '<defs><linearGradient id="sg' + loc.id + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%" stop-color="hsl(' + h + ',12%,16%)"/>' +
                '<stop offset="100%" stop-color="hsl(' + ((h + 30) % 360) + ',14%,7%)"/>' +
            '</linearGradient></defs>' +
            '<rect width="320" height="180" fill="url(#sg' + loc.id + ')"/>' +
            '<g fill="hsl(' + h + ',10%,22%)">' +
                '<rect x="10" y="86" width="52" height="94"/><rect x="70" y="62" width="40" height="118"/>' +
                '<rect x="118" y="104" width="58" height="76"/><rect x="184" y="76" width="46" height="104"/>' +
                '<rect x="238" y="94" width="66" height="86"/>' +
            '</g>' +
            '<rect y="150" width="320" height="30" fill="hsl(' + h + ',8%,13%)"/>' +
            '</svg>';
    }

    /* 有图就出图，没图就出占位 */
    function portraitHtml(cfg, cls, size) {
        const src = portrait(cfg.id);
        if (src) return '<img class="' + cls + '" src="' + src + '" alt="' + G.esc(cfg.name) + '" loading="lazy" draggable="false">';
        return '<div class="' + cls + ' is-ph" title="把立绘放到 assets/portraits/' + cfg.id + '.png 就会出现在这里">' +
            portraitPlaceholder(cfg, { size: size }) + '</div>';
    }
    function sceneHtml(loc, cls) {
        const src = scene(loc.id);
        if (src) return '<img class="' + cls + '" src="' + src + '" alt="' + G.esc(loc.name) + '" loading="lazy" draggable="false">';
        return '<div class="' + cls + ' is-ph" title="把背景图放到 assets/scenes/' + loc.id + '.jpg 就会出现在这里">' +
            scenePlaceholder(loc) + '</div>';
    }

    window.Assets = { manifest, portrait, scene, doom, count, portraitHtml, sceneHtml, hue };
})();
