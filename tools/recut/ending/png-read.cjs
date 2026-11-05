/* A tiny PNG reader for 8-bit RGB/RGBA, non-interlaced PNGs (what tools/plate.mjs and PIL write): returns
   { w, h, rgba } with one RGBA pixel per image pixel. Node only. */
const fs = require('fs'), zlib = require('zlib');
function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, ct = 0, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('8-bit, non-interlaced only'); }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error('RGB or RGBA only');
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; rgba[o] = cur[x * bpp]; rgba[o + 1] = cur[x * bpp + 1]; rgba[o + 2] = cur[x * bpp + 2]; rgba[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    cur.copy(prev);
  }
  return { w, h, rgba };
}
/* Every s-th pixel from the s x s block's top left: a 2x plate at one pixel per grain. */
function down(img, s) {
  const w = img.w / s, h = img.h / s, rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y * s) * img.w + x * s) * 4, o = (y * w + x) * 4; for (let k = 0; k < 4; k++) rgba[o + k] = img.rgba[i + k]; }
  return { w, h, rgba };
}
module.exports = { readPng, down };
