#!/usr/bin/env node
/**
 * 由 CHANGELOG.md 生成 js/config/changelog.js（游戏内「设置 → 更新日志」用）
 *
 * 用法：node tools/gen-changelog.js
 * 说明：CHANGELOG.md 是唯一数据源；游戏里读的是生成出来的那份数据，不要在游戏里另写一份。
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'CHANGELOG.md'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'CHANGELOG.md');
const OUT = path.join(ROOT, 'js', 'config', 'changelog.js');

const md = fs.readFileSync(SRC, 'utf8');
const lines = md.split(/\r?\n/);

/* 很轻量的 markdown 处理：链接取文字、**加粗**、`代码`；先转义再加标签 */
function inline(s) {
    let t = String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t.trim();
}

/* ---------- 版本历史总览表 ---------- */
const overview = [];
{
    let i = lines.findIndex(l => /^##\s+版本历史总览/.test(l));
    if (i >= 0) {
        for (; i < lines.length; i++) {
            const l = lines[i];
            if (/^##\s/.test(l) && !/版本历史总览/.test(l)) break;
            if (!/^\|/.test(l)) continue;
            const cells = l.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.length < 3) continue;
            const version = cells[0].replace(/\*/g, '');
            if (!/^v?\d+\.\d+\.\d+$/.test(version)) continue;
            overview.push({
                version: version,
                date: cells[1],
                summary: inline(cells[cells.length - 1]),
            });
        }
    }
}

/* ---------- 各版本明细 ---------- */
const versions = [];
{
    let cur = null, section = null;
    for (const raw of lines) {
        const l = raw.replace(/\s+$/, '');
        if (/^##\s+\[?[^\]]*未发布/.test(l)) { cur = null; section = null; continue; }
        const vh = /^##\s+\[([^\]]+)\]\s*[-–—]\s*(\S+)/.exec(l);
        if (vh) {
            cur = { version: vh[1], date: vh[2], sections: [] };
            versions.push(cur);
            section = null;
            continue;
        }
        if (/^##\s/.test(l)) { cur = null; section = null; continue; }
        if (!cur) continue;
        const sh = /^###\s+(.+)$/.exec(l);
        if (sh) {
            section = { title: sh[1].trim(), items: [] };
            cur.sections.push(section);
            continue;
        }
        if (!section) continue;
        const item = /^\*\s+(.*)$/.exec(l);
        if (item) { section.items.push(inline(item[1])); continue; }
        if (/^\s+\S/.test(raw) && section.items.length) {
            section.items[section.items.length - 1] += ' ' + inline(l);
        }
    }
}

const data = {
    source: 'CHANGELOG.md',
    currentVersion: versions.length ? versions[0].version : '0.0.0',
    overview: overview,
    versions: versions,
};
const js = '/* 由 tools/gen-changelog.js 自动生成，请勿直接编辑；改动请写 CHANGELOG.md 后重新生成。 */\n' +
    'window.CHANGELOG_DATA = ' + JSON.stringify(data, null, 4).replace(/<\//g, '<\\/') + ';\n';

fs.writeFileSync(OUT, js);
console.log('已生成 ' + path.relative(ROOT, OUT).replace(/\\/g, '/') +
    '（当前版本 ' + data.currentVersion + '，总览 ' + overview.length + ' 条，版本明细 ' +
    versions.length + ' 个，' + (js.length / 1024).toFixed(0) + ' KB）');
