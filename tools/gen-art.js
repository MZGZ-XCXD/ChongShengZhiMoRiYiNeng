/*
 * 批量出图：按 tools/art-spec.js 里的清单逐张生成，自动存到 assets/ 下正确的文件名。
 *
 * 用法（在项目目录下）：
 *   tools\run.ps1 tools\gen-art.js --dry-run                先不花钱，用占位图把整条管线验一遍
 *   tools\run.ps1 tools\gen-art.js --provider gemini        真出图（需要先设好 GEMINI_API_KEY）
 *   tools\run.ps1 tools\gen-art.js --only wangyi,market     只做指定的几张
 *   tools\run.ps1 tools\gen-art.js --kind scenes            只做某一类（portraits / scenes / dooms）
 *   tools\run.ps1 tools\gen-art.js --dump                   把提示词导出成 tools/art-prompts.md
 *
 * 约定：
 *   · API Key 只从环境变量读（GEMINI_API_KEY），不接受命令行参数 —— 免得留在命令历史里。
 *   · 已经存在的图默认跳过，所以中断之后重跑即可续上；要重画加 --force。
 *   · 出完图还要跑一次 tools\gen-asset-manifest.js 与 tools\build-single-file.js（脚本末尾会提醒）。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const net = require('net');
const { spawnSync } = require('child_process');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'js', 'config'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');

/* 沙箱里 require 本地文件会撞上 realpath 限制（EPERM），所以同目录模块用 fs + vm 自己加载 */
function loadLocal(rel) {
    const p = path.join(__dirname, rel);
    const src = fs.readFileSync(p, 'utf8');
    const wrapped = '(function (module, exports, require, __filename, __dirname) {\n' + src + '\n})';
    const fn = vm.runInThisContext(wrapped, { filename: rel });
    const mod = { exports: {} };
    fn(mod, mod.exports, require, p, path.dirname(p));
    return mod.exports;
}
const spec = loadLocal('art-spec.js');
const { solidPng } = loadLocal('png-stub.js');

/* ---------------- 命令行 ---------------- */
const argv = process.argv.slice(2);
function arg(name, def) {
    const i = argv.indexOf('--' + name);
    if (i < 0) return def;
    const next = argv[i + 1];
    return (next === undefined || next.indexOf('--') === 0) ? true : next;
}
const OPTS = {
    provider: String(arg('provider', 'gemini')),
    model: String(arg('model', '')),
    kind: arg('kind', null),
    only: arg('only', null),
    dryRun: !!arg('dry-run', false),
    force: !!arg('force', false),
    dump: !!arg('dump', false),
    listModels: !!arg('list-models', false),
    sleep: Number(arg('sleep', 1500)) || 1500,
};
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

/* ---------------- 走不走代理 ----------------
   Google 的接口在国内直连不通（DNS 都被劫持），而 Node 的 fetch 不认 HTTPS_PROXY。
   所以：给了代理就用 curl.exe 发请求（它原生支持代理），没给就用 fetch 直连。 */
function tcpOpen(port, host) {
    return new Promise(resolve => {
        const sock = net.connect({ port: port, host: host || '127.0.0.1' });
        const done = ok => { sock.destroy(); resolve(ok); };
        sock.setTimeout(250);
        sock.on('connect', () => done(true));
        sock.on('timeout', () => done(false));
        sock.on('error', () => done(false));
    });
}

async function resolveProxy() {
    const explicit = String(arg('proxy', '')) || process.env.GEMINI_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
    if (explicit) return explicit;
    /* 没显式指定就找一下常见的本地代理端口（Clash Verge 7897 / Clash 7890 / v2ray 10809） */
    for (const p of [7897, 7890, 10809, 10808, 7899]) {
        if (await tcpOpen(p)) return 'http://127.0.0.1:' + p;
    }
    return '';
}

