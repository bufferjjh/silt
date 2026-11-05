/* Exhibit B. A cross-section of a small world at dusk, simulated grain by grain on typed arrays. Watch only.
   A simplified model written for this page, not the world itself.
   The opening is composed, and the same on every visit: the cabin, the pond and its bridge, the terraces,
   the well down to the water underground, the stream and the cave are placed by hand.
   From there it runs on rules and dice, so no two visits go the same way. Rain falls and soaks in; the ground
   gives it back as springs and drips; the stream carries it down to the cave. Seeds root where the ground is damp,
   grow, flower, seed and go back to the soil. Moss creeps where it is wet. A worm or two turns the soil.
   Nothing here hurts anything. The water goes round and is never made or lost: what is out of sight is
   held in the ground and the air. Growth and withering keep each other in step.
   The record only writes what happened in these arrays. */
(function () {
  'use strict';

  const DOC = typeof document !== 'undefined' ? document : null;
  const el = (id) => (DOC ? DOC.getElementById(id) : null);
  const canvas = el('sand');
  const stage = el('sand-stage'), still = el('sand-still');
  const ctl = el('sand-ctl'), runBtn = el('sand-run');
  const logEl = el('sand-log'), movedEl = el('sand-moved');
  const livingEl = el('sand-living');
  const hinge = el('hinge-state'), tag = el('sand-tag');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas. The frozen frame stays. */ }
  const PAGE = !!(ctx && stage && still && ctl && runBtn && logEl && movedEl && livingEl && hinge && tag);

  /* Earlier versions kept their world in this browser. This one starts fresh on every visit, so that store goes. */
  if (PAGE) try { if (window.indexedDB) indexedDB.deleteDatabase('silt'); } catch (e) { /* Nothing kept, nothing to clear. */ }

  const OPENING = 0x51f7a3c9; /* The dice the opening is composed and settled with. */
  const GRAIN = 1.5; /* CSS px, before snapping to device pixels. */
  /* The opening is drawn to a plan in steps of this many CSS px, and each step is filled with as many grains as
     fit. So the picture is the same size on every screen, and a finer screen gets more grains, not bigger ones. */
  const PLAN = 3;

  /* Materials. Everything below WATER stays where it is unless a rule acts on it. */

  const AIR = 0, EDGE = 1, ROCK = 2, MASON = 3, WOOD = 4, LAMP = 5, CREATURE = 6, GREEN = 7, CANOPY = 8;
  const MOSS = 9, SOIL = 10, TURF = 11, TILL = 12, ROOT = 13, BLADE = 14, STEM = 15, LEAF = 16, BLOOM = 17;
  const STALK = 18, CAP = 19, WORM = 20, TUNNEL = 21;
  const WATER = 22, DRIP = 23, LILY = 24, SEED = 25, PETAL = 26, LITTER = 27, SMOKE = 28, SPORE = 29;

  function table(list) { const t = new Uint8Array(32); list.forEach((m) => { t[m] = 1; }); return t; }
  /* What a falling grain changes places with. */
  const PASS = table([AIR, SMOKE, SPORE]);
  /* Ground that holds water. */
  const SOAK = table([SOIL, TURF, TILL]);
  /* Lights. Their own light does not fall on them. */
  const EMIT = table([LAMP, CAP]);
  const LIVING = table([GREEN, CANOPY, MOSS, ROOT, BLADE, STEM, LEAF, BLOOM, STALK, CAP, WORM, LILY]);
  /* How each grain is painted: its own colour, what is behind it, water, damp ground, smoke, a hanging drop, a spore. */
  const PAINT = new Uint8Array(32);
  PAINT[AIR] = 1; PAINT[TUNNEL] = 1; PAINT[EDGE] = 1; PAINT[WATER] = 2;
  PAINT[SOIL] = 3; PAINT[TURF] = 3; PAINT[TILL] = 3; PAINT[SMOKE] = 4; PAINT[DRIP] = 5; PAINT[SPORE] = 6;

  const Z_POND = 1, Z_AQ = 2, Z_STREAM = 3, Z_CAVE = 4, Z_POOL = 5, Z_SHAFT = 6, Z_CELLAR = 7;
  const WMAX = 6; /* Water a grain of ground can hold. */

  /* Clay, dusk and lantern. Four shades each, dark to light. */
  const PAL = {
    skyTop: ['#24304A', '#2E3B56', '#3B4762', '#4D566E'],
    skyHorizon: ['#6B6876', '#977B78', '#C89478', '#EAB680'],
    cloud: ['#4E4D61', '#86707A', '#C48D79', '#EDB58A'],
    moon: ['#FFE2A8', '#FFF4DA'],
    grass: ['#2B4430', '#38573A', '#4A6B40', '#62824B'],
    topsoil: ['#281C17', '#34251E', '#422F26', '#513B2F'],
    strataA: ['#7B4331', '#90523B', '#A56346', '#B97654'],
    strataB: ['#87684A', '#987756', '#AA8763', '#BB9872'],
    strataC: ['#4E4A38', '#5A5641', '#67624B', '#746F56'],
    stone: ['#3E3A38', '#4A4643', '#57534F', '#66615C'],
    water: ['#273D52', '#355066', '#4C687C', '#E3B07E'],
    sand: ['#A4876A', '#B69876', '#C7A884', '#D8BA95'],
    leaf: ['#223A2B', '#2D4C37', '#3B5F42', '#527651'],
    bush: ['#2B4431', '#39573E', '#4C6B49', '#668458'],
    crop: ['#58673A', '#6C7C43', '#83924F', '#A0AA60'],
    blossom: ['#B3564C', '#CF7A62', '#E6A17A', '#F5D2AE'],
    wild: ['#C8743E', '#E39C52', '#EFC46C', '#F7E6C4'],
    glow: ['#F2A24A', '#FBC66A', '#FFE09A', '#FFF6DC'],
    wood: ['#3D2A20', '#52382A', '#6A4934', '#845D42'],
    creature: ['#221917', '#C9A47E', '#E2C29C', '#FBEBD2'],
    worm: ['#8E5E50', '#A87060', '#C48A72', '#D9A288'],
    silt: ['#8C7864', '#9A8570', '#A8937E', '#B6A08C']
  };

  /* Coracle, the creature, drawn over the grains (it throws no dice). One size in the world: the 9 set below 1.8 grains
     a plan step, the 12 set from 1.8 up. Each set is one grid; its frames share the origin. '.' is transparent. */
  const CORACLE_SETS = {
    9: {"rest":[".........","lllllllls","lppppppps","lpgpppgps","ppkpppkps",".pppppps.","..sssss..",".....s...",".....hh..",".....hg.."],"lift":["lllllllls","lppppppps","lpgpppgps","ppkpppkps",".pppppps.","..sssss..",".....s...",".....s...",".....hh..",".....hg.."],"settle":[".........",".........","lllllllls","lppppppps","lpgpppgps","ppkpppkps",".sssssss.",".....s...",".....hh..",".....hg.."],"blink":[".........","lllllllls","lppppppps","lppppppps","ppkpppkps",".pppppps.","..sssss..",".....s...",".....hg..",".....hg.."],"base":9},
    12: {"rest":["............","llllllllllls","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"],"lift":["llllllllllls","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......s....",".......hh...",".......hg...","............"],"settle":["............","............","llllllllllls","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..",".......s....",".......hh...",".......hg...","............"],"blink":["............","llllllllllls","olppppppppso","olppppppppso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hg...",".......hg...","............"],"base":10},
  };
  const CORACLE_C = {g: pk(rgb('#FFE09A')), h: pk(rgb('#D2AC60')), k: pk(rgb('#281C17')), l: pk(rgb('#F7E6C4')), o: pk(rgb('#6A4934')), p: pk(rgb('#DAC29C')), s: pk(rgb('#B49A78'))};
  const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n, w) { let s = String(n); while (s.length < w) s = '0' + s; return s; }
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function pk(c, k) {
    if (k === undefined) k = 1;
    return 0xff000000 | (clamp(Math.round(c[2] * k), 0, 255) << 16) | (clamp(Math.round(c[1] * k), 0, 255) << 8) |
      clamp(Math.round(c[0] * k), 0, 255);
  }
  function blend(c, r, g, b, a) {
    const cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
    return 0xff000000 | ((cb + (b - cb) * a) << 16) | ((cg + (g - cg) * a) << 8) | (cr + (r - cr) * a);
  }
  function darken(c, k) {
    return 0xff000000 | ((((c >>> 16) & 255) * k >> 8) << 16) | ((((c >>> 8) & 255) * k >> 8) << 8) | ((c & 255) * k >> 8);
  }

  const SH = {}, K = {};
  Object.keys(PAL).forEach((k) => { SH[k] = PAL[k].map(rgb); K[k] = SH[k].map((c) => pk(c)); });
  const C_RAIN = pk(mixc(SH.glow[3], SH.water[2], 0.38)), RAIN = mixc(SH.glow[3], SH.water[2], 0.38);
  const C_DRIP = pk(mixc(SH.water[2], SH.glow[3], 0.3));
  const C_FLOW = pk(mixc(SH.water[2], SH.glow[2], 0.22));
  const C_SHIM = pk(mixc(SH.water[3], SH.glow[3], 0.45));
  const C_SKYW = pk(mixc(SH.water[2], SH.water[3], 0.35));
  const LIGHT = SH.glow[2];
  /* Damp ground darkens, a step for each grain of water it holds. Out of 256. */
  const WK = new Uint16Array([256, 234, 218, 205, 194, 185, 178]);

  /* Dice for the composition: the same every time. */
  function rngOf(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s) { return 0.6 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.1 * vnoise(x * 4.3, y * 4.3, s + 13); }

  /* What stands where along the ground, in steps of the plan. Each part has the width it needs, a width it is
     comfortable at, and one it would like. The cabin, the pond, a strip of meadow and the beds come first;
     a tree joins only if those can still be comfortable. */
  function layout(GW) {
    const defs = [
      { id: 'grove', min: 46, want: 46, pref: 56, pri: 5 },
      { id: 'young', min: 22, want: 22, pref: 22, pri: 7 },
      { id: 'pond', min: 36, want: 62, pref: 78, pri: 2 },
      { id: 'meadow', min: 14, want: 14, pref: 54, pri: 3 },
      { id: 'home', min: 52, want: 58, pref: 58, pri: 1 },
      { id: 'terraces', min: 42, want: 63, pref: 84, pri: 4, step: 21 },
      { id: 'orchard', min: 32, want: 32, pref: 34, pri: 6 }
    ];
    const byPri = defs.slice().sort((a, b) => a.pri - b.pri);
    let used = 0, wants = 0;
    byPri.forEach((d) => {
      d.on = d.pri <= 4 ? used + d.min <= GW : wants + d.min <= GW;
      if (!d.on) return;
      used += d.min;
      wants += d.pri <= 4 ? d.want : d.min;
      d.w = d.min;
    });
    let spare = GW - used;
    const grow = (d, to) => {
      if (!d.on || spare <= 0) return;
      let g = Math.min(spare, to - d.w);
      if (g <= 0) return;
      if (d.step) g -= g % d.step;
      if (d.id === 'home' && g < 6) g = 0;
      d.w += g;
      spare -= g;
    };
    byPri.forEach((d) => { if (d.pri <= 4) grow(d, d.want); });
    byPri.forEach((d) => { grow(d, d.pref); });
    const meadow = defs[3];
    if (meadow.on) { const g = Math.round(spare * 0.6); meadow.w += g; spare -= g; }
    const left = spare >> 1, right = spare - left;
    const segs = [];
    let x = 0;
    if (left) { segs.push({ id: 'edge', x0: 0, w: left }); x = left; }
    defs.forEach((d) => { if (d.on) { segs.push({ id: d.id, x0: x, w: d.w }); x += d.w; } });
    if (right) segs.push({ id: 'edge', x0: x, w: right });
    return segs;
  }

  /* A world of this many grains, U grains to a step of the plan, and a plan PW steps wide and PH tall from its top
     left corner. Any grains past the plan carry on the ground and sky beyond it. The arrays carry a one-grain frame
     the plate never shows.
     It is built a part at a time (each yield is a pause), so the page stays free to scroll while it is made. */

  function* boot(GW, GH, U, PW, PH, opts) {
    const W = GW + 2, H = GH + 2, N = W * H;
    const bare = !ctx || !!(opts && opts.bare);
    const image = bare ? { width: GW, height: GH, data: new Uint8ClampedArray(GW * GH * 4) } : ctx.createImageData(GW, GH);
    const out = new Uint32Array(image.data.buffer);

    /* mat is also read four grains at a time (mat4), so its buffer is a whole number of fours. */
    const mat = new Uint8Array(new ArrayBuffer((N + 3) & ~3), 0, N), mat4 = new Uint32Array(mat.buffer), aux = new Uint8Array(N), stamp = new Uint8Array(N), wet = new Uint8Array(N);
    const zone = new Uint8Array(N), sky = new Uint8Array(N), origM = new Uint8Array(N), gk = new Uint8Array(N);
    const col = new Uint32Array(N), base = new Uint32Array(N), orig = new Uint32Array(N);
    const NB4 = [-W, W, -1, 1];
    /* For the film: with { tags }, which part of the composition last set each grain, and what the grain was before the
       first part after the land touched it. Nothing is recorded, and nothing changes, without it. */
    const tags = opts && opts.tags ? { part: new Uint8Array(N), bareM: new Uint8Array(N), bareC: new Uint32Array(N), prevM: new Uint8Array(N), prevC: new Uint32Array(N) } : null;
    /* What the film can ask of a world. As here, it is Exhibit B; the film turns things off and drives the weather. */
    const BARE_KEEP = [0, 1, 1, 0, 1, 1];
    const ctl = { auto: true, rain: null, seep: 0, creature: true, machine: 4, clouds: true, stars: true, lights: 1, flies: true, spill: 0 };
    function mark(k) {
      if (!tags) return;
      const pm = tags.prevM, pc = tags.prevC, pt = tags.part;
      for (let i = 0; i < N; i++) {
        if (mat[i] === pm[i] && col[i] === pc[i]) continue;
        /* The bare place keeps the land, what lies under it, and the rock round it (parts 1, 2, 4, 5): a grain's bare
           state is what the last of those left it as. */
        if (BARE_KEEP[k]) { tags.bareM[i] = mat[i]; tags.bareC[i] = col[i]; }
        else if (BARE_KEEP[pt[i]] || pt[i] === 0) { tags.bareM[i] = pm[i]; tags.bareC[i] = pc[i]; }
        pt[i] = k; pm[i] = mat[i]; pc[i] = col[i];
      }
      /* What shows through the air, and the zones, as the land left them and as the whole composition did. */
      if (k === 1) { tags.landB = base.slice(); tags.landZ = zone.slice(); tags.landS = sky.slice(); }
      if (k === 18) { tags.finalB = base.slice(); tags.finalZ = zone.slice(); tags.finalS = sky.slice(); }
    }

    /* The plan and the grains. A step of the plan, numbered v, covers the grains from F(v) up to F(v + 1).
       P gives a length of the plan in grains; pl gives the middle of a grain as a place on the plan, numbered the same way. */
    const U2 = U * U;
    const P = (v) => Math.round(v * U);
    const F = (v) => Math.ceil(v * U - 0.5 - 1e-7);
    const pl = (x) => (x + 0.5) / U - 0.5;

    let seed = OPENING;
    function r32() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    }
    function rf() { return r32() / 4294967296; }
    function rint(n) { return Math.floor(rf() * n); }
    function chance(p) { return rf() < p; }
    /* A count that is n on average: the whole part, and one more as often as the fraction. */
    function some(n) { const k = Math.floor(n); return k + (rf() < n - k ? 1 : 0); }

    let tick = 0, pass = 0, sub = 0, stampNow = 1, T = 0, T0 = 0, moved = 0, recording = false, living = 0;
    /* Water out of sight: in the ground and in the air, counted in grains. */
    let hidden = Math.round(900 * U2);

    for (let x = 0; x < W; x++) { mat[x] = EDGE; mat[N - W + x] = EDGE; }
    for (let y = 0; y < H; y++) { mat[y * W] = EDGE; mat[y * W + W - 1] = EDGE; }

    /* ---- The opening ---- */

    const CR = rngOf(OPENING);
    /* The plate, in steps of the plan. */
    const GWp = Math.max(1, Math.min(PW, Math.floor(GW / U + 1e-6))), GHp = Math.min(PH, GH / U);
    const SBp = clamp(Math.round(GHp * 0.325), 38, 92); /* The row the meadow, the pond and the cabin stand on. */
    const SB = F(SBp);
    const D = GHp - SBp;
    const KS = clamp(D / 146, 0.55, 1.35);
    const segs = layout(GWp);
    const seg = {};
    const idAt = new Array(GWp), segAt = new Array(GW);
    segs.forEach((s) => {
      if (s.id !== 'edge') seg[s.id] = s;
      for (let x = s.x0; x < s.x0 + s.w && x < GWp; x++) idAt[x] = s.id;
    });
    for (let x = 0; x < GW; x++) segAt[x] = idAt[Math.min(GWp - 1, Math.floor((x + 0.5) / U))];

    function idx(x, y) { return (y + 1) * W + x + 1; }
    function inb(x, y) { return x >= 0 && y >= 0 && x < GW && y < GH; }
    function at(x, y) { x = Math.round(x); y = Math.round(y); return inb(x, y) ? mat[idx(x, y)] : EDGE; }
    function put(x, y, m, c) {
      x = Math.round(x); y = Math.round(y);
      if (!inb(x, y)) return -1;
      const i = idx(x, y);
      mat[i] = m;
      col[i] = c;
      if (m === ROCK || m === MASON || SOAK[m]) { origM[i] = m; orig[i] = c; }
      return i;
    }
    function putOpen(x, y, m, c) { return at(x, y) === AIR ? put(x, y, m, c) : -1; }
    function pick(t, j, x, y, salt) { const v = t * 4 + (hash(x, y, salt || 99) - 0.5) * j; return v < 0 ? 0 : v > 3.999 ? 3 : Math.floor(v); }
    function depthK(y) { return y > SBp + 18 ? 1 - 0.2 * clamp((y - SBp - 18) / 128, 0, 1) : 1; } /* y on the plan */
    /* Stone laid in courses: JOINT on a joint, else a small shift in tone for the block, lighter or darker.
       Sizes on the plan, x0 and y0 in grains. A course starts on the grain nearest its place on the plan, and gets a
       joint along its top only if it is two grains tall or more; a thinner one is told apart by its tone. */
    const JOINT = -1;
    function course(d, size) {
      let n = Math.floor((d + 0.5) / size);
      if (Math.round(n * size) > d) n--;
      else if (Math.round((n + 1) * size) <= d) n++;
      return n;
    }
    function brick(x, y, x0, y0, bw, bh, shift) {
      const ch = bh * U, dy = y - y0, row = course(dy, ch), top = Math.round(row * ch);
      const cw = bw * U, dx = x - x0 + ((row & 1) ? Math.round(shift * U) : 0), cn = course(dx, cw);
      const joint = (dy === top && Math.round((row + 1) * ch) - top >= 2) || dx === Math.round(cn * cw);
      return joint ? JOINT : (hash(cn, row, 157) - 0.5) * 0.35;
    }
    /* A thin upright of wood: one grain wide, or two in two shades where the grains are small enough. */
    function upright(xc, y0, y1, c0, c1) {
      const w = U >= 1.8 ? 2 : 1, x0 = Math.round(xc * U - w / 2);
      for (let y = F(y0); y < F(y1); y++) for (let k = 0; k < w; k++) put(x0 + k, y, WOOD, k ? c1 : c0);
    }

    /* -- The lie of the land */

    const surf = new Int16Array(GW), plantable = new Uint8Array(GW), bladeMax = new Uint8Array(GW);
    (function () {
      const pts = [], flats = [];
      let last = 0;
      segs.forEach((s, n) => {
        const a = s.x0, b = s.x0 + s.w;
        if (s.id === 'edge') {
          if (n === 0) pts.push([a, segs[1] && segs[1].id === 'grove' ? -13 : -3]);
          else pts.push([b - 1, last - 3]);
        } else if (s.id === 'grove') { pts.push([a, -15], [a + Math.round(s.w * 0.42), -17], [b - 6, -7]); last = -7; }
        else if (s.id === 'young') { pts.push([a + (s.w >> 1), -4]); last = -4; }
        else if (s.id === 'pond' || s.id === 'home') { flats.push([a, b, 0]); last = 0; }
        else if (s.id === 'meadow') { if (s.w >= 24) pts.push([a + Math.round(s.w * 0.4), -4]); last = 0; }
        else if (s.id === 'terraces') {
          const n2 = Math.round(s.w / 21);
          for (let k = 0; k < n2; k++) flats.push([a + 21 * k, k === n2 - 1 ? b : a + 21 * (k + 1), -2 - 4 * k]);
          last = -2 - 4 * (n2 - 1);
        } else if (s.id === 'orchard') { pts.push([a + 1, last - 1], [b - 1, last - 7]); last -= 7; }
      });
      flats.forEach((f) => { pts.push([f[0], f[2]], [f[1] - 1, f[2]]); });
      pts.sort((p, q) => p[0] - q[0]);
      for (let x = 0; x < GW; x++) {
        const u = (x + 0.5) / U, xo = u - 0.5;
        let off = 0, flat = false;
        for (let k = 0; k < flats.length; k++) if (u >= flats[k][0] && u < flats[k][1]) { off = flats[k][2]; flat = true; break; }
        if (!flat) {
          let p0 = null, p1 = null;
          for (let k = 0; k < pts.length; k++) { if (pts[k][0] <= xo) p0 = pts[k]; else { p1 = pts[k]; break; } }
          if (!p0) off = p1 ? p1[1] : 0;
          else if (!p1 || p1[0] === p0[0]) off = p0[1];
          else {
            let t = (xo - p0[0]) / (p1[0] - p0[0]);
            t = (1 - Math.cos(t * Math.PI)) / 2;
            off = p0[1] + (p1[1] - p0[1]) * t;
          }
          off += 0.8 * Math.sin(xo * 0.37) + 0.6 * Math.sin(xo * 0.81 + 2);
        }
        surf[x] = F(SBp + off);
        const id = segAt[x];
        plantable[x] = id === 'meadow' || id === 'grove' || id === 'young' || id === 'orchard' || id === 'edge' ? 1 : 0;
      }
    })();

    /* The pond, on the plan (l, r, dep) and in grains (L, R, dep). */
    const pond = seg.pond ? { l: seg.pond.x0 + 6, r: seg.pond.x0 + seg.pond.w - 6 } : null;
    if (pond) {
      pond.pdep = clamp(Math.round((pond.r - pond.l) * 0.21), 7, 14);
      pond.L = F(pond.l + 0.5);
      pond.R = F(pond.r + 0.5);
      pond.dep = P(pond.pdep);
      /* The grassy banks either side of the water take seed too. */
      for (let x = F(seg.pond.x0); x < F(seg.pond.x0 + seg.pond.w) && x < GW; x++) if (x < pond.L - P(1) || x > pond.R + P(1)) plantable[x] = 1;
    }
    function pondDepth(xo) { /* On the plan. */
      if (!pond || xo <= pond.l || xo >= pond.r) return 0;
      return pond.pdep * Math.pow(Math.sin(Math.PI * (xo - pond.l) / (pond.r - pond.l)), 0.7);
    }
    const nTerr = seg.terraces ? Math.round(seg.terraces.w / 21) : 0;
    function terraceAt(x) {
      const s = seg.terraces, u = (x + 0.5) / U;
      if (!s || u < s.x0 || u >= s.x0 + s.w) return -1;
      return Math.min(Math.floor((u - s.x0) / 21), nTerr - 1);
    }

    /* -- Sky, moon and the far hills. All of it is what shows through the air. */

    const skyRamp = SH.skyTop.concat(SH.skyHorizon);
    const farC = [pk(mixc(SH.skyHorizon[1], SH.grass[0], 0.22)), pk(mixc(SH.skyHorizon[1], SH.grass[0], 0.3))];
    const midC = [pk(mixc(SH.skyHorizon[0], SH.grass[0], 0.48)), pk(mixc(SH.skyHorizon[0], SH.grass[1], 0.42))];
    const caveC = [pk(mixc(SH.stone[0], [0, 0, 0], 0.5)), pk(mixc(SH.stone[0], [0, 0, 0], 0.42))];
    const holeC = [pk(mixc(SH.topsoil[0], [0, 0, 0], 0.3)), pk(mixc(SH.topsoil[0], [0, 0, 0], 0.22))];
    const moon = { x: Math.round(GWp * 0.78), y: Math.max(9, Math.round(SBp * 0.2)), r: 6.5 }; /* On the plan. */
    {
      const bumps = [];
      for (let b = 0; b < Math.round(GWp / 15); b++) bumps.push([Math.floor(CR() * GWp), 2 + Math.floor(CR() * 3), 2 + Math.floor(CR() * 3)]);
      const span = 1.486 * SBp, lift = 0.571 * SBp;
      /* The sky's shade for each row, before dithering. */
      const rowT = new Float32Array(GH);
      for (let y = 0; y < GH; y++) rowT[y] = Math.pow(clamp((pl(y) + lift) / span, 0, 1), 1.05) * 7;
      for (let x = 0; x < GW; x++) {
        if (x && !(x & 63)) yield;
        const xo = pl(x);
        const farP = SBp - 24 + 5 * Math.sin(xo / 47 + 0.5) + 3 * Math.sin(xo / 19 + 2) + 1.2 * Math.sin(xo / 7);
        let mid = SBp - 13 + 4 * Math.sin(xo / 33 + 3) + 2 * Math.sin(xo / 13 + 1);
        for (let k = 0; k < bumps.length; k++) {
          const du = (xo - bumps[k][0]) / bumps[k][1];
          if (Math.abs(du) <= 1) mid -= bumps[k][2] * Math.sqrt(1 - du * du);
        }
        const far = F(farP + 0.5), midF = F(mid + 0.5);
        for (let y = 0; y < GH; y++) {
          const i = idx(x, y);
          if (y >= surf[x]) { base[i] = holeC[hash(x, y, 7) < 0.5 ? 0 : 1]; continue; }
          if (y >= far) {
            sky[i] = 2;
            base[i] = y >= midF ? midC[hash(x, y, 41) < 0.25 + 0.5 * ((y - midF) / (12 * U)) ? 1 : 0]
              : farC[hash(x, y, 42) < 0.2 + 0.6 * ((y - far) / (14 * U)) ? 1 : 0];
            continue;
          }
          sky[i] = 1;
          const yo = pl(y), t = rowT[y];
          const b = Math.floor(t), th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
          let c = skyRamp[clamp(t - b > th ? b + 1 : b, 0, 7)];
          const dm = Math.abs(xo - moon.x) < 34 && Math.abs(yo - moon.y) < 34 ? Math.hypot(xo - moon.x, yo - moon.y) : 99;
          if (dm <= moon.r) c = dm > moon.r - 0.8 ? SH.moon[0] : SH.moon[1];
          else if (dm < 34) {
            const w = 0.5 * (1 - dm / 34) * (1 - dm / 34);
            if (w >= 0.08 || th <= w * 12) c = mixc(c, SH.moon[0], w);
          }
          base[i] = pk(c);
        }
      }
    }

    /* -- Ground and strata */

    const tb = new Int16Array(GW);
    let cbMax = 0;
    {
      for (let x = 0; x < GW; x++) {
        if (x && !(x & 15)) yield;
        const xo = pl(x), s0 = surf[x], o = s0 / U - SBp, pd = pondDepth(xo), pdR = Math.round(pd), terr = terraceAt(x);
        let t0 = s0 / U + (8 + 0.35 * (2 - o)) * KS + 2.5 * Math.sin(xo / 29 + 1) + 1.5 * Math.sin(xo / 11);
        if (pdR > 0) t0 = Math.max(t0, SBp + 1 + pd + 4);
        tb[x] = F(t0);
        const ab = t0 + 12 * KS + 3 * Math.sin(xo / 41 + 0.5) + 3 * (fbm(xo / 14, 0, 3) - 0.5) + xo * 0.012;
        const lx = (xo - GWp * 0.51) / (GWp * 0.23);
        const lens = Math.max(0, 7 * KS * (1 - lx * lx));
        const bb = ab + lens + 14 * KS + 3 * Math.sin(xo / 53 + 2) + 3 * (fbm(xo / 16, 5, 4) - 0.5);
        const cb = bb + 16 * KS + 3 * Math.sin(xo / 37 + 4) + 2 * (fbm(xo / 12, 9, 5) - 0.5);
        cbMax = Math.max(cbMax, cb);
        const abF = F(ab), lensF = F(ab + lens), bbF = F(bb), cbF = F(cb);
        /* The turf ends raggedly, grain by grain. */
        const turfD = P(2) + (hash(x, 1, 4) < 0.5 ? 0 : 1 + Math.floor(hash(x, 2, 4) * U));
        const pAir = SB + P(1), pWater = SB + P(pd - 1), pBed = SB + P(pd + 2);
        for (let y = s0; y < GH; y++) {
          const jag = hash(x, y, 3), yj = y + (jag < 0.28 ? -1 : jag > 0.72 ? 1 : 0), d = y - s0, yo = pl(y), fk = depthK(yo);
          let i;
          if (pdR >= 3 && y < pBed) {
            /* The pond: a clay bed that holds its water. */
            if (y < pAir) { i = put(x, y, AIR, 0); base[i] = base[idx(x, y - 1)]; sky[i] = 2; zone[i] = Z_POND; continue; }
            /* What shows behind the water when it is low is what shows above it. */
            if (y < pWater) { i = put(x, y, WATER, 0); base[i] = base[idx(x, y - 1)]; zone[i] = Z_POND; sky[i] = 3; continue; }
            i = put(x, y, ROCK, y === pBed - 1 ? K.topsoil[2] : K.sand[pick(0.3, 1.2, x, y, 53)]);
            gk[i] = 7;
            continue;
          }
          if (terr >= 0 && d < P(3)) {
            const mound = (Math.floor((x + 0.5) / U) % 4) < 2, dp = d / U;
            let c;
            if (dp < 1) c = mound ? K.strataA[hash(x, y, 61) < 0.5 ? 1 : 2] : K.topsoil[3];
            else if (dp < 2) c = K.topsoil[mound ? 3 : 2];
            else c = K.topsoil[hash(x, y, 60) < 0.5 ? 1 : 2];
            i = put(x, y, TILL, c);
            gk[i] = 9;
            continue;
          }
          if (pdR > 0 && pdR < 3 && d < P(2)) { i = put(x, y, ROCK, K.sand[pick(0.6, 1.6, x, y, 54)]); gk[i] = 7; continue; }
          if (d < turfD) {
            i = put(x, y, TURF, K.grass[pick(Math.max(0.3, 0.92 - 0.31 * d / U), 0.9, x, y, 5)]);
            gk[i] = 8;
            continue;
          }
          if (yj < tb[x]) {
            i = put(x, y, SOIL, pk(SH.topsoil[pick(0.5 - 0.2 * (y - s0) / Math.max(1, tb[x] - s0) + (fbm(xo / 6, yo / 6, 6) - 0.5) * 0.5, 1.5, x, y, 7)], fk));
            gk[i] = 1;
            continue;
          }
          let kind, c;
          if (yj < abF) { kind = 2; c = SH.strataA[pick(0.5 + 0.22 * Math.sin(yo * 0.9 + fbm(xo / 20, yo / 6, 8) * 4) + 0.12 * (fbm(xo / 8, yo / 3, 9) - 0.5), 1.1, x, y, 10)]; }
          else if (yj < lensF) { kind = 3; c = SH.sand[pick(0.55, 1.7, x, y, 11)]; }
          else if (yj < bbF) { kind = 4; c = SH.strataB[pick(0.5 + 0.18 * Math.sin(yo * 0.7 + xo * 0.03) + 0.2 * (fbm(xo / 10, yo / 4, 12) - 0.5), 1.1, x, y, 13)]; }
          else if (yj < cbF) { kind = 5; c = SH.strataC[pick(0.5 + 0.2 * Math.sin(yo * 0.6 + xo * 0.02) + 0.25 * (fbm(xo / 9, yo / 4, 14) - 0.5), 1.1, x, y, 15)]; }
          else {
            /* Stone in beds: each bed its own tone, a darker parting between them. */
            const bedY = yo + 3 * Math.sin(xo / 31) + 2 * Math.sin(xo / 13 + 1) + 0.03 * xo;
            const bedN = Math.floor(bedY / 7), inBed = bedY - bedN * 7;
            let st = 0.28 + 0.42 * hash(bedN, 0, 120) + 0.3 * (fbm(xo / 9, yo / 5, 16) - 0.5);
            if (inBed < 0.7 && hash(x, y, 17) > 0.15) st -= 0.32;
            if (inBed > 5.5) st += 0.08;
            kind = 6;
            c = SH.stone[pick(st, 0.8, x, y, 18)];
          }
          i = put(x, y, ROCK, pk(c, fk));
          gk[i] = kind;
        }
      }
    }

    yield;

    /* Pebbles and boulders: rounded, lit from above, a dark rim underneath. */
    (function () {
      const n = Math.round(GWp * D * 0.00175);
      for (let p = 0; p < n; p++) {
        const px = Math.floor(CR() * GWp), py = Math.floor(SBp + 5 + CR() * (D - 5));
        const pr = CR() < 0.22 ? 2 + CR() * 2.6 : 0.8 + CR() * 1.2;
        const cx = (px + 0.5) * U, cy = (py + 0.5) * U, rx = pr * 1.4 * U, ry = pr * U;
        const k0 = gk[idx(clamp(Math.floor(cx), 0, GW - 1), clamp(Math.floor(cy), 0, GH - 1))];
        if (!(k0 === 1 || k0 === 2 || k0 === 4 || k0 === 5 || k0 === 6)) continue;
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
          for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
            if (!inb(x, y)) continue;
            const ex = (x + 0.5 - cx) / rx, ey = (y + 0.5 - cy) / ry, e = ex * ex + ey * ey;
            const k1 = gk[idx(x, y)];
            if (e > 1 || !(k1 === 1 || k1 === 2 || k1 === 4 || k1 === 5 || k1 === 6)) continue;
            let lt = 0.7 - 0.3 * ex - 0.45 * ey + (k0 === 6 ? 0.2 : 0);
            if (e > 0.6 && ey > 0.2) lt = 0.05;
            else if (e > 0.55 && ey < -0.35 && ex < 0.2) lt += 0.18;
            const i = put(x, y, ROCK, pk(SH.stone[pick(lt, 0.5, x, y, 19)], depthK(pl(y))));
            gk[i] = 10;
          }
        }
      }
    })();

    yield;

    mark(1);
    /* -- Underground: the water under the beds, the cave, the stream between, the well and the cellar.
       Their shapes are on the plan; the water lines and floors are in grains. */

    const well = seg.home ? seg.home.x0 + (seg.home.w >= 58 ? 47 : 46) : Math.round(GWp * 0.6);
    const aq = { rx: clamp(Math.round(GWp * 0.12), 20, 46), ry: clamp(Math.round(D * 0.068), 6, 10) };
    aq.x = Math.round(Math.min(well + aq.rx * 0.6, GWp - aq.rx * 0.5));
    if (aq.x - aq.rx * 0.75 > well - 1) aq.x = Math.round(well - 1 + aq.rx * 0.75);
    aq.y = Math.max(SBp + Math.round(D * 0.52), Math.round(cbMax) + aq.ry - 2);
    const cv = { rx: clamp(Math.round(GWp * 0.11), 18, 42), ry: clamp(Math.round(D * 0.082), 8, 13) };
    cv.y = Math.min(Math.max(SBp + Math.round(D * 0.71), aq.y + aq.ry + 6), Math.floor(GHp) - cv.ry - 8);
    cv.x = clamp(pond ? pond.l : Math.round(GWp * 0.22), cv.rx + 3, GWp - cv.rx - 3);
    if ((aq.x - aq.rx) - (cv.x + cv.rx) < 14) {
      cv.rx = Math.max(12, Math.round((aq.x - aq.rx - 14 - 3) / 2));
      cv.x = cv.rx + 3;
    }
    const aqTop = F(aq.y - Math.round(aq.ry * 0.4)); /* Its water line. */
    aq.X = F(aq.x + 0.5);
    aq.RX = aq.rx * U;

    function blob(cx, cy, rx, ry, salt, fn) {
      for (let y = F(cy - ry - 3); y < F(cy + ry + 4); y++) {
        for (let x = F(cx - rx - 4); x < F(cx + rx + 5); x++) {
          if (!inb(x, y)) continue;
          const xo = pl(x), yo = pl(y);
          const e = ((xo - cx) / rx) * ((xo - cx) / rx) + ((yo - cy) / ry) * ((yo - cy) / ry);
          if (e < 1 + 0.45 * (fbm(xo / 6, yo / 4, salt) - 0.5)) fn(x, y);
        }
      }
    }
    function hollow(x, y, z) {
      const i = put(x, y, AIR, 0);
      if (i < 0) return -1;
      zone[i] = z;
      gk[i] = 0;
      base[i] = caveC[hash(x, y, 71) < 0.5 ? 0 : 1];
      return i;
    }

    blob(aq.x, aq.y, aq.rx, aq.ry, 73, (x, y) => {
      if (y >= aqTop) { const i = put(x, y, WATER, 0); zone[i] = Z_AQ; base[i] = caveC[0]; gk[i] = 0; }
      else hollow(x, y, Z_AQ);
    });

    const caveFloor = new Int16Array(GW).fill(-1);
    blob(cv.x, cv.y, cv.rx, cv.ry, 70, (x, y) => { hollow(x, y, Z_CAVE); });
    for (let x = Math.max(0, F(cv.x - cv.rx - 4)); x <= Math.min(GW - 1, F(cv.x + cv.rx + 5)); x++) {
      const xo = pl(x);
      const fl = F(cv.y + cv.ry * 0.5 + 2 * Math.sin(xo / 9) + (xo < cv.x - cv.rx * 0.5 ? (cv.x - cv.rx * 0.5 - xo) * 0.15 : 0) + 0.5);
      for (let y = fl; y < F(cv.y + cv.ry + 6) && y < GH; y++) {
        if (zone[idx(x, y)] === Z_CAVE && mat[idx(x, y)] === AIR) {
          const i = put(x, y, ROCK, K.sand[pick(0.45 - (y - fl) / U * 0.05, 1.4, x, y, 72)]);
          zone[i] = 0;
          gk[i] = 11;
          if (caveFloor[x] < 0) caveFloor[x] = y;
        }
      }
    }

    /* A slow stream from the water under the beds down to the cave, a stair of small still pools,
       each holding behind a lip of stone, so that it runs only when the ground gives it water. */
    const pool = { L: 0, R: -1, top: 0 };
    /* Where things are, in grains, for the machine and for the film: filled in as the parts are placed. */
    const geo = { aqTop, aq: { x: aq.X, rx: aq.RX }, stair: null, well: null, bed: null };
    if (pond) geo.pond = { L: pond.L, R: pond.R, top: SB, dep: pond.dep };
    (function () {
      let sx = -1;
      for (let x = 0; x < GW && sx < 0; x++) if (zone[idx(x, aqTop + P(1))] === Z_AQ) sx = x;
      const my = F(cv.y - 2);
      let ex = -1;
      for (let x = GW - 1; x >= 0 && ex < 0; x--) if (zone[idx(x, my)] === Z_CAVE) ex = x;
      if (sx < 0 || ex < 0 || sx - ex < P(12)) return;
      const b0 = aqTop + P(2), bEnd = my + P(2), deep = P(5), full = P(2);
      const L = sx - ex, n = clamp(Math.round(L / (11 * U)), 2, 12), span = (L - P(3)) / n;
      function carve(x, b, from, fill) {
        const top = Math.min(from, b - deep - (hash(x, b, 140) < 0.35 ? 1 : 0));
        for (let y = top; y < b; y++) {
          const z = zone[idx(x, y)];
          if (z === Z_AQ || z === Z_CAVE) continue;
          if (fill && y >= b - full) { const i = put(x, y, WATER, 0); zone[i] = Z_STREAM; base[i] = caveC[0]; gk[i] = 0; }
          else hollow(x, y, Z_STREAM);
        }
        const bi = idx(x, b);
        if (zone[bi] !== Z_AQ && zone[bi] !== Z_CAVE && mat[bi] !== AIR) { put(x, b, ROCK, pk(SH.sand[pick(0.35, 1.2, x, b, 132)], 0.8)); gk[bi] = 11; }
      }
      let prevTop = b0 - deep;
      for (let k = 0; k < n; k++) {
        const xa = k === 0 ? sx + P(3) : Math.round(sx - k * span);
        const xb = Math.round(sx - (k + 1) * span) + 1;
        const b = Math.round(b0 + (bEnd - b0) * k / n);
        for (let x = xa; x >= xb; x--) carve(x, b, x === xa ? Math.min(prevTop, b - deep) : b - deep, true);
        /* The lip. */
        for (let y = b - full; y < b; y++) { const i = put(xb, y, ROCK, pk(SH.stone[y === b - full ? 3 : 2], 0.9)); zone[i] = 0; gk[i] = 12; }
        prevTop = b - deep;
        if (!geo.stair) geo.stair = { sx, steps: [] };
        geo.stair.steps.push({ xa, xb, b, top: b - deep, water: b - full });
      }
      const xs = Math.round(sx - n * span);
      for (let x = xs; x >= ex - 1; x--) carve(x, bEnd, x === xs ? Math.min(prevTop, bEnd - deep) : bEnd - deep, false);
      /* Where it meets the cave it falls into a pool, dug into the cave floor. */
      const hw = P(clamp(Math.round(cv.rx * 0.3), 6, 12));
      pool.R = Math.min(GW - 2, ex + P(1));
      pool.L = Math.max(1, pool.R - 2 * hw);
      const mid = (pool.L + pool.R) >> 1;
      pool.top = caveFloor[mid] > 0 ? caveFloor[mid] : F(cv.y + cv.ry - 3);
      for (let x = pool.L; x <= pool.R; x++) {
        const dep = P(2 + 3 * Math.sin(Math.PI * (x - pool.L + U) / (pool.R - pool.L + 2 * U)));
        for (let y = pool.top - P(4); y < pool.top; y++) {
          const i = idx(x, y);
          if (mat[i] === ROCK && gk[i] === 11) hollow(x, y, Z_CAVE);
        }
        for (let y = pool.top; y < pool.top + dep; y++) {
          const i = put(x, y, WATER, 0);
          zone[i] = Z_POOL;
          base[i] = caveC[0];
          gk[i] = 0;
        }
        for (let y = pool.top + dep; y < pool.top + dep + P(3); y++) {
          const i = idx(x, y);
          if (mat[i] === AIR || zone[i]) { put(x, y, ROCK, K.sand[pick(0.3, 1.2, x, y, 134)]); zone[i] = 0; gk[i] = 11; }
        }
        caveFloor[x] = -1;
      }
      [pool.L - 1, pool.R + 1].forEach((x) => {
        for (let y = pool.top; y < pool.top + P(3); y++) {
          const i = idx(x, y);
          if (inb(x, y) && mat[i] === AIR) { put(x, y, ROCK, K.sand[1]); zone[i] = 0; gk[i] = 11; }
        }
      });
    })();

    mark(2);
    /* The well shaft, lined in stone, down to the water. */
    let shaftBottom = -1;
    const ropeX = F(well + 0.5);
    if (seg.home) {
      const s0 = F(well - 1), s1 = F(well + 2), wl = F(well - 2), wr = F(well + 3);
      for (let y = SB; y < GH - 1; y++) {
        if (shaftBottom < 0 && zone[idx(ropeX, y)] === Z_AQ) shaftBottom = y;
        let open = 0;
        for (let x = s0; x < s1; x++) if (zone[idx(x, y)] !== Z_AQ) { hollow(x, y, Z_SHAFT); open++; }
        if (!open) break;
        const course = y - F(Math.floor((y + 0.5) / U / 3) * 3) === 0, yo = pl(y);
        for (let x = wl; x < s0; x++) if (zone[idx(x, y)] !== Z_AQ) put(x, y, MASON, pk(SH.stone[course ? 0 : x === s0 - 1 ? 1 : 2], depthK(yo)));
        for (let x = s1; x < wr; x++) if (zone[idx(x, y)] !== Z_AQ) put(x, y, MASON, pk(SH.stone[course ? 0 : 1], depthK(yo)));
      }
    }

    mark(3);
    /* A geode and a fossil, for whoever digs. */
    const lamps = [];
    (function () {
      function solidStone(x0, y0, rx, ry) {
        for (let y = y0 - ry; y <= y0 + ry; y++) for (let x = x0 - rx; x <= x0 + rx; x++) {
          if (!inb(x, y) || mat[idx(x, y)] !== ROCK || zone[idx(x, y)] || gk[idx(x, y)] === 11) return false;
        }
        return true;
      }
      const tries = [[0.9, cv.y + 4], [0.12, GHp - 12], [0.62, GHp - 11]];
      for (let k = 0; k < tries.length; k++) {
        const gx = Math.round(GWp * tries[k][0]), gy = Math.min(Math.floor(GHp) - 10, Math.round(tries[k][1]));
        const cx = (gx + 0.5) * U, cy = (gy + 0.5) * U;
        if (!solidStone(Math.floor(cx), Math.floor(cy), P(10), P(8))) continue;
        for (let y = Math.floor(cy - 7 * U); y <= cy + 7 * U; y++) for (let x = Math.floor(cx - 9 * U); x <= cx + 9 * U; x++) {
          const e = Math.hypot((x + 0.5 - cx) / (9 * U), (y + 0.5 - cy) / (7 * U));
          if (e > 1) continue;
          if (e > 0.82) put(x, y, ROCK, K.stone[e > 0.95 ? 2 : 3]);
          else if (e > 0.62) put(x, y, ROCK, K.water[hash(x, y, 133) < 0.25 ? 3 : 2]);
          else if (e > 0.25) { if (hash(x, y, 136) < 0.3) put(x, y, LAMP, K.glow[3]); else put(x, y, ROCK, K.water[3]); }
          else put(x, y, LAMP, K.glow[2]);
        }
        [[-2, -1], [3, 1], [0, 2]].forEach((s) => {
          const lx = Math.floor(cx + s[0] * U), ly = Math.floor(cy + s[1] * U);
          put(lx, ly, LAMP, K.glow[3]);
          lamps.push([lx, ly, P(4), 0.35, 1]);
        });
        break;
      }
      const fx = Math.round(GWp * 0.46), fy = Math.min(Math.floor(GHp) - 9, cv.y + cv.ry + 10);
      if (solidStone(F(fx + 0.5), F(fy + 0.5), P(7), P(6))) {
        for (let t = 0; t < Math.PI * 4.2; t += 0.08 / U) {
          const r = 0.6 + t * 0.5;
          put(Math.floor((fx + 0.5 + r * Math.cos(t)) * U), Math.floor((fy + 0.5 + r * Math.sin(t) * 0.9) * U), ROCK, pk(SH.sand[t > 9 ? 3 : 2], 0.85));
        }
      }
    })();

    yield;

    mark(4);
    /* Rock round an opening is darkest, and a little dark a grain further in. */
    (function () {
      const rim = new Uint8Array(N);
      const open = (i) => { const z = zone[i]; return z === Z_CAVE || z === Z_AQ || z === Z_STREAM || z === Z_POOL; };
      const rock = (i) => mat[i] === ROCK && gk[i] !== 11 && gk[i] !== 12 && gk[i] !== 7;
      for (let i = W; i < N - W; i++) {
        if (!rock(i)) continue;
        for (let k = 0; k < 4; k++) if (open(i + NB4[k])) { rim[i] = 1; break; }
      }
      if (U >= 1.7) {
        for (let i = W; i < N - W; i++) {
          if (rim[i] || !rock(i)) continue;
          for (let k = 0; k < 4; k++) if (rim[i + NB4[k]] === 1) { rim[i] = 2; break; }
        }
      }
      for (let i = W; i < N - W; i++) if (rim[i]) col[i] = orig[i] = darken(col[i], rim[i] === 1 ? 212 : 236);
    })();

    yield;

    mark(5);
    /* -- On the ground */

    const canopy = [], canopyCol = [], canopyBloom = [], canopyAt = new Int32Array(N).fill(-1);
    /* A root wanders down a grain at a time; it wanders as far, step for step of the plan, at any size of grain.
       It throws its own dice, so the number of grains it takes leaves the rest of the opening's dice alone. */
    const ROOT_KEEP = Math.pow(0.92, 1 / U), ROOT_WANDER = 1.1 * Math.sqrt(U);
    function root(x0, y0, len, depth) {
      const RR = rngOf(Math.floor(hash(x0, y0, 81 + depth) * 4294967296));
      let x = x0, y = y0, dir = (hash(x0, y0, 80) - 0.5) * 0.8;
      for (let k = 0; k < len; k++) {
        const rx = Math.round(x), ry = Math.round(y);
        if (!inb(rx, ry)) break;
        const i = idx(rx, ry), g = gk[i];
        if (mat[i] !== ROOT) {
          if (!(g === 1 || g === 2 || g === 8 || g === 4 || g === 9)) break;
          put(rx, ry, ROOT, K.wood[k < len * 0.4 ? 1 : 0]);
          if (depth === 0 && k < len * 0.3) { const g2 = gk[i + 1]; if (mat[i + 1] !== ROOT && (g2 === 1 || g2 === 2 || g2 === 8 || g2 === 4)) put(rx + 1, ry, ROOT, K.wood[0]); }
        }
        y += 1;
        x += dir + (RR() - 0.5) * ROOT_WANDER;
        dir *= ROOT_KEEP;
        if (depth < 2 && RR() < 0.07 / U) root(Math.round(x), Math.round(y), Math.floor(len * 0.55), depth + 1);
      }
    }

    function tree(bx, h, cyOff, clusters, opts) {
      if (bx < 0 || bx >= GWp) return;
      const X = F(bx + 0.5), by = surf[X], baseW = opts.baseW || 4, xm = X + 0.5;
      let top = cyOff;
      clusters.forEach((c) => { top = Math.max(top, cyOff - c[1] + c[2]); });
      const f = clamp((by / U - 2) / top, 0.5, 1);
      const hh = P(Math.round(h * f));
      const cx = xm + (opts.dx || 0) * U, cy = by - P(Math.round(cyOff * f)), rr = (opts.r || 16) * f * U;
      clusters = clusters.map((c) => [Math.round(c[0] * f) * U, Math.round(c[1] * f) * U, Math.max(3, c[2] * f) * U]);
      /* The trunk tapers, with the bark in long runs. */
      for (let y = by - 1; y >= by - hh; y--) {
        const k = (by - y) / hh, w = Math.max(2, Math.round((baseW + (2 - baseW) * k) * U)), left = Math.round(xm - w / 2);
        for (let i = 0; i < w; i++) {
          const bark = hash(left + i, Math.floor(y / (3 * U)), 85);
          put(left + i, y, WOOD, K.wood[i === 0 ? 3 : i === w - 1 ? 0 : i === w - 2 && w > 4 ? 1 : (bark < 0.5 ? 1 : 2)]);
        }
      }
      /* It flares where it meets the ground. */
      const fh = Math.max(1, P(1.5)), w0 = Math.round(baseW * U), l0 = Math.round(xm - w0 / 2);
      for (let y = by - fh; y < by; y++) {
        const spread = Math.max(1, Math.round((1 - (by - 1 - y) / fh) * U));
        for (let s = 1; s <= spread; s++) { put(l0 - s, y, WOOD, K.wood[2]); put(l0 + w0 - 1 + s, y, WOOD, K.wood[0]); }
      }
      clusters.forEach((c, ci) => {
        if (ci % 2) return;
        const tx = cx + c[0], ty = cy + c[1], sx = xm, sy = by - hh + P(2), n = Math.ceil(Math.max(Math.abs(tx - sx), Math.abs(ty - sy)));
        for (let s = 0; s <= n; s++) {
          const x = sx + (tx - sx) * s / n, y = sy + (ty - sy) * s / n;
          put(x, y, WOOD, K.wood[1]);
          if (U >= 1.7 && s < n * 0.6) put(x, y + 1, WOOD, K.wood[0]);
        }
      });
      clusters.forEach((c) => {
        const ccx = cx + c[0], ccy = cy + c[1], r = c[2];
        for (let y = Math.floor(ccy - r - U); y <= ccy + r + U; y++) {
          for (let x = Math.floor(ccx - r - U); x <= ccx + r + U; x++) {
            if (!inb(x, y)) continue;
            const xo = pl(x), yo = pl(y);
            const dd = Math.hypot(x + 0.5 - ccx, (y + 0.5 - ccy) * 1.12), edge = r * (0.86 + 0.28 * fbm(xo / 4, yo / 4, 86));
            if (dd > edge || (dd > edge - 1.1 * U && hash(x, y, 87) < 0.45)) continue;
            const gl = 0.5 - 0.42 * (x - cx) / rr - 0.5 * (y - cy) / rr, lc = 0.5 - 0.3 * (x - ccx) / r - 0.4 * (y - ccy) / r;
            /* Light on the whole crown, on each cluster, and on each little clump of leaves. */
            let t = 0.55 * gl + 0.45 * lc + (fbm(xo / 3, yo / 3, 88) - 0.5) * 0.55 + (vnoise(x / 1.7, y / 1.7, 188) - 0.5) * 0.3;
            let bl = false;
            if (opts.blossom && fbm(xo / 2.6, yo / 2.6, 89) > 0.56) { bl = true; t += 0.25; }
            const m0 = mat[idx(x, y)];
            if (m0 !== AIR && m0 !== WOOD && m0 !== CANOPY) continue;
            const i = put(x, y, CANOPY, (bl ? K.blossom : K.leaf)[pick(t, 1.0, x, y, 90)]);
            if (m0 !== CANOPY) { canopyAt[i] = canopy.length; canopy.push(i); canopyBloom.push(bl ? 1 : 0); canopyCol.push(col[i]); }
            else { const k = canopyAt[i]; canopyCol[k] = col[i]; canopyBloom[k] = bl ? 1 : 0; }
          }
        }
      });
      for (let k = 0; k < (opts.roots || 4); k++) root(X - P(2) + Math.floor(CR() * P(5)), by + P(3), P(10 + Math.floor(CR() * 16)), 0);
    }

    function bush(cx, w, h, berries) { /* On the plan. */
      const hh = h * U;
      for (let x = F(cx - w); x < F(cx + w + 1); x++) {
        if (x < 0 || x >= GW) continue;
        const xo = pl(x), u = (xo - cx) / w;
        const top = surf[x] - Math.round(hh * Math.sqrt(Math.max(0, 1 - u * u)) * (0.85 + 0.3 * vnoise(xo / 2, cx, 95))) + (hash(x, 0, 194) < 0.3 ? 1 : 0);
        for (let y = top; y < surf[x]; y++) {
          if (at(x, y) !== AIR) continue;
          const t = 0.6 - 0.35 * u - 0.6 * (y - (surf[x] - hh)) / hh + (fbm(xo / 2.5, pl(y) / 2.5, 96) - 0.5) * 0.5 + (vnoise(x / 1.5, y / 1.5, 196) - 0.5) * 0.25;
          if (berries && hash(x, y, 97) < 0.07) put(x, y, GREEN, K.blossom[1 + (hash(x, y, 98) < 0.5 ? 1 : 0)]);
          else put(x, y, GREEN, K.bush[pick(t, 1.0, x, y, 99)]);
        }
      }
      const X = F(cx + 0.5);
      if (X >= 0 && X < GW) root(X, surf[X] + P(3), P(7), 1);
    }

    const lights = []; /* [x, y, radius, strength, kind]: 0 steady, 1 twinkles, 2 the window */
    const chimney = [], eyes = [];
    /* Today's creature and sprout, held while the opening settles; where Coracle hovers (null: not in this frame). */
    const stand = [];
    let hover = null;
    const fish = [], flies = [], plants = [], fungi = [], worms = [];
    const mossGroup = new Uint8Array(N); /* Which named place a mossy surface belongs to. */

    mark(6);
    /* The pond: lilies, fish, reeds, and the bridge over it. */
    const FL = Math.max(3, P(3)); /* A fish, nose to tail. */
    if (pond) {
      const s = seg.pond, pw = pond.r - pond.l, lilyRow = SB + P(1) - 1;
      (pw >= 40 ? [[0.26, 6], [0.55, 5], [0.77, 3]] : [[0.3, 4], [0.68, 3]]).forEach((l, n) => {
        const lx = Math.round(pond.l + pw * l[0]), x0 = F(lx), x1 = F(lx + l[1]);
        for (let x = x0; x < x1; x++) put(x, lilyRow, LILY, K.bush[x === x0 || x === x1 - 1 ? 1 : 3 - (hash(x, 2, 85) < 0.6 ? 0 : 1)]);
        /* A flower on the first pad, a bud on the second. */
        if (n === 0) {
          for (let x = F(lx + 2); x < F(lx + 4); x++) for (let y = lilyRow - P(1); y < lilyRow; y++) {
            const u = (x + 0.5) / U - lx - 3, v = (lilyRow - y - 0.5) / U;
            if (Math.abs(u) < 1 - v * 0.6) put(x, y, LILY, K.blossom[Math.abs(u) < 0.4 ? 3 : 2]);
          }
        }
        if (n === 1) for (let y = lilyRow - P(1); y < lilyRow; y++) put(F(lx + 2.5), y, LILY, K.wild[3]);
      });
      const fy = SB + P(1 + clamp(Math.round(pond.pdep * 0.45), 2, 6));
      fish.push({ x: F(pond.l + pw * 0.39), y: fy, dir: 1, every: 13, acc: 0 });
      if (pw >= 40) fish.push({ x: F(pond.l + pw * 0.68), y: fy - P(1), dir: -1, every: 17, acc: 0.4 });
      const reeds = (x0, x1) => {
        for (let x = F(x0); x < F(x1 + 1); x++) {
          if (hash(x, 1, 81) < 0.4) continue;
          const h = P(5) + Math.floor(hash(x, 2, 82) * P(9)), top = SB - h, lean = hash(x, 3, 83) < 0.5 ? -1 : 1, bend = P(3);
          for (let y = SB; y > top; y--) putOpen(x + (y < top + bend && h > P(9) ? lean : 0), y, GREEN, K.crop[y < top + P(4) ? 3 : 2]);
          /* Now and then a reed has a seed head. */
          if (h >= P(9) && hash(x, 4, 84) < 0.6 / U) {
            for (let y = top + 1; y <= top + P(3); y++) for (let k = 0; k < (U >= 1.8 ? 2 : 1); k++) putOpen(x + lean + k * lean, y, WOOD, K.wood[y === top + 1 || k ? 1 : 2]);
          }
        }
      };
      const rw = Math.max(4, Math.round(9 * s.w / 78));
      reeds(s.x0 + 4, s.x0 + 4 + rw);
      reeds(s.x0 + s.w - 5 - rw, s.x0 + s.w - 4);
      const bx0 = s.x0 + 2, bx1 = s.x0 + s.w - 2, arch = clamp(Math.round((bx1 - bx0) * 0.108), 4, 8);
      const deck = (xo) => F(SBp - 1 - arch * Math.sin(Math.PI * (xo - bx0) / (bx1 - bx0)));
      for (let x = F(bx0); x < F(bx1 + 1); x++) {
        const xo = pl(x), dy = deck(xo), plank = Math.floor((xo + 0.5 - bx0) / 3), u = Math.floor(xo + 0.5 - bx0 + 7) % 9;
        const over = x > pond.L && x < pond.R ? Z_POND : 0;
        const gap = x === F(bx0 + 3 * plank);
        /* The deck: planks on a beam. */
        for (let y = dy; y < dy + P(2); y++) {
          const top = y < dy + P(1);
          zone[put(x, y, WOOD, top ? K.wood[gap ? 1 : y === dy ? 3 : plank % 2 ? 3 : 2] : K.wood[y === dy + P(2) - 1 ? 0 : 1])] = over;
        }
        /* The rail, its posts, and a short brace between them. */
        zone[put(x, dy - P(5), WOOD, K.wood[3])] = over;
        if (u === 0 && x === F(Math.floor(xo + 0.5))) { for (let y = dy - P(5) + 1; y < dy; y++) put(x, y, WOOD, K.wood[y < dy - P(4) ? 2 : 1]); }
        else if (u === 4 || u === 5) put(x, dy - P(2), WOOD, K.wood[1]);
      }
      [0.35, 0.65].forEach((f) => {
        const px = Math.round(bx0 + (bx1 - bx0) * f);
        for (let x = F(px); x < F(px + 2); x++) {
          const xo = pl(x);
          for (let y = deck(xo) + P(2); y < SB + P(pondDepth(xo)); y++) put(x, y, WOOD, K.wood[x === F(px) && y < SB ? 1 : 0]);
        }
      });
    }

    yield;

    mark(7);
    /* Trees. */
    if (seg.grove) {
      const s = seg.grove, tx = s.x0 + Math.round(s.w * 0.54);
      tree(tx, 30, 35, [[-15, 5, 10], [0, -4, 13], [14, 3, 10], [-7, 9, 9], [8, 10, 9], [1, -13, 8], [-9, -6, 8], [11, -7, 7]], { baseW: 5, r: 22, roots: 6 });
      bush(s.x0 + 6, 7, 6, false);
      if (s.w >= 52) bush(s.x0 + s.w - 7, 5, 4, true);
    }
    if (seg.young) tree(seg.young.x0 + 12, 18, 27, [[-7, 2, 7], [6, 1, 8], [0, -6, 7]], { baseW: 3, r: 11, roots: 3 });
    if (seg.orchard) {
      const s = seg.orchard, tx = s.x0 + 16;
      tree(tx, 20, 26, [[-11, 2, 8], [0, -4, 10], [10, 1, 8], [-4, 6, 7], [7, 6, 7]], { baseW: 4, r: 15, blossom: true, roots: 4, dx: -1 });
      if (s.w >= 34 || s.x0 + s.w < GWp - 4) bush(s.x0 + 30, 5, 4, false);
    }

    mark(8);
    /* The meadow, with a sapling tied to its stake. */
    if (seg.meadow) {
      const s = seg.meadow;
      if (s.w >= 20) bush(s.x0 + 4, 5, 4, false);
      if (s.w >= 40) bush(s.x0 + Math.round(s.w * 0.48), 6, 5, true);
      if (s.w >= 50) bush(s.x0 + s.w - 4, 4, 4, false);
      if (s.w >= 30) {
        const bx = s.x0 + Math.round(s.w * 0.74), X = F(bx + 0.5), by = surf[X], st = F(bx + 2.5);
        for (let y = by - 1; y >= by - P(8); y--) put(X, y, WOOD, K.wood[2]);
        for (let y = by - 1; y >= by - P(7); y--) put(st, y, WOOD, K.wood[3]);
        for (let x = X + 1; x < st; x++) put(x, by - P(5), GREEN, K.crop[3]);
        const ccx = X + 0.5, ccy = by - P(12) + 0.5;
        for (let y = Math.floor(ccy - 6 * U); y <= ccy + 5 * U; y++) for (let x = Math.floor(ccx - 6 * U); x <= ccx + 6 * U; x++) {
          const dx = (x + 0.5 - ccx) / U, dy = (y + 0.5 - ccy) / U;
          if (Math.hypot(dx, dy * 1.2) > 4.6 + (hash(x, y, 93) - 0.5) * 0.9) continue;
          if (at(x, y) === AIR) put(x, y, GREEN, K.leaf[pick(0.55 - 0.08 * dx - 0.1 * dy + (vnoise(x / 1.6, y / 1.6, 193) - 0.5) * 0.3, 1.0, x, y, 94)]);
        }
        root(X, by + P(3), P(9), 1);
      }
    }
    segs.forEach((s) => { if (s.id === 'edge' && s.w >= 16) bush(s.x0 + (s.w >> 1), 4, 4, s.x0 > 0); });

    yield;

    mark(9);
    /* The cabin, with a cellar under it, a lantern by the path, and the well.
       Drawn in steps of the plan, each step filled grain by grain. */
    if (seg.home) {
      const s = seg.home, full = s.w >= 58, ox = s.x0 - (full ? 209 : 210), oy = SBp - 110;
      const X = (u) => F(u + ox), Y = (v) => F(v + oy);
      /* Steps xa to xb and ya to yb of the drawing, both ends in; fn gets each grain and where its middle falls in the drawing. */
      const B = (xa, xb, ya, yb, fn) => {
        const x1 = X(xb + 1), y1 = Y(yb + 1);
        for (let y = Y(ya); y < y1; y++) for (let x = X(xa); x < x1; x++) fn(x, y, (x + 0.5) / U - ox, (y + 0.5) / U - oy);
      };
      /* The footing. */
      B(213, 245, 106, 109, (x, y) => {
        const b = brick(x, y, X(213), Y(106), 4, 1, 2);
        const i = put(x, y, MASON, y === Y(106) || b === JOINT ? K.stone[0] : K.stone[pick(0.6 + b, 1.2, x, y, 100)]);
        if (i >= 0) mossGroup[i] = 3;
      });
      /* Walls of planks, a board end here and there. */
      B(214, 244, 92, 105, (x, y, u, v) => {
        const plank = Math.floor((v - 92) / 2), seam = y === Y(94 + 2 * plank) - 1, ui = Math.floor(u);
        let sh = plank % 2 ? 2 : 3;
        if (seam) sh = 1;
        else if (ui % 7 === 0 && x === X(ui) && hash(Math.floor(ui / 7), plank, 101) < 0.3) sh = 1;
        else if (hash(Math.floor(x / 3), y, 201) < 0.1) sh--;
        if (x === X(214)) sh = Math.min(3, sh + 1);
        if (x === X(245) - 1) sh = 0;
        put(x, y, WOOD, K.wood[sh]);
      });
      /* The window, lit from inside. */
      B(218, 226, 95, 101, (x, y, u, v) => {
        const fr = x === X(218) || x === X(227) - 1 || y === Y(95) || y === Y(102) - 1 || x === F(222.5 + ox) || y === F(98.5 + oy);
        if (fr) put(x, y, WOOD, K.wood[0]);
        else put(x, y, LAMP, K.glow[(v < 98.5 ? 2 : 1) + (u < 222.5 ? 1 : 0)]);
      });
      lights.push([F(222.5 + ox), F(98.5 + oy), P(13), 0.4, 2]);
      B(231, 237, 97, 105, (x, y, u, v) => {
        const ui = Math.floor(u), edge = x === X(231) || x === X(238) - 1 || y === Y(97);
        let sh = edge ? 0 : Math.max(0, (ui % 2 ? 1 : 2) - (v >= 104 ? 1 : 0));
        if (!edge && x === X(ui) && sh) sh--;
        put(x, y, WOOD, K.wood[sh]);
      });
      put(F(236.5 + ox), F(101.5 + oy), LAMP, K.glow[2]);
      /* Thatch with moss on it, and a wooden eave. */
      B(210, 248, 79, 91, (x, y, u, v) => {
        const half = (v - 78.5) * 1.42 + 0.5, L = 229.5 - half - 0.5, R = 229.5 + half + 0.5;
        if (u < L || u >= R) return;
        if (v >= 91) { const ui = Math.floor(u); put(x, y, WOOD, K.wood[(ui % 3 === 0 && x === X(ui)) || y === Y(92) - 1 ? 0 : 1]); return; }
        const eL = (u - L) * U, eR = (R - u) * U, mo = fbm(u / 3, v / 2, 102);
        const t = 0.65 - 0.025 * (u - 229) - 0.03 * (v - 79) + (hash(x, Math.floor(y / Math.max(1, P(1.5))), 203) - 0.5) * 0.3;
        if (eL < 1 || eR < 1) put(x, y, WOOD, K.wood[1]);
        else if (mo > 0.5) put(x, y, GREEN, K.bush[pick(t + 0.1 + (vnoise(x / 1.5, y / 1.5, 204) - 0.5) * 0.3, 1.0, x, y, 103)]);
        else put(x, y, WOOD, K.crop[pick(t - 0.15, 1.0, x, y, 104)]);
      });
      B(237, 240, 75, 86, (x, y, u, v) => {
        let i;
        if (v < 76) i = put(x, y, MASON, K.stone[y === Y(76) - 1 ? 1 : 3]);
        else { const b = brick(x, y, X(237), Y(76), 2, 1.5, 1); i = put(x, y, MASON, b === JOINT ? K.stone[0] : K.stone[pick(0.55 + b, 0.9, x, y, 158)]); }
        if (i >= 0) mossGroup[i] = 3;
      });
      for (let x = X(238); x < X(240); x++) if (inb(x, Y(75) - 1)) chimney.push(idx(x, Y(75) - 1));
      /* The cellar: shelves of preserves and a lantern. */
      B(217, 241, 112, 124, (x, y, u, v) => {
        if (u < 218 || u >= 241 || v >= 124) {
          const b = brick(x, y, X(217), Y(112), 2, 1, 1);
          put(x, y, MASON, b === JOINT ? K.stone[0] : K.stone[pick(0.42 + b, 1.0, x, y, 159)]);
        } else if (v >= 123) {
          const ui = Math.floor(u);
          put(x, y, WOOD, K.wood[ui % 3 === 0 && x === X(ui) ? 0 : y === Y(123) ? 3 : 2]);
        } else { const i = put(x, y, AIR, 0); if (i >= 0) { zone[i] = Z_CELLAR; base[i] = caveC[hash(x, y, 105) < 0.5 ? 0 : 1]; gk[i] = 0; } }
      });
      [116, 120].forEach((sy) => {
        B(218, 228, sy, sy, (x, y) => { put(x, y, WOOD, K.wood[y === Y(sy) ? 3 : 2]); });
        const jars = sy === 116 ? [[219, K.blossom, 2], [222, K.glow, 1], [225, K.crop, 3], [227, K.wild, 2]]
          : [[219, K.wild, 2], [222, K.sand, 2], [225, K.blossom, 2]];
        jars.forEach((j) => {
          const m = j[1] === K.glow ? LAMP : WOOD, x0 = X(j[0]), x1 = X(j[0] + 2) - 1, y0 = Y(sy - 2);
          /* A jar with a lid, a light side and a dark side. */
          B(j[0], j[0] + 1, sy - 2, sy - 1, (x, y) => {
            if (y === y0) { if (x !== x0 && x !== x1) put(x, y, WOOD, K.wood[1]); return; }
            put(x, y, m, j[1][x === x0 ? Math.min(3, j[2] + 1) : x === x1 ? j[2] - 1 : j[2]]);
          });
        });
      });
      const ra = F(235.5 + ox), rb = F(238.5 + ox);
      for (let y = Y(110); y < Y(123); y++) { put(ra, y, WOOD, K.wood[2]); put(rb, y, WOOD, K.wood[1]); }
      for (let r = 111; r <= 122; r += 3) for (let x = ra + 1; x < rb; x++) put(x, F(r + 0.5 + oy), WOOD, K.wood[3]);
      for (let y = Y(112); y < Y(114); y++) put(F(231.5 + ox), y, WOOD, K.wood[0]);
      B(230, 231, 114, 115, (x, y, u, v) => {
        if (y === Y(114)) put(x, y, WOOD, K.wood[0]);
        else put(x, y, LAMP, K.glow[v < 115 ? 3 : 2]);
      });
      lights.push([F(231 + ox), F(115 + oy), P(11), 0.55, 0]);
      if (full) {
        /* The lantern by the path, and a bit of fence. */
        upright(209.5 + ox, 98 + oy, 110 + oy, K.wood[2], K.wood[1]);
        for (let x = X(209) + (U >= 1.8 ? 2 : 1); x < X(212); x++) put(x, Y(96), WOOD, K.wood[1]);
        for (let y = Y(96); y < Y(98); y++) put(X(212) - 1, y, WOOD, K.wood[0]);
        B(210, 211, 98, 100, (x, y, u, v) => {
          if (v >= 100 || y === Y(98)) put(x, y, WOOD, K.wood[0]);
          else put(x, y, LAMP, K.glow[v < 99 ? 3 : 2]);
        });
        lights.push([F(211 + ox), F(99 + oy), P(10), 0.5, 0]);
        [262, 266].forEach((fx) => { upright(fx + 0.5 + ox, 103 + oy, 110 + oy, K.wood[2], K.wood[1]); });
        [[104.5, 3], [107.5, 1]].forEach((r) => { for (let x = X(262); x < X(267); x++) put(x, F(r[0] + oy), WOOD, K.wood[r[1]]); });
      }
      /* The well. */
      B(252, 260, 104, 109, (x, y, u, v) => {
        let c;
        if (v < 105) c = K.stone[y === Y(105) - 1 ? 1 : 3];
        else { const b = brick(x, y, X(252), Y(105), 3, 1, 1.5); c = b === JOINT ? K.stone[0] : K.stone[pick(0.6 + b, 1.0, x, y, 160)]; }
        const i = put(x, y, MASON, c);
        if (i >= 0) mossGroup[i] = 1;
      });
      upright(252.5 + ox, 95 + oy, 104 + oy, K.wood[2], K.wood[1]);
      upright(260.5 + ox, 95 + oy, 104 + oy, K.wood[1], K.wood[0]);
      B(250, 262, 89, 94, (x, y, u, v) => {
        const half = v - 88.5;
        if (u < 256 - half || u >= 257 + half) return;
        if (v >= 94) { put(x, y, WOOD, K.wood[0]); return; }
        const course = y === F(89 + 1.5 * Math.floor((v - 89) / 1.5) + oy);
        const edge = (u - (256 - half)) * U < 1 || (257 + half - u) * U < 1;
        put(x, y, WOOD, K.wood[course ? 0 : (u < 256.5 ? 3 : 2) - (edge ? 1 : 0)]);
      });
      for (let x = X(253); x < X(260); x++) put(x, F(98.5 + oy), WOOD, K.wood[1]);
      for (let y = Y(99); y < Y(101); y++) put(ropeX, y, WOOD, K.wood[3]);
      B(255, 257, 101, 102, (x, y) => {
        const side = x === X(255) || x === X(258) - 1;
        put(x, y, WOOD, K.wood[y === Y(101) ? 2 : side || y === Y(103) - 1 ? 0 : 1]);
      });
      /* The well ring has no floor: the shaft opens under it. */
      B(255, 257, 104, 109, (x, y) => {
        const i = put(x, y, AIR, 0);
        if (i >= 0) { zone[i] = Z_SHAFT; base[i] = caveC[0]; gk[i] = 0; }
      });
      if (shaftBottom > 0) {
        /* The rope goes down to just above the water. */
        const end = Math.max(shaftBottom, aqTop - P(2));
        for (let y = Y(103); y < end; y++) put(ropeX, y, WOOD, K.wood[3]);
        put(ropeX, end, WOOD, K.wood[1]);
        for (let y = SB; y < shaftBottom; y++) for (let x = F(well - 2); x < F(well + 3); x++) if (mat[idx(x, y)] === MASON) mossGroup[idx(x, y)] = 1;
      }
      geo.well = { ropeX, s0: F(well - 1), s1: F(well + 2), bottom: shaftBottom, ringL: X(252), ringR: X(261) - 1, ringTop: Y(104), roller: F(98.5 + oy), fence: [X(262), X(267) - 1, Y(103)] };
    }

    yield;

    mark(10);
    /* Terraces: stone retaining walls, beds and what grows in them. */
    if (seg.terraces) {
      const s = seg.terraces, starts = [266, 288, 310, 332];
      for (let k = 0; k < nTerr; k++) {
        const a = s.x0 + 21 * k, top = SBp - 2 - 4 * k, ox = a - starts[k], oy = SBp - 110;
        const X = (u) => F(u + ox), Y = (v) => F(v + oy);
        const B = (xa, xb, ya, yb, fn) => {
          const x1 = X(xb + 1), y1 = Y(yb + 1);
          for (let y = Y(ya); y < y1; y++) for (let x = X(xa); x < x1; x++) fn(x, y, (x + 0.5) / U - ox, (y + 0.5) / U - oy);
        };
        const ground = (u) => surf[clamp(X(u), 0, GW - 1)];
        const nx = a + 21;
        if (nx < GWp && surf[F(nx + 0.5)] < F(top)) {
          const y0 = surf[F(nx + 0.5)];
          for (let y = y0; y < F(top + 2); y++) for (let x = F(nx - 1); x < F(nx + 1); x++) {
            const b = brick(x, y, F(nx - 1), y0, 2, 2, 1);
            const i = put(x, y, MASON, y === y0 ? K.stone[3] : b === JOINT ? K.stone[0] : K.stone[pick(0.55 + b - (x === F(nx + 1) - 1 ? 0.2 : 0), 0.9, x, y, 161)]);
            if (i >= 0) mossGroup[i] = 2;
          }
        }
        if (k === 0) {
          geo.bed = { x0: X(267), x1: X(286) - 1, top: F(top) };
          /* Cabbages, leaf over leaf. */
          [269, 274].forEach((cx) => {
            B(cx - 2, cx + 2, 105, 107, (x, y, u, v) => {
              const du = (u - cx - 0.5) / 2.6, dv = (108 - v) / 3.1, rr = du * du + dv * dv;
              if (rr > 1) return;
              const t = 0.45 + 0.15 * (108 - v) - 0.08 * (u - cx - 0.5) + 0.14 * Math.sin(Math.sqrt(rr) * 8 + Math.atan2(dv, du) * 3) + (rr < 0.12 ? 0.4 : 0);
              put(x, y, GREEN, K.crop[pick(t, 0.7, x, y, 106)]);
            });
            root(X(cx + 0.5), ground(cx) + P(2), P(6 + Math.floor(CR() * 6)), 1);
          });
          /* The creature, tending the cabbages, a sprout in its hand. Ears, a round body, a light belly, an eye, two feet. */
          B(279, 285, 102, 107, (x, y, u, v) => {
            const a = u - 279, b = v - 102;
            let c = -1;
            const ex = (a - 3.5) / 3.5, ey = (b - 2.95) / 2.05;
            if (b < 1.05 && (Math.abs(a - 1.5) < 0.2 + 0.35 * b || Math.abs(a - 5.5) < 0.2 + 0.35 * b)) c = 1;
            if (ex * ex + ey * ey <= 1) {
              c = 2;
              const bx = (a - 2.3) / 1.7, by2 = (b - 3.9) / 1.05;
              if (bx * bx + by2 * by2 <= 1) c = 3;
              else if (a > 5.6 && b > 2.6) c = 1;
            }
            if (b >= 4.9 && (Math.abs(a - 1.5) < 0.5 || Math.abs(a - 5.5) < 0.5)) c = 0;
            if (c < 0) return;
            stand.push(put(x, y, CREATURE, K.creature[c]));
          });
          const ex = F(281.6 + ox), ey = F(104.5 + oy);
          eyes.push(put(ex, ey, CREATURE, K.creature[0]));
          if (U >= 2) eyes.push(put(ex, ey + 1, CREATURE, K.creature[0]));
          for (let y = F(104.3 + oy); y < Y(106); y++) stand.push(put(F(278.5 + ox), y, GREEN, K.crop[2]));
          for (let x = F(277.2 + ox); x < F(278.5 + ox); x++) stand.push(put(x, F(104.5 + oy), GREEN, K.crop[3]));
          stand.push(put(F(278.5 + ox) + 1, F(104.1 + oy), GREEN, K.crop[3]));
          eyes.forEach((i) => { stand.push(i); });
          /* Coracle: centred on today's creature, its lowest row round(2U/1.5) grains of air above the bed. */
          {
            const set = CORACLE_SETS[U < 1.8 ? 9 : 12];
            let lo = 1e9, hi = -1;
            stand.forEach((i) => { if (i >= 0 && mat[i] === CREATURE) { const x = (i % W) - 1; if (x < lo) lo = x; if (x > hi) hi = x; } });
            if (hi >= 0) hover = { set, x: Math.floor((lo + hi) / 2) - (set.rest[0].length >> 1), y: F(top) - 1 - Math.round(2 * U / 1.5) - set.base };
          }
        } else if (k === 1) {
          /* Carrots: an orange shoulder in the soil and a fan of fine leaves. */
          for (let cx = 291; cx < 305; cx += 4) {
            const bx = cx + 0.5, by = 104;
            [[-1.3, -3.2, 2], [-0.7, -3.9, 3], [0, -4.3, 3], [0.8, -3.8, 2], [1.4, -2.9, 3], [-1.0, -2.0, 1], [1.1, -1.7, 1]].forEach((l) => {
              const n = Math.ceil(Math.max(Math.abs(l[0]), Math.abs(l[1])) * U);
              for (let t = 1; t <= n; t++) {
                const f = t / n;
                put(Math.floor((bx + ox + l[0] * f * f) * U), Math.floor((by + oy + l[1] * f) * U), GREEN, K.crop[f > 0.7 ? l[2] : 1]);
              }
            });
            B(cx, cx, 104, 104, (x, y, u, v) => { if (Math.abs(u - bx) < 0.45 + 0.1 * (v - 104)) put(x, y, TILL, K.wild[v < 104.4 ? 1 : 0]); });
            root(X(cx + 0.5), F(top + 2), P(6 + Math.floor(CR() * 6)), 1);
          }
        } else if (k === 2) {
          /* Beans up three poles. */
          [313, 320, 327].forEach((sx) => { upright(sx + 0.5 + ox, 88 + oy, 100 + oy, K.wood[2], K.wood[1]); });
          for (let x = X(312); x < X(329); x++) { put(x, Y(88), WOOD, K.wood[3]); if (U >= 1.8) put(x, Y(88) + 1, WOOD, K.wood[1]); }
          B(312, 328, 89, 99, (x, y, u, v) => {
            const near = Math.min(Math.abs(u - 313.5), Math.abs(u - 320.5), Math.abs(u - 327.5));
            const vv = fbm(u / 2, v / 2, 107) + (vnoise(x / 1.4, y / 1.4, 207) - 0.5) * 0.25;
            if (near <= 2.5 && vv > 0.42 - (v - 89) * 0.01 && at(x, y) !== WOOD) {
              if (hash(x, y, 108) < 0.08) put(x, y, GREEN, K.wild[2]);
              else put(x, y, GREEN, K.bush[pick(0.65 - 0.15 * (Math.floor(u) % 8 > 4 ? 1 : 0) + (vv - 0.5), 1.0, x, y, 109)]);
            }
          });
          [313, 320, 327].forEach((sx) => { root(X(sx + 0.5), F(top + 2), P(6 + Math.floor(CR() * 6)), 1); });
        } else if (k === 3) {
          /* Wheat: thin stalks, each ear a braid of grains, a whisker or two at the top. */
          for (let gx = 334; gx < 349; gx += 2) {
            const x = X(gx + 0.5), gh = P(6 + Math.floor(hash(gx, 7, 110) * 3)) + (hash(gx, 9, 110) < 0.5 ? 0 : 1), ear = P(2.6);
            for (let k4 = 1; k4 <= gh; k4++) {
              const y = Y(96) - k4, inEar = k4 > gh - ear;
              put(x, y, GREEN, inEar ? K.sand[k4 === gh ? 2 : 3] : K.crop[2]);
              if (inEar && k4 < gh) put(x + ((k4 & 1) ? 1 : -1), y, GREEN, K.sand[2]);
            }
            put(x + (hash(gx, 8, 111) < 0.5 ? 1 : -1), Y(96) - gh - 1, GREEN, K.sand[1]);
          }
          [336, 342].forEach((rx) => { root(X(rx + 0.5), F(top + 2), P(6 + Math.floor(CR() * 6)), 1); });
        }
      }
    }

    mark(11);
    /* Grass blades, thin and many, and the wildflowers of the opening. */
    const segOf = (x) => segAt[clamp(x, 0, GW - 1)];
    for (let x = 0; x < GW; x++) {
      const sy = surf[x];
      if (terraceAt(x) >= 0 || (pond && x > pond.L - P(1) && x < pond.R + P(1)) || at(x, sy) !== TURF || at(x, sy - 1) !== AIR) continue;
      const id = segOf(x);
      const meadow = id === 'meadow' || id === 'edge' || id === 'orchard' || (id === 'grove' && (x + 0.5) / U < seg.grove.x0 + 18);
      if (hash(x, 9, 112) > (meadow ? 0.85 : 0.6)) { bladeMax[x] = P(1); continue; }
      const bh = Math.max(1, Math.round((1 + hash(x, 10, 113) * (meadow ? 6 : 3)) * U)), lean = hash(x, 11, 114) < 0.5 ? -1 : 1;
      /* A tall blade bends over at the tip; regrowth only adds to the straight part. */
      const bent = bh >= P(3) ? Math.max(1, Math.round(U * 0.6)) : 0;
      bladeMax[x] = bh - bent;
      for (let k = 1; k <= bh; k++) {
        const bx = x + (k > bh - bent ? lean : 0);
        if (at(bx, sy - k) === AIR) put(bx, sy - k, BLADE, K.grass[k === bh ? 3 : k > bh - P(1) - 1 ? 2 : 1]);
      }
    }

    yield;

    mark(12);
    /* -- Wildflowers: each one a plant with its own life. Sizes and steps are on the plan; cells are grains. */

    const GROW = 0, OPEN = 1, SEEDING = 2, WITHER = 3;
    let plantCap = 3;
    /* A flower head: rows above the top of the stem, a little wider than tall. [dx, dy, shade step] */
    const FLOWER = [];
    const FHW = Math.max(1, Math.round(1.5 * U - 0.5)), FHH = Math.max(1, P(2) - 1);
    for (let dy = -FHH; dy <= 0; dy++) for (let dx = -FHW; dx <= FHW; dx++) {
      if (!dx && !dy) continue;
      const ex = dx / (FHW + 0.5), ey = (dy + FHH / 2) / (FHH / 2 + 0.5);
      if (ex * ex + ey * ey > 1) continue;
      FLOWER.push([dx, dy, dy < -FHH / 2 ? 1 : Math.abs(dx) > FHW * 0.6 ? -1 : 0]);
    }
    const SWAY = Math.min(0.6, 0.2 * U), ROOT_SWAY = Math.min(0.8, 0.4 * U);
    function makePlant(x, g, h, kind, shade) {
      return {
        x, g, h, n: 0, kind, shade, stem: [], leaves: [], head: [], roots: [], rootGoal: 5 + rint(6), rootN: 0,
        stage: GROW, next: T + 40 + rint(40), drank: T, until: 0, side: rint(2) ? 1 : -1, seeds: 0, dry: false, acc: 0
      };
    }
    function headColours(p) { return p.kind ? K.blossom : K.wild; }
    function openHead(p) {
      const topc = p.stem[p.stem.length - 1];
      let c = topc - W;
      if (mat[c] !== AIR) c = topc;
      const fc = headColours(p), fs = p.shade;
      mat[c] = BLOOM; col[c] = fc[fs]; p.head.push(c);
      if (c === topc) p.stem.pop();
      if (p.n >= 3) {
        for (let k = 0; k < FLOWER.length; k++) {
          const q = FLOWER[k], s = c + q[0] + q[1] * W;
          if (mat[s] === AIR) { mat[s] = BLOOM; col[s] = fc[clamp(fs + q[2], 0, 3)]; p.head.push(s); }
        }
      }
      p.stage = OPEN;
      p.until = T + 2400 + rint(4800);
    }
    /* A leaf: a few grains out from the stem, rising a little. */
    function leaf(p, c) {
      const n = Math.max(1, Math.round(U));
      for (let j = 1; j <= n; j++) {
        const l = c + p.side * j - W * Math.floor((j - 1) / 2);
        if (mat[l] !== AIR) break;
        mat[l] = LEAF; col[l] = K.crop[j === n ? 3 : 2 + rint(2)]; p.leaves.push(l);
      }
      p.side = -p.side;
    }
    /* One step of the plan up: as many grains as that is. False if something is in the way. */
    function growStem(p) {
      const want = P(p.n + 1);
      while (p.stem.length < want) {
        const topc = p.stem[p.stem.length - 1];
        let c = topc - W;
        if (p.n >= 3 && rf() < SWAY) { const s = rint(2) ? 1 : -1; if (mat[c + s] === AIR) c += s; }
        if (mat[c] === SEED || mat[c] === LITTER || mat[c] === PETAL) toAir(c);
        if (mat[c] !== AIR) { p.h = p.n; return false; }
        mat[c] = STEM; col[c] = K.crop[p.n < 2 ? 1 : 2]; stamp[c] = stampNow;
        p.stem.push(c);
      }
      p.n++;
      if (p.n === 2 || (p.n === 4 && p.h >= 6)) leaf(p, p.stem[p.stem.length - 1]);
      return true;
    }
    if (GW > 0) {
      for (let xp = 1; xp < GWp - 1; xp++) {
        const x = F(xp + 0.5);
        if (!plantable[x] || hash(xp, 12, 115) > 0.16) continue;
        if (plants.some((p) => Math.abs(p.x - x) < P(2))) continue;
        const g = idx(x, surf[x]);
        if (mat[g] !== TURF) continue;
        const stemH = 3 + Math.floor(hash(xp, 13, 116) * 5);
        let ok = true;
        for (let k = 1; k <= P(stemH + 2) && ok; k++) { const m = mat[g - W * k]; if (m !== AIR && m !== BLADE) ok = false; }
        if (!ok) continue;
        for (let c = g - W; mat[c] === BLADE; c -= W) mat[c] = AIR;
        const p = makePlant(x, g, stemH, hash(xp, 14, 117) < 0.4 ? 1 : 0, 1 + Math.floor(hash(xp, 15, 118) * 3));
        p.n = stemH;
        for (let k = 1; k <= P(stemH); k++) { const c = g - W * k; mat[c] = STEM; col[c] = K.crop[k < P(2) ? 1 : 2]; p.stem.push(c); }
        [2, 4].forEach((n) => { if (n < stemH && (n === 2 || stemH >= 6)) leaf(p, g - W * P(n)); });
        p.rootN = 2 + Math.floor(hash(xp, 16, 119) * 3);
        for (let k = 1; k <= P(p.rootN); k++) {
          const c = g + W * k;
          if (SOAK[mat[c]]) { mat[c] = ROOT; col[c] = K.wood[k < P(2) ? 1 : 0]; p.roots.push(c); }
        }
        openHead(p);
        p.until = T + 1600 + Math.floor(hash(xp, 17, 120) * 9000);
        plants.push(p);
      }
    }
    plantCap = Math.max(3, Math.round(plantable.reduce((a, b) => a + b, 0) / U / 7));
    /* One of them is about done flowering, so the first seeds fall soon after the plate is shown. */
    if (plants.length) plants[Math.floor(plants.length / 2)].until = 180 + 640 + Math.floor(hash(GWp, Math.round(GHp), 121) * 240);

    /* Fallen petals under the blossom tree. */
    if (seg.orchard) {
      for (let x = F(seg.orchard.x0); x < Math.min(GW, F(seg.orchard.x0 + 34)); x++) {
        if (hash(x, 5, 91) < 0.18) { const i = putOpen(x, surf[x] - 1, LITTER, K.blossom[2 + (hash(x, 6, 92) < 0.5 ? 1 : 0)]); if (i >= 0) aux[i] = 40 + Math.floor(hash(x, 7, 93) * 200); }
      }
    }

    yield;

    mark(13);
    /* -- The cave: glowing fungi on its floor, small lights on its ceiling. */

    const FG = 0, FALIVE = 1, FFADE = 2;
    let fungiCap = 4;
    /* Caps: a dome, its rim and its gills a little deeper in colour. [dx, dy, shade] */
    function capShape(rx, ry) {
      const out2 = [];
      for (let dy = -Math.ceil(ry) + 1; dy <= 0; dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const ex = dx / (rx + 0.5), ey = (-dy + 0.5) / (ry + 0.5);
        if (ex * ex + ey * ey > 1) continue;
        out2.push([dx, dy, dy === 0 || Math.abs(ex) > 0.72 ? 1 : ey > 0.55 && Math.abs(ex) < 0.4 ? 3 : 2]);
      }
      return out2;
    }
    const CAP_BIG = capShape(2.5 * U - 0.5, 2 * U), CAP_SMALL = capShape(1.5 * U - 0.5, 1.1 * U);
    function fungusCap(f) {
      const top = f.stalk.length ? f.stalk[f.stalk.length - 1] : f.base + W;
      const cy = top - W, shape = f.h >= 5 ? CAP_BIG : CAP_SMALL;
      let hi = cy;
      for (let k = 0; k < shape.length; k++) {
        const q = shape[k], c = cy + q[0] + q[1] * W;
        if (mat[c] === AIR) { mat[c] = CAP; col[c] = K.glow[q[2]]; f.cap.push(c); if (!q[0] && c < hi) hi = c; }
      }
      f.top = hi;
      f.cx = (cy % W) - 1;
      f.cy = ((cy / W) | 0) - 1 - (f.h >= 5 ? P(1) : 0);
    }
    function makeFungus(base, h) {
      return { base, h, n: 0, stalk: [], cap: [], top: base, stage: FG, next: T + 60, until: 0, fade: 0, ph: rint(4000), per: 160 + rint(120), cx: 0, cy: 0 };
    }
    [[-0.71, 4], [-0.57, 6], [-0.48, 3], [-0.21, 5], [-0.1, 3], [0.19, 7], [0.33, 4], [0.5, 5], [0.67, 3]].forEach((q) => {
      const x = F(cv.x + q[0] * cv.rx + 0.5);
      if (x < 1 || x >= GW - 1 || (x >= pool.L - P(2) && x <= pool.R + P(2)) || caveFloor[x] < 0) return;
      const fy = caveFloor[x], b = idx(x, fy - 1);
      for (let k = 0; k <= P(q[1] + 1); k++) if (mat[b - W * k] !== AIR) return;
      const f = makeFungus(b, q[1]);
      f.n = q[1] - 1;
      for (let k = 0; k < P(q[1] - 1); k++) { const c = b - W * k; mat[c] = STALK; col[c] = K.sand[3]; f.stalk.push(c); }
      fungusCap(f);
      f.stage = FALIVE;
      f.until = T + 14000 + Math.floor(hash(x, fy, 77) * 40000);
      fungi.push(f);
    });
    fungiCap = Math.max(3, fungi.length + 2);
    for (let x = Math.max(0, F(cv.x - cv.rx)); x < Math.min(GW, F(cv.x + cv.rx)); x++) {
      for (let y = F(cv.y - cv.ry - 3); y < F(cv.y); y++) {
        if (!inb(x, y) || zone[idx(x, y)] !== Z_CAVE || mat[idx(x, y)] !== AIR) continue;
        if (at(x, y - 1) === ROCK && hash(x, y, 76) < 0.22) {
          put(x, y, LAMP, K.glow[hash(x, y, 77) < 0.5 ? 0 : 1]);
          if (hash(x, y, 78) < 0.35 / U) lights.push([x, y, P(5), 0.3, 1]);
        }
        if (at(x, y - 1) === ROCK || at(x, y - 1) === LAMP) break;
      }
    }
    lamps.forEach((l) => lights.push(l));

    mark(14);
    /* -- A worm or two in the topsoil. */

    const WL = P(5);
    function placeWorm(x0) {
      for (let tryN = 0; tryN < 30; tryN++) {
        const x = F(clamp(x0 + tryN * 3, 3, GWp - 9) + 0.5);
        const y = surf[x] + P(5 + (tryN % 3));
        const segs2 = [];
        for (let k = 0; k < WL; k++) { const i = idx(x + WL - 1 - k, y); if (mat[i] !== SOIL) break; segs2.push(i); }
        if (segs2.length < WL) continue;
        segs2.forEach((i, k) => { mat[i] = WORM; col[i] = K.worm[k === 0 ? 3 : k === WL - 1 ? 0 : 2 - (k & 1)]; });
        const every = 9 + rint(5);
        worms.push({ segs: segs2, dir: 1, every, acc: rint(9) / every, stuck: 0 });
        return;
      }
    }
    placeWorm(seg.meadow ? seg.meadow.x0 + 2 : seg.grove ? seg.grove.x0 + 4 : 4);
    if (GWp >= 200) placeWorm(seg.grove ? seg.grove.x0 + 6 : seg.orchard ? seg.orchard.x0 + 2 : GWp - 40);

    mark(15);
    /* -- Fireflies, drifting over the grass and the water. */

    segs.forEach((s) => {
      const n = s.id === 'meadow' ? Math.round(s.w / 7) : s.id === 'pond' ? 2 : s.id === 'grove' || s.id === 'orchard' ? 2 : s.id === 'edge' ? Math.round(s.w / 24) : s.id === 'young' ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const x = F(s.x0 + 2 + Math.floor(CR() * Math.max(1, s.w - 4)) + 0.5);
        const y = surf[clamp(x, 0, GW - 1)] - P(6 + Math.floor(CR() * 22));
        if (at(x, y) !== AIR) continue;
        const every = 4 + Math.floor(CR() * 4);
        flies.push({ x, y, vx: CR() < 0.5 ? -1 : 1, vy: 0, lo: F(Math.max(1, s.x0 - 18)), hi: Math.min(GW - 2, F(Math.min(GWp - 2, s.x0 + s.w + 18))), every, acc: 0, ph: Math.floor(CR() * 400), per: 150 + Math.floor(CR() * 160), alt: 30 });
      }
    });

    mark(16);
    /* -- Stars and clouds: the sky behind everything. */

    const stars = [];
    for (let k = 0; k < Math.round(GWp * SBp / 800); k++) {
      const xp = CR() * GWp, yp = CR() * SBp * 0.5, x = Math.floor(xp * U), y = Math.floor(yp * U);
      if (Math.hypot(xp - moon.x, yp - moon.y) < 12 || !inb(x, y) || sky[idx(x, y)] !== 1) continue;
      stars.push([x, y, CR() < 0.3 ? 1 : 0, Math.floor(CR() * 1000), 0.35 + CR() * 0.55]);
    }
    const clouds = [];
    [[0.16, 0.22, 46, 5], [0.52, 0.1, 64, 7], [0.86, 0.34, 34, 4], [0.34, 0.5, 28, 3], [0.02, 0.44, 22, 3], [0.7, 0.58, 26, 3]].forEach((c, ci) => {
      const L = c[2] / 2, h = c[3], cells = [];
      for (let dx = Math.floor(-L * U); dx <= L * U; dx++) {
        const dp = dx / U, u = dp / L, bump = 0.65 + 0.35 * Math.abs(Math.sin(dp * 0.23 + ci)) + 0.25 * (vnoise(dp / 5, ci, 21) - 0.5);
        const top = -h * U * Math.sqrt(Math.max(0, 1 - u * u)) * bump, bot = Math.round((1 + (Math.abs(u) < 0.7 ? 1 : 0)) * U);
        for (let dy = Math.floor(top); dy <= bot; dy++) {
          if (Math.abs(u) > 0.92 && hash(dx, dy, 31 + ci) < 0.5) continue;
          const tt = 1 - (dy - top) / Math.max(1, bot - top);
          cells.push(dx, dy, pick(0.25 + tt * 0.85, 0.7, dx, dy, 32 + ci));
        }
      }
      clouds.push({ x: c[0] * GWp, y: F(Math.round(c[1] * SBp) + 2), L: L, cells, v: 0.0035 + ci * 0.0007 });
    });

    yield;

    mark(17);
    /* -- The opening's damp: dry on top, damp lower down, wetter round the pond and in the beds. */

    const soilList = [];
    for (let i = W; i < N - W; i++) {
      const g = gk[i];
      if (g !== 1 && g !== 8 && g !== 9) continue;
      soilList.push(i);
      const x = (i % W) - 1, y = ((i / W) | 0) - 1, d = (y - surf[x]) / U;
      let w = d >= 4 ? (hash(x, y, 140) < 0.5 ? 1 : 0) + (d >= 7 ? 1 : 0) : d < 2 ? 1 : 0;
      if (pond && x > pond.L - P(8) && x < pond.R + P(8)) w += 1;
      if (g === 9) w += 1;
      wet[i] = Math.min(WMAX, w);
    }
    const soilArr = Int32Array.from(soilList);

    yield;

    /* Places moss can grow: the faces of stone that meet the air. */
    const mossC = [];
    for (let i = W; i < N - W; i++) {
      const m = mat[i];
      if (m !== MASON && m !== ROCK) continue;
      if (m === ROCK && gk[i] === 7) continue;
      let open = false;
      for (let k = 0; k < 4; k++) {
        const n = i + NB4[k], z = zone[n];
        if (mat[n] !== AIR) continue;
        if (m === MASON ? z !== Z_CELLAR : (z === Z_CAVE || z === Z_AQ || z === Z_STREAM || z === Z_POOL || z === Z_SHAFT)) { open = true; break; }
      }
      if (!open) continue;
      mossC.push(i);
      if (!mossGroup[i]) mossGroup[i] = m === MASON ? 0 : 4;
    }
    const mossCol = (i) => pk(SH.bush[1 + Math.floor(hash(i, 3, 150) * 3)], depthK(pl(((i / W) | 0) - 1)) * (zone[i] || mat[i] === ROCK ? 0.82 : 1));
    const NEAR = P(2); /* How far a stone looks for wet, in grains. */

    yield;

    /* Where drops form, and where the ground lets water in at the near end of the water under the beds, by the stream. */
    const dripAq = [], dripShaft = [], dripCave = [], seeps = [];
    for (let i = W; i < N - W; i++) {
      if (mat[i] !== AIR) continue;
      const z = zone[i], up = mat[i - W];
      if (z === Z_AQ && (up === ROCK)) dripAq.push(i);
      else if (z === Z_CAVE && (up === ROCK)) dripCave.push(i);
      else if (z === Z_STREAM && up === ROCK) dripCave.push(i);
      else if (z === Z_SHAFT && (mat[i - 1] === MASON || mat[i + 1] === MASON) && (i / W | 0) > SB + P(4)) dripShaft.push(i);
      if (z === Z_AQ && mat[i + W] === WATER && (i / W | 0) - 1 === aqTop - 1 && (i % W) - 1 < aq.X - aq.RX * 0.3) seeps.push(i);
    }
    const sporeSites = dripCave.filter((i) => zone[i] === Z_CAVE);
    /* Moss already on the wet stone of the cave. */
    mossC.forEach((i) => {
      if (mossGroup[i] !== 4 || hash(i, 1, 151) > 0.3) return;
      let near = false;
      for (let dy = -NEAR; dy <= NEAR && !near; dy++) for (let dx = -NEAR; dx <= NEAR; dx++) if (mat[i + dy * W + dx] === WATER) { near = true; break; }
      if (near) { mat[i] = MOSS; col[i] = mossCol(i); }
    });

    yield;

    /* What the water bodies hold in the opening, and where they settle. */
    function countWater(z) { let n = 0; for (let i = W; i < N - W; i++) if (mat[i] === WATER && zone[i] === z) n++; return n; }
    const pondCap = countWater(Z_POND);
    let pondTop = 0;
    if (pond) for (let x = pond.L; x <= pond.R; x++) if (mat[idx(x, SB + P(1))] === WATER) pondTop++;
    const pondTarget = pondCap - Math.round(pondTop * 0.8 * U);
    const poolTarget = countWater(Z_POOL);

    mark(18);
    /* -- Rules. Grains move as far each second, and things happen as often, at any size of grain:
       moving grains take about U steps a tick, and what is counted in grains of water is counted U*U times over. */

    const aqTarget = countWater(Z_AQ);
    let pondN = pondCap, poolN = poolTarget, aqN = aqTarget, pondLow = false, pondEvap = 0, poolHigh = false;
    let canopyN = canopy.length;
    const canopy0 = canopy.length;
    const rain = { on: false, next: 1e9, t0: 0, len: 1, total: 0, left: 0, x0: 0, x1: 0, acc: 0, i: 0 };
    let firstDrip = -1, lastWellDrip = -1e9, pondFullAt = -1e9, smokeAcc = 0, canopyAcc = 0;
    const mossSeen = new Uint8Array(8);
    const sporeList = [];
    const DRY = 1 / (512 * U); /* A stray grain of water drying, each step. */
    const AQ_SPARE = 24 * U2, BRIDGE = P(2) + 1, LONE = P(3), LEVEL = P(20);
    /* The ground: a grain of water moves to a neighbour as often as it must to spread as far each second;
       downward a little more often than the other ways, so it sinks as fast. */
    const DIFF = Math.min(65535, Math.round(256 * U2)), DOWN = (1 - 0.5 / U) / 4 + 0.5 / U;
    const DOWN_T = Math.round(DOWN * 256), SIDE_T = Math.round((DOWN + (1 - DOWN) / 3) * 256), SIDE2_T = Math.round((DOWN + 2 * (1 - DOWN) / 3) * 256);
    const SINK = Math.round(64 / U), INTO_ROCK = (1 / (16 * U)) * (0.625 / DOWN), SHED = Math.round(64 * U);

    function swap(a, b) {
      const m = mat[a]; mat[a] = mat[b]; mat[b] = m;
      const c = col[a]; col[a] = col[b]; col[b] = c;
      const x = aux[a]; aux[a] = aux[b]; aux[b] = x;
      stamp[a] = stampNow;
      stamp[b] = stampNow;
      moved++;
    }
    function toAir(i) { mat[i] = AIR; col[i] = 0; aux[i] = 0; }
    function restore(i) { mat[i] = origM[i]; col[i] = orig[i]; }

    function stepWater(i) {
      const q = r32();
      const d = i + W, md = mat[d];
      if (PASS[md]) {
        /* Through open air a drop falls two grains at a time. */
        if (sky[i] && PASS[mat[d + W]]) swap(i, d + W); else swap(i, d);
        return;
      }
      const z = zone[i];
      if (SOAK[md]) {
        if (wet[d] < WMAX && (q & 3) === 0) { wet[d]++; toAir(i); return; }
      } else if (md === ROCK && (z === Z_CAVE || z === Z_POOL)) {
        /* The cave floor drinks what the pool cannot hold, and any stray drop. */
        if ((z !== Z_POOL || poolHigh) && ((q >>> 2) & 31) === 0) { toAir(i); hidden++; return; }
      } else if (md === WOOD && zone[d] === Z_POND) {
        /* Through the gaps in the bridge. */
        for (let k = 2; k <= BRIDGE; k++) if (PASS[mat[i + W * k]]) { swap(i, i + W * k); return; }
      }
      /* Water standing anywhere but a pond, a stream or a pool dries, a drop at a time. */
      if (!z && rf() < DRY) { toAir(i); hidden++; return; }
      const dir = (q >>> 8) & 1 ? 1 : -1;
      if (PASS[mat[d + dir]] && PASS[mat[i + dir]]) { swap(i, d + dir); return; }
      if (PASS[mat[d - dir]] && PASS[mat[i - dir]]) { swap(i, d - dir); return; }
      const up = mat[i - W];
      /* A pool levels at once. A lone drop runs a grain or two at a time. */
      const lone = md !== WATER && mat[i - 1] !== WATER && mat[i + 1] !== WATER && up !== WATER;
      const reach = lone ? LONE : LEVEL;
      for (let k = 1; k <= reach; k++) {
        const s = i + dir * k;
        if (!PASS[mat[s]]) break;
        if (PASS[mat[s + W]]) { swap(i, k > 2 ? i + dir * 2 : s); return; }
      }
      if (up !== WATER && up !== LILY) {
        if (z === Z_POND && pondEvap && rf() < pondEvap) { toAir(i); hidden++; return; }
        if (((q >>> 24) & 7) === 0 && PASS[mat[i + dir]]) swap(i, i + dir);
      }
    }

    function stepDrip(i) {
      if (sub) return;
      if (aux[i] > 0) { aux[i]--; return; }
      mat[i] = WATER;
      stamp[i] = stampNow;
    }

    function stepLily(i) {
      const d = i + W;
      if (PASS[mat[d]]) {
        const held = (mat[i - 1] === LILY && !PASS[mat[i - 1 + W]]) || (mat[i + 1] === LILY && !PASS[mat[i + 1 + W]]);
        if (!held) swap(i, d);
        return;
      }
      if (mat[i - W] === WATER) swap(i, i - W);
    }

    function stepSeed(i) {
      const q = r32();
      if (!sub && (tick & 31) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      const d = i + W, md = mat[d];
      if (PASS[md]) {
        if (q & 3) {
          const r = (q >>> 2) % 6, s = r === 0 ? -1 : r < 3 ? 1 : 0;
          if (s && PASS[mat[d + s]] && PASS[mat[i + s]]) swap(i, d + s); else swap(i, d);
        }
        return;
      }
      if (md === EDGE || mat[i + 1] === EDGE || mat[i - 1] === EDGE) { toAir(i); return; }
      if (md === WATER) { if (((q >>> 5) & 15) === 0) swap(i, d); return; }
      if (!sub && ((q >>> 9) & 15) === 0 && takeRoot(i)) return;
      if (md !== TURF && md !== BLADE && md !== SOIL && md !== TILL) {
        const dir = (q >>> 13) & 1 ? 1 : -1;
        if (PASS[mat[d + dir]] && PASS[mat[i + dir]]) swap(i, d + dir);
        else if (PASS[mat[d - dir]] && PASS[mat[i - dir]]) swap(i, d - dir);
      }
    }

    function stepPetal(i) {
      const q = r32();
      if (!sub && (tick & 7) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      if ((q & 3) !== 0) return;
      const d = i + W, md = mat[d], r = (q >>> 2) % 8, s = r < 3 ? 1 : r < 5 ? -1 : 0;
      if (mat[i + s] === EDGE || md === EDGE) { toAir(i); return; }
      if (PASS[md]) {
        if (s && PASS[mat[i + s]]) { if (PASS[mat[d + s]] && ((q >>> 5) & 1)) swap(i, d + s); else swap(i, i + s); }
        else swap(i, d);
        return;
      }
      mat[i] = LITTER;
      if (aux[i] < 40) aux[i] = 40 + ((q >>> 8) % 100);
    }

    function stepLitter(i) {
      if (!sub && (tick & 7) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      if (PASS[mat[i + W]] && (r32() & 3) === 0) swap(i, i + W);
    }

    /* Smoke rises slowly, spreads, leans with the breeze as it climbs, and thins to nothing. Out of 1024 a step:
       it rises on 128; it drifts either way on 32*U each, so it spreads as wide, and the breeze adds 32 per lean. */
    const SM_UP = 128, SM_SIDE = Math.round(32 * U);
    function stepSmoke(i) {
      const q = r32();
      let age = aux[i];
      if (!sub && (q & 1)) { age++; aux[i] = age; }
      if (age > 180 || (age > 100 && !sub && ((q >>> 1) & 63) === 0)) { toAir(i); return; }
      const u = i - W, r = (q >>> 7) & 1023, lean = (age >> 6) * 32;
      if (mat[u] === EDGE || mat[i + 1] === EDGE) { toAir(i); return; }
      if (r < SM_UP) {
        if (mat[u] === AIR) {
          const s = ((q >>> 17) & 3) === 0 ? 1 : 0;
          if (s && mat[u + 1] === AIR) swap(i, u + 1); else swap(i, u);
        }
      } else if (r < SM_UP + SM_SIDE + lean) { if (mat[i + 1] === AIR) swap(i, i + 1); }
      else if (r < SM_UP + 2 * SM_SIDE + lean) { if (mat[i - 1] === AIR) swap(i, i - 1); }
    }

    function stepSpore(i) {
      const q = r32();
      if (!sub && (tick & 3) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      const r = q & 15;
      let j = i;
      if (r < 2) j = i + W;
      else if (r === 2) j = i - W;
      else if (r < 5) j = i + ((q >>> 4) & 1 ? 1 : -1);
      if (j !== i && mat[j] === AIR && zone[j] === Z_CAVE) { swap(i, j); i = j; }
      sporeList.push(i);
      if (!sub && mat[i + W] === ROCK && ((q >>> 6) & 15) === 0) sprout(i);
    }

    /* -- Plants */

    function takeRoot(i) {
      const x = (i % W) - 1;
      if (x < 1 || x >= GW - 1 || !plantable[x] || plants.length >= plantCap) return false;
      let g = i + W, n = 0;
      while (mat[g] === BLADE && n < 8 * U) { g += W; n++; }
      /* It wants damp ground, unless the meadow is thin, when it takes its chances and waits for rain. */
      if (mat[g] !== TURF) return false;
      if (plants.length >= plantCap * 0.5) {
        let w = 0;
        for (let k = 0; k < P(4) && !w; k++) w += wet[g + k * W];
        if (w < 1) return false;
      }
      for (let k = 0; k < plants.length; k++) if (Math.abs(plants[k].x - x) < P(2)) return false;
      const b = g - W;
      for (let k = 1; k <= P(5); k++) { const m = mat[b - W * k]; if (m !== AIR && m !== BLADE && m !== SEED) return false; }
      toAir(i);
      for (let c = b; c > b - W * P(9) && (mat[c] === BLADE || c === b); c -= W) if (mat[c] === BLADE) toAir(c);
      const p = makePlant(x, g, 3 + rint(5), chance(0.4) ? 1 : 0, 1 + rint(3));
      mat[b] = STEM; col[b] = K.crop[1]; stamp[b] = stampNow;
      p.stem.push(b);
      plants.push(p);
      entry('A seed took root.', true);
      return true;
    }

    function growRoot(p) {
      const want = P(p.rootN + 1);
      while (p.roots.length < want) {
        const tip = p.roots.length ? p.roots[p.roots.length - 1] : p.g;
        const c = tip + W + (rf() < ROOT_SWAY ? (rint(2) ? 1 : -1) : 0);
        if (!SOAK[mat[c]]) { p.rootGoal = p.rootN; return; }
        mat[c] = ROOT; col[c] = K.wood[p.roots.length < P(2) ? 1 : 0]; p.roots.push(c);
      }
      p.rootN++;
    }
    /* A step of the plan drinks a step's worth of water: U*U grains of it, from the ground by the stem and round the roots. */
    const THIRST = Math.max(1, Math.round(U2));
    function drink(p) {
      let got = 0;
      for (let k = 0; k < P(2) && got < THIRST; k++) { const c = p.g + W * k; while (SOAK[mat[c]] && wet[c] > 0 && got < THIRST) { wet[c]--; hidden++; got++; } }
      for (let k = p.roots.length - 1; k >= 0 && got < THIRST; k--) {
        const r = p.roots[k];
        for (let n = 0; n < 4 && got < THIRST; n++) { const c = r + NB4[n]; if (SOAK[mat[c]] && wet[c] > 0) { wet[c]--; hidden++; got++; } }
      }
      return got > 0;
    }

    /* A dry piece either drops as litter, to lie a while and go, or is simply gone. */
    function shed(c, toLitter) {
      if (toLitter) { mat[c] = LITTER; aux[c] = 30 + rint(80); } else toAir(c);
    }
    /* Withering takes one piece away: the head first, then the stem from the top with its leaves, then the roots. */
    function witherOne(p) {
      if (p.head.length) { const c = p.head.pop(); if (mat[c] === BLOOM) shed(c, true); return true; }
      if (p.stem.length) {
        const c = p.stem.pop();
        for (let k = p.leaves.length - 1; k >= 0; k--) {
          const l = p.leaves[k];
          if (Math.abs(l - c) <= 2 * U + 1 && ((l / W) | 0) >= ((c / W) | 0) - U) { if (mat[l] === LEAF) shed(l, rint(2) === 0); p.leaves.splice(k, 1); }
        }
        if (mat[c] === STEM) shed(c, rint(2) === 0);
        return true;
      }
      if (p.leaves.length) { const l = p.leaves.pop(); if (mat[l] === LEAF) toAir(l); return true; }
      if (p.roots.length) { const r = p.roots.pop(); if (mat[r] === ROOT) restore(r); return true; }
      return false;
    }

    function stepPlant(p) {
      if (T < p.next) return;
      if (p.stage === GROW) {
        /* Roots go down looking for damp. Everything above ground drinks for every step it takes. */
        p.next = T + 50 + rint(60);
        const canRoot = p.rootN < p.rootGoal;
        if (canRoot && p.rootN <= p.n + 1) { growRoot(p); return; }
        if (!drink(p)) {
          if (canRoot) { growRoot(p); return; }
          if (T - p.drank > 6000) { p.stage = WITHER; p.next = T; } else p.next = T + 60 + rint(60);
          return;
        }
        p.drank = T;
        if (p.n < p.h) { growStem(p); return; }
        openHead(p);
        entry('A flower opened.', true);
        return;
      }
      if (p.stage === OPEN) {
        if (T >= p.until) { p.stage = SEEDING; p.seeds = plants.length < plantCap * 0.6 ? 4 : plants.length < plantCap ? 3 : 1; p.next = T + 20; }
        else p.next = T + 200;
        return;
      }
      if (p.stage === SEEDING) {
        const c = p.head[0];
        if (p.seeds > 0) {
          const hh = p.head.length > 1 ? FHH + 1 : 1, hw = p.head.length > 1 ? FHW + 1 : 1;
          const spots = [c - hw, c + hw, c - W * hh - 1, c - W * hh + 1, c - W * hh];
          for (let k = 0; k < spots.length; k++) {
            const s = spots[(k + p.seeds) % spots.length];
            if (mat[s] === AIR) { mat[s] = SEED; col[s] = K.wood[2 + rint(2)]; aux[s] = 160 + rint(95); stamp[s] = stampNow; break; }
          }
          p.seeds--;
          if (p.seeds === 0) entry('A flower went to seed.', true);
          p.next = T + 60 + rint(80);
          return;
        }
        /* The petals go; the seed head dries. */
        for (let k = p.head.length - 1; k >= 1; k--) {
          const h = p.head[k];
          if (mat[h] === BLOOM) { mat[h] = PETAL; aux[h] = 120; }
        }
        p.head.length = 1;
        if (mat[c] === BLOOM) col[c] = K.wood[1];
        p.stage = WITHER;
        p.next = T + 400 + rint(400);
        return;
      }
      /* Withering: it dries, comes down from the top, and the roots go back to soil, a step of the plan at a time. */
      p.next = T + 50 + rint(60);
      if (!p.dry) {
        p.dry = true;
        p.stem.forEach((c) => { if (mat[c] === STEM) col[c] = K.wood[2]; });
        p.leaves.forEach((c) => { if (mat[c] === LEAF) col[c] = K.sand[0]; });
        p.head.forEach((c) => { if (mat[c] === BLOOM) col[c] = K.wood[1]; });
        return;
      }
      p.acc += U;
      for (; p.acc >= 1; p.acc--) {
        if (!witherOne(p)) {
          p.dead = true;
          entry('A plant is soil again.', true);
          return;
        }
      }
    }

    /* -- Fungi */

    function sprout(i) {
      const x = (i % W) - 1;
      if (fungi.length >= fungiCap || zone[i] !== Z_CAVE || (x >= pool.L - P(2) && x <= pool.R + P(2))) return;
      for (let k = 0; k < fungi.length; k++) if (Math.abs((fungi[k].base % W) - 1 - x) < P(4)) return;
      const h = 3 + rint(4);
      for (let k = 1; k <= P(h + 1); k++) if (mat[i - W * k] !== AIR) return;
      toAir(i);
      fungi.push(makeFungus(i, h));
    }

    function stepFungus(f) {
      if (f.stage === FG) {
        if (T < f.next) return;
        f.next = T + 70 + rint(50);
        if (f.n < f.h - 1) {
          const want = P(f.n + 1);
          while (f.stalk.length < want) {
            const c = f.stalk.length ? f.stalk[f.stalk.length - 1] - W : f.base;
            if (mat[c] !== AIR) { f.h = f.n + 1; return; }
            mat[c] = STALK; col[c] = K.sand[3]; f.stalk.push(c);
          }
          f.n++;
          return;
        }
        fungusCap(f);
        f.stage = FALIVE;
        f.until = T + 30000 + rint(40000);
        entry('A new light in the cave.', true);
        return;
      }
      if (f.stage === FALIVE) {
        if (T >= f.until) { f.stage = FFADE; f.fade = T; return; }
        if ((r32() & 2047) === 0 && f.cap.length) {
          const s = f.top - W;
          if (mat[s] === AIR) { mat[s] = SPORE; aux[s] = 40 + rint(60); }
        }
        return;
      }
      if (T - f.fade > 480) {
        f.cap.forEach((c) => { if (mat[c] === CAP) toAir(c); });
        f.stalk.forEach((c) => { if (mat[c] === STALK) toAir(c); });
        f.dead = true;
        entry('A cave light went out.', true);
      }
    }

    /* -- Worms: a slow way through the damp, a grain at a time, and a tunnel that closes behind. */

    const tunnels = [];
    let tunnelHead = 0;
    function wormCan(c) {
      const m = mat[c];
      if (m !== SOIL && m !== TUNNEL) return false;
      const up = mat[c - W], dn = mat[c + W];
      if (!(SOAK[up] || up === TUNNEL || up === WORM || up === ROOT) || up === TURF || dn === AIR || zone[c + W] === Z_CELLAR) return false;
      for (let k = 2; k <= NEAR; k++) { const a = mat[c - k * W]; if (a === AIR || a === BLADE) return false; }
      return true;
    }
    function wormColours(w) { w.segs.forEach((c, k) => { col[c] = K.worm[k === 0 ? 3 : k === w.segs.length - 1 ? 0 : 2 - (k & 1)]; }); }
    function stepWorm(w) {
      w.acc += U / w.every;
      if (w.acc < 1) return;
      w.acc -= 1;
      if (rint(6) === 0) return;
      const head = w.segs[0];
      const fwd = head + w.dir;
      const opts = [fwd, head - W, head + W, head + w.dir - W, head + w.dir + W];
      let best = -1, score = -1;
      for (let k = 0; k < opts.length; k++) {
        const c = opts[k];
        if (!wormCan(c) || w.segs.indexOf(c) >= 0) continue;
        const s = (k === 0 ? 3 : 1) + wet[c] * 0.8 + rf() * 2.2;
        if (s > score) { score = s; best = c; }
      }
      if (best < 0 || chance(1 / (40 * U))) {
        w.segs.reverse();
        w.dir = -w.dir;
        wormColours(w);
        return;
      }
      const dx = (best % W) - (head % W);
      if (dx) w.dir = dx > 0 ? 1 : -1;
      const tail = w.segs.pop();
      mat[tail] = TUNNEL;
      col[tail] = 0;
      tunnels.push(tail, T + 500 + rint(500));
      mat[best] = WORM;
      w.segs.unshift(best);
      wormColours(w);
      moved++;
    }
    function closeTunnels() {
      while (tunnelHead < tunnels.length && tunnels[tunnelHead + 1] <= T) {
        const c = tunnels[tunnelHead];
        if (mat[c] === TUNNEL) restore(c);
        tunnelHead += 2;
      }
      if (tunnelHead > 2000) { tunnels.splice(0, tunnelHead); tunnelHead = 0; }
    }

    /* -- Fireflies and fish move on their own, a grain at a time; they are drawn over the grains they pass. */

    function stepFlies() {
      for (let k = 0; k < flies.length; k++) {
        const f = flies[k];
        f.acc += U / f.every;
        if (f.acc < 1) continue;
        f.acc -= 1;
        if (chance(0.25 / U)) f.vx = rint(3) - 1;
        if (chance(0.2 / U)) f.vy = rint(3) - 1;
        const nx = f.x + f.vx;
        let ny = f.y + (chance(0.5) ? f.vy : 0);
        if (nx < f.lo || nx > f.hi || nx < 1 || nx > GW - 2) { f.vx = -f.vx; continue; }
        const s = surf[nx], low = s - P(rain.on ? 3 : 2), high = Math.max(P(2), s - P(rain.on ? 12 : f.alt));
        if (ny < high) { ny = high; f.vy = 1; }
        if (ny > low) { ny = low; f.vy = -1; }
        if (at(nx, ny) !== AIR) { f.vx = -f.vx; f.vy = -f.vy; continue; }
        f.x = nx;
        f.y = ny;
      }
    }
    /* A fish: a body FL grains long, a back, and a tail fin above and below. */
    const FISH = [];
    for (let n = 0; n < FL; n++) FISH.push([n, 0, n === 0 ? 2 : n < FL * 0.6 ? 1 : 0]);
    for (let n = 1; n <= FL >> 1; n++) FISH.push([n, -1, 1]);
    const FISH_CELLS = FISH.length + 1;
    function fishFits(x, y, dir) {
      for (let k = 0; k < FISH.length; k++) if (at(x - dir * FISH[k][0], y + FISH[k][1]) !== WATER) return false;
      const t = x - dir * (FL - 1);
      return at(t, y - 1) === WATER && at(t, y + 1) === WATER;
    }
    function stepFish() {
      for (let k = 0; k < fish.length; k++) {
        const f = fish[k];
        f.acc += U / f.every;
        if (f.acc < 1) continue;
        f.acc -= 1;
        if (chance(0.2)) continue;
        if (chance(0.02 / U)) f.dir = -f.dir;
        const nx = f.x + f.dir, ny = f.y + (chance(0.1 / U) ? (chance(0.5) ? 1 : -1) : 0);
        if (fishFits(nx, ny, f.dir)) { f.x = nx; f.y = ny; }
        else if (fishFits(nx, f.y, f.dir)) f.x = nx;
        else if (fishFits(f.x, f.y, f.dir)) { f.dir = -f.dir; f.x += (FL - 1) * f.dir; }
        else if (fishFits(f.x, f.y + 1, f.dir)) f.y++;
      }
    }

    /* -- Ground water: it soaks down, dries from the top, and what reaches the clay goes into the ground below. */

    function damp() {
      const n = soilArr.length, half = n >> 1, from = (tick & 1) ? 0 : half, to = (tick & 1) ? half : n;
      for (let k = from; k < to; k++) {
        const i = soilArr[k], m = mat[i];
        if (!SOAK[m]) continue;
        const w = wet[i], up = mat[i - W];
        const open = up === AIR || up === BLADE || up === LITTER || up === SEED;
        if (open) {
          const q = r32();
          if (m === TURF && (q & 65535) < SHED) blades(i, w);
          if (w && (q >>> 16) < SHED) { wet[i] = w - 1; hidden++; continue; }
        }
        if (!w) continue;
        const q = r32();
        if ((q & 65535) >= DIFF) continue;
        const r = (q >>> 16) & 255;
        const j = r < DOWN_T ? i + W : r < SIDE_T ? i - 1 : r < SIDE2_T ? i + 1 : i - W;
        const mj = mat[j];
        if (SOAK[mj]) {
          const wj = wet[j];
          if (j === i + W ? wj < WMAX && (wj < w || (q >>> 24) < SINK) : wj + 1 < w) { wet[i] = w - 1; wet[j] = wj + 1; }
        } else if (j === i + W && mj === ROCK && rf() < INTO_ROCK) {
          wet[i] = w - 1;
          hidden++;
        }
      }
    }
    function blades(i, w) {
      const x = (i % W) - 1;
      let top = i - W, h = 0;
      while (mat[top] === BLADE && h < 40) { top -= W; h++; }
      if (w >= 2 && h < bladeMax[x] && mat[top] === AIR) { mat[top] = BLADE; col[top] = K.grass[3]; if (h) col[top + W] = K.grass[h >= P(1) ? 2 : 1]; }
      else if (w === 0 && h > Math.max(0, bladeMax[x] - P(2))) { toAir(top + W); if (h > 1) col[top + 2 * W] = K.grass[3]; }
    }

    /* -- Moss, on wet stone. */

    function isDamp(i) {
      for (let dy = -NEAR; dy <= NEAR; dy++) {
        const r = i + dy * W;
        for (let dx = -NEAR; dx <= NEAR; dx++) { const m = mat[r + dx]; if (m === WATER || m === DRIP) return true; }
      }
      for (let k = 0; k < 4; k++) { const c = i + NB4[k]; if (SOAK[mat[c]] && wet[c] >= 2) return true; }
      return false;
    }
    const MOSS_SAYS = ['', 'Moss on the well.', 'Moss on the terrace wall.', 'Moss on the cabin stones.', ''];
    const MOSS_LOOKS = 3 * U2;
    let mossAcc = 0;
    function mossPass() {
      if (!mossC.length) return;
      mossAcc += MOSS_LOOKS;
      for (; mossAcc >= 1; mossAcc--) {
        const i = mossC[rint(mossC.length)], m = mat[i];
        if (m !== MOSS && m !== origM[i]) continue;
        const wetHere = isDamp(i);
        if (m === MOSS) { if (!wetHere && chance(0.05)) restore(i); continue; }
        if (!wetHere) continue;
        let near = false;
        for (let k = 0; k < 4 && !near; k++) if (mat[i + NB4[k]] === MOSS || mat[i + NB4[k] + (k < 2 ? 1 : W)] === MOSS) near = true;
        if ((near && chance(0.3)) || chance(0.012 / U)) {
          mat[i] = MOSS;
          col[i] = mossCol(i);
          const g = mossGroup[i];
          if (g && !mossSeen[g]) { mossSeen[g] = 1; if (MOSS_SAYS[g]) entry(MOSS_SAYS[g], true); }
        }
      }
    }

    /* -- Trees let go of a petal or a leaf now and then, and grow it back. */

    function canopyPass() {
      if (!canopy.length) return;
      canopyAcc += U2;
      for (; canopyAcc >= 1; canopyAcc--) {
        const k = rint(canopy.length), i = canopy[k], m = mat[i];
        if (m === CANOPY) {
          if (!PASS[mat[i + W]] || canopyN < canopy0 * 0.93) continue;
          if (chance(canopyBloom[k] ? 0.2 : 0.015)) { mat[i] = PETAL; aux[i] = 200; canopyN--; moved++; }
        } else if (m === AIR && chance(0.25)) {
          if (mat[i - 1] === CANOPY || mat[i + 1] === CANOPY || mat[i - W] === CANOPY || mat[i + W] === CANOPY) {
            mat[i] = CANOPY; col[i] = canopyCol[k]; canopyN++;
          }
        }
      }
    }

    /* -- Weather, springs and drips: the water out of sight comes back. */

    function startRain() {
      rain.on = true;
      rain.t0 = T;
      rain.len = 1000 + rint(900);
      rain.total = Math.min(hidden - Math.round(300 * U2), Math.round((700 + rint(700)) * U2));
      rain.left = rain.total;
      const span = Math.round(GW * (0.6 + rf() * 0.4));
      rain.x0 = rint(Math.max(1, GW - span));
      rain.x1 = rain.x0 + span;
      rain.acc = 0;
      entry('Rain.');
    }
    function stepRain() {
      const u = (T - rain.t0) / rain.len;
      if (u >= 1 || rain.left <= 0) {
        rain.on = false;
        rain.i = 0;
        rain.next = T + 4800 + rint(6000);
        entry('The rain has passed.');
        return;
      }
      rain.i = Math.pow(Math.sin(Math.PI * u), 0.6);
      rain.acc += rain.i * rain.total / (rain.len * 0.62);
      rain.x0 += 0.012 * U;
      rain.x1 += 0.012 * U;
      while (rain.acc >= 1 && rain.left > 0) {
        rain.acc -= 1;
        const x = Math.floor(rain.x0 + rf() * (rain.x1 - rain.x0));
        if (x < 0 || x >= GW) continue;
        const i = idx(x, rint(P(3)));
        if (mat[i] !== AIR) continue;
        mat[i] = WATER; aux[i] = 0; stamp[i] = stampNow;
        hidden--;
        rain.left--;
      }
    }
    function drip(list, isWell) {
      if (!list.length || hidden < 40 * U2) return;
      const i = list[rint(list.length)];
      if (mat[i] !== AIR) return;
      mat[i] = DRIP; aux[i] = 30 + rint(90); col[i] = 0;
      hidden--;
      if (isWell) {
        if (T - lastWellDrip > 7200) entry('A drip in the well.', true);
        lastWellDrip = T;
      }
    }
    /* The film's weather and water, when it asks: rain of strength i over grains x0 to x1, and drops forming over the
       water under the beds, so many a tick. Its water comes from out of sight. */
    function filmRain() {
      const r = ctl.rain;
      rain.i = r.i;
      rain.acc += r.i * (r.rate || 0.6 * U2);
      while (rain.acc >= 1) {
        rain.acc -= 1;
        const x = Math.floor(r.x0 + rf() * (r.x1 - r.x0));
        if (x < 0 || x >= GW) continue;
        const i = idx(x, rint(P(3)));
        if (mat[i] === AIR) { mat[i] = WATER; aux[i] = 0; stamp[i] = stampNow; }
      }
    }
    function filmSeep() {
      for (let n = some(ctl.seep); n > 0; n--) {
        if (!dripAq.length) return;
        const i = dripAq[rint(dripAq.length)];
        if (mat[i] === AIR) { mat[i] = DRIP; aux[i] = 30 + rint(90); col[i] = 0; }
      }
    }
    function director() {
      if (ctl.rain) filmRain();
      else if (!rain.on) { if (ctl.auto && T >= rain.next && hidden >= 640 * U2) startRain(); }
      else stepRain();
      if (ctl.seep > 0) filmSeep();
      /* The film's spill: the water under the beds coming over into the head of the stair, so many grains a tick. */
      if (ctl.spill > 0 && geo.stair) {
        const s0 = geo.stair.steps[0];
        for (let n = some(ctl.spill); n > 0; n--) {
          const i = idx(geo.stair.sx - 1 - rint(Math.max(2, P(4))), s0.top + 1 + rint(Math.max(1, s0.water - s0.top - 1)));
          if (mat[i] === AIR) { mat[i] = WATER; aux[i] = 0; stamp[i] = stampNow; }
        }
      }
      /* Where the ground holds more, the spring under the beds runs harder, and so does the stream. */
      const seepP = ctl.auto && aqN < aqTarget + AQ_SPARE ? clamp((hidden / U2 - 220) / 2400, 0, 0.2) : 0;
      if (seepP > 0 && seeps.length) {
        for (let n = some(seepP * U2); n > 0; n--) {
          const i = seeps[rint(seeps.length)];
          if (mat[i] === AIR) { mat[i] = WATER; stamp[i] = stampNow; hidden--; }
        }
      }
      /* A pond that has sunk below its usual line is fed slowly from the ground under it. */
      if (pond && pondN < pondTarget && hidden > 200 * U2) {
        for (let n = some(U2 / 32); n > 0; n--) {
          const x = pond.L + 2 + rint(Math.max(1, pond.R - pond.L - 4));
          for (let y = SB; y < SB + pond.dep; y++) {
            const i = idx(x, y);
            if (mat[i] === AIR && mat[i + W] === WATER) { mat[i] = WATER; stamp[i] = stampNow; hidden--; pondN++; break; }
            if (mat[i] !== AIR && mat[i] !== LILY) break;
          }
        }
      }
      if (T === firstDrip) drip(dripShaft, true);
      else if ((r32() & 63) === 0) {
        /* Drops form over the water under the beds while it has room, and in the cave. */
        const r = rint(10), full = aqN >= aqTarget + AQ_SPARE;
        if (r < 5) { if (!full) drip(dripAq, false); }
        else if (r < 7) { if (!full) drip(dripShaft, true); }
        else drip(dripCave, false);
      }
      if (chimney.length) {
        smokeAcc += 0.225 * U2;
        for (; smokeAcc >= 1; smokeAcc--) { const c = chimney[rint(chimney.length)]; if (mat[c] === AIR) { mat[c] = SMOKE; aux[c] = 0; } }
      }
      /* The world goes on past the edge of the plate. When the meadow here is thin, a seed blows in from there. */
      if (ctl.auto && plants.length < plantCap * 0.45 && (r32() & 511) === 0) {
        const x = rint(GW), i = idx(x, 1 + rint(Math.max(1, SB - P(24))));
        if (plantable[x] && mat[i] === AIR) {
          mat[i] = SEED; col[i] = K.wood[2 + rint(2)]; aux[i] = 160 + rint(95);
          entry('Seeds on the wind.', true);
        }
      }
      /* Likewise in the cave: when its lights are few, a spore drifts down out of the dark. */
      if (ctl.auto && fungi.length < Math.max(2, fungiCap * 0.5) && sporeSites.length && (r32() & 2047) === 0) {
        const i = sporeSites[rint(sporeSites.length)];
        if (mat[i] === AIR) { mat[i] = SPORE; aux[i] = 90 + rint(90); }
      }
      canopyPass();
      mossPass();
    }

    function census() {
      let liv = 0, pn = 0, cn = 0, an = 0, can = 0;
      for (let i = W; i < N - W; i++) {
        const m = mat[i];
        if (LIVING[m]) { liv++; if (m === CANOPY) can++; }
        else if (m === WATER) { const z = zone[i]; if (z === Z_POND) pn++; else if (z === Z_POOL || z === Z_CAVE) cn++; else if (z === Z_AQ) an++; }
      }
      aqN = an;
      living = liv + flies.length + fish.length * FISH_CELLS;
      canopyN = can;
      pondN = pn;
      poolN = cn;
      poolHigh = poolN > poolTarget;
      pondEvap = pondN > pondTarget ? 1 / 1400 : 1 / 60000;
      if (pond) {
        if (pondN < pondCap - pondTop * 0.5 * U) pondLow = true;
        else if (pondLow && pondN >= pondCap - 2 * U2) {
          pondLow = false;
          if (T - pondFullAt > 12000) entry('The pond is full.');
          pondFullAt = T;
        }
      }
      for (let k = plants.length - 1; k >= 0; k--) if (plants[k].dead) plants.splice(k, 1);
      for (let k = fungi.length - 1; k >= 0; k--) if (fungi[k].dead) fungi.splice(k, 1);
    }

    /* -- The record. Only what happened here. A minor line waits its turn and gives way if the record is busy. */

    const queue = [];
    let quietUntil = 0;
    function entry(text, minor) {
      if (!recording) return;
      if (minor) {
        if (T < quietUntil) return;
        quietUntil = T + 1400;
      }
      if (queue.length < 6) queue.push(T - T0, text);
    }

    function move(i, t) {
      const m = mat[i];
      if (m < WATER || stamp[i] === t) return;
      switch (m) {
        case WATER: stepWater(i); break;
        case DRIP: stepDrip(i); break;
        case LILY: stepLily(i); break;
        case SEED: stepSeed(i); break;
        case PETAL: stepPetal(i); break;
        case LITTER: stepLitter(i); break;
        case SMOKE: stepSmoke(i); break;
        case SPORE: stepSpore(i); break;
      }
    }
    /* Added to four grains at once, this sets the top bit of each one that is WATER or after: a grain that moves. */
    const MOVES = (128 - WATER) * 0x01010101;
    /* Each tick, the moving grains take as many steps as there are grains to a step of the plan, U on average.
       Rows go bottom to top, each row the other way from the last; four grains with nothing to move are passed together. */
    function update() {
      tick++;
      T++;
      const steps = Math.max(1, Math.floor(tick * U) - Math.floor((tick - 1) * U));
      for (sub = 0; sub < steps; sub++) {
        pass++;
        stampNow = (pass & 255) || 1;
        const t = stampNow;
        sporeList.length = 0;
        for (let y = H - 2; y >= 1; y--) {
          const a = y * W + 1, b = y * W + W - 2;
          if (((y ^ pass) & 1) === 0) {
            for (let q = a >> 2, qe = b >> 2; q <= qe; q++) {
              if (((mat4[q] + MOVES) & 0x80808080) === 0) continue;
              for (let i = Math.max(q << 2, a), ie = Math.min((q << 2) + 3, b); i <= ie; i++) move(i, t);
            }
          } else {
            for (let q = b >> 2, qe = a >> 2; q >= qe; q--) {
              if (((mat4[q] + MOVES) & 0x80808080) === 0) continue;
              for (let i = Math.min((q << 2) + 3, b), ie = Math.max(q << 2, a); i >= ie; i--) move(i, t);
            }
          }
        }
      }
      sub = 0;
      damp();
      for (let k = 0; k < plants.length; k++) if (!plants[k].dead) stepPlant(plants[k]);
      for (let k = 0; k < fungi.length; k++) if (!fungi[k].dead) stepFungus(fungi[k]);
      for (let k = 0; k < worms.length; k++) stepWorm(worms[k]);
      closeTunnels();
      stepFlies();
      stepFish();
      director();
      if ((tick & 31) === 0) census();
    }

    /* -- Drawing. One pixel per grain; light is added where something glows. */

    const kernels = [];
    function kernel(r) {
      if (kernels[r]) return kernels[r];
      const dx = [], dy = [], f = [];
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y) / r;
        if (d < 1) { dx.push(x); dy.push(y); f.push((1 - d) * (1 - d)); }
      }
      return (kernels[r] = { dx: Int8Array.from(dx), dy: Int8Array.from(dy), f: Float32Array.from(f), n: dx.length });
    }
    function light(cx, cy, r, a) {
      if (a <= 0.02) return;
      const k = kernel(r), LR = LIGHT[0], LG = LIGHT[1], LB = LIGHT[2];
      for (let n = 0; n < k.n; n++) {
        const x = cx + k.dx[n], y = cy + k.dy[n];
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        const w = a * k.f[n];
        if (w < 0.08 && (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 > w * 12) continue;
        if (EMIT[mat[(y + 1) * W + x + 1]]) continue;
        const o = y * GW + x;
        out[o] = blend(out[o], LR, LG, LB, w);
      }
    }

    const SMK = mixc(SH.cloud[2], [217, 211, 208], 0.55), SPR = SH.glow[2];
    /* Water is lit along its top grain, lighter for a band under that, and dithered deep below.
       A falling drop trails a fading streak as long as it falls in a tick. */
    const BAND = P(2) * W, DEEP = P(4) * W, TAIL = Math.max(1, Math.round(2 * U) - 1), SHIM = 8 * U;
    const R_FLY = P(4), R_SPORE = P(3), R_CAP = P(12), R_CAP2 = P(8);
    function render() {
      const sn = stampNow;
      for (let y = 1; y < H - 1; y++) {
        const a = y * W + 1, b = a + GW, d = (y - 1) * GW - a;
        for (let i = a; i < b;) {
          /* Four grains of one material that is painted plainly, and as many fours of it as follow, are copied straight. */
          if ((i & 3) === 0 && i + 4 <= b) {
            const w4 = mat4[i >> 2], m4 = w4 & 255;
            if (w4 === m4 * 0x01010101 && PAINT[m4] < 2) {
              const src = PAINT[m4] ? base : col;
              let j = i + 4;
              while (j + 4 <= b && mat4[j >> 2] === w4) j += 4;
              for (; i < j; i++) out[i + d] = src[i];
              continue;
            }
          }
          const m = mat[i], o = i + d, x = i - a + 1;
          switch (PAINT[m]) {
            case 0: out[o] = col[i]; break;
            case 1: out[o] = base[i]; break;
            case 2: {
              const up = mat[i - W];
              if (up !== WATER && up !== LILY && up !== DRIP) {
                if (PASS[mat[i + W]]) {
                  out[o] = C_RAIN;
                  for (let k = 1, j = i - W, q = o - GW; k <= TAIL && y - k >= 1 && mat[j] === AIR; k++, j -= W, q -= GW) out[q] = blend(base[j], RAIN[0], RAIN[1], RAIN[2], 0.45 - 0.25 * (k - 1) / TAIL);
                }
                else if (sky[i]) out[o] = hash(x, (T >> 4) + ((x / SHIM) | 0), 9) < 0.08 ? C_SHIM : K.water[3];
                else out[o] = stamp[i] === sn ? C_FLOW : K.water[2];
              } else if (mat[i - BAND] !== WATER) {
                out[o] = stamp[i] === sn ? C_FLOW : sky[i] ? C_SKYW : K.water[2];
              } else {
                const deep = mat[i - DEEP] === WATER;
                out[o] = K.water[(BAYER[(y & 3) * 4 + (x & 3)] < (deep ? 4 : 10)) ? 1 : deep ? 0 : 2];
              }
              break;
            }
            case 3: { const w = wet[i]; out[o] = w ? darken(col[i], WK[w]) : col[i]; break; }
            case 4: {
              const a = 0.7 * (1 - aux[i] / 185);
              out[o] = a > 0 ? blend(base[i], SMK[0], SMK[1], SMK[2], a) : base[i];
              break;
            }
            case 5: out[o] = C_DRIP; break;
            case 6: out[o] = blend(base[i], SPR[0], SPR[1], SPR[2], Math.min(1, 0.35 + aux[i] / 60)); break;
          }
          i++;
        }
      }
      /* Stars, then the clouds drifting over them. */
      for (let k = 0; ctl.stars && k < stars.length; k++) {
        const s = stars[k], i = idx(s[0], s[1]);
        if (mat[i] !== AIR) continue;
        const b = s[4] * (0.6 + 0.4 * Math.sin((T + s[3]) * 0.021 + s[3]));
        const c = s[2] ? SH.moon[1] : SH.cloud[2], o2 = s[1] * GW + s[0];
        out[o2] = blend(out[o2], c[0], c[1], c[2], b);
        /* The bright ones, where the grains are small, a faint cross. */
        if (s[2] && U >= 1.8 && s[0] > 0 && s[1] > 0 && s[0] < GW - 1 && s[1] < GH - 1) {
          [o2 - 1, o2 + 1, o2 - GW, o2 + GW].forEach((q) => { out[q] = blend(out[q], c[0], c[1], c[2], b * 0.3); });
        }
      }
      const ri = rain.i;
      for (let k = 0; ctl.clouds && k < clouds.length; k++) {
        const cl = clouds[k], cx = Math.round(cl.x * U), cs = cl.cells;
        for (let n = 0; n < cs.length; n += 3) {
          const x = cx + cs[n], y = cl.y + cs[n + 1];
          if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
          const i = idx(x, y);
          if (mat[i] !== AIR || sky[i] !== 1) continue;
          const s = cs[n + 2], c = s > 0 && ri > 0.05 && hash(x, y, T >> 2) < ri * 0.7 ? K.cloud[s - 1] : K.cloud[s];
          out[y * GW + x] = c;
        }
      }
      for (let k = 0; k < fish.length; k++) {
        const f = fish[k];
        for (let n = 0; n < FISH.length; n++) {
          const q = FISH[n], x = f.x - f.dir * q[0], y = f.y + q[1];
          if (at(x, y) === WATER) out[y * GW + x] = K.blossom[q[2]];
        }
        const tx = f.x - f.dir * (FL - 1), ty = f.y + (hash(f.x, f.y, T >> 3) < 0.5 ? -1 : 1);
        if (at(tx, ty) === WATER) out[ty * GW + tx] = K.blossom[0];
      }
      if (ctl.machine > 0) drawMachine();
      if (hover && ctl.creature) {
        /* Phased from the scene's start, so the frozen frame is the rest pose. 40 ticks a second: a 3 s bob (rest,
           lift, a short settle), and a blink every 6 s, always at rest. */
        const ph = T - T0, b = ((ph % 120) + 120) % 120, w = ((ph % 240) + 240) % 240;
        const set = hover.set;
        const fr = b >= 40 && b < 100 ? set.lift : b >= 100 && b < 108 ? set.settle : w >= 228 && w < 234 ? set.blink : set.rest;
        for (let r = 0; r < fr.length; r++) {
          const row = fr[r], gy = hover.y + r;
          if (gy < 0 || gy >= GH) continue;
          for (let q = 0; q < row.length; q++) {
            const ch = row[q], gx = hover.x + q;
            if (ch !== '.' && gx >= 0 && gx < GW) out[gy * GW + gx] = CORACLE_C[ch];
          }
        }
      }
      if (eyes.length && (T % 230) < 5) {
        for (let k = 0; k < eyes.length; k++) { const e = eyes[k]; if (e >= 0 && mat[e] === CREATURE) out[(((e / W) | 0) - 1) * GW + (e % W) - 1] = K.creature[2]; }
      }
      /* Light. */
      for (let k = 0; k < lights.length; k++) {
        const l = lights[k];
        let a = l[3];
        if (l[4] === 1) a *= 0.7 + 0.3 * Math.sin(T * 0.013 + l[0] / U * 1.7);
        else if (l[4] === 2) a *= 0.92 + 0.08 * Math.sin(T * 0.05) * Math.sin(T * 0.031 + 1);
        light(l[0], l[1], l[2], a * ctl.lights);
      }
      for (let k = 0; k < fungi.length; k++) {
        const f = fungi[k];
        if (f.dead || f.stage === FG || !f.cap.length) continue;
        let a = 0.5 * (0.72 + 0.28 * Math.sin((T + f.ph) * 6.2832 / f.per));
        if (f.stage === FFADE) a *= Math.max(0, 1 - (T - f.fade) / 480);
        light(f.cx, f.cy, f.h >= 5 ? R_CAP : R_CAP2, a);
      }
      for (let k = 0; k < sporeList.length; k++) {
        const i = sporeList[k];
        if (mat[i] === SPORE) light((i % W) - 1, ((i / W) | 0) - 1, R_SPORE, 0.25);
      }
      for (let k = 0; ctl.flies && k < flies.length; k++) {
        const f = flies[k], u = ((T + f.ph) % f.per) / f.per;
        let b = u < 0.32 ? Math.sin(Math.PI * u / 0.32) : 0;
        b *= 1 - 0.65 * ri;
        const o2 = f.y * GW + f.x;
        if (b > 0.05) {
          light(f.x, f.y, R_FLY, 0.55 * b);
          out[o2] = blend(out[o2], SH.glow[3][0], SH.glow[3][1], SH.glow[3][2], 0.35 + 0.65 * b);
        } else {
          out[o2] = blend(out[o2], SH.glow[0][0], SH.glow[0][1], SH.glow[0][2], 0.3);
        }
      }
      if (!bare) ctx.putImageData(image, 0, 0);
    }

    function drift() {
      for (let k = 0; k < clouds.length; k++) {
        const c = clouds[k];
        c.x += c.v;
        if (c.x - c.L > GWp + 2) c.x = -c.L - 2 - (k * 17) % 40;
      }
    }

    /* The machine the creature built: a wooden wheel where the water under the beds spills down the stair, a rope belt
       from its hub to a drum at the foot of the well, a loop of clay pots up the shaft, and (where there are beds) a
       trough from the well head over the fence to the cabbages. It is drawn over the grains and throws no dice. It turns
       only while water moves over the stair's first lip, so the water that turns it is moved, never made. Its angle starts
       at zero when the scene begins, so the frozen frame always shows it at rest. */
    const mach = (function () {
      const st = geo.stair, wl = geo.well;
      if (!st || st.steps.length < 2 || !wl || wl.bottom < 0) return null;
      const s0 = st.steps[0], s1 = st.steps[1];
      const R = Math.max(3, Math.round(2 * U));
      const hub = [s0.xb - R - 1, Math.min(s1.water - 1, s1.top + R + 1)];
      const px = Math.max(wl.s0, Math.min(wl.ropeX - 2, wl.s1 - 3));
      const drum = [px + 1, wl.bottom - 2];
      const gap = Math.max(6, Math.round(9 * U / 1.5));
      const top = wl.ringTop - 2;
      const m = { R, hub, drum, px, gap, top, bottom: wl.bottom - 4, lip: s0.xb, y0: s0.water, y1: s1.b, run: 0, a: 0, trough: null };
      const bd = geo.bed;
      if (bd) {
        const x0 = wl.ringR - 3, x1 = bd.x0, y0 = wl.fence[2] - 2;
        m.trough = { x0, x1, y0, y: (x) => y0 + Math.floor((x - x0) * 2 / Math.max(1, x1 - x0)), bed: bd.top };
      }
      return m;
    })();
    if (mach) geo.machine = { hub: mach.hub, R: mach.R, drum: mach.drum, shaft: mach.px, trough: mach.trough && [mach.trough.x0, mach.trough.x1, mach.trough.y0] };
    function machineTick() {
      if (!mach) return;
      let flow = 0;
      for (let y = mach.y0 - 1; y <= mach.y1; y++) for (let x = mach.lip - 2; x <= mach.lip + 1; x++) {
        if (!inb(x, y)) continue;
        const i = idx(x, y);
        if (mat[i] === WATER && stamp[i] === stampNow) flow++;
      }
      mach.run += ((flow > 0 ? 1 : 0) - mach.run) * (flow > 0 ? 0.06 : 0.015);
      if (!ctl.hold) mach.a += mach.run * 0.045;
    }
    const C_POT = [K.worm[0], K.worm[2], K.worm[3]];
    const C_ROPE = pk(rgb('#B49A78'));
    function drawMachine() {
      if (!mach) return;
      const solid = (x, y) => { const m = at(x, y); return m !== AIR && m !== WATER && m !== EDGE; };
      const dot = (x, y, c) => { if (x >= 0 && y >= 0 && x < GW && y < GH) out[y * GW + x] = c; };
      const nook = (x, y) => { if (inb(x, y) && solid(x, y)) dot(x, y, caveC[0]); };
      const [hx, hy] = mach.hub, R = mach.R, a = mach.a;
      /* The niche it turns in, cut where the rock was. */
      for (let y = -R - 2; y <= R + 2; y++) for (let x = -R - 2; x <= R + 2; x++) if (x * x + y * y <= (R + 1.6) * (R + 1.6)) nook(hx + x, hy + y);
      /* The belt: a rope from the hub to the drum, in a slot where it passes through rock. The film builds the machine
         in stages (ctl.machine): 1 the wheel, 2 the belt and drum, 3 the pots, 4 the trough. */
      if (ctl.machine >= 2) (function () {
        let [x0, y0] = mach.hub; const [x1, y1] = mach.drum;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let e = dx + dy, n = 0;
        for (;;) {
          if (solid(x0, y0)) { nook(x0, y0 - 1); nook(x0, y0 + 1); }
          dot(x0, y0, ((n++ + Math.floor(a * R)) % 6) < 1 ? K.wood[2] : C_ROPE);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * e;
          if (e2 >= dy) { e += dy; x0 += sx; }
          if (e2 <= dx) { e += dx; y0 += sy; }
        }
      })();
      /* The wheel: rim, six spokes and paddles, turning with the angle. */
      for (let k = 0; k < 6; k++) {
        const t = a + k * Math.PI / 3, c = Math.cos(t), s = Math.sin(t);
        for (let r = 1; r < R; r++) dot(Math.round(hx + c * r), Math.round(hy + s * r), K.wood[2]);
        dot(Math.round(hx + c * (R + 1)), Math.round(hy + s * (R + 1)), K.wood[2]);
      }
      for (let k = 0; k < 8 * R; k++) { const t = k * Math.PI * 2 / (8 * R); dot(Math.round(hx + Math.cos(t) * R), Math.round(hy + Math.sin(t) * R), K.wood[3]); }
      dot(hx, hy, K.wood[3]);
      /* The drum at the foot of the shaft. */
      if (ctl.machine < 2) return;
      const [dx, dy] = mach.drum;
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) dot(dx + x, dy + y, (x || y) ? K.wood[1] : K.wood[3]);
      if (ctl.machine < 3) return;
      /* The pot loop: a rope up the shaft and a clay pot every few grains, rising as the wheel turns. */
      const px = mach.px, g = mach.gap, off = Math.floor(a * R * 0.7) % g;
      for (let y = mach.top; y <= dy - 2; y++) if (at(px, y) === AIR || at(px, y) === WATER) dot(px, y, C_ROPE);
      for (let y = mach.bottom - off; y >= mach.top; y -= g) {
        dot(px, y, C_POT[1]); dot(px + 1, y, C_POT[1]); dot(px, y + 1, C_POT[0]); dot(px + 1, y + 1, C_POT[0]); dot(px, y - 1, C_POT[2]);
      }
      /* The trough, over the fence to the bed, with water running in it while the wheel turns. */
      const tr = mach.trough;
      if (tr && ctl.machine >= 4) {
        for (let x = tr.x0; x <= tr.x1; x++) {
          const y = tr.y(x);
          /* A split log: its lit rim, its shadowed belly, and water in it while the wheel turns. */
          dot(x, y + 1, K.wood[0]);
          dot(x, y, K.wood[2]);
          if (x === tr.x0 || x === tr.x1) dot(x, y - 1, K.wood[3]);
          else if (mach.run > 0.3) dot(x, y, K.water[2]);
        }
        if (mach.run > 0.3) for (let y = tr.y(tr.x1) + 1; y < tr.bed; y++) if (((y + Math.floor(a * 6)) & 3) === 0) dot(tr.x1, y, K.water[2]);
      }
    }

    const world = {
      GW, GH, U, PW: GWp, PH: GHp, line: 'T+0000000', render, out, image, geo, mat, stamp,
      update() { update(); drift(); machineTick(); },
      get T() { return T - T0; },
      get tick() { return tick; },
      get moved() { return moved; },
      get living() { return living; },
      get machine() { return mach ? { run: mach.run, angle: mach.a } : null; },
      /* For the film: the arrays, its controls, the part tags, where the creature hovers, and the bare ground. */
      ctl, tags, col, base, aux, wet, zone, sky, gk, W, H, N,
      get hover() { return hover ? { x: hover.x, y: hover.y, w: hover.set.rest[0].length, h: hover.set.rest.length } : null; },
      /* The place before anyone came: the land and what lies under it (the water under the beds a little lower, the
         stair and the cave pool dry), pale silt where the turf and beds will be, the pond's hollow filled level, and
         none of what grows or was built. Needs { tags }. */
      makeBare(lower) {
        if (!tags) throw new Error('boot with { tags: true }');
        const keep = (p) => !!BARE_KEEP[p];
        const silt = (x, y) => K.silt[pick(0.5, 1.6, x, y, 77)];
        const aqLine = aqTop + (lower === undefined ? P(3) : lower);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x, gx = x - 1, gy = y - 1;
          if (!keep(tags.part[i])) { mat[i] = tags.bareM[i]; col[i] = tags.bareC[i]; }
          const z0 = zone[i];
          if (!keep(tags.part[i]) || z0 === Z_SHAFT || z0 === Z_CELLAR || z0 === Z_POND) { base[i] = tags.landB[i]; zone[i] = tags.landZ[i]; sky[i] = tags.landS[i]; }
          const k = gk[i], z = zone[i];
          if ((z0 === Z_POND && gy >= SB) || (k === 7 && gy >= SB)) {
            /* The pond's hollow, filled level with what is round it: silt on top, topsoil under. */
            mat[i] = SOIL; col[i] = gy < SB + P(2) ? silt(gx, gy) : K.topsoil[pick(0.45, 1.5, gx, gy, 78)]; sky[i] = 0; zone[i] = 0;
          }
          else if (z0 === Z_POND && mat[i] === WATER) { mat[i] = AIR; col[i] = 0; }
          else if ((k === 8 || k === 9) && (mat[i] === TURF || mat[i] === TILL)) { mat[i] = SOIL; col[i] = silt(gx, gy); }
          else if (mat[i] === WATER && (z === Z_POOL || (z === Z_AQ && gy < aqLine))) { mat[i] = AIR; col[i] = 0; aux[i] = 0; }
          else if (mat[i] >= GREEN && mat[i] !== SOIL && mat[i] !== TURF && mat[i] !== TILL && mat[i] !== WATER) {
            /* Whatever lives or drifts: back to what was there, or to air. */
            mat[i] = tags.bareM[i]; col[i] = tags.bareC[i];
            if (mat[i] >= GREEN && mat[i] !== SOIL && mat[i] !== TURF && mat[i] !== TILL && mat[i] !== WATER) { mat[i] = AIR; col[i] = 0; }
          }
        }
        wet.fill(0);
        plants.length = 0; fungi.length = 0; worms.length = 0; flies.length = 0; fish.length = 0; lights.length = 0;
        chimney.length = 0; eyes.length = 0; stand.length = 0;
        ctl.creature = false; ctl.machine = 0; ctl.auto = false;
        census();
      },
      /* A grain as the composition left it (before the opening settled). */
      restore(i) { if (tags) { mat[i] = tags.prevM[i]; col[i] = tags.prevC[i]; base[i] = tags.finalB[i]; zone[i] = tags.finalZ[i]; sky[i] = tags.finalS[i]; } },
      settle(n) { for (let k = 0; k < n; k++) { update(); drift(); } },
      next() { return queue.length ? [queue.shift(), queue.shift()] : null; },
      /* The opening is settled with the opening's dice. From here on each visit throws its own. */
      begin(given) {
        moved = 0;
        T0 = T;
        let s = 0;
        if (given !== undefined) s = given >>> 0; else try {
          const a = new Uint32Array(1);
          (window.crypto || window.msCrypto).getRandomValues(a);
          s = a[0];
        } catch (e) { s = (Math.random() * 4294967296) >>> 0; }
        seed = (s ^ OPENING) || 0x9e3779b9;
        rain.next = T + 1800 + rint(2600);
        firstDrip = T + 90 + rint(90);
        lastWellDrip = -1e9;
        recording = true;
        if (hover) for (let k = 0; k < stand.length; k++) { const i = stand[k]; if (i >= 0 && (mat[i] === CREATURE || mat[i] === GREEN)) toAir(i); }
        stand.length = 0;
        eyes.length = 0;
        if (mach) { mach.a = 0; mach.run = 0; }
        census();
      },
      /* The books: every grain of water, seen or not, and the counts. Nothing is made or lost. */
      stats() {
        let vis = 0, damp2 = 0, drips = 0;
        for (let i = 0; i < N; i++) { if (mat[i] === WATER) vis++; else if (mat[i] === DRIP) drips++; }
        for (let k = 0; k < soilArr.length; k++) damp2 += wet[soilArr[k]];
        return { T: T - T0, water: vis, drips, damp: damp2, hidden, total: vis + drips + damp2 + hidden, pond: pondN, pondCap, pondTarget,
          pool: poolN, poolTarget, plants: plants.length, plantCap, fungi: fungi.length, canopy: canopyN, canopy0, living, raining: rain.on };
      }
    };

    census();
    return world;
  }

  const API = { boot, layout, OPENING, PLAN, GRAIN };
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SiltSand = API;
  if (!PAGE) return;

  /* ---- Page ---- */

  const STEP = 1000 / 40;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let world = null, starting = false, woken = false, ready = false, live = false, wanted = !reduced;
  let inView = !('IntersectionObserver' in window);
  let raf = 0, last = 0, acc = 0, shownT = -1000, shownMoved = -1, shownLiving = -1;

  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  function say() {
    runBtn.textContent = wanted ? '[Pause]' : '[Run]';
    runBtn.setAttribute('aria-label', wanted ? 'Pause simulation' : 'Run simulation');
    hinge.textContent = wanted ? 'This is running.' : 'This is paused.';
  }

  /* Until a frame has been drawn the plate is a frozen frame, and says so. */
  function reveal() {
    if (live) return;
    live = true;
    canvas.hidden = false;
    still.hidden = true;
    tag.textContent = 'Simulated in your browser';
    ctl.hidden = false;
    say();
  }

  /* A whole number of device pixels per grain, at any zoom, never finer than FINEST CSS px, and how many grains
     that is to a step of the plan. The plate is a whole number of CSS px wide and tall: the browser lays out a
     canvas of any other size a device pixel larger, and one column or row of grains comes out wider than the rest.
     So the grains across and down are a multiple of the fewest that come to whole CSS px (up to TILE of them),
     enough of them to cover the stage, and the stage crops what is over. The plan is the whole steps the stage holds.
     A zoomed pixel ratio is not exact (1.35 comes as 1.3500000238), so whole CSS px is to within a hair. */
  const FINEST = 1.3, TILE = 48;
  function measure() {
    const dpr = window.devicePixelRatio || 1;
    let K2 = Math.max(1, Math.round(GRAIN * dpr));
    if (K2 / dpr < FINEST) K2++;
    const g = K2 / dpr;
    const whole = (v) => Math.abs(v - Math.round(v)) <= 1e-5;
    let n = 1;
    while (n < TILE && !whole(n * g)) n++;
    if (!whole(n * g)) n = 1;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    /* A stage that starts between device pixels needs one more to be covered. */
    const box = stage.getBoundingClientRect();
    const odd = (v) => Math.abs(v * dpr - Math.round(v * dpr)) > 1e-3 ? 1 / dpr : 0;
    const ox = odd(box.left + window.scrollX + stage.clientLeft), oy = odd(box.top + window.scrollY + stage.clientTop);
    const cover = (s) => n * Math.ceil(Math.ceil(s / g - 1e-6) / n);
    const m = { dpr, g, U: Math.round(PLAN / g * 1e6) / 1e6, sw, sh, ox, oy, w: cover(sw + ox), h: cover(sh + oy),
      pw: Math.floor((sw + 0.01) / PLAN), ph: Math.floor((sh + 0.01) / PLAN), show: g };
    if (world) m.show = shown(world, dpr);
    return m;
  }
  /* A world keeps its grains (w.at: the grain, pixel ratio and plan it was built for), shown as near the size they
     were built at as whole device pixels allow. */
  function shown(w, dpr) { return Math.max(1, Math.round(w.at.g * dpr)) / dpr; }
  /* When the pixel ratio changes (a zoom, or a screen with another ratio), a world stays only if it looks just as it
     did: its grains the same size in CSS px, the same plan, and the stage still covered. Otherwise it is built again. */
  function keeps(w, m) {
    const k = shown(w, m.dpr);
    return Math.abs(k - w.at.g) <= 1e-6 * w.at.g && w.at.pw === m.pw && w.at.ph === m.ph &&
      w.GW * k >= m.sw + m.ox - 1e-3 && w.GH * k >= m.sh + m.oy - 1e-3;
  }

  /* The plan starts at the stage's top left corner, and the grains past it fill the stage to its right and bottom
     edges, where the stage crops them. After a resize, a plan bigger than the stage is centred and cropped on both
     sides, and a plate smaller than the stage is centred (any odd device pixel left over going below). It starts on
     a device pixel wherever the stage happens to fall: the one at or before the stage's edge when there are grains
     to spare, so no sliver of the stage shows. */
  function place(m) {
    const k = world ? m.show : m.g;
    const cw = (world ? world.GW : m.w) * k, ch = (world ? world.GH : m.h) * k;
    const pw = (world ? world.PW * world.U : m.pw * m.U) * k, ph = (world ? world.PH * world.U : m.ph * m.U) * k;
    const box = stage.getBoundingClientRect();
    const px = box.left + window.scrollX + stage.clientLeft, py = box.top + window.scrollY + stage.clientTop;
    const d = m.dpr;
    const snap = (v, spare) => (spare >= 1 / d ? Math.floor(v * d + 1e-6) : Math.round(v * d)) / d;
    const along = (p, s, c, q) => {
      if (c < s) return snap(p + Math.floor((s - c) / 2 * d) / d, 0);
      const v = clamp((s - q) / 2, s - c, 0);
      return snap(p + v, v - (s - c));
    };
    const s = canvas.style;
    s.position = 'absolute';
    s.left = along(px, m.sw, cw, pw) - px + 'px';
    s.top = along(py, m.sh, ch, ph) - py + 'px';
    s.width = cw + 'px';
    s.height = ch + 'px';
    s.imageRendering = 'pixelated';
  }

  function group(n, w) { return pad(n, w).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function counters() {
    if (world.moved !== shownMoved) { shownMoved = world.moved; movedEl.textContent = group(shownMoved, 9); }
    if (world.living !== shownLiving) { shownLiving = world.living; livingEl.textContent = group(shownLiving, 6); }
  }

  /* The record is one row, overwritten. A line stays up long enough to read. */
  function show(text, t) {
    const line = 'T+' + pad(t, 7) + ' ' + text;
    logEl.textContent = line;
    return line;
  }
  function record() {
    if (world.T - shownT < 240) return;
    const e = world.next();
    if (!e) return;
    world.line = show(e[1], e[0]);
    shownT = world.T;
  }

  function frame(now) {
    raf = 0;
    if (!going()) return;
    raf = requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (dt > 100) dt = 100;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 2) {
      world.update();
      acc -= STEP;
      steps++;
    }
    if (acc >= STEP) acc = 0;
    if (steps) {
      world.render();
      record();
      if ((world.tick & 7) < steps) counters();
    }
  }

  function going() { return wanted && inView && ready && !document.hidden && !isFull(); }

  /* Paused means stopped. Nothing is caught up. */
  function kick() {
    if (going() && !raf) {
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  /* The opening settles for a moment before it is shown: the smoke finds its way up, the water finds its level.
     A little at a time, so the page stays free. Then it takes the plate, from the frozen frame or from a world
     built at another pixel ratio. */
  function settle(left, w) {
    const t0 = performance.now();
    do { w.update(); left--; } while (left > 0 && performance.now() - t0 < 10);
    if (left > 0) { setTimeout(settle, 0, left, w); return; }
    starting = false;
    /* The pixel ratio changed while it was being made: make it again, unless the world on the plate suits it. */
    const m = measure();
    if (m.dpr !== w.at.dpr && !keeps(w, m)) {
      if (world && world.at.dpr === m.dpr) { ready = true; kick(); return; }
      start(m);
      if (starting) return;
    }
    w.at.dpr = m.dpr;
    world = w;
    canvas.width = w.GW;
    canvas.height = w.GH;
    place(measure());
    shownT = -1000;
    shownMoved = shownLiving = -1;
    w.begin();
    w.render();
    counters();
    reveal();
    ready = true;
    kick();
  }

  function start(m) {
    if (m.pw < 40 || m.ph < 60 || starting) return;
    starting = true;
    ready = false;
    const parts = boot(m.w, m.h, m.U, m.pw, m.ph);
    (function build() {
      const t0 = performance.now();
      let r;
      try { do r = parts.next(); while (!r.done && performance.now() - t0 < 12); } catch (e) { starting = false; ready = !!world; kick(); return; }
      if (!r.done) { setTimeout(build, 0); return; }
      r.value.at = { g: m.g, dpr: m.dpr, pw: m.pw, ph: m.ph };
      setTimeout(settle, 0, 180, r.value);
    })();
  }

  /* One world for the visit. A new window size crops it, or leaves a margin; it does not start another.
     A new pixel ratio (a zoom, another screen) does, unless the world would look just as it did. It is looked at
     a moment after the change, once the page has laid itself out at the new size. */
  let refitTimer = 0;
  function refit() {
    const m = measure();
    place(m);
    if (!woken) return;
    if (!world) start(m);
    else if (m.dpr !== world.at.dpr) {
      if (keeps(world, m)) world.at.dpr = m.dpr;
      else start(m);
    }
  }
  function later() {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refit, 150);
  }
  (function ratio() {
    if (!window.matchMedia) return;
    const q = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    if (q.addEventListener) q.addEventListener('change', () => { later(); ratio(); }, { once: true });
  })();

  runBtn.addEventListener('click', () => {
    wanted = !wanted;
    say();
    if (world) counters();
    kick();
  });

  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', later);
  if (window.ResizeObserver) new ResizeObserver(() => { place(measure()); }).observe(document.documentElement);

  place(measure());

  function go() {
    if (woken || isFull()) return;
    woken = true;
    start(measure());
  }
  function wake() {
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 400 });
    else setTimeout(go, 60);
  }

  /* Nothing runs until the plate is on screen, and nothing is built until it is coming up. */
  let coming = !('IntersectionObserver' in window);
  if (coming) {
    wake();
  } else {
    new IntersectionObserver((es) => {
      inView = es[es.length - 1].isIntersecting;
      kick();
    }).observe(stage);
    new IntersectionObserver((es) => {
      coming = es[es.length - 1].isIntersecting;
      if (coming) wake();
    }, { rootMargin: '50% 0px' }).observe(stage);
  }

  ['fullscreenchange', 'webkitfullscreenchange'].forEach((name) => {
    document.addEventListener(name, () => {
      if (coming) wake();
      kick();
    });
  });
})();
