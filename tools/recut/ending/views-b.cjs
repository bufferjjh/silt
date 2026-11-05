/* Approach (b)'s near views: Exhibit B's composition built at a finer U (grains a plan step), one cell a grain, cropped
   to the film's picture at 1440 (577 x 244 cells during play), centred on the creature over the cabbage bed.
   Writes view-U<u>.png at 2x (screen size at dpr 1) and prints the build and settle times.
   Usage: node views-b.cjs [core=core-newcre-hold.js] [U list=1.5,2,2.4,3,3.6] */
const fs = require('fs'), path = require('path');
const { png } = require(path.resolve(__dirname, '../../../tools/png.cjs'));
const S = require(path.resolve(process.argv[2] || path.join(__dirname, 'core-newcre-hold.js')));
const Us = (process.argv[3] || '1.5,2,2.4,3,3.6').split(',').map(Number);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const C = 577, R = 244;
for (const U of Us) {
  const GW = Math.ceil(384 * U), GH = Math.ceil(216 * U);
  const t0 = now();
  const g = S.boot(GW, GH, U, 384, 216); let r; do r = g.next(); while (!r.done);
  const w = r.value, t1 = now();
  for (let k = 0; k < 180; k++) w.update();
  const t2 = now();
  w.begin(1); w.render();
  /* The creature hovers at plan x 281 (grains 421 at U 1.5); centre the crop there, ground row 102/1.5 = plan 68. */
  const cx = Math.round(284 * U), cy = Math.round(62 * U);
  const x0 = Math.max(0, Math.min(GW - C, cx - (C >> 1))), y0 = Math.max(0, Math.min(GH - R, cy - Math.round(R * 0.45)));
  const px = new Uint8Array(w.out.buffer), rgba = new Uint8ClampedArray(C * R * 4);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const o = (y * C + x) * 4, gx = x0 + x, gy = y0 + y;
    if (gx >= GW || gy >= GH) { rgba[o] = 16; rgba[o + 1] = 13; rgba[o + 2] = 11; rgba[o + 3] = 255; continue; }
    const i = (gy * GW + gx) * 4; rgba[o] = px[i]; rgba[o + 1] = px[i + 1]; rgba[o + 2] = px[i + 2]; rgba[o + 3] = 255;
  }
  fs.writeFileSync(path.join(__dirname, 'view-U' + U + '.png'), png(C, R, rgba, 2));
  console.log(JSON.stringify({ U, grains: GW + 'x' + GH, bootMs: +(t1 - t0).toFixed(0), settleMs: +(t2 - t1).toFixed(0), crop: [x0, y0], showsPlanSteps: +(C / U).toFixed(1), shareOfB: +(C / U / 384).toFixed(3) }));
}
