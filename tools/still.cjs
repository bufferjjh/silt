/* assets/film-still.png, the paused cover: the widest view (x8) at 52.6 s, one pixel per cell, 800 cells across
   (the whole valley), 48 rows of sky above the world's top and 16 of rock below: 800 x 344. js/reel.js expects
   exactly this (STILL_W = 200 * Q, STILL_SKY = 12 * Q, STILL_DEEP = 8 * Q).
   Usage, from the repo root: node tools/still.cjs <out.png> [seed=10] [time=52.6] */
const fs = require('fs'), path = require('path');
const { png } = require('./png.cjs');
const R = require(path.resolve('js/reel-core.js'));
const out = process.argv[2], seed = +(process.argv[3] || 10), T = +(process.argv[4] || 52.6);
const Q = R.Q, C = 200 * Q, SKY = 12 * Q, ROWS = 560 / 2 + SKY + 4 * Q;
const reel = R.create({ seed });
while (reel.t < T) reel.tick();
const rgba = new Uint8ClampedArray(C * ROWS * 4);
reel.paint(rgba, C, ROWS, { mode: 'world', z: 8, x: 0, y: -SKY });
fs.writeFileSync(out, png(C, ROWS, rgba));
console.log(out, C + 'x' + ROWS, 't ' + reel.t.toFixed(2), 'seed ' + seed);
