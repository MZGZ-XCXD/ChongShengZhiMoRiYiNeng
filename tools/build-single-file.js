#!/usr/bin/env node
/**
 * 单文件版打包脚本
 *
 * 用法：node tools/build-single-file.js
 * 输出：dist/echoes-of-doom.html
 *
 * 作用：把 index.html 里引用的 css/style.css 与全部 js 内联成一个 HTML，
 *       生成可以直接双击运行、也方便分享的单文件版本。
 * 注意：改动 js/、css/ 或 index.html 之后必须重新跑一次本脚本，否则 dist 还是旧代码。
 */
const fs = require('fs');
const path = require('path');

/* 沙箱里跑的时候由 run.ps1 传进 PROJ_ROOT（见 tools/run.ps1 的说明） */
const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'index.html'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'echoes-of-doom.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const inlined = [];

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (match, file) => {
    inlined.push(file);
    return '<style>\n' + fs.readFileSync(path.join(ROOT, file), 'utf8') + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (match, file) => {
    inlined.push(file);
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return '<script>\n/* ===== ' + file + ' ===== */\n' + code + '\n</script>';
});

html = html.replace(
    '<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- 单文件版：由 tools/build-single-file.js 自动生成，请勿直接编辑本文件；\n' +
    '     改动请修改 index.html / css / js 后重新构建。 -->'
);

/* ---------- 把 assets/ 里的图内联成 data URI ----------
   单文件版要能独立分享，所以图片不能留在外面。
   只替换**被引号包起来**的路径（清单里就是 "assets/xxx.jpg" 这种字面量）——
   不能无脑替换整篇文本：文案里提到一次路径（比如更新日志写「基准图是 assets/portraits/baimanman.jpg」），
   那张图就会被整个塞进去第二遍、第三遍，单文件版白白胖胖好几百 KB。 */
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
let assetCount = 0;
let assetBytes = 0;
const assetProblems = [];
{
    const manifestPath = path.join(ROOT, 'js', 'config', 'assets.js');
    const paths = [];
    if (fs.existsSync(manifestPath)) {
        const src = fs.readFileSync(manifestPath, 'utf8');
        /* 生成出来的清单用的是双引号，手写的可能是单引号，两种都要认 */
        for (const m of src.matchAll(/["'](assets\/[^"']+)["']/g)) paths.push(m[1]);
    }
    const skipped = [];
    for (const rel of paths) {
        const full = path.join(ROOT, rel);
        if (!fs.existsSync(full)) { assetProblems.push(rel + '（清单里有、文件不在）'); continue; }
        const needles = ['"' + rel + '"', "'" + rel + "'"];
        const present = needles.filter(function (n) { return html.indexOf(n) >= 0; });
        if (present.length === 0) { assetProblems.push(rel + '（没有出现在页面里）'); continue; }
        const buf = fs.readFileSync(full);
        const mime = MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream';
        const uri = 'data:' + mime + ';base64,' + buf.toString('base64');
        let refs = 0;
        for (const n of present) {
            const quote = n.charAt(0);
            const parts = html.split(n);
            refs += parts.length - 1;
            html = parts.join(quote + uri + quote);
        }
        assetCount += 1;
        assetBytes += buf.length;
        if (refs > 1) skipped.push(rel + '（页面里被引用了 ' + refs + ' 处，图会被内联 ' + refs + ' 遍）');
        if (buf.length > 1.5 * 1024 * 1024) assetProblems.push(rel + '（超过 1.5 MB，建议压缩）');
    }
    for (const s of skipped) assetProblems.push(s);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const left = (html.match(/<script src=|<link rel="stylesheet"/g) || []).length;
console.log('已生成 ' + path.relative(ROOT, OUT).replace(/\\/g, '/') +
    '（' + (html.length / 1024).toFixed(0) + ' KB，内联 ' + inlined.length + ' 个文件）');
if (assetCount) {
    console.log('内联图片 ' + assetCount + ' 张（原始 ' + (assetBytes / 1024).toFixed(0) + ' KB）');
}
for (const p of assetProblems) console.warn('图片提醒：' + p);
if (html.length > 8 * 1024 * 1024) {
    console.warn('警告：单文件版已经 ' + (html.length / 1024 / 1024).toFixed(1) + ' MB，建议压缩图片或减少立绘尺寸。');
}
if (left > 0) {
    console.error('警告：仍有 ' + left + ' 个外部引用没有被内联。');
    process.exitCode = 1;
}
