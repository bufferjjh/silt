/* Coracle in Exhibit B, with the frozen frame unchanged apart from the creature.
   Builds in-b/js/sand.js (the page copy) from the repo's js/sand.js, and with --core also in-b/node/sand-core.js
   (the same change on the DOM-free core, for the Node render).
   - Today's creature and its sprout are composed exactly as now and kept in the arrays while the opening settles, so
     the settle throws exactly the same dice. begin() clears them just before the first frame is drawn.
   - Coracle is drawn by render() as an overlay, after the grains, stars, clouds and fish and before the light (so it
     is lit like the grains). It is not in the arrays and throws no dice.
   - Sprites: 'b10' from ../spec.json (9 x 9 grains, '.' transparent) at rest, and 'b10_lift' (9 wide x 10 tall, its
     bottom row on b10's) for the bob, at U = 1.5 only (dpr 1 desktop). At any other U the page is today's, old
     creature included: dpr 2 and other U need their own sprite (Phase 2).
   - Place: centred on today's creature (its grains' x span), b10's bottom row 2 grains of air above the cabbage bed.
   - Idle, phased from the scene start (T - T0), so the frozen frame is the rest pose:
     bob: for 60 of every 120 ticks (40 ticks a second, a 3 s cycle) b10_lift is drawn in b10's place, bottoms
     aligned: the bowl a grain higher, the line 2 grains, the bead held where it was (as in the 24's and the 12's idle).
     If the spec has no b10_lift, the bowl and line lift 1 grain and the bead follows 5 ticks later (the first proof).
     settle: for 8 ticks after it lands (ticks 100-107 of the 120), b10_settle is drawn in b10's place: the lip a grain
     lower, one row shallower, keel, line and bead where they were; so the bob is rest, lift, settle, rest, as the 24's
     and the 12's three-frame idle, and lands rather than ticks.
     blink: every 240 ticks (6 s), for 6 ticks, b10_blink is drawn in b10's place: the glints go, the eyes' dark row
     stays as the closed lid, and the bead lights a second grain, so two grains still glow. Always while it rests,
     never on a bob. (Without b10_blink in the spec: the eyes and their glints are drawn in body clay, the first proof.)
   Usage: node make-coracle.cjs [--core] */
const fs = require('fs'), path = require('path');
const HERE = __dirname, ROOT = path.resolve(HERE, '../../..');
const spec = JSON.parse(fs.readFileSync(path.resolve(HERE, 'spec.json'), 'utf8'));
const SPRITE = spec.b10, LIFTS = spec.b10_lift || null, PALC = spec.palette;
const SETTLES = (LIFTS && spec.b10_settle) || null, BLINKS = spec.b10_blink || null;
if (SPRITE.length !== 9 || SPRITE.some((r) => r.length !== 9)) throw new Error('b10 is not 9x9');

const LIFT = [40, 100], LAG = 5, BOB = 120, BLINK = 240, SHUT = [228, 234], SETTLE = [100, 108];
/* The line is the 's' column under the keel; the bead is everything below it. */
const LINE_ROW = SPRITE.findIndex((r) => /^\.*s\.*$/.test(r));
if (LINE_ROW < 0) throw new Error('no line row in b10');
if (LIFTS) {
  /* b10_lift: the same width, one row taller; its bowl is b10's bowl a row higher, its line one row longer, and its
     bead b10's bead in the same rows (bottoms aligned). */
  if (LIFTS.length !== SPRITE.length + 1 || LIFTS.some((r) => r.length !== SPRITE[0].length)) throw new Error('b10_lift is not 9 wide x 10 tall');
  for (let r = 0; r < LINE_ROW; r++) if (LIFTS[r] !== SPRITE[r]) throw new Error('b10_lift bowl row ' + r + ' is not b10\'s');
  if (LIFTS[LINE_ROW] !== SPRITE[LINE_ROW] || LIFTS[LINE_ROW + 1] !== SPRITE[LINE_ROW]) throw new Error('b10_lift line is not b10\'s line, 2 rows');
  for (let r = LINE_ROW + 1; r < SPRITE.length; r++) if (LIFTS[r + 1] !== SPRITE[r]) throw new Error('b10_lift bead row ' + (r + 1) + ' is not b10\'s');
}
for (const [name, fr] of [['b10_settle', SETTLES], ['b10_blink', BLINKS]]) {
  if (fr && (fr.length !== SPRITE.length || fr.some((r) => r.length !== SPRITE[0].length))) throw new Error(name + ' is not 9x9');
}
if (SETTLES) {
  /* b10_settle: drawn in b10's place; its top row is empty (the lip a grain lower) and its line and bead are b10's. */
  if (SETTLES[0] !== '.'.repeat(9)) throw new Error('b10_settle row 0 is not empty');
  for (let r = LINE_ROW; r < SPRITE.length; r++) if (SETTLES[r] !== SPRITE[r]) throw new Error('b10_settle row ' + r + ' is not b10\'s');
}
if (BLINKS) {
  /* b10_blink: b10 with only the glints over the eyes gone to clay and bead grains lit; every other grain b10's. */
  for (let r = 0; r < SPRITE.length; r++) for (let q = 0; q < 9; q++) {
    const a = SPRITE[r][q], b = BLINKS[r][q];
    if (a === b) continue;
    const glint = r < LINE_ROW && a === 'g' && b === 'p' && (SPRITE[r + 1] || '')[q] === 'k';
    const bead = r > LINE_ROW && a === 'h' && b === 'g';
    if (!glint && !bead) throw new Error('b10_blink differs from b10 at row ' + r + ' column ' + q);
  }
  if (BLINKS.join('').split('g').length - 1 < 2) throw new Error('b10_blink keeps fewer than two glow grains');
}
const used = [...new Set([SPRITE, LIFTS, SETTLES, BLINKS].filter(Boolean).map((f) => f.join('')).join('').replace(/\./g, ''))].sort();
for (const k of used) if (!PALC[k]) throw new Error('no colour for ' + k);

