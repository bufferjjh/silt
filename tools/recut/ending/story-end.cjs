/* The end gate, as it would go in tools/story.cjs: plays each seed's whole script, paints its final frame (at the
   hold, 59.4 s) at the end sizes (1440 dpr 1: 577 x 285 cells with the pane and keys strip freed; a 390 phone:
   353 x 265), and checks that every seed's frame is byte for byte seed 10's. With --plate, also that the 1440 frame's
   first 576 columns are the band of assets/cross-section.png (taken one pixel a grain) that the film shows.
   Usage: node story-end.cjs <first> <count> [--today] [--plate] [--core path/to/sand core]
   --today gates today's film (end card) instead of approach (a). */
const path = require('path'), crypto = require('crypto');
const args = process.argv.slice(2);
const first = +(args[0] || 1), count = +(args[1] || 4), today = args.includes('--today'), plate = args.includes('--plate');
const coreAt = args.indexOf('--core');
const A = require('./reel-a.cjs');
const HOLD = 59.4, SIZES = [[577, 285], [353, 265]];
const reel = today ? A.R.create({ seed: 10 }) : A.create({ seed: 10, core: coreAt >= 0 ? args[coreAt + 1] : undefined });
function finalFrames(seed) {
  reel.reset(seed);
  while (reel.t + 1 / 120 < HOLD) reel.tick();
  return SIZES.map(([c, r]) => {
    const rgba = new Uint8ClampedArray(c * r * 4), v = reel.frame(reel.t, c, r);
    reel.paint(rgba, c, r, v.cam);
    return { c, r, rgba, cam: v.cam, hash: crypto.createHash('sha1').update(rgba).digest('hex').slice(0, 12) };
  });
}
const t0 = Date.now();
const ref = finalFrames(10);
console.log('seed 10:', ref.map((f) => f.c + 'x' + f.r + ' ' + f.hash).join('  '), 'cam', JSON.stringify(ref[0].cam));
if (plate) {
  const { readPng, down } = require('./png-read.cjs');
  const img = down(readPng(path.resolve(__dirname, '../../../assets/cross-section.png')), 2), f = ref[0];
  let bad = 0;
  for (let r = 0; r < f.r; r++) for (let c = 0; c < Math.min(576, f.c); c++) {
    const y = r + f.cam.y, o = (r * f.c + c) * 4, i = (y * img.w + c) * 4;
    if (y >= img.h || f.rgba[o] !== img.rgba[i] || f.rgba[o + 1] !== img.rgba[i + 1] || f.rgba[o + 2] !== img.rgba[i + 2]) bad++;
  }
  console.log('1440 end frame vs assets/cross-section.png rows', f.cam.y, '-', f.cam.y + f.r - 1, ':', bad ? bad + ' cells differ' : 'pixel for pixel');
}
const fails = [];
for (let s = first; s < first + count; s++) {
  if (s === 10) continue;
  const fr = finalFrames(s), same = fr.every((f, k) => f.hash === ref[k].hash);
  if (!same) fails.push(s);
  console.log(s, same ? 'ok' : 'FAIL end frame differs from seed 10', fr.map((f) => f.hash).join(' '));
}
console.log('end gate:', fails.length ? 'failed ' + JSON.stringify(fails) : 'all match seed 10', '(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
