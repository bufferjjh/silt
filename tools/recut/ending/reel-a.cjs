/* Approach (a) as a wrapper, for measuring: the film's last shot is drawn by Exhibit B's own renderer, from the
   DOM-free core (proto/sand-core.js, or the one given). From T.LOGO (today's end card) the picture is a band of Exhibit B's
   composition, one cell a grain, as settled for its frozen frame, so it is the same for every seed.
   In a real build this lives in reel-core.js: everything() makes B's world after the film's (a generator, so load()
   can spread it), frame() hands back cam { mode: 'b', x, y } for the last shot, and paint() copies the band.
     const A = require('./reel-a.cjs'); const reel = A.create({ seed: 10 }); ...  reel.bMs: what B's world took */
const path = require('path');
const R = require(path.resolve(__dirname, '../../../js/reel-core.js'));
const now = () => Number(process.hrtime.bigint()) / 1e6;
function buildB(core, dims) {
  const S = require(path.resolve(core || path.join(__dirname, 'sand-core.js')));
  const [GW, GH, U, PW, PH] = dims || [576, 324, 1.5, 384, 216];
  const t0 = now();
  const g = S.boot(GW, GH, U, PW, PH); let r; do r = g.next(); while (!r.done);
  const w = r.value;
  for (let k = 0; k < 180; k++) w.update();
  /* Fixed dice from here on, so the hold could run on live and still be the same for every seed. */
  w.begin(S.OPENING);
  w.render();
  w.ms = now() - t0;
  return w;
}
function wrap(reel, B, opts) {
  const o = opts || {}, shot = o.shot || R.T.LOGO;
  const frame0 = reel.frame, paint0 = reel.paint;
  /* Which rows of B the picture shows: top-aligned unless asked (o.band(rows) gives the first row). */
  const band = o.band || ((rows) => Math.max(0, Math.min(B.GH - rows, 0)));
  reel.frame = function (t, cols, rows) {
    const v = frame0(t, cols, rows);
    if (t >= shot) { v.mode = 'b'; v.cam = { mode: 'b', z: 0, x: 0, y: band(rows) }; }
    return v;
  };
  const px = new Uint8Array(B.out.buffer);
  reel.paint = function (rgba, cols, rows, cam) {
    if (!cam || cam.mode !== 'b') return paint0(rgba, cols, rows, cam);
    for (let r = 0; r < rows; r++) {
      const y = r + cam.y;
      for (let c = 0; c < cols; c++) {
        const x = c + cam.x, o = (r * cols + c) * 4;
        if (x < 0 || y < 0 || x >= B.GW || y >= B.GH) { rgba[o] = 0x10; rgba[o + 1] = 0x0d; rgba[o + 2] = 0x0b; rgba[o + 3] = 255; continue; }
        const i = (y * B.GW + x) * 4;
        rgba[o] = px[i]; rgba[o + 1] = px[i + 1]; rgba[o + 2] = px[i + 2]; rgba[o + 3] = 255;
      }
    }
  };
  reel.B = B;
  reel.bMs = B.ms;
  return reel;
}
module.exports = {
  R, buildB, wrap,
  create(o) { const reel = R.create(o); return wrap(reel, buildB(o && o.core, o && o.dims), o); }
};
