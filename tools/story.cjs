/* Story safety across seeds. Plays the whole script for each seed under Node and checks every beat the words and
   the picture rely on, in the fine grains the film is simulated in (counts are given in valley-grain equivalents,
   fine grains / S^2, so the gates read like the old ones).
   Usage, from the repo root: node tools/story.cjs <firstSeed> <count> [--verbose] [--core path/to/reel-core.js]
   All 256 seeds passed at a906f25 (LEFT_OUT in reel-core.js is empty). A seed that fails goes in LEFT_OUT. */
const args = process.argv.slice(2);
const coreAt = args.indexOf('--core');
const R = require(require('path').resolve(coreAt >= 0 ? args[coreAt + 1] : 'js/reel-core.js'));
const { MAT, FLORA, T } = R;
const first = +(args[0] || 1), count = +(args[1] || 20), verbose = args.includes('--verbose');
const reel = R.create({ seed: first });
/* Fine grains of a material in a box of the patch, in valley grains (inclusive, like the old gates). */
function countIn(mat, x0, y0, x1, y1, flora) {
  const lv = reel.level, S = lv.S, A = flora ? lv.FL : lv.M;
  const fx0 = Math.max(0, (x0 - lv.px0) * S), fx1 = Math.min(lv.w, (x1 + 1 - lv.px0) * S);
  const fy0 = Math.max(0, (y0 - lv.py0) * S), fy1 = Math.min(lv.h, (y1 + 1 - lv.py0) * S);
  let c = 0;
  for (let y = fy0; y < fy1; y++) for (let x = fx0; x < fx1; x++) if (A[y * lv.w + x] === mat) c++;
  return c;
}
function v(mat, x0, y0, x1, y1) { const S = reel.level.S; return countIn(mat, x0, y0, x1, y1) / S / S; }
const GATES = {
  dip: 16.2, sprout: 19.5, basin: 24.2, clayFrom: 24.6, clayBy: 25.8, scoop: 10, wallOver: 38.5,
  plantAtBird: 12, flowers: 6, reeds: 1
};
const rows = [];
for (let s = first; s < first + count; s++) {
  reel.reset(s);
  const r = { seed: s, dip: null, sprout: null, basin: null, clay: null, clayAt: 0, scooped: 0, built: 0, over: null, h: 0, flowers: 0, reeds: 0 };
  let k = 0;
  while (reel.t < 45) {
    reel.tick();
    const t = reel.t;
    const exact = Math.abs(t - T.BIRD) < 1 / 120 || Math.abs(t - 27) < 1 / 120 || (t > 35.8 && t < 36);
    if ((++k & 3) && !exact) continue;
    if (r.dip === null && t > 10 && v(MAT.WATER, 56, 28, 62, 32) >= 4) r.dip = +t.toFixed(2);
    if (r.sprout === null && reel.plant) r.sprout = +t.toFixed(2);
    if (r.basin === null && t > 13.4 && v(MAT.WATER, 112, 38, 132, 43) >= 12) r.basin = +t.toFixed(2);
    if (r.clay === null && reel.firstClay > 0) r.clay = +reel.firstClay.toFixed(2);
    if (Math.abs(t - 27.0) < 1 / 120) r.clayAt = +v(MAT.CLAY, 100, 34, 145, 47).toFixed(1);
    if (r.over === null && reel.built >= 10 && countIn(MAT.WATER, 141, 30, 150, 45) >= 2 * reel.level.S) r.over = +t.toFixed(2);
    if (Math.abs(t - T.BIRD) < 1 / 120) {
      r.h = reel.plant ? +(reel.plant.h / reel.level.S).toFixed(1) : 0;
      /* A flower head is about 0.6 of a valley grain. */
      r.flowers = Math.round((countIn(FLORA.FLOWER, 20, 0, 160, 50, true) + countIn(FLORA.BLOSSOM, 20, 0, 160, 50, true)) / (0.6 * reel.level.S * reel.level.S));
    }
    if (t > 35.8 && t < 36 && !r.reeds) r.reeds = reel.reeds;
  }
  r.scooped = reel.scooped; r.built = reel.built;
  const fails = [];
  if (r.dip === null || r.dip > GATES.dip) fails.push('dip');
  if (r.sprout === null || r.sprout > GATES.sprout) fails.push('sprout');
  if (r.basin === null || r.basin > GATES.basin) fails.push('basin');
  if (r.clay === null || r.clay < GATES.clayFrom) fails.push('clay-early');
  if (r.clay === null || r.clay > GATES.clayBy) fails.push('clay-late');
  if (r.scooped < GATES.scoop) fails.push('scoop');
  if (r.over === null || r.over > GATES.wallOver) fails.push('over');
  if (r.h < GATES.plantAtBird) fails.push('plant');
  if (r.flowers < GATES.flowers) fails.push('flowers');
  if (r.reeds < GATES.reeds) fails.push('reeds');
  r.fails = fails;
  rows.push(r);
  if (verbose) console.log(JSON.stringify(r));
  else console.log(s, fails.length ? 'FAIL ' + fails.join(',') : 'ok', JSON.stringify({ dip: r.dip, sprout: r.sprout, basin: r.basin, clay: r.clay, clayAt: r.clayAt, over: r.over, h: r.h, flowers: r.flowers, reeds: r.reeds }));
}
const bad = rows.filter((r) => r.fails.length).map((r) => r.seed);
console.log('passed', rows.length - bad.length, 'of', rows.length, 'left out:', JSON.stringify(bad));
