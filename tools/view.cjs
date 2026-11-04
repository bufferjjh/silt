/* One view of the film's world as a PNG, picture only (no words), straight from js/reel-core.js under Node.
   Usage, from the repo root: node tools/view.cjs <out.png> <seed> <time> <z> <cols> <rows> <x cell> <y cell> [scale]
   z is the zoom (0.5 close-up, 1, 2, 4, 8). For frames as the film frames them (camera included), use
   reel.frame(t, cols, rows).cam as the last argument of paint instead. */
const fs = require('fs'), path = require('path');
const { png } = require('./png.cjs');
const R = require(path.resolve('js/reel-core.js'));
const [out, seedA, tA, zA, cA, rA, xA, yA, sA] = process.argv.slice(2);
const C = +cA, ROWS = +rA;
const reel = R.create({ seed: +seedA });
while (reel.t < +tA) reel.tick();
const rgba = new Uint8ClampedArray(C * ROWS * 4);
reel.paint(rgba, C, ROWS, { mode: 'world', z: +zA, x: +xA, y: +yA });
fs.writeFileSync(out, png(C, ROWS, rgba, +(sA || 1)));
console.log(out, 't ' + reel.t.toFixed(2), 'seed ' + seedA);
