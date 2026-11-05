/* Beyond B's frame: boot() with more grains than the plan (the plan stays 384 x 216 steps at the top left, and the grains
   past it "carry on the ground and sky beyond it"), and with a wider plan. Is B's region still B?
   Prints, for each, the grains of B's 576 x 324 region that differ from the frozen frame, before and after the settle,
   and the time. Usage: node wider.cjs */
const path = require('path');
const S = require(path.join(__dirname, 'sand-core.js'));
const now = () => Number(process.hrtime.bigint()) / 1e6;
function world(GW, GH, U, PW, PH, settle) {
  const t0 = now(); const g = S.boot(GW, GH, U, PW, PH); let r; do r = g.next(); while (!r.done);
  const w = r.value; if (settle) for (let k = 0; k < 180; k++) w.update(); w.begin(1); w.render();
  return { w, ms: now() - t0 };
}
function region(w, x0, y0) { const o = new Uint32Array(576 * 324); for (let y = 0; y < 324; y++) for (let x = 0; x < 576; x++) o[y * 576 + x] = w.out[(y + y0) * w.GW + x + x0]; return o; }
const ref = [region(world(576, 324, 1.5, 384, 216, false).w, 0, 0), region(world(576, 324, 1.5, 384, 216, true).w, 0, 0)];
for (const [name, a, x0, y0] of [
  ['grains past the plan to the right (720 x 324, plan 384 x 216)', [720, 324, 1.5, 384, 216], 0, 0],
  ['grains past the plan below (576 x 450, plan 384 x 216)', [576, 450, 1.5, 384, 216], 0, 0],
  ['a wider plan (720 x 324, plan 480 x 216): layout() changes', [720, 324, 1.5, 480, 216], 72, 0]]) {
  const res = [false, true].map((settle, k) => { const { w, ms } = world(...a, settle); const r = region(w, x0, y0); let d = 0; for (let i = 0; i < r.length; i++) if (r[i] !== ref[k][i]) d++; return (settle ? 'settled' : 'composed') + ': ' + d + ' grains differ (' + ms.toFixed(0) + ' ms)'; });
  console.log(name + ' -> ' + res.join(', '));
}
