/* Under Node, from in-b/node/sand-core.js (Coracle) and a core of today's js/sand.js built the same way:
   1. the frozen frame at several sizes and U, Coracle's vs today's: differing grains and their box;
   2. at 1440 dpr 1, Coracle tick by tick for 600 ticks (15 s) after the frozen frame: the bob and the blink. Each tick
      it reads the lip row, the bead's top row, the line's length, the eye and glow grains, and which of the spec's frames
      is on the canvas cell for cell (b10 at rows 91-99, b10_lift at rows 90-99, b10_settle and b10_blink in b10's
      place, or, for a spec without b10_blink, b10 or b10_lift with the eyes painted out).
      (Only the frozen frame is compared: from begin() on, each visit throws its own run dice, and today's creature is
      gone from the arrays, so the live frames of the two pages are not meant to match.)
   Usage (from in-b/): node work/node-checks.cjs */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const { transform } = require(path.join(ROOT, 'tools/recut/ending/make-core.cjs'));
const todayPath = path.resolve(__dirname, '../node/sand-core-today.js');
fs.writeFileSync(todayPath, transform(fs.readFileSync(path.join(ROOT, 'js/sand.js'), 'utf8')));
const A = require(todayPath), B = require(path.resolve(__dirname, '../node/sand-core.js'));

function make(S, dims) {
  const parts = S.boot(...dims);
  let r; do r = parts.next(); while (!r.done);
  const w = r.value;
  for (let k = 0; k < 180; k++) w.update();
  w.begin(12345);
  w.render();
  return w;
}
function cmp(a, b, GW) {
  let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let i = 0; i < a.out.length; i++) if (a.out[i] !== b.out[i]) {
    n++; const x = i % GW, y = (i / GW) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return n ? { n, box: `x ${x0}-${x1} y ${y0}-${y1}` } : { n };
}
const sizes = [
  ['1440 dpr 1', [576, 324, 1.5, 384, 216]],
  ['1440 dpr 2', [768, 432, 2, 384, 216]],
  ['1600 dpr 1', [720, 405, 1.5, 480, 270]],
  ['1100 dpr 1', [504, 311, 1.5, 336, 207]],
  ['phone 390 dpr 3', [213, 390, 1.8, 117, 216]]
];
const res = {};
for (const [name, dims] of sizes) {
  const a = make(A, dims), b = make(B, dims);
  res[name] = cmp(a, b, dims[0]);
  console.log('frozen frame', name, JSON.stringify(dims), JSON.stringify(res[name]));
}
/* The run, 1440 dpr 1: 600 ticks (15 s). */
const dims = sizes[0][1], GW = dims[0];
const b = make(B, dims);
const rows = [];
const hexAt = (w, x, y) => { const c = w.out[y * GW + x]; return ((c & 255) << 16) | (((c >>> 8) & 255) << 8) | ((c >>> 16) & 255); };
const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'spec.json'), 'utf8'));
const pal = Object.fromEntries(Object.entries(spec.palette).map(([k, v]) => [k, parseInt(v.slice(1), 16)]));
const shutOf = (fr) => fr.map((row, r) => [...row].map((ch, q) => (ch === 'k' || (ch === 'g' && (fr[r + 1] || '')[q] === 'k')) ? 'p' : ch).join(''));
const FRAMES = [['rest', spec.b10, 91], ['rest-shut', spec.b10_blink || shutOf(spec.b10), 91]];
if (spec.b10_lift) FRAMES.push(['lift', spec.b10_lift, 90], ['lift-shut', shutOf(spec.b10_lift), 90]);
if (spec.b10_lift && spec.b10_settle) FRAMES.push(['settle', spec.b10_settle, 91]);
const X0 = 422;
const which = (w) => {
  for (const [name, fr, y0] of FRAMES) {
    let ok = true;
    for (let r = 0; r < fr.length && ok; r++) for (let q = 0; q < fr[r].length && ok; q++) {
      const ch = fr[r][q];
      if (ch !== '.' && hexAt(w, X0 + q, y0 + r) !== pal[ch]) ok = false;
    }
    if (ok) return name;
  }
  return 'none';
};
const probe = (w) => {
  let lip = -1, bead = -1, eyes = 0, line = 0, glow = 0;
  for (let y = 86; y < 102; y++) {
    if (lip < 0 && hexAt(w, 426, y) === 0xF7E6C4) lip = y;
    if (bead < 0 && hexAt(w, 427, y) === 0xD2AC60) bead = y;
    if (hexAt(w, 427, y) === 0xB49A78 && hexAt(w, 426, y) !== 0xB49A78 && hexAt(w, 428, y) !== 0xB49A78) line++;
    for (let x = 422; x <= 430; x++) { if (hexAt(w, x, y) === 0x281C17) eyes++; if (hexAt(w, x, y) === 0xFFE09A) glow++; }
  }
  return [lip, bead, line, eyes, glow, which(w)];
};
rows.push([0, ...probe(b)]);
for (let t = 1; t <= 600; t++) {
  b.update(); b.render();
  /* Coracle's lip row (its 'l' colour at its middle column), its bead's top row, its line's length, its eye grains,
     its glow grains and which frame is drawn. */
  rows.push([t, ...probe(b)]);
}
/* Changes only. */
let prev = '';
const changes = [];
for (const r of rows) {
  const k = r.slice(1).join('/');
  if (k !== prev) changes.push(`${r[0]}:${k}`);
  prev = k;
}
const counts = {};
for (const r of rows) counts[r[6]] = (counts[r[6]] || 0) + 1;
console.log('tick:lip row/bead top row/line grains/eye grains/glow grains/frame, at each change:', changes.join(' '));
console.log('ticks per frame:', JSON.stringify(counts));
fs.writeFileSync(path.resolve(__dirname, '../node/node-checks.json'), JSON.stringify({ frozen: res, run: { ticks: 600, key: 'tick:lip row/bead top row/line grains/eye grains/glow grains/frame', changes, ticksPerFrame: counts } }, null, 1));
