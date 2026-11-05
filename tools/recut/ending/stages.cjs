/* The bare ground growing into Exhibit B, from a tagged composition (core-tags.js): stages 1 (land), 2 (underground),
   3 (pond furniture), 4 (trees, bushes), 5 (home), 6 (terraces, crops, creature), 7 (grass), 8 (wildflowers),
   11 (all), at U (default 2.4, the film's 1:1 under approach b), cropped to 577 x 244 cells round the creature
   (or the whole frame at U 1.5). Writes stages-U<u>.png (a column of the stages at 1 px a cell) and checks that the
   last stage is the frozen frame. Usage: node stages.cjs [U=2.4] */
const fs = require('fs'), path = require('path');
const { png } = require(path.resolve(__dirname, '../../../tools/png.cjs'));
const S = require(path.join(__dirname, 'core-tags.js'));
const U = +(process.argv[2] || 2.4), GW = Math.ceil(384 * U), GH = Math.ceil(216 * U);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const t0 = now();
const g = S.boot(GW, GH, U, 384, 216, { tags: true }); let r; do r = g.next(); while (!r.done);
const w = r.value; const t1 = now();
for (let k = 0; k < 180; k++) w.update(); w.begin(1);
const full = U === 1.5, C = full ? GW : 577, R = full ? GH : 244;
const cx = Math.round(284 * U), cy = Math.round(62 * U);
const x0 = full ? 0 : Math.max(0, Math.min(GW - C, cx - (C >> 1))), y0 = full ? 0 : Math.max(0, Math.min(GH - R, cy - Math.round(R * 0.45)));
const ST = [1, 2, 3, 4, 5, 6, 7, 8, 11], gap = 6, all = new Uint8ClampedArray(C * (R + gap) * ST.length * 4).fill(16);
ST.forEach((st, k) => {
  w.stage(st);
  const px = new Uint8Array(w.out.buffer);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const o = ((k * (R + gap) + y) * C + x) * 4, i = ((y0 + y) * GW + x0 + x) * 4;
    all[o] = px[i]; all[o + 1] = px[i + 1]; all[o + 2] = px[i + 2]; all[o + 3] = 255;
  }
});
w.render(); const fin = Uint32Array.from(w.out); w.stage(11); let d = 0; for (let i = 0; i < fin.length; i++) if (fin[i] !== w.out[i]) d++;
fs.writeFileSync(path.join(__dirname, 'stages-U' + U + '.png'), png(C, (R + gap) * ST.length, all, 1));
console.log(JSON.stringify({ U, tagBootMs: +(t1 - t0).toFixed(0), lastStageVsFrame: d ? d + ' grains differ' : 'same' }));
