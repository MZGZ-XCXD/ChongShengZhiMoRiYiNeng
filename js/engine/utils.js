/* 通用工具：数字 / 时间格式化、随机、数组 */
(function () {
    const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];

    function fmtNum(n, digits) {
        if (n === undefined || n === null || isNaN(n)) return '0';
        if (digits === undefined) digits = 1;
        const neg = n < 0;
        n = Math.abs(n);
        if (n < 1000) {
            let s;
            if (n >= 100) s = n.toFixed(0);
            else if (n >= 10) s = n.toFixed(Math.min(1, digits));
            else s = n.toFixed(Math.max(1, digits));
            if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
            return (neg ? '-' : '') + s;
        }
        const tier = Math.floor(Math.log10(n) / 3);
        if (tier >= UNITS.length) return (neg ? '-' : '') + n.toExponential(2).replace('e+', 'e');
        const scaled = n / Math.pow(1000, tier);
        const s = scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0);
        return (neg ? '-' : '') + s + UNITS[tier];
    }

    function fmtInt(n) { return Math.round(n).toLocaleString('zh-CN'); }

    function fmtRate(n, digits) {
        if (n === undefined || isNaN(n)) return '0';
        return (n < 0 ? '-' : '+') + fmtNum(Math.abs(n), digits === undefined ? 1 : digits);
    }

    function fmtPct(x, digits) {
        if (x === undefined || x === null || isNaN(x)) return '0%';
        const d = digits === undefined ? 0 : digits;
        return (x * 100).toFixed(d).replace(/\.0+$/, '') + '%';
    }

    /* 游戏内时间以「小时」为基本单位 */
    function fmtHours(h) {
        h = Math.max(0, h);
        if (h < 1) return Math.floor(h * 60) + ' 分';
        if (h < 24) {
            const m = Math.floor((h % 1) * 60);
            return Math.floor(h) + ' 小时' + (m > 0 ? ' ' + m + ' 分' : '');
        }
        const d = Math.floor(h / 24), hh = Math.floor(h % 24);
        return d + ' 天' + (hh > 0 ? ' ' + hh + ' 小时' : '');
    }

    /* 倒计时：固定两位小数感，短时间要看得见在动 */
    function fmtCountdown(h) {
        h = Math.max(0, h);
        if (h >= 24) {
            const d = Math.floor(h / 24), hh = Math.floor(h % 24);
            return d + ' 天 ' + hh + ' 小时';
        }
        if (h >= 1) {
            const hh = Math.floor(h), m = Math.floor((h % 1) * 60);
            return hh + ' 小时 ' + m + ' 分';
        }
        const m = Math.floor(h * 60), s = Math.floor((h * 60 % 1) * 60);
        return m + ' 分 ' + s + ' 秒';
    }

    function fmtClock(h) {
        const day = Math.floor(h / 24) + 1;
        const hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60);
        return '第 ' + day + ' 天 ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    }

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function rnd(a, b) {
        if (a === undefined) return Math.random();
        if (b === undefined) return Math.random() * a;
        return a + Math.random() * (b - a);
    }
    function rndInt(a, b) { return Math.floor(rnd(a, b + 1)); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }
    function weightedPick(items, weightFn) {
        let total = 0;
        for (const it of items) total += Math.max(0, weightFn(it));
        if (total <= 0) return null;
        let r = Math.random() * total;
        for (const it of items) {
            r -= Math.max(0, weightFn(it));
            if (r <= 0) return it;
        }
        return items[items.length - 1];
    }
    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    window.Utils = {
        fmtNum, fmtInt, fmtRate, fmtPct, fmtHours, fmtCountdown, fmtClock,
        clamp, rnd, rndInt, pick, shuffle, weightedPick, deepClone,
    };
})();
