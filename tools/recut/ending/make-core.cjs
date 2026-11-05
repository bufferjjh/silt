/* Builds proto/sand-core.js from js/sand.js with the smallest changes that make boot() reachable and DOM-free:
   - the page's element lookups only run where there is a document, and the page code only runs where it found them;
   - boot() draws into a plain RGBA buffer when there is no 2D context (or when asked to: opts.bare);
   - render() only puts the image on a canvas when it has one;
   - the world exposes its pixels (world.out, world.image), and begin() takes an optional seed for the run dice;
   - the module exports { boot, layout, OPENING, PLAN, GRAIN } (CommonJS under Node, window.SiltSand in a page).
   Each replacement must apply exactly once. Usage: node make-core.cjs [src=../../../js/sand.js] [out=sand-core.js] */
const fs = require('fs'), path = require('path');
function transform(text) {
let s = text;
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error('expected one match, found ' + n + ': ' + a.slice(0, 80));
  s = s.replace(a, () => b);
}
rep(`  const canvas = document.getElementById('sand');
  const stage = document.getElementById('sand-stage'), still = document.getElementById('sand-still');
  const ctl = document.getElementById('sand-ctl'), runBtn = document.getElementById('sand-run');
  const logEl = document.getElementById('sand-log'), movedEl = document.getElementById('sand-moved');
  const livingEl = document.getElementById('sand-living');
  const hinge = document.getElementById('hinge-state'), tag = document.getElementById('sand-tag');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas. The frozen frame stays. */ }
  if (!ctx || !stage || !still || !ctl || !runBtn || !logEl || !movedEl || !livingEl || !hinge || !tag) return;

  /* Earlier versions kept their world in this browser. This one starts fresh on every visit, so that store goes. */
  try { if (window.indexedDB) indexedDB.deleteDatabase('silt'); } catch (e) { /* Nothing kept, nothing to clear. */ }
`, `  const DOC = typeof document !== 'undefined' ? document : null;
  const el = (id) => (DOC ? DOC.getElementById(id) : null);
  const canvas = el('sand');
  const stage = el('sand-stage'), still = el('sand-still');
  const ctl = el('sand-ctl'), runBtn = el('sand-run');
  const logEl = el('sand-log'), movedEl = el('sand-moved');
  const livingEl = el('sand-living');
  const hinge = el('hinge-state'), tag = el('sand-tag');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas. The frozen frame stays. */ }
  const PAGE = !!(ctx && stage && still && ctl && runBtn && logEl && movedEl && livingEl && hinge && tag);

  /* Earlier versions kept their world in this browser. This one starts fresh on every visit, so that store goes. */
  if (PAGE) try { if (window.indexedDB) indexedDB.deleteDatabase('silt'); } catch (e) { /* Nothing kept, nothing to clear. */ }
`);
rep(`  function* boot(GW, GH, U, PW, PH) {
    const W = GW + 2, H = GH + 2, N = W * H;
    const image = ctx.createImageData(GW, GH);`, `  function* boot(GW, GH, U, PW, PH, opts) {
    const W = GW + 2, H = GH + 2, N = W * H;
    const bare = !ctx || !!(opts && opts.bare);
    const image = bare ? { width: GW, height: GH, data: new Uint8ClampedArray(GW * GH * 4) } : ctx.createImageData(GW, GH);`);
rep(`      ctx.putImageData(image, 0, 0);
    }`, `      if (!bare) ctx.putImageData(image, 0, 0);
    }`);
rep(`      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render,`, `      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image,`);
rep(`      begin() {
        moved = 0;
        T0 = T;
        let s = 0;
        try {`, `      begin(given) {
        moved = 0;
        T0 = T;
        let s = 0;
        if (given !== undefined) s = given >>> 0; else try {`);
rep(`  /* ---- Page ---- */
`, `  const API = { boot, layout, OPENING, PLAN, GRAIN };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SiltSand = API;
  if (!PAGE) return;

  /* ---- Page ---- */
`);
return s;
}
module.exports = { transform };
if (require.main === module) {
  const src = path.resolve(__dirname, process.argv[2] || '../../../js/sand.js');
  const out = path.resolve(__dirname, process.argv[3] || 'sand-core.js');
  fs.writeFileSync(out, transform(fs.readFileSync(src, 'utf8')));
  console.log('wrote', out);
}
