/* Story safety across seeds, for the re-cut. Plays the whole script for each seed under Node and checks the beats the
   picture relies on, in the film's own world (js/reel-core.js, drawn with Exhibit B's js/sand.js), and that every
   seed ends on the same last frame: seed 10's, which is Exhibit B's frozen frame.
   Usage, from the repo root: node tools/story.cjs <firstSeed> <count> [--verbose] [--core path/to/reel-core.js]
   A seed that fails goes in LEFT_OUT in js/reel-core.js. */
const path = require('path'), crypto = require('crypto');
const args = process.argv.slice(2);
const coreAt = args.indexOf('--core');
const R = require(path.resolve(coreAt >= 0 ? args[coreAt + 1] : 'js/reel-core.js'));
const first = +(args[0] || 1), count = +(args[1] || 20), verbose = args.includes('--verbose');
const T = R.T, beat = R.beat;
const WATER = 22, Z_POOL = 5, Z_CAVE = 4;
/* The last frame at 1440 x 900 dpr 1 (the pane and keys strip freed) and on a 390 phone. */
const SIZES = [[577, 285], [353, 265]];
const GATES = { hollow: beat(22), cave: beat(35), wheel: beat(45) };

const reel = R.create({ seed: first, size: SIZES[0] });
function hollowWater() {
  const w = reel.worlds.W1, G = reel.G;
  let water = 0;
  for (let y = G.sb; y < G.sb + 16; y++) for (let x = G.hc - G.hw; x <= G.hc + G.hw; x++) if (w.mat[(y + 1) * w.W + x + 1] === WATER) water++;
  return water;
}
function caveWater() {
  const w = reel.worlds.W1;
  let c = 0;
  for (let i = 0; i < w.N; i++) if (w.mat[i] === WATER && (w.zone[i] === Z_POOL || w.zone[i] === Z_CAVE)) c++;
  return c;
}
function lastFrames() {
  return SIZES.map(([c, r]) => {
    const v = reel.frame(reel.t, c, r);
    const img = new Uint8ClampedArray(c * r * 4);
    reel.paint(img, c, r, v.cam);
    return { hash: crypto.createHash('sha1').update(img).digest('hex'), img, c, r };
  });
}
/* Against the plate: the 1440 frame's first 576 columns equal assets/cross-section.png's rows shown, one grain a cell. */
function plateCheck(f) {
  const { readPng } = require(path.resolve('tools/recut/ending/png-read.cjs'));
  const p = readPng(path.resolve('assets/cross-section.png'));
  let bad = 0;
  for (let y = 0; y < Math.min(f.r, 324); y++) for (let x = 0; x < 576; x++) {
    const a = (y * f.c + x) * 4, b = ((2 * y) * p.w + 2 * x) * 4;
    if (f.img[a] !== p.rgba[b] || f.img[a + 1] !== p.rgba[b + 1] || f.img[a + 2] !== p.rgba[b + 2]) bad++;
  }
  return bad;
}

let ref = null;
const rows = [];
for (let s = first; s < first + count; s++) {
  reel.reset(s);
  const r = { seed: s, hollow: null, cave: null, wheel: null, end: '' };
  let k = 0;
  while (reel.t < 59.4 - 1e-9) {
    reel.tick();
    const t = reel.t;
    if ((++k & 7) || t >= T.LAPSE) continue;
    if (r.hollow === null && t > T.RAIN && hollowWater() >= 300) r.hollow = +t.toFixed(2);
    if (r.cave === null && t > T.SPILL - 2 && caveWater() >= 10) r.cave = +t.toFixed(2);
    const m = reel.worlds.W1.machine;
    if (r.wheel === null && t > T.WHEEL - 0.1 && m && m.run > 0.3) r.wheel = +t.toFixed(2);
  }
  const f = lastFrames();
  if (!ref) { ref = f; r.plate = plateCheck(f[0]); }
  r.end = f.every((x, q) => x.hash === ref[q].hash) ? 'same' : 'differs';
  const fails = [];
  if (r.hollow === null || r.hollow > GATES.hollow) fails.push('hollow');
  if (r.cave === null || r.cave > GATES.cave) fails.push('cave');
  if (r.wheel === null || r.wheel > GATES.wheel) fails.push('wheel');
  if (r.end !== 'same') fails.push('end');
  if (r.plate !== undefined && r.plate !== 0) fails.push('plate');
  r.fails = fails;
  rows.push(r);
  if (verbose || fails.length) console.log(JSON.stringify(r));
}
const failed = rows.filter((r) => r.fails.length).map((r) => r.seed);
const max = (k) => Math.max(...rows.map((r) => r[k] || 0)).toFixed(2);
console.log(`seeds ${first}-${first + count - 1}: ${rows.length - failed.length} pass, ${failed.length} fail ${failed.length ? JSON.stringify(failed) : ''}` +
  ` | latest hollow ${max('hollow')} (gate ${GATES.hollow}), cave ${max('cave')} (gate ${GATES.cave}), wheel ${max('wheel')} (gate ${GATES.wheel})`);
process.exitCode = failed.length ? 1 : 0;
