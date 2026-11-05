/* Picture-only frames of the current film, framed as the film frames them (camera from reel.frame()).
   Usage: [NOCRE=1] node review-local/kit/frames.cjs out.png seed t cols rows
   NOCRE=1 leaves today's creature out (for mockups). Output is one pixel per cell; on a 1440x900 dpr-1 screen a
   cell is 2 CSS px, so scale 2x with no smoothing to see it at screen size. Prints the camera as JSON. */
const fs = require('fs'), path = require('path');
const { png } = require(path.resolve('tools/png.cjs'));
const R = require(path.resolve('review-local/kit/reel-core-kit.js'));
const [out, seedA, tA, cA, rA] = process.argv.slice(2);
const C = +cA, ROWS = +rA;
const reel = R.create({ seed: +seedA });
while (reel.t < +tA - 1e-9) reel.tick();
const f = reel.frame(reel.t, C, ROWS);
const rgba = new Uint8ClampedArray(C * ROWS * 4);
reel.paint(rgba, C, ROWS, f.cam);
fs.writeFileSync(out, png(C, ROWS, rgba, 1));
console.log(JSON.stringify({ out, t: +reel.t.toFixed(3), cam: f.cam, scene: f.scene }));