function asciiJson(obj) {
    return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, c =>
        '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/* 用 curl 发 POST（带代理时走这条路），返回 { status, text } */
function curlPost(url, body, proxy) {
    const tmpDir = path.join(ROOT, 'work');
    fs.mkdirSync(tmpDir, { recursive: true });
    const bodyPath = path.join(tmpDir, 'gen-art-request.json');
    const outPath = path.join(tmpDir, 'gen-art-response.json');
    fs.writeFileSync(bodyPath, asciiJson(body));
    const args = ['-s', '-S', '--max-time', '300', '-o', outPath, '-w', '%{http_code}',
        '-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@' + bodyPath];
    if (proxy) args.unshift('-x', proxy);
    args.push(url);
    const r = spawnSync(process.env.CURL || 'curl.exe', args, { encoding: 'utf8', windowsHide: true });
    if (r.error) throw new Error('curl 调用失败：' + r.error.message);
    const status = Number(String(r.stdout || '').trim()) || 0;
    let text = '';
    try { text = fs.readFileSync(outPath, 'utf8'); } catch (e) { text = ''; }
    if (!status) throw new Error('连不上（curl 退出码 ' + r.status + '）：' + String(r.stderr || '').slice(0, 200));
    return { status: status, text: text };
}

/* 用 curl 发 GET（列模型用） */
function curlGet(url, proxy) {
    const tmpDir = path.join(ROOT, 'work');
    fs.mkdirSync(tmpDir, { recursive: true });
    const outPath = path.join(tmpDir, 'gen-art-models.json');
    const args = ['-s', '-S', '--max-time', '60', '-o', outPath, '-w', '%{http_code}'];
    if (proxy) args.unshift('-x', proxy);
    args.push(url);
    const r = spawnSync(process.env.CURL || 'curl.exe', args, { encoding: 'utf8', windowsHide: true });
    if (r.error) throw new Error('curl 调用失败：' + r.error.message);
    const status = Number(String(r.stdout || '').trim()) || 0;
    let text = '';
    try { text = fs.readFileSync(outPath, 'utf8'); } catch (e) { text = ''; }
    if (!status) throw new Error('连不上（curl 退出码 ' + r.status + '）：' + String(r.stderr || '').slice(0, 200));
    return { status: status, text: text };
}

async function httpPost(url, body, proxy) {
    if (proxy) return curlPost(url, body, proxy);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 240000);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        });
        return { status: res.status, text: await res.text() };
    } finally {
        clearTimeout(timer);
    }
}