/* render(): the overlay. With b10_lift: one frame, one place, picked by the bob phase. */
const DRAW_LIFT = `        const settle = ${SETTLES ? `b >= ${SETTLE[0]} && b < ${SETTLE[1]}` : 'false'};
        const fr = up ? CORACLE_LIFT : settle ? CORACLE_SETTLE : ${BLINKS ? 'shut ? CORACLE_BLINK : ' : ''}CORACLE;
        const y0 = hover.y - (fr.length - CORACLE.length);
        for (let r = 0; r < fr.length; r++) {
          const row = fr[r];
          for (let q = 0; q < row.length; q++) {
            let ch = row[q];
            if (ch === '.') continue;${BLINKS ? '' : `
            if (r < ${LINE_ROW} && shut && (ch === 'k' || (ch === 'g' && (fr[r + 1] || '')[q] === 'k'))) ch = 'p';`}
            dot(q, y0 + r, ch);
          }
        }`;
/* Without it (the first proof): the bowl and line rise, the bead follows LAG ticks later. */
const DRAW_LAG = `        const upB = b >= ${LIFT[0] + LAG} && b < ${LIFT[1] + LAG} ? 1 : 0;
        for (let r = 0; r < CORACLE.length; r++) {
          const row = CORACLE[r];
          for (let q = 0; q < row.length; q++) {
            let ch = row[q];
            if (ch === '.') continue;
            if (r < ${LINE_ROW}) {
              if (shut && (ch === 'k' || (ch === 'g' && (CORACLE[r + 1] || '')[q] === 'k'))) ch = 'p';
              dot(q, hover.y + r - up, ch);
            } else if (r === ${LINE_ROW}) {
              /* The line spans from the keel to the bead, wherever each is. */
              dot(q, hover.y + r - up, ch);
              if (upB < up) dot(q, hover.y + r, ch);
            } else dot(q, hover.y + r - upB, ch);
          }
        }`;

