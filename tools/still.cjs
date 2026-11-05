/* assets/film-still.png, the paused cover: the film's whole world near the end of its last working view (51.5 s, the
   place grown, at dusk), one pixel per cell: 691 x 389, Exhibit B's composition at 1.8 grains a step. js/reel.js
   expects exactly this (STILL_W = 691) and draws it where that view's picture sits.
   Usage, from the repo root: node tools/still.cjs <out.png> [seed=10] [time=51.5] */
const fs = require('fs'), path = require('path');
const { png } = require('./png.cjs');
const R = require(path.resolve('js/reel-core.js'));
const out = process.argv[2], seed = +(process.argv[3] || 10), T = +(process.argv[4] || 51.5);
const reel = R.create({ seed, size: [577, 257] });
while (reel.t + 1e-9 < T) reel.tick();
const { W1 } = reel.worlds, C = W1.GW, ROWS = W1.GH;
const rgba = new Uint8ClampedArray(C * ROWS * 4);
reel.paint(rgba, C, ROWS, { v: 'W', x: 0, y: 0, t: T });
fs.writeFileSync(out, png(C, ROWS, rgba));
console.log(out, C + 'x' + ROWS, 't ' + reel.t.toFixed(2), 'seed ' + seed);