/* ---------------- 提示词导出 ---------------- */
/* ---------------- 先查一下 key 能用哪些模型（不花钱） ---------------- */
if (OPTS.listModels) {
    (async function () {
        const info = apiKeyInfo();
        if (!info.key) {
            console.error('没有找到 API Key：请设置环境变量 GEMINI_API_KEY，或把 key 写到 work/gemini.key（一行）。');
            process.exit(1);
        }
        console.log('Key 来源：' + info.from);
        const proxy = await resolveProxy();
        console.log('网络：' + (proxy ? ('走代理 ' + proxy) : '直连'));
        /* 这段在 BASE 定义之前执行（const 有暂时性死区），所以自己拼一个地址 */
        const base = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
        const url = base + '/models?pageSize=200&key=' + encodeURIComponent(info.key);
        let res, text;
        try {
            res = await curlGet(url, proxy);
            text = res.text;
        } catch (e) {
            console.error('请求失败：' + e.message + '（沙箱里需要先给网络权限）');
            process.exit(1);
        }
        if (res.status !== 200) {
            console.error('HTTP ' + res.status + '：' + text.slice(0, 300));
            process.exit(1);
        }
        let json = {};
        try { json = JSON.parse(text); } catch (e) { /* 忽略 */ }
        const list = (json.models || []).map(m => m.name.replace(/^models\//, ''));
        const image = list.filter(n => /image|imagen/i.test(n));
        console.log('模型总数 ' + list.length + '，其中名字像出图的 ' + image.length + ' 个：');
        image.forEach(n => console.log('  ' + n));
        if (!image.length) {
            console.log('（没找到名字像出图的模型，可以先把上面的完整列表发我，我来挑）');
            list.slice(0, 40).forEach(n => console.log('  ' + n));
        }
        console.log('');
        console.log('默认用 gemini-2.5-flash-image；换别的加 --model <名字>。');
    })();
    return;
}

if (OPTS.dump) {
    const groups = { portraits: [], scenes: [], dooms: [] };
    for (const item of spec.all()) groups[item.kind].push(item);
    let md = '# 出图提示词清单\n\n' +
        '由 `tools/gen-art.js --dump` 生成。可以直接复制去任何出图工具，' +
        '画风段是固定的，只换「主体」那一行就不会跑偏。\n\n' +
        '文件名必须按 id 命名，放在对应目录下（见 assets/README.md）。\n\n';
    md += '## 用法建议\n\n' +
        '1. 画风基准图是 `assets/portraits/baimanman.jpg`（白小满）。**每张都把它当参考图一起传上去**，' +
        '风格最稳；没有参考图功能时，至少保证同一个出图工具、同一个风格词。\n' +
        '   注意：参考图只该锁「画风 / 质感 / 打光」，姿势要按每条提示词里的「动作」那一行 —— ' +
        '否则 17 张立绘会连白小满抬手凝冰锥的动作一起抄，变成同一个姿势。\n' +
        '2. 风格关键词：电影级半写实 CG 角色渲染（3A 游戏画面质感）—— 次表面散射、虹膜纹理、' +
        '逆光发丝光晕、侧逆光窗光加浮尘、浅景深；清晰锐利、笔触干净、有画意。' +
        '**不要厚涂、不要油画笔触、不要柔焦糊脸、不要磨皮成塑料，也不要纪实摄影那种「平光拍真人」的素人感。**\n' +
        '   可以有网感（五官精致、眼尾略上挑、妆面干净显气色）；陶陶 18 岁，仍不做美艳处理。\n' +
        '   每位角色都有一条独立的「发型」和「机位与光线」——出图时别让两张的剪影和镜头语言重复。\n' +
        '3. 每次改完提示词，跑 `tools\\run.ps1 tools\\gen-asset-manifest.js` 再跑 `tools\\run.ps1 tools\\build-single-file.js`，' +
        '图片才会进 dist 单文件版。\n\n';
    const titles = { portraits: '羁绊立绘（3:4，768×1024）', scenes: '地点背景（16:9，1280×720）', dooms: '末日氛围图（16:9）' };
    for (const kind of ['portraits', 'scenes', 'dooms']) {
        md += '## ' + titles[kind] + '\n\n';
        for (const item of groups[kind]) {
            md += '### ' + item.id + ' → ' + item.path + '\n\n```text\n' + item.prompt + '\n```\n\n';
        }
    }
    const out = path.join(ROOT, 'tools', 'art-prompts.md');
    fs.writeFileSync(out, md);
    console.log('已导出 ' + path.relative(ROOT, out).replace(/\\/g, '/') + '（' + spec.all().length + ' 条）');
    process.exit(0);
}

/* ---------------- 选片 ---------------- */
let items = spec.all();
if (OPTS.kind) items = items.filter(i => i.kind === OPTS.kind);
if (OPTS.only) {
    /* PowerShell 会把 a,b 拆成数组再拼成空格分隔，所以逗号和空格都当分隔符 */
    const wanted = String(OPTS.only).split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    items = items.filter(i => wanted.indexOf(i.id) >= 0);
}
if (!items.length) {
    console.error('没有匹配的条目。可用的 id 见 tools/art-prompts.md');
    console.error('（解析到的参数：' + JSON.stringify(OPTS) + '；完整清单 ' + spec.all().length + ' 条）');
    process.exit(2);
}

function existingFor(id, kind) {
    const dir = path.join(ROOT, 'assets', kind);
    if (!fs.existsSync(dir)) return null;
    for (const ext of EXTS) {
        const p = path.join(dir, id + ext);
        if (fs.existsSync(p)) return p;
    }
    return null;
}
function extOf(buf) {
    if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return '.png';
    if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8) return '.jpg';
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
    return '.png';
}

/* ---------------- 模型调用 ---------------- */
const BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/* Key 两个来源：环境变量 GEMINI_API_KEY，或本地文件 work/gemini.key（一行）。
   两条路都不需要把 key 写进命令行或聊天里；work/ 不参与打包，不会被塞进 dist。 */
function apiKeyInfo() {
    const envKey = (process.env.GEMINI_API_KEY || '').trim();
    if (envKey) return { key: envKey, from: '环境变量 GEMINI_API_KEY' };
    const file = path.join(ROOT, 'work', 'gemini.key');
    if (fs.existsSync(file)) {
        const k = fs.readFileSync(file, 'utf8').trim();
        if (k) return { key: k, from: 'work/gemini.key' };
    }
    return { key: '', from: '' };
}

async function callGemini(model, prompt, aspect, proxy) {
    const info = apiKeyInfo();
    if (!info.key) {
        const e = new Error('没有找到 API Key：请设置环境变量 GEMINI_API_KEY，或把 key 写到 work/gemini.key（一行）。');
        e.fatal = true;
        throw e;
    }
    const isImagen = /^imagen/i.test(model);
    const url = BASE + '/models/' + model + ':' + (isImagen ? 'predict' : 'generateContent') + '?key=' + encodeURIComponent(info.key);
    const body = isImagen
        ? { instances: [{ prompt: prompt }], parameters: { sampleCount: 1, aspectRatio: aspect } }
        : { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };

    const res = await httpPost(url, body, proxy);
    const text = res.text;
    if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status + '：' + text.slice(0, 300));
    let json;
    try { json = JSON.parse(text); }
    catch (e) { throw new Error('返回的不是 JSON：' + text.slice(0, 200)); }

    const b64 = isImagen
        ? (json.predictions && json.predictions[0] && json.predictions[0].bytesBase64Encoded)
        : findInlineImage(json);
    if (!b64) {
        throw new Error('返回里没有图片数据：' + JSON.stringify(json).slice(0, 300));
    }
    return Buffer.from(b64, 'base64');
}

