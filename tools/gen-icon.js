/*
 * 生成桌面快捷方式用的图标：assets/icon.ico（256×256，PNG 压缩的 ICO）
 * 图案：沥青黑底 + 锈色边框 + 中间一枚冷青色的「空间」菱形 + 底部黄黑警示条。
 * 顺便写一张 assets/icon-preview.png，方便直接看效果。
 *
 * 用法（在项目目录下）：tools\run.ps1 tools\gen-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = process.env.PROJ_ROOT && fs.existsSync(path.join(process.env.PROJ_ROOT, 'index.html'))
    ? process.env.PROJ_ROOT : path.resolve(__dirname, '..');
const SIZE = 256;

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
}
function pngRgba(w, h, pixels) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        const off = y * (w * 4 + 1);
        raw[off] = 0;
        pixels.copy(raw, off + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;   // 位深
    ihdr[9] = 6;   // RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
function ico(pngBuf) {
    const dir = Buffer.alloc(6);
    dir.writeUInt16LE(0, 0);
    dir.writeUInt16LE(1, 2);   // 图标类型
    dir.writeUInt16LE(1, 4);   // 一张图
    const entry = Buffer.alloc(16);
    entry[0] = 0;              // 0 = 256
    entry[1] = 0;
    entry[4] = 1;              // planes
    entry[6] = 32;             // 位深
    entry.writeUInt32LE(pngBuf.length, 8);
    entry.writeUInt32LE(22, 12);
    return Buffer.concat([dir, entry, pngBuf]);
}

/* ---- 画图：每个像素做 4×4 超采样，边缘才不毛 ---- */
const C = SIZE / 2;
function insideRoundRect(x, y, inset, r) {
    const a = inset, b = SIZE - inset;
    if (x < a || x > b || y < a || y > b) return false;
    const cx = Math.min(Math.max(x, a + r), b - r);
    const cy = Math.min(Math.max(y, a + r), b - r);
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}
function colorAt(x, y) {
    if (!insideRoundRect(x, y, 6, 40)) return [0, 0, 0, 0];                 // 圆角外透明
    const d = Math.abs(x - C) + Math.abs(y - C);
    if (y >= 208 && y <= 224) {                                            // 底部黄黑警示条
        const stripe = Math.floor((x + (y - 208) * 2) / 14) % 2 === 0;
        return stripe ? [217, 169, 43, 255] : [26, 26, 22, 255];
    }
    if (d <= 78) {                                                          // 中间的空间菱形
        const t = (y - (C - 78)) / 156;
        if (d > 71) {                                                        // 亮边
            return [Math.round(80 - 26 * t), Math.round(200 - 50 * t), Math.round(195 - 48 * t), 255];
        }
        return [Math.round(34 - 10 * t), Math.round(92 - 26 * t), Math.round(88 - 24 * t), 255];
    }
    if (d <= 96) return [63, 168, 160, 42];                                 // 菱形外面的微光
    if (!insideRoundRect(x, y, 9, 37)) return [201, 122, 51, 255];          // 锈色描边
    const t = (y - 6) / (SIZE - 12);
    return [Math.round(16 + 10 * t), Math.round(18 + 10 * t), Math.round(17 + 9 * t), 255];
}

const px = Buffer.alloc(SIZE * SIZE * 4);
const S = 4;
for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < S; sy++) {
            for (let sx = 0; sx < S; sx++) {
                const c = colorAt(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
                const al = c[3] / 255;
                r += c[0] * al; g += c[1] * al; b += c[2] * al; a += al;
            }
        }
        const n = S * S;
        const off = (y * SIZE + x) * 4;
        if (a > 0) {
            px[off] = Math.round(r / a);
            px[off + 1] = Math.round(g / a);
            px[off + 2] = Math.round(b / a);
            px[off + 3] = Math.round((a / n) * 255);
        }
    }
}

const png = pngRgba(SIZE, SIZE, px);
const assetsDir = path.join(ROOT, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico(png));
fs.writeFileSync(path.join(assetsDir, 'icon-preview.png'), png);
console.log('已生成 assets/icon.ico 与 assets/icon-preview.png（' + (png.length / 1024).toFixed(0) + ' KB）');