function patch(text) {
  let s = text;
  const rep = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(n + ' matches: ' + a.slice(0, 70)); s = s.replace(a, () => b); };
  /* 1. Sprite and colours, at the top level beside the other tables. */
  rep(`  const BAYER = new Uint8Array(`, `  /* Coracle at Exhibit B's size (spec.json 'b10'), 9 x 9 grains at U = 1.5; '.' is transparent.${LIFTS ? `
     CORACLE_LIFT ('b10_lift', 9 x 10) is the bob's lifted frame, drawn with its bottom row on b10's.` : ''} */
  const CORACLE = ${JSON.stringify(SPRITE)};${LIFTS ? `
  const CORACLE_LIFT = ${JSON.stringify(LIFTS)};` : ''}${SETTLES ? `
  /* CORACLE_SETTLE ('b10_settle') and CORACLE_BLINK ('b10_blink') are drawn in b10's place: the bob's settle, a short
     beat after it lands, and the blink. */
  const CORACLE_SETTLE = ${JSON.stringify(SETTLES)};` : ''}${BLINKS ? `
  const CORACLE_BLINK = ${JSON.stringify(BLINKS)};` : ''}
  const CORACLE_C = {${used.map((k) => `${k}: pk(rgb('${PALC[k]}'))`).join(', ')}};
  const BAYER = new Uint8Array(`);
  /* 2. Today's creature's place in the arrays, and Coracle's spot. */
  rep(`    const chimney = [], eyes = [];`, `    const chimney = [], eyes = [];
    /* Today's creature and sprout, held while the opening settles; where Coracle hovers (null: not in this frame). */
    const stand = [];
    let hover = null;`);
  rep(`            put(x, y, CREATURE, K.creature[c]);
          });`, `            stand.push(put(x, y, CREATURE, K.creature[c]));
          });`);
  rep(`          for (let y = F(104.3 + oy); y < Y(106); y++) put(F(278.5 + ox), y, GREEN, K.crop[2]);
          for (let x = F(277.2 + ox); x < F(278.5 + ox); x++) put(x, F(104.5 + oy), GREEN, K.crop[3]);
          put(F(278.5 + ox) + 1, F(104.1 + oy), GREEN, K.crop[3]);`, `          for (let y = F(104.3 + oy); y < Y(106); y++) stand.push(put(F(278.5 + ox), y, GREEN, K.crop[2]));
          for (let x = F(277.2 + ox); x < F(278.5 + ox); x++) stand.push(put(x, F(104.5 + oy), GREEN, K.crop[3]));
          stand.push(put(F(278.5 + ox) + 1, F(104.1 + oy), GREEN, K.crop[3]));
          eyes.forEach((i) => { stand.push(i); });
          /* Coracle, at U = 1.5 only: centred on today's creature, its lowest row 2 grains of air above the bed. */
          if (U === 1.5) {
            let lo = 1e9, hi = -1;
            stand.forEach((i) => { if (i >= 0 && mat[i] === CREATURE) { const x = (i % W) - 1; if (x < lo) lo = x; if (x > hi) hi = x; } });
            if (hi >= 0) hover = { x: Math.floor((lo + hi) / 2) - (CORACLE[0].length >> 1), y: F(top) - 3 - (CORACLE.length - 1) };
          }`);
  /* 3. begin(): today's creature leaves just before the first frame (only where Coracle takes its place). */
  rep(`        recording = true;
        census();`, `        recording = true;
        if (hover) for (let k = 0; k < stand.length; k++) { const i = stand[k]; if (i >= 0 && (mat[i] === CREATURE || mat[i] === GREEN)) toAir(i); }
        stand.length = 0;
        census();`);
  /* 4. render(): the overlay, after the fish, before today's blink and the light. */
  rep(`      if (eyes.length && (T % 230) < 5) {`, `      if (hover) {
        const ph = T - T0, b = ((ph % ${BOB}) + ${BOB}) % ${BOB}, w = ((ph % ${BLINK}) + ${BLINK}) % ${BLINK};
        const up = b >= ${LIFT[0]} && b < ${LIFT[1]} ? 1 : 0;
        const shut = w >= ${SHUT[0]} && w < ${SHUT[1]};
        const dot = (q, gy, ch) => {
          const gx = hover.x + q;
          if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) out[gy * GW + gx] = CORACLE_C[ch];
        };
${LIFTS ? DRAW_LIFT : DRAW_LAG}
      }
      if (eyes.length && (T % 230) < 5) {`);
  return s;
}
const src = fs.readFileSync(path.join(ROOT, 'js/sand.js'), 'utf8');
const page = patch(src);
fs.writeFileSync(path.resolve(process.env.OUT || HERE, 'sand.js'), page);
console.log('wrote in-b/js/sand.js', 'b10', SPRITE[0].length + 'x' + SPRITE.length, 'line row', LINE_ROW,
  LIFTS ? 'b10_lift ' + LIFTS[0].length + 'x' + LIFTS.length + ' (bob: lift frame, bead held)' : 'no b10_lift (bob: bowl lifts, bead follows ' + LAG + ' ticks later)',
  SETTLES ? '| b10_settle (ticks ' + SETTLE[0] + '-' + (SETTLE[1] - 1) + ')' : '| no settle', BLINKS ? '| b10_blink (lid kept, bead lit)' : '| blink: eyes to clay');
if (process.argv.includes('--core')) {
  const { transform } = require(path.join(ROOT, 'tools/recut/ending/make-core.cjs'));
  fs.writeFileSync(path.resolve(process.env.OUT || HERE, 'sand-core.js'), patch(transform(src)));
  console.log('wrote in-b/node/sand-core.js');
}