function findInlineImage(json) {
    const cands = json.candidates || [];
    for (const c of cands) {
        const parts = (c.content && c.content.parts) || [];
        for (const p of parts) {
            if (p.inlineData && p.inlineData.data) return p.inlineData.data;
            if (p.inline_data && p.inline_data.data) return p.inline_data.data;
        }
    }
    return null;
}

/* ---------------- 主流程 ---------------- */
(async function main() {
    const model = OPTS.model || (OPTS.dryRun ? 'dry-run' : DEFAULT_MODEL);
    const proxy = OPTS.dryRun ? '' : await resolveProxy();
    console.log('出图清单：' + items.length + ' 张　来源 ' + (OPTS.dryRun ? '占位图（dry-run）' : OPTS.provider + ' / ' + model));
    if (!OPTS.dryRun) console.log('网络：' + (proxy ? ('走代理 ' + proxy) : '直连（没有找到本地代理；Google 接口在国内直连不通）'));
    if (!OPTS.dryRun && OPTS.provider === 'gemini') {
        const info = apiKeyInfo();
        console.log('API Key：' + (info.key ? '已读取（来自 ' + info.from + '）' : '没有找到 —— 见 README 的「用 AI 批量出图」'));
    }
    console.log('');

    let done = 0, skipped = 0;
    const failed = [];

    for (const item of items) {
        const have = existingFor(item.id, item.kind);
        if (have && !OPTS.force) {
            skipped++;
            console.log('跳过  ' + item.id + '（已有 ' + path.basename(have) + '）');
            continue;
        }
        try {
            let buf;
            if (OPTS.dryRun) {
                buf = solidPng(item.width, item.height, item.id.length * 7 + item.id.charCodeAt(0));
            } else if (OPTS.provider === 'gemini') {
                buf = await callGemini(model, item.prompt, item.aspect, proxy);
            } else {
                throw new Error('目前只实现了 gemini；OpenAI 请用图像技能的 CLI（或在聊天里告诉我，我来驱动）');
            }
            const dir = path.join(ROOT, 'assets', item.kind);
            fs.mkdirSync(dir, { recursive: true });
            /* 按真实格式落盘（模型可能返回 png 也可能 jpg），顺手清掉同 id 的旧格式 */
            const target = path.join(dir, item.id + extOf(buf));
            for (const ext of EXTS) {
                const p = path.join(dir, item.id + ext);
                if (p !== target && fs.existsSync(p)) fs.unlinkSync(p);
            }
            fs.writeFileSync(target, buf);
            done++;
            console.log('生成  ' + path.relative(ROOT, target).replace(/\\/g, '/') + '　' +
                (buf.length / 1024).toFixed(0) + ' KB');
        } catch (e) {
            failed.push({ id: item.id, msg: e.message });
            console.log('失败  ' + item.id + '　' + e.message);
            if (e.fatal) break;
        }
        if (!OPTS.dryRun) await new Promise(r => setTimeout(r, OPTS.sleep));
    }

    console.log('');
    console.log('完成 ' + done + ' 张，跳过 ' + skipped + ' 张，失败 ' + failed.length + ' 张');
    if (done || skipped) {
        console.log('接下来：');
        console.log('  tools\\run.ps1 tools\\gen-asset-manifest.js');
        console.log('  tools\\run.ps1 tools\\build-single-file.js');
    }
    if (failed.length) {
        console.log('失败的条目：' + failed.map(f => f.id).join('、') + '（重跑会自动跳过已成功的）');
        process.exit(1);
    }
})();
