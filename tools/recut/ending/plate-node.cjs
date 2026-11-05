/* Exhibit B's frozen frame under Node, from proto/sand-core.js (or another core given as the 3rd argument):
   boot(576, 324, 1.5, 384, 216), the same 180 settle updates as the page, begin(), one render.
   Writes the frame at 2x with no smoothing (like tools/plate.mjs) and prints the timings.
   Usage: node plate-node.cjs out.png [scale=2] [core=./sand-core.js] [GW GH U PW PH] */
const fs = require('fs'), path = require('path');
const { png } = require(path.resolve(__dirname, '../../../tools/png.cjs'));
const [outA, sA, coreA, ...dims] = process.argv.slice(2);
const S = require(path.resolve(coreA || path.join(__dirname, 'sand-core.js')));
const [GW, GH, U, PW, PH] = dims.length ? dims.map(Number) : [576, 324, 1.5, 384, 216];
const now = () => Number(process.hrtime.bigint()) / 1e6;
const t0 = now();
const parts = S.boot(GW, GH, U, PW, PH);
let r, yields = 0;
do { r = parts.next(); yields++; } while (!r.done);
const w = r.value;
const t1 = now();
for (let k = 0; k < 180; k++) w.update();
const t2 = now();
w.begin(1);
w.render();
const t3 = now();
const rgba = new Uint8ClampedArray(w.out.buffer.slice(0));
if (outA) fs.writeFileSync(outA, png(GW, GH, rgba, +(sA || 2)));
let t4 = now(); for (let k = 0; k < 20; k++) w.render(); const renderMs = (now() - t4) / 20;
t4 = now(); for (let k = 0; k < 200; k++) w.update(); const updateMs = (now() - t4) / 200;
console.log(JSON.stringify({ GW, GH, U, PW, PH, yields, bootMs: +(t1 - t0).toFixed(1), settleMs: +(t2 - t1).toFixed(1), firstRenderMs: +(t3 - t2).toFixed(1), renderMs: +renderMs.toFixed(2), updateMsLive: +updateMs.toFixed(2), out: outA }));
