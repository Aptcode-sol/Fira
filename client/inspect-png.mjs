// Throwaway: decode a PNG with node's own zlib (no dependency available here) and
// report whether it is opaque, to confirm what Google composites onto white.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const COLOR_TYPES = { 0: 'gray', 2: 'rgb', 3: 'palette', 4: 'gray+alpha', 6: 'rgba' };
const lines = [];

function chunks(buf) {
    const out = [];
    let p = 8; // skip signature
    while (p < buf.length) {
        const len = buf.readUInt32BE(p);
        const type = buf.toString('ascii', p + 4, p + 8);
        out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
        p += 12 + len;
    }
    return out;
}

/** Undo PNG line filters for 8-bit, non-interlaced images. */
function unfilter(raw, width, height, bpp) {
    const stride = width * bpp;
    const out = Buffer.alloc(height * stride);
    let pos = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[pos++];
        const line = raw.subarray(pos, pos + stride);
        pos += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;
            let v = line[x];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            cur[x] = v & 0xff;
        }
    }
    return out;
}

for (const file of process.argv.slice(2)) {
    const buf = readFileSync(file);
    const cs = chunks(buf);
    const ihdr = cs.find(c => c.type === 'IHDR').data;
    const width = ihdr.readUInt32BE(0);
    const height = ihdr.readUInt32BE(4);
    const depth = ihdr[8];
    const colorType = ihdr[9];
    const interlace = ihdr[12];

    let note = `${file}: ${width}x${height} depth=${depth} color=${COLOR_TYPES[colorType]}`;

    if (colorType === 2) {
        lines.push(`${note}  -> no alpha channel: fully OPAQUE`);
        continue;
    }
    if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 4)) {
        lines.push(`${note}  -> not scanned (unsupported combination)`);
        continue;
    }

    const bpp = colorType === 6 ? 4 : 2;
    const idat = Buffer.concat(cs.filter(c => c.type === 'IDAT').map(c => c.data));
    const px = unfilter(inflateSync(idat), width, height, bpp);

    let transparent = 0, nearWhite = 0, nearBlack = 0;
    const total = width * height;
    for (let i = 0; i < px.length; i += bpp) {
        const alpha = px[i + bpp - 1];
        if (alpha < 16) { transparent++; continue; }
        const lum = colorType === 6
            ? 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
            : px[i];
        if (lum > 200) nearWhite++;
        else if (lum < 60) nearBlack++;
    }
    const pct = n => `${((n / total) * 100).toFixed(1)}%`;
    lines.push(`${note}  transparent=${pct(transparent)} nearWhite=${pct(nearWhite)} nearBlack=${pct(nearBlack)}`);
}

writeFileSync('png-report.txt', lines.join('\n') + '\n');
