/*
 * 「清除存档」的真实路径自检：造一份中期存档 → 走真正的 SaveEngine.hardReset()
 * （它会 location.reload）→ 刷新后检查是不是真的回到了最开始、序章浮窗有没有弹出来。
 *
 * 为什么不放进 tools/driver.js：driver 是在同一个页面里跑断言的，而这里必须真的重载一次，
 * 因为重载会触发 beforeunload，那里藏着一个「清完档又被自动保存写回来」的坑。
 */
(function () {
    const R = { pass: 0, fail: 0, log: [] };
    function check(name, cond, extra) {
        if (cond) { R.pass++; R.log.push('PASS  ' + name + (extra !== undefined ? '   [' + extra + ']' : '')); }
        else { R.fail++; R.log.push('FAIL  ' + name + (extra !== undefined ? '   [' + extra + ']' : '')); }
    }
    function flush() {
        const el = document.getElementById('report');
        if (el) el.textContent = R.log.join('\n');
        document.title = 'DONE ' + R.pass + '/' + R.fail;
    }
    let phase = '0';
    try { phase = sessionStorage.getItem('doom-e2e-phase') || '0'; } catch (e) { /* 忽略 */ }
    /* #prefixbug：把清档的守卫拆掉，用来验证这条自检真的能抓到「清完档又长回来」的问题 */
    if (location.hash === '#prefixbug') window.__DOOM_TEST_IGNORE_SUSPEND = true;

    if (phase === '0') {
        setTimeout(function () {
            try {
                localStorage.clear();
                sessionStorage.setItem('doom-e2e-phase', '1');
                /* 造一份「已经玩到中期」的存档 */
                GameState.hours = 200;
                GameState.space.level = 6;
                StoryEngine.present(GameState, 'prologue');
                GameState.pending = null;
                if (!SaveEngine.save(GameState)) {
                    R.fail++; R.log.push('FAIL  造档失败（localStorage 不可用）'); flush(); return;
                }
                /* 玩家真正点的那条路：清档 → 立刻重载。
                   重载会触发 beforeunload 里的自动保存，这一步就是被测对象。 */
                SaveEngine.hardReset();
            } catch (e) {
                R.fail++; R.log.push('FAIL  准备阶段抛错：' + e.message); flush();
            }
        }, 300);
        return;
    }

    /* ---- 刷新之后的第二屏 ---- */
    setTimeout(function () {
        try { sessionStorage.setItem('doom-e2e-phase', 'done'); } catch (e) { /* 忽略 */ }
        check('刷新后读不到旧存档（自动保存没有把旧档写回来）', SaveEngine.hasSave() === false);
        check('刷新后回到最开始：序章浮窗弹出来了',
            !!GameState.pending && GameState.pending.type === 'story' && GameState.pending.id === 'prologue',
            JSON.stringify(GameState.pending));
        check('进度也归零了', GameState.hours < 1 && GameState.space.level === 1,
            GameState.hours.toFixed(2) + ' 小时 / 空间 Lv' + GameState.space.level);
        check('序章浮窗确实画在界面上', !!document.querySelector('#modal-root .modal h2'));
        check('「刚清过档」的标记用过就清掉', (function () {
            try { return sessionStorage.getItem('echoes-of-doom-just-reset') === null; } catch (e) { return true; }
        })());
        flush();
    }, 500);
})();
