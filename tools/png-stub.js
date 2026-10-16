/*
 * 最小 PNG 生成器：只用来产出「占位图」验证管线（不依赖任何图像库）。
 * 竖条渐变 + 两块暗块，一眼能看出这是占位而不是真图。
 */
const zlib = require('zlib');

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

function solidPng(w, h, seed) {
    const hue = (seed * 37) % 60;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    const band = Math.max(8, Math.round(h / 12));
    for (let y = 0; y < h; y++) {
        const off = y * (w * 3 + 1);
        raw[off] = 0;
        const dark = (y > h * 0.55 && y < h * 0.62) ? -12 : 0;
        const base = Math.round(22 + 26 * (y / h)) + hue + dark;
        for (let x = 0; x < w; x++) {
            const box = (x > w * 0.12 && x < w * 0.42) || (x > w * 0.55 && x < w * 0.9);
            const v = Math.max(4, Math.min(120, base - (box && y > h * 0.4 ? 14 : 0)));
            raw[off + 1 + x * 3] = v;
            raw[off + 2 + x * 3] = Math.max(4, v - 6);
            raw[off + 3 + x * 3] = Math.max(4, v - 14);
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;      // 位深
    ihdr[9] = 2;      // 真彩色
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

module.exports = { solidPng };
