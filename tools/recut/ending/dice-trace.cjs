/* Why removing today's creature from Exhibit B's composition changes grains elsewhere.
   Builds two DOM-free cores (js/sand.js and review-local/nocre/js/sand.js), each with a trace of the run dice (the
   xorshift state) after every phase of update(), runs the 180 settle updates in both, and reports:
   - whether the composition's arrays differ anywhere but the creature's own grains;
   - the first update and phase where the run dice part;
   - which ground grains damp() treats differently (it throws a die for every soaking grain with open air above).
   Usage: node dice-trace.cjs [a.js=js/sand.js] [b.js=review-local/nocre/js/sand.js]  (sources before the DOM-free change) */
const fs = require('fs'), path = require('path'), vm = require('vm');
function core(src) {
  /* the same DOM-free changes as make-core.cjs, then the trace */
  let s = require('./make-core.cjs').transform(fs.readFileSync(src, 'utf8'));
  const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('no single match: ' + a.slice(0, 60)); s = s.replace(a, () => b); };
  rep(`      sub = 0;
      damp();
      for (let k = 0; k < plants.length; k++) if (!plants[k].dead) stepPlant(plants[k]);
      for (let k = 0; k < fungi.length; k++) if (!fungi[k].dead) stepFungus(fungi[k]);
      for (let k = 0; k < worms.length; k++) stepWorm(worms[k]);
      closeTunnels();
      stepFlies();
      stepFish();
      director();`, `      sub = 0;
      TR('move');
      damp(); TR('damp');
      for (let k = 0; k < plants.length; k++) if (!plants[k].dead) stepPlant(plants[k]);
      TR('plants');
      for (let k = 0; k < fungi.length; k++) if (!fungi[k].dead) stepFungus(fungi[k]);
      for (let k = 0; k < worms.length; k++) stepWorm(worms[k]);
      TR('fungi+worms');
      closeTunnels();
      stepFlies(); TR('flies');
      stepFish(); TR('fish');
      director(); TR('director');`);
  rep(`    function update() {`, `    const trace = [];
    function TR(tag) { trace.push(tick + ':' + tag + ':' + (seed >>> 0)); }
    function openSoak() { const o = []; for (let k = 0; k < soilArr.length; k++) { const i = soilArr[k], up = mat[i - W]; if (SOAK[mat[i]] && (up === AIR || up === BLADE || up === LITTER || up === SEED)) o.push(i); } return o; }
    function update() {`);
  rep(`      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image,`, `      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image, trace, openSoak, mossC, mat, W, get seed() { return seed >>> 0; },`);
  const m = { exports: {} };
  vm.runInNewContext(s, { module: m, Math, Uint8Array, Uint16Array, Uint32Array, Int16Array, Int32Array, Float32Array, Int8Array, Uint8ClampedArray, ArrayBuffer, Array, Object, String, Number, Error });
  return m.exports;
}
function run(C) {
  const g = C.boot(576, 324, 1.5, 384, 216); let r; do r = g.next(); while (!r.done);
  const w = r.value;
  const mat0 = Uint8Array.from(w.mat), seed0 = w.seed, open0 = w.openSoak();
  for (let k = 0; k < 180; k++) w.update();
  return { w, mat0, seed0, open0 };
}
const A = run(core(path.resolve(process.argv[2] || path.join(__dirname, '../../../js/sand.js'))));
const B = run(core(path.resolve(process.argv[3] || path.join(__dirname, '../../nocre/js/sand.js'))));
const W = A.w.W, xy = (i) => [(i % W) - 1, ((i / W) | 0) - 1];
let diff = [];
for (let i = 0; i < A.mat0.length; i++) if (A.mat0[i] !== B.mat0[i]) diff.push(i);
const bx = diff.map(xy);
console.log('composition: grains whose material differs:', diff.length, 'x', Math.min(...bx.map((p) => p[0])), '-', Math.max(...bx.map((p) => p[0])), 'y', Math.min(...bx.map((p) => p[1])), '-', Math.max(...bx.map((p) => p[1])));
console.log('run dice after composition:', A.seed0, B.seed0, A.seed0 === B.seed0 ? 'same' : 'DIFFERENT');
const sa = new Set(A.open0), extra = B.open0.filter((i) => !sa.has(i)), sb = new Set(B.open0), gone = A.open0.filter((i) => !sb.has(i));
console.log('soaking grains open to the air: with creature', A.open0.length, 'without', B.open0.length, '; open only without:', JSON.stringify(extra.map(xy)), '; open only with:', JSON.stringify(gone.map(xy)));
for (let k = 0; k < Math.min(A.w.trace.length, B.w.trace.length); k++) {
  if (A.w.trace[k] !== B.w.trace[k]) { console.log('first divergence of the run dice:', A.w.trace[k], 'vs', B.w.trace[k], '(previous phase', A.w.trace[k - 1] || 'start', ')'); break; }
}
{
  const ma = new Set(A.w.mossC), mb = new Set(B.w.mossC);
  const onlyB = B.w.mossC.filter((i) => !ma.has(i)), onlyA = A.w.mossC.filter((i) => !mb.has(i));
  console.log('moss sites (stone and masonry with an open face): a', A.w.mossC.length, 'b', B.w.mossC.length, '; only in b:', JSON.stringify(onlyB.map(xy)), '; only in a:', JSON.stringify(onlyA.map(xy)));
}
let after = 0; for (let i = 0; i < A.w.mat.length; i++) if (A.w.mat[i] !== B.w.mat[i]) after++;
console.log('after 180 settle updates: grains whose material differs:', after);
