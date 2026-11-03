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

  const canvas = document.getElementById('sand');
  const stage = document.getElementById('sand-stage'), still = document.getElementById('sand-still');
  const ctl = document.getElementById('sand-ctl'), runBtn = document.getElementById('sand-run');
  const logEl = document.getElementById('sand-log'), movedEl = document.getElementById('sand-moved');
  const livingEl = document.getElementById('sand-living');
  const hinge = document.getElementById('hinge-state'), tag = document.getElementById('sand-tag');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas. The frozen frame stays. */ }
  if (!ctx || !stage || !still || !ctl || !runBtn || !logEl || !movedEl || !livingEl || !hinge || !tag) return;

  /* Earlier versions kept their world in this browser. This one starts fresh on every visit, so that store goes. */
  try { if (window.indexedDB) indexedDB.deleteDatabase('silt'); } catch (e) { /* Nothing kept, nothing to clear. */ }

  const OPENING = 0x51f7a3c9; /* The dice the opening is composed and settled with. */
  const GRAIN = 3; /* CSS px, before snapping to device pixels. */

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
    worm: ['#8E5E50', '#A87060', '#C48A72', '#D9A288']
  };

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

  /* What stands where along the ground. Each part has the width it needs, a width it is comfortable at, and one
     it would like. The cabin, the pond, a strip of meadow and the beds come first; a tree joins only if those can
     still be comfortable. */
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

  /* A world of this many grains. The arrays carry a one-grain frame the plate never shows. */

  function boot(GW, GH) {
    const W = GW + 2, H = GH + 2, N = W * H;
    canvas.width = GW;
    canvas.height = GH;
    const image = ctx.createImageData(GW, GH);
    const out = new Uint32Array(image.data.buffer);

    const mat = new Uint8Array(N), aux = new Uint8Array(N), stamp = new Uint8Array(N), wet = new Uint8Array(N);
    const zone = new Uint8Array(N), sky = new Uint8Array(N), origM = new Uint8Array(N), gk = new Uint8Array(N);
    const col = new Uint32Array(N), base = new Uint32Array(N), orig = new Uint32Array(N);
    const NB4 = [-W, W, -1, 1];

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

    let tick = 0, stampNow = 1, T = 0, T0 = 0, moved = 0, recording = false, living = 0;
    /* Water out of sight: in the ground and in the air, counted in grains. */
    let hidden = 900;

    for (let x = 0; x < W; x++) { mat[x] = EDGE; mat[N - W + x] = EDGE; }
    for (let y = 0; y < H; y++) { mat[y * W] = EDGE; mat[y * W + W - 1] = EDGE; }

    /* ---- The opening ---- */

    const CR = rngOf(OPENING);
    const SB = clamp(Math.round(GH * 0.325), 38, 92); /* The row the meadow, the pond and the cabin stand on. */
    const D = GH - SB;
    const KS = clamp(D / 146, 0.55, 1.35);
    const segs = layout(GW);
    const seg = {};
    const segAt = new Array(GW);
    segs.forEach((s) => {
      if (s.id !== 'edge') seg[s.id] = s;
      for (let x = s.x0; x < s.x0 + s.w && x < GW; x++) segAt[x] = s.id;
    });

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
    function depthK(y) { return y > SB + 18 ? 1 - 0.2 * clamp((y - SB - 18) / 128, 0, 1) : 1; }

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
      const isFlat = new Uint8Array(GW), off = new Float32Array(GW);
      flats.forEach((f) => {
        for (let x = f[0]; x < f[1] && x < GW; x++) { off[x] = f[2]; isFlat[x] = 1; }
        pts.push([f[0], f[2]], [f[1] - 1, f[2]]);
      });
      pts.sort((p, q) => p[0] - q[0]);
      for (let x = 0; x < GW; x++) {
        if (!isFlat[x]) {
          let p0 = null, p1 = null;
          for (let k = 0; k < pts.length; k++) { if (pts[k][0] <= x) p0 = pts[k]; else { p1 = pts[k]; break; } }
          if (!p0) off[x] = p1 ? p1[1] : 0;
          else if (!p1 || p1[0] === p0[0]) off[x] = p0[1];
          else {
            let t = (x - p0[0]) / (p1[0] - p0[0]);
            t = (1 - Math.cos(t * Math.PI)) / 2;
            off[x] = p0[1] + (p1[1] - p0[1]) * t;
          }
          off[x] += Math.round(0.8 * Math.sin(x * 0.37) + 0.6 * Math.sin(x * 0.81 + 2));
        }
        surf[x] = SB + Math.round(off[x]);
        const id = segAt[x];
        plantable[x] = id === 'meadow' || id === 'grove' || id === 'young' || id === 'orchard' || id === 'edge' ? 1 : 0;
      }
    })();

    const pond = seg.pond ? { L: seg.pond.x0 + 6, R: seg.pond.x0 + seg.pond.w - 6 } : null;
    /* The grassy banks either side of the water take seed too. */
    if (pond) for (let x = seg.pond.x0; x < seg.pond.x0 + seg.pond.w && x < GW; x++) if (x < pond.L - 1 || x > pond.R + 1) plantable[x] = 1;
    if (pond) pond.dep = clamp(Math.round((pond.R - pond.L) * 0.21), 7, 14);
    function pondDepth(x) {
      if (!pond || x <= pond.L || x >= pond.R) return 0;
      return Math.round(pond.dep * Math.pow(Math.sin(Math.PI * (x - pond.L) / (pond.R - pond.L)), 0.7));
    }
    const nTerr = seg.terraces ? Math.round(seg.terraces.w / 21) : 0;
    function terraceAt(x) {
      const s = seg.terraces;
      if (!s || x < s.x0 || x >= s.x0 + s.w) return -1;
      return Math.min(Math.floor((x - s.x0) / 21), nTerr - 1);
    }

    /* -- Sky, moon and the far hills. All of it is what shows through the air. */

    const skyRamp = SH.skyTop.concat(SH.skyHorizon);
    const farC = [pk(mixc(SH.skyHorizon[1], SH.grass[0], 0.22)), pk(mixc(SH.skyHorizon[1], SH.grass[0], 0.3))];
    const midC = [pk(mixc(SH.skyHorizon[0], SH.grass[0], 0.48)), pk(mixc(SH.skyHorizon[0], SH.grass[1], 0.42))];
    const caveC = [pk(mixc(SH.stone[0], [0, 0, 0], 0.5)), pk(mixc(SH.stone[0], [0, 0, 0], 0.42))];
    const holeC = [pk(mixc(SH.topsoil[0], [0, 0, 0], 0.3)), pk(mixc(SH.topsoil[0], [0, 0, 0], 0.22))];
    const moon = { x: Math.round(GW * 0.78), y: Math.max(9, Math.round(SB * 0.2)), r: 6.5 };
    (function () {
      const bumps = [];
      for (let b = 0; b < Math.round(GW / 15); b++) bumps.push([Math.floor(CR() * GW), 2 + Math.floor(CR() * 3), 2 + Math.floor(CR() * 3)]);
      const span = 1.486 * SB, lift = 0.571 * SB;
      for (let x = 0; x < GW; x++) {
        const far = Math.round(SB - 24 + 5 * Math.sin(x / 47 + 0.5) + 3 * Math.sin(x / 19 + 2) + 1.2 * Math.sin(x / 7));
        let mid = SB - 13 + 4 * Math.sin(x / 33 + 3) + 2 * Math.sin(x / 13 + 1);
        for (let k = 0; k < bumps.length; k++) {
          const du = (x - bumps[k][0]) / bumps[k][1];
          if (Math.abs(du) <= 1) mid -= bumps[k][2] * Math.sqrt(1 - du * du);
        }
        mid = Math.round(mid);
        for (let y = 0; y < GH; y++) {
          const i = idx(x, y);
          if (y >= surf[x]) { base[i] = holeC[hash(x, y, 7) < 0.5 ? 0 : 1]; continue; }
          if (y >= far) {
            sky[i] = 2;
            base[i] = y >= mid ? midC[hash(x, y, 41) < 0.25 + 0.5 * ((y - mid) / 12) ? 1 : 0]
              : farC[hash(x, y, 42) < 0.2 + 0.6 * ((y - far) / 14) ? 1 : 0];
            continue;
          }
          sky[i] = 1;
          const t = Math.pow(clamp((y + lift) / span, 0, 1), 1.05) * 7;
          const b = Math.floor(t), th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
          let c = skyRamp[clamp(t - b > th ? b + 1 : b, 0, 7)];
          const dm = Math.hypot(x - moon.x, y - moon.y);
          if (dm <= moon.r) c = dm > moon.r - 1.2 ? SH.moon[0] : SH.moon[1];
          else if (dm < 34) {
            const w = 0.5 * (1 - dm / 34) * (1 - dm / 34);
            if (w >= 0.08 || th <= w * 12) c = mixc(c, SH.moon[0], w);
          }
          base[i] = pk(c);
        }
      }
    })();

    /* -- Ground and strata */

    const tb = new Int16Array(GW);
    let cbMax = 0;
    (function () {
      for (let x = 0; x < GW; x++) {
        const s0 = surf[x], o = s0 - SB, pd = pondDepth(x), terr = terraceAt(x);
        let t0 = s0 + (8 + 0.35 * (2 - o)) * KS + 2.5 * Math.sin(x / 29 + 1) + 1.5 * Math.sin(x / 11);
        if (pd > 0) t0 = Math.max(t0, SB + 1 + pd + 4);
        tb[x] = Math.round(t0);
        const ab = Math.round(t0 + 12 * KS + 3 * Math.sin(x / 41 + 0.5) + 3 * (fbm(x / 14, 0, 3) - 0.5) + x * 0.012);
        const lx = (x - GW * 0.51) / (GW * 0.23);
        const lens = Math.max(0, Math.round(7 * KS * (1 - lx * lx)));
        const bb = Math.round(ab + lens + 14 * KS + 3 * Math.sin(x / 53 + 2) + 3 * (fbm(x / 16, 5, 4) - 0.5));
        const cb = Math.round(bb + 16 * KS + 3 * Math.sin(x / 37 + 4) + 2 * (fbm(x / 12, 9, 5) - 0.5));
        cbMax = Math.max(cbMax, cb);
        for (let y = s0; y < GH; y++) {
          const jag = hash(x, y, 3), yj = y + (jag < 0.28 ? -1 : jag > 0.72 ? 1 : 0), d = y - s0, fk = depthK(y);
          let i;
          if (pd >= 3 && y <= SB + 1 + pd) {
            /* The pond: a clay bed that holds its water. */
            if (y === SB) { i = put(x, y, AIR, 0); base[i] = base[idx(x, y - 1)]; sky[i] = 2; zone[i] = Z_POND; continue; }
            if (y < SB + pd - 1) { i = put(x, y, WATER, 0); zone[i] = Z_POND; sky[i] = 3; continue; }
            i = put(x, y, ROCK, y === SB + 1 + pd ? K.topsoil[2] : K.sand[pick(0.3, 1.2, x, y, 53)]);
            gk[i] = 7;
            continue;
          }
          if (terr >= 0 && d < 3) {
            const mound = (x % 4) < 2;
            let c;
            if (d === 0) c = mound ? K.strataA[hash(x, y, 61) < 0.5 ? 1 : 2] : K.topsoil[3];
            else if (d === 1) c = K.topsoil[mound ? 3 : 2];
            else c = K.topsoil[hash(x, y, 60) < 0.5 ? 1 : 2];
            i = put(x, y, TILL, c);
            gk[i] = 9;
            continue;
          }
          if (pd > 0 && pd < 3 && d < 2) { i = put(x, y, ROCK, K.sand[pick(0.6, 1.6, x, y, 54)]); gk[i] = 7; continue; }
          if (d < 2 || (d === 2 && hash(x, y, 4) >= 0.5)) {
            i = put(x, y, TURF, K.grass[pick(d === 0 ? 0.92 : d === 1 ? 0.58 : 0.3, 0.9, x, y, 5)]);
            gk[i] = 8;
            continue;
          }
          if (yj < tb[x]) {
            i = put(x, y, SOIL, pk(SH.topsoil[pick(0.5 - 0.2 * (y - s0) / Math.max(1, tb[x] - s0) + (fbm(x / 6, y / 6, 6) - 0.5) * 0.5, 1.5, x, y, 7)], fk));
            gk[i] = 1;
            continue;
          }
          let kind, c;
          if (yj < ab) { kind = 2; c = SH.strataA[pick(0.5 + 0.22 * Math.sin(y * 0.9 + fbm(x / 20, y / 6, 8) * 4) + 0.12 * (fbm(x / 8, y / 3, 9) - 0.5), 1.1, x, y, 10)]; }
          else if (yj < ab + lens) { kind = 3; c = SH.sand[pick(0.55, 1.7, x, y, 11)]; }
          else if (yj < bb) { kind = 4; c = SH.strataB[pick(0.5 + 0.18 * Math.sin(y * 0.7 + x * 0.03) + 0.2 * (fbm(x / 10, y / 4, 12) - 0.5), 1.1, x, y, 13)]; }
          else if (yj < cb) { kind = 5; c = SH.strataC[pick(0.5 + 0.2 * Math.sin(y * 0.6 + x * 0.02) + 0.25 * (fbm(x / 9, y / 4, 14) - 0.5), 1.1, x, y, 15)]; }
          else {
            /* Stone in beds: each bed its own tone, a darker parting between them. */
            const bedY = y + 3 * Math.sin(x / 31) + 2 * Math.sin(x / 13 + 1) + 0.03 * x;
            const bedN = Math.floor(bedY / 7), inBed = bedY - bedN * 7;
            let st = 0.28 + 0.42 * hash(bedN, 0, 120) + 0.3 * (fbm(x / 9, y / 5, 16) - 0.5);
            if (inBed < 1 && hash(x, y, 17) > 0.15) st -= 0.32;
            if (inBed > 5.5) st += 0.08;
            kind = 6;
            c = SH.stone[pick(st, 0.8, x, y, 18)];
          }
          i = put(x, y, ROCK, pk(c, fk));
          gk[i] = kind;
        }
      }
    })();

    /* Pebbles and boulders: rounded, lit from above, a dark rim underneath. */
    (function () {
      const n = Math.round(GW * D * 0.00175);
      for (let p = 0; p < n; p++) {
        const px = Math.floor(CR() * GW), py = Math.floor(SB + 5 + CR() * (D - 5));
        const pr = CR() < 0.22 ? 2 + CR() * 2.6 : 0.8 + CR() * 1.2;
        const k0 = gk[idx(clamp(px, 0, GW - 1), clamp(py, 0, GH - 1))];
        if (!(k0 === 1 || k0 === 2 || k0 === 4 || k0 === 5 || k0 === 6)) continue;
        for (let y = Math.floor(py - pr); y <= py + pr; y++) {
          for (let x = Math.floor(px - pr * 1.4); x <= px + pr * 1.4; x++) {
            if (!inb(x, y)) continue;
            const ex = (x - px) / (pr * 1.4), ey = (y - py) / pr, e = ex * ex + ey * ey;
            const k1 = gk[idx(x, y)];
            if (e > 1 || !(k1 === 1 || k1 === 2 || k1 === 4 || k1 === 5 || k1 === 6)) continue;
            let lt = 0.7 - 0.3 * ex - 0.45 * ey + (k0 === 6 ? 0.2 : 0);
            if (e > 0.6 && ey > 0.2) lt = 0.05;
            const i = put(x, y, ROCK, pk(SH.stone[pick(lt, 0.5, x, y, 19)], depthK(y)));
            gk[i] = 10;
          }
        }
      }
    })();

    /* -- Underground: the water under the beds, the cave, the stream between, the well and the cellar */

    const well = seg.home ? seg.home.x0 + (seg.home.w >= 58 ? 47 : 46) : Math.round(GW * 0.6);
    const aq = { rx: clamp(Math.round(GW * 0.12), 20, 46), ry: clamp(Math.round(D * 0.068), 6, 10) };
    aq.x = Math.round(Math.min(well + aq.rx * 0.6, GW - aq.rx * 0.5));
    if (aq.x - aq.rx * 0.75 > well - 1) aq.x = Math.round(well - 1 + aq.rx * 0.75);
    aq.y = Math.max(SB + Math.round(D * 0.52), cbMax + aq.ry - 2);
    const cv = { rx: clamp(Math.round(GW * 0.11), 18, 42), ry: clamp(Math.round(D * 0.082), 8, 13) };
    cv.y = Math.min(Math.max(SB + Math.round(D * 0.71), aq.y + aq.ry + 6), GH - cv.ry - 8);
    cv.x = clamp(pond ? pond.L : Math.round(GW * 0.22), cv.rx + 3, GW - cv.rx - 3);
    if ((aq.x - aq.rx) - (cv.x + cv.rx) < 14) {
      cv.rx = Math.max(12, Math.round((aq.x - aq.rx - 14 - 3) / 2));
      cv.x = cv.rx + 3;
    }
    aq.top = aq.y - Math.round(aq.ry * 0.4); /* Its water line. */

    function blob(cx, cy, rx, ry, salt, fn) {
      for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
        for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
          if (!inb(x, y)) continue;
          const e = ((x - cx) / rx) * ((x - cx) / rx) + ((y - cy) / ry) * ((y - cy) / ry);
          if (e < 1 + 0.45 * (fbm(x / 6, y / 4, salt) - 0.5)) fn(x, y);
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
      if (y >= aq.top) { const i = put(x, y, WATER, 0); zone[i] = Z_AQ; base[i] = caveC[0]; gk[i] = 0; }
      else hollow(x, y, Z_AQ);
    });

    const caveFloor = new Int16Array(GW).fill(-1);
    blob(cv.x, cv.y, cv.rx, cv.ry, 70, (x, y) => { hollow(x, y, Z_CAVE); });
    for (let x = Math.max(0, cv.x - cv.rx - 4); x <= Math.min(GW - 1, cv.x + cv.rx + 4); x++) {
      const fl = Math.round(cv.y + cv.ry * 0.5 + 2 * Math.sin(x / 9) + (x < cv.x - cv.rx * 0.5 ? (cv.x - cv.rx * 0.5 - x) * 0.15 : 0));
      for (let y = fl; y < cv.y + cv.ry + 6 && y < GH; y++) {
        if (zone[idx(x, y)] === Z_CAVE && mat[idx(x, y)] === AIR) {
          const i = put(x, y, ROCK, K.sand[pick(0.45 - (y - fl) * 0.05, 1.4, x, y, 72)]);
          zone[i] = 0;
          gk[i] = 11;
          if (caveFloor[x] < 0) caveFloor[x] = y;
        }
      }
    }

    /* A slow stream from the water under the beds down to the cave, a stair of small still pools,
       each holding behind a lip of stone, so that it runs only when the ground gives it water. */
    const pool = { L: 0, R: -1, top: 0 };
    (function () {
      let sx = -1;
      for (let x = 0; x < GW && sx < 0; x++) if (zone[idx(x, aq.top + 1)] === Z_AQ) sx = x;
      const my = cv.y - 2;
      let ex = -1;
      for (let x = GW - 1; x >= 0 && ex < 0; x--) if (zone[idx(x, my)] === Z_CAVE) ex = x;
      if (sx < 0 || ex < 0 || sx - ex < 12) return;
      const b0 = aq.top + 2, bEnd = my + 2;
      const L = sx - ex, n = clamp(Math.round(L / 11), 2, 12), span = (L - 3) / n;
      function carve(x, b, from, full) {
        const top = Math.min(from, b - 5 - (hash(x, b, 140) < 0.35 ? 1 : 0));
        for (let y = top; y < b; y++) {
          const z = zone[idx(x, y)];
          if (z === Z_AQ || z === Z_CAVE) continue;
          if (full && y >= b - 2) { const i = put(x, y, WATER, 0); zone[i] = Z_STREAM; base[i] = caveC[0]; gk[i] = 0; }
          else hollow(x, y, Z_STREAM);
        }
        const bi = idx(x, b);
        if (zone[bi] !== Z_AQ && zone[bi] !== Z_CAVE && mat[bi] !== AIR) { put(x, b, ROCK, pk(SH.sand[pick(0.35, 1.2, x, b, 132)], 0.8)); gk[bi] = 11; }
      }
      let prevB = b0, prevTop = b0 - 5;
      for (let k = 0; k < n; k++) {
        const xa = k === 0 ? sx + 3 : Math.round(sx - k * span);
        const xb = Math.round(sx - (k + 1) * span) + 1;
        const b = Math.round(b0 + (bEnd - b0) * k / n);
        for (let x = xa; x >= xb; x--) carve(x, b, x === xa ? Math.min(prevTop, b - 5) : b - 5, true);
        /* The lip. */
        for (let y = b - 2; y < b; y++) { const i = put(xb, y, ROCK, pk(SH.stone[y === b - 2 ? 3 : 2], 0.9)); zone[i] = 0; gk[i] = 12; }
        prevB = b;
        prevTop = b - 5;
      }
      const xs = Math.round(sx - n * span);
      for (let x = xs; x >= ex - 1; x--) carve(x, bEnd, x === xs ? Math.min(prevTop, bEnd - 5) : bEnd - 5, false);
      /* Where it meets the cave it falls into a pool, dug into the cave floor. */
      const hw = clamp(Math.round(cv.rx * 0.3), 6, 12);
      pool.R = Math.min(GW - 2, ex + 1);
      pool.L = Math.max(1, pool.R - 2 * hw);
      const mid = (pool.L + pool.R) >> 1;
      pool.top = caveFloor[mid] > 0 ? caveFloor[mid] : cv.y + cv.ry - 3;
      for (let x = pool.L; x <= pool.R; x++) {
        const dep = 2 + Math.round(3 * Math.sin(Math.PI * (x - pool.L + 1) / (pool.R - pool.L + 2)));
        for (let y = pool.top - 4; y < pool.top; y++) {
          const i = idx(x, y);
          if (mat[i] === ROCK && gk[i] === 11) hollow(x, y, Z_CAVE);
        }
        for (let y = pool.top; y < pool.top + dep; y++) {
          const i = put(x, y, WATER, 0);
          zone[i] = Z_POOL;
          base[i] = caveC[0];
          gk[i] = 0;
        }
        for (let y = pool.top + dep; y < pool.top + dep + 3; y++) {
          const i = idx(x, y);
          if (mat[i] === AIR || zone[i]) { put(x, y, ROCK, K.sand[pick(0.3, 1.2, x, y, 134)]); zone[i] = 0; gk[i] = 11; }
        }
        caveFloor[x] = -1;
      }
      [pool.L - 1, pool.R + 1].forEach((x) => {
        for (let y = pool.top; y < pool.top + 3; y++) {
          const i = idx(x, y);
          if (inb(x, y) && mat[i] === AIR) { put(x, y, ROCK, K.sand[1]); zone[i] = 0; gk[i] = 11; }
        }
      });
    })();

    /* The well shaft, lined in stone, down to the water. */
    let shaftBottom = -1;
    if (seg.home) {
      for (let y = SB; y < GH - 1; y++) {
        if (shaftBottom < 0 && zone[idx(well, y)] === Z_AQ) shaftBottom = y;
        let open = 0;
        for (let x = well - 1; x <= well + 1; x++) if (zone[idx(x, y)] !== Z_AQ) { hollow(x, y, Z_SHAFT); open++; }
        if (!open) break;
        if (zone[idx(well - 2, y)] !== Z_AQ) put(well - 2, y, MASON, pk(SH.stone[y % 3 === 0 ? 0 : 2], depthK(y)));
        if (zone[idx(well + 2, y)] !== Z_AQ) put(well + 2, y, MASON, pk(SH.stone[y % 3 === 0 ? 0 : 1], depthK(y)));
      }
    }

    /* A geode and a fossil, for whoever digs. */
    const lamps = [];
    (function () {
      function solidStone(x0, y0, rx, ry) {
        for (let y = y0 - ry; y <= y0 + ry; y++) for (let x = x0 - rx; x <= x0 + rx; x++) {
          if (!inb(x, y) || mat[idx(x, y)] !== ROCK || zone[idx(x, y)] || gk[idx(x, y)] === 11) return false;
        }
        return true;
      }
      const tries = [[0.9, cv.y + 4], [0.12, GH - 12], [0.62, GH - 11]];
      for (let k = 0; k < tries.length; k++) {
        const gx = Math.round(GW * tries[k][0]), gy = Math.min(GH - 10, Math.round(tries[k][1]));
        if (!solidStone(gx, gy, 10, 8)) continue;
        for (let y = gy - 7; y <= gy + 7; y++) for (let x = gx - 9; x <= gx + 9; x++) {
          const e = Math.hypot((x - gx) / 9, (y - gy) / 7);
          if (e > 1) continue;
          if (e > 0.82) put(x, y, ROCK, K.stone[3]);
          else if (e > 0.62) put(x, y, ROCK, K.water[hash(x, y, 133) < 0.25 ? 3 : 2]);
          else if (e > 0.25) { if (hash(x, y, 136) < 0.3) put(x, y, LAMP, K.glow[3]); else put(x, y, ROCK, K.water[3]); }
          else put(x, y, LAMP, K.glow[2]);
        }
        [[-2, -1], [3, 1], [0, 2]].forEach((s) => { put(gx + s[0], gy + s[1], LAMP, K.glow[3]); lamps.push([gx + s[0], gy + s[1], 4, 0.35, 1]); });
        break;
      }
      const fx = Math.round(GW * 0.46), fy = Math.min(GH - 9, cv.y + cv.ry + 10);
      if (solidStone(fx, fy, 7, 6)) {
        for (let t = 0; t < Math.PI * 4.2; t += 0.08) {
          const r = 0.6 + t * 0.5;
          put(fx + r * Math.cos(t), fy + r * Math.sin(t) * 0.9, ROCK, pk(SH.sand[t > 9 ? 3 : 2], 0.85));
        }
      }
    })();

    /* Rock round an opening is darkest. */
    (function () {
      const rim = [];
      for (let i = W; i < N - W; i++) {
        if (mat[i] !== ROCK || gk[i] === 11 || gk[i] === 12 || gk[i] === 7) continue;
        for (let k = 0; k < 4; k++) {
          const z = zone[i + NB4[k]];
          if (z === Z_CAVE || z === Z_AQ || z === Z_STREAM || z === Z_POOL) { rim.push(i); break; }
        }
      }
      rim.forEach((i) => { col[i] = orig[i] = darken(col[i], 212); });
    })();

    /* -- On the ground */

    const canopy = [], canopyCol = [], canopyBloom = [], canopyAt = new Int32Array(N).fill(-1);
    function root(x0, y0, len, depth) {
      let x = x0, y = y0, dir = (hash(x0, y0, 80) - 0.5) * 0.8;
      for (let k = 0; k < len; k++) {
        const rx = Math.round(x), ry = Math.round(y);
        if (!inb(rx, ry)) break;
        const i = idx(rx, ry), g = gk[i];
        if (mat[i] !== ROOT) {
          if (!(g === 1 || g === 2 || g === 8 || g === 4 || g === 9)) break;
          put(rx, ry, ROOT, K.wood[k < len * 0.4 ? 1 : 0]);
        }
        y += 1;
        x += dir + (CR() - 0.5) * 1.1;
        dir *= 0.92;
        if (depth < 2 && CR() < 0.07) root(Math.round(x), Math.round(y), Math.floor(len * 0.55), depth + 1);
      }
    }

    function tree(bx, h, cyOff, clusters, opts) {
      if (bx < 0 || bx >= GW) return;
      const by = surf[bx], baseW = opts.baseW || 4;
      let top = cyOff;
      clusters.forEach((c) => { top = Math.max(top, cyOff - c[1] + c[2]); });
      const f = clamp((by - 2) / top, 0.5, 1);
      h = Math.round(h * f);
      const cx = bx + (opts.dx || 0), cy = by - Math.round(cyOff * f), rr = (opts.r || 16) * f;
      clusters = clusters.map((c) => [Math.round(c[0] * f), Math.round(c[1] * f), Math.max(3, c[2] * f)]);
      for (let y = by - 1; y >= by - h; y--) {
        const k = (by - y) / h, w = Math.max(2, Math.round(baseW + (2 - baseW) * k)), left = bx - Math.floor(w / 2);
        for (let i = 0; i < w; i++) put(left + i, y, WOOD, K.wood[i === 0 ? 3 : i === w - 1 ? 0 : (hash(left + i, y, 85) < 0.5 ? 1 : 2)]);
      }
      put(bx - Math.floor(baseW / 2) - 1, by - 1, WOOD, K.wood[2]);
      put(bx + Math.ceil(baseW / 2), by - 1, WOOD, K.wood[0]);
      clusters.forEach((c, ci) => {
        if (ci % 2) return;
        const tx = cx + c[0], ty = cy + c[1], sx = bx, sy = by - h + 2, n = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
        for (let s = 0; s <= n; s++) put(sx + (tx - sx) * s / n, sy + (ty - sy) * s / n, WOOD, K.wood[1]);
      });
      clusters.forEach((c) => {
        const ccx = cx + c[0], ccy = cy + c[1], r = c[2];
        for (let y = Math.floor(ccy - r - 1); y <= ccy + r + 1; y++) {
          for (let x = Math.floor(ccx - r - 1); x <= ccx + r + 1; x++) {
            if (!inb(x, y)) continue;
            const dd = Math.hypot(x - ccx, (y - ccy) * 1.12), edge = r * (0.86 + 0.28 * fbm(x / 4, y / 4, 86));
            if (dd > edge || (dd > edge - 1.5 && hash(x, y, 87) < 0.45)) continue;
            const gl = 0.5 - 0.42 * (x - cx) / rr - 0.5 * (y - cy) / rr, lc = 0.5 - 0.3 * (x - ccx) / r - 0.4 * (y - ccy) / r;
            let t = 0.55 * gl + 0.45 * lc + (fbm(x / 3, y / 3, 88) - 0.5) * 0.55;
            let bl = false;
            if (opts.blossom && fbm(x / 2.6, y / 2.6, 89) > 0.56) { bl = true; t += 0.25; }
            const m0 = mat[idx(x, y)];
            if (m0 !== AIR && m0 !== WOOD && m0 !== CANOPY) continue;
            const i = put(x, y, CANOPY, (bl ? K.blossom : K.leaf)[pick(t, 1.0, x, y, 90)]);
            if (m0 !== CANOPY) { canopyAt[i] = canopy.length; canopy.push(i); canopyBloom.push(bl ? 1 : 0); canopyCol.push(col[i]); }
            else { const k = canopyAt[i]; canopyCol[k] = col[i]; canopyBloom[k] = bl ? 1 : 0; }
          }
        }
      });
      for (let k = 0; k < (opts.roots || 4); k++) root(bx - 2 + Math.floor(CR() * 5), by + 3, 10 + Math.floor(CR() * 16), 0);
    }

    function bush(cx, w, h, berries) {
      for (let x = cx - w; x <= cx + w; x++) {
        if (x < 0 || x >= GW) continue;
        const u = (x - cx) / w, top = surf[x] - Math.round(h * Math.sqrt(Math.max(0, 1 - u * u)) * (0.85 + 0.3 * vnoise(x / 2, cx, 95)));
        for (let y = top; y < surf[x]; y++) {
          if (at(x, y) !== AIR) continue;
          const t = 0.6 - 0.35 * u - 0.6 * (y - (surf[x] - h)) / h + (fbm(x / 2.5, y / 2.5, 96) - 0.5) * 0.5;
          if (berries && hash(x, y, 97) < 0.07) put(x, y, GREEN, K.blossom[1 + (hash(x, y, 98) < 0.5 ? 1 : 0)]);
          else put(x, y, GREEN, K.bush[pick(t, 1.0, x, y, 99)]);
        }
      }
      if (cx >= 0 && cx < GW) root(cx, surf[cx] + 3, 7, 1);
    }

    const lights = []; /* [x, y, radius, strength, kind]: 0 steady, 1 twinkles, 2 the window */
    let chimney = -1, eye = -1;
    const fish = [], flies = [], plants = [], fungi = [], worms = [];
    const mossGroup = new Uint8Array(N); /* Which named place a mossy surface belongs to. */

    /* The pond: lilies, fish, reeds, and the bridge over it. */
    if (pond) {
      const s = seg.pond, pw = pond.R - pond.L;
      (pw >= 40 ? [[0.26, 6], [0.55, 5], [0.77, 3]] : [[0.3, 4], [0.68, 3]]).forEach((l, n) => {
        const lx = Math.round(pond.L + pw * l[0]);
        for (let k = 0; k < l[1]; k++) put(lx + k, SB, LILY, K.bush[k === 0 || k === l[1] - 1 ? 1 : 3 - (k % 2)]);
        if (n === 0) { put(lx + 2, SB - 1, LILY, K.blossom[3]); put(lx + 3, SB - 1, LILY, K.blossom[2]); }
        if (n === 1) put(lx + 2, SB - 1, LILY, K.wild[3]);
      });
      const fy = SB + 1 + clamp(Math.round(pond.dep * 0.45), 2, 6);
      fish.push({ x: Math.round(pond.L + pw * 0.39), y: fy, dir: 1, every: 13, ph: 0 });
      if (pw >= 40) fish.push({ x: Math.round(pond.L + pw * 0.68), y: fy - 1, dir: -1, every: 17, ph: 5 });
      const reeds = (x0, x1) => {
        for (let x = x0; x <= x1; x++) {
          if (hash(x, 1, 81) < 0.4) continue;
          const h = 5 + Math.floor(hash(x, 2, 82) * 9), top = SB - h, lean = hash(x, 3, 83) < 0.5 ? -1 : 1;
          for (let y = SB; y > top; y--) putOpen(x + (y < top + 3 && h > 9 ? lean : 0), y, GREEN, K.crop[y < top + 4 ? 3 : 2]);
          if (h >= 9 && hash(x, 4, 84) < 0.6) {
            putOpen(x + lean, top + 1, WOOD, K.wood[2]); putOpen(x + lean, top + 2, WOOD, K.wood[1]); putOpen(x + lean, top + 3, WOOD, K.wood[1]);
          }
        }
      };
      const rw = Math.max(4, Math.round(9 * s.w / 78));
      reeds(s.x0 + 4, s.x0 + 4 + rw);
      reeds(s.x0 + s.w - 5 - rw, s.x0 + s.w - 4);
      const bx0 = s.x0 + 2, bx1 = s.x0 + s.w - 2, arch = clamp(Math.round((bx1 - bx0) * 0.108), 4, 8);
      const deck = (x) => Math.round(SB - 1 - arch * Math.sin(Math.PI * (x - bx0) / (bx1 - bx0)));
      for (let x = bx0; x <= bx1; x++) {
        const dy = deck(x), plank = Math.floor((x - bx0) / 3), u = (x - bx0 + 7) % 9;
        const over = x > pond.L && x < pond.R ? Z_POND : 0;
        zone[put(x, dy, WOOD, K.wood[plank % 2 ? 3 : 2])] = over;
        zone[put(x, dy + 1, WOOD, K.wood[x % 3 === 0 ? 0 : 1])] = over;
        zone[put(x, dy - 5, WOOD, K.wood[3])] = over;
        if (u === 0) { for (let k = 1; k <= 4; k++) put(x, dy - k, WOOD, K.wood[k === 4 ? 2 : 1]); }
        else if (u === 4 || u === 5) put(x, dy - 2, WOOD, K.wood[1]);
      }
      [0.35, 0.65].forEach((f) => {
        const px = Math.round(bx0 + (bx1 - bx0) * f);
        for (let y = deck(px) + 2; y < SB + 1 + pondDepth(px) - 1; y++) {
          put(px, y, WOOD, K.wood[y > SB ? 0 : 1]);
          put(px + 1, y, WOOD, K.wood[0]);
        }
      });
    }

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
      if (s.w >= 34 || s.x0 + s.w < GW - 4) bush(s.x0 + 30, 5, 4, false);
    }

    /* The meadow, with a sapling tied to its stake. */
    if (seg.meadow) {
      const s = seg.meadow;
      if (s.w >= 20) bush(s.x0 + 4, 5, 4, false);
      if (s.w >= 40) bush(s.x0 + Math.round(s.w * 0.48), 6, 5, true);
      if (s.w >= 50) bush(s.x0 + s.w - 4, 4, 4, false);
      if (s.w >= 30) {
        const bx = s.x0 + Math.round(s.w * 0.74), by = surf[bx];
        for (let y = by - 1; y >= by - 8; y--) put(bx, y, WOOD, K.wood[2]);
        for (let y = by - 1; y >= by - 7; y--) put(bx + 2, y, WOOD, K.wood[3]);
        put(bx + 1, by - 5, GREEN, K.crop[3]);
        for (let dy = -5; dy <= 3; dy++) for (let dx = -5; dx <= 5; dx++) {
          if (Math.hypot(dx, dy * 1.2) > 4.6 + (hash(bx + dx, dy, 93) - 0.5)) continue;
          if (at(bx + dx, by - 12 + dy) === AIR) put(bx + dx, by - 12 + dy, GREEN, K.leaf[pick(0.55 - 0.08 * dx - 0.1 * dy, 1.0, bx + dx, dy, 94)]);
        }
        root(bx, by + 3, 9, 1);
      }
    }
    segs.forEach((s) => { if (s.id === 'edge' && s.w >= 16) bush(s.x0 + (s.w >> 1), 4, 4, s.x0 > 0); });

    /* The cabin, with a cellar under it, a lantern by the path, and the well. */
    if (seg.home) {
      const s = seg.home, full = s.w >= 58, ox = s.x0 - (full ? 209 : 210), oy = SB - 110;
      const S = (x, y, m, c) => put(x + ox, y + oy, m, c);
      for (let y = 106; y <= 109; y++) for (let x = 213; x <= 245; x++) {
        const block = ((x + (y % 2) * 2) % 4 === 0) || y === 106;
        const i = S(x, y, MASON, K.stone[block ? 0 : pick(0.6, 1.2, x, y, 100)]);
        if (i >= 0) mossGroup[i] = 3;
      }
      for (let y = 92; y <= 105; y++) for (let x = 214; x <= 244; x++) {
        const plank = Math.floor((y - 92) / 2), seam = (y - 92) % 2 === 1;
        let sh = plank % 2 ? 2 : 3;
        if (seam) sh = 1;
        if (x === 214) sh = Math.min(3, sh + 1);
        if (x === 244) sh = 0;
        if (!seam && hash(Math.floor(x / 7), plank, 101) < 0.3 && x % 7 === 0) sh = 1;
        S(x, y, WOOD, K.wood[sh]);
      }
      /* The window, lit from inside. */
      for (let y = 95; y <= 101; y++) for (let x = 218; x <= 226; x++) {
        const fr = y === 95 || y === 101 || x === 218 || x === 226 || x === 222 || y === 98;
        if (fr) S(x, y, WOOD, K.wood[0]);
        else S(x, y, LAMP, K.glow[(y < 98 ? 2 : 1) + (x < 222 ? 1 : 0)]);
      }
      lights.push([222 + ox, 98 + oy, 13, 0.4, 2]);
      for (let y = 97; y <= 105; y++) for (let x = 231; x <= 237; x++) {
        S(x, y, WOOD, K.wood[(x === 231 || x === 237 || y === 97) ? 0 : Math.max(0, (x % 2 ? 1 : 2) - (y > 103 ? 1 : 0))]);
      }
      S(236, 101, LAMP, K.glow[2]);
      /* Thatch with moss on it, and a wooden eave. */
      for (let y = 79; y <= 91; y++) {
        const half = Math.round((y - 78) * 1.42);
        for (let x = 229 - half; x <= 229 + half; x++) {
          if (x < 210 || x > 248) continue;
          if (y === 91) { S(x, y, WOOD, K.wood[(x % 3 === 0) ? 0 : 1]); continue; }
          const eL = x - (229 - half), eR = (229 + half) - x, mo = fbm(x / 3, y / 2, 102), t = 0.65 - 0.025 * (x - 229) - 0.03 * (y - 79);
          if (eL < 1 || eR < 1) S(x, y, WOOD, K.wood[1]);
          else if (mo > 0.5) S(x, y, GREEN, K.bush[pick(t + 0.1, 1.0, x, y, 103)]);
          else S(x, y, WOOD, K.crop[pick(t - 0.15, 1.0, x, y, 104)]);
        }
      }
      for (let y = 75; y <= 86; y++) for (let x = 237; x <= 240; x++) {
        const i = S(x, y, MASON, K.stone[(y === 75) ? 3 : ((x + y) % 3 === 0 ? 0 : 2)]);
        if (i >= 0) mossGroup[i] = 3;
      }
      if (inb(239 + ox, 74 + oy)) chimney = idx(239 + ox, 74 + oy);
      /* The cellar: shelves of preserves and a lantern. */
      for (let y = 112; y <= 124; y++) for (let x = 217; x <= 241; x++) {
        if (x === 217 || x === 241 || y === 124) S(x, y, MASON, K.stone[(x + y) % 3 === 0 ? 0 : 1]);
        else if (y === 123) S(x, y, WOOD, K.wood[x % 3 === 0 ? 0 : 2]);
        else { const i = S(x, y, AIR, 0); if (i >= 0) { zone[i] = Z_CELLAR; base[i] = caveC[hash(x, y, 105) < 0.5 ? 0 : 1]; gk[i] = 0; } }
      }
      [116, 120].forEach((sy) => {
        for (let x = 218; x <= 228; x++) S(x, sy, WOOD, K.wood[2]);
        const jars = sy === 116 ? [[219, K.blossom, 2], [222, K.glow, 1], [225, K.crop, 3], [227, K.wild, 2]]
          : [[219, K.wild, 2], [222, K.sand, 2], [225, K.blossom, 2]];
        jars.forEach((j) => {
          const m = j[1] === K.glow ? LAMP : WOOD;
          S(j[0], sy - 1, m, j[1][j[2]]); S(j[0] + 1, sy - 1, m, j[1][j[2] - 1]);
          S(j[0], sy - 2, m, j[1][j[2] - 1]); S(j[0] + 1, sy - 2, m, j[1][j[2]]);
        });
      });
      for (let y = 110; y <= 122; y++) {
        S(235, y, WOOD, K.wood[2]); S(238, y, WOOD, K.wood[1]);
        if (y % 3 === 0) { S(236, y, WOOD, K.wood[3]); S(237, y, WOOD, K.wood[3]); }
      }
      S(231, 112, WOOD, K.wood[0]); S(231, 113, WOOD, K.wood[0]);
      S(230, 114, LAMP, K.glow[3]); S(231, 114, LAMP, K.glow[3]); S(230, 115, LAMP, K.glow[2]); S(231, 115, LAMP, K.glow[2]);
      lights.push([231 + ox, 115 + oy, 11, 0.55, 0]);
      if (full) {
        for (let y = 98; y <= 109; y++) S(209, y, WOOD, K.wood[y % 4 === 0 ? 1 : 2]);
        S(210, 96, WOOD, K.wood[1]); S(211, 96, WOOD, K.wood[1]); S(211, 97, WOOD, K.wood[0]);
        S(210, 98, LAMP, K.glow[3]); S(211, 98, LAMP, K.glow[3]); S(210, 99, LAMP, K.glow[2]); S(211, 99, LAMP, K.glow[2]);
        S(210, 100, WOOD, K.wood[0]); S(211, 100, WOOD, K.wood[0]);
        lights.push([211 + ox, 99 + oy, 10, 0.5, 0]);
        for (let fx = 262; fx <= 266; fx += 4) for (let fy = 103; fy <= 109; fy++) S(fx, fy, WOOD, K.wood[2]);
        for (let fx = 262; fx <= 266; fx++) { S(fx, 104, WOOD, K.wood[3]); S(fx, 107, WOOD, K.wood[1]); }
      }
      /* The well. */
      for (let y = 104; y <= 109; y++) for (let x = 252; x <= 260; x++) {
        const i = S(x, y, MASON, K.stone[(y === 104) ? 3 : (((x + (y % 2) * 2) % 4 === 0) ? 0 : 2)]);
        if (i >= 0) mossGroup[i] = 1;
      }
      for (let y = 95; y < 104; y++) { S(252, y, WOOD, K.wood[2]); S(260, y, WOOD, K.wood[0]); }
      for (let y = 89; y <= 94; y++) {
        const half = (y - 89) + 1;
        for (let x = 256 - half; x <= 256 + half; x++) S(x, y, WOOD, K.wood[y === 94 ? 0 : (x < 256 ? 3 : 2) - (x === 256 - half || x === 256 + half ? 1 : 0)]);
      }
      for (let x = 253; x <= 259; x++) S(x, 98, WOOD, K.wood[1]);
      S(256, 99, WOOD, K.wood[3]); S(256, 100, WOOD, K.wood[3]);
      for (let x = 255; x <= 257; x++) { S(x, 101, WOOD, K.wood[1]); S(x, 102, WOOD, K.wood[0]); }
      /* The well ring has no floor: the shaft opens under it. */
      for (let y = 104; y <= 109; y++) for (let x = 255; x <= 257; x++) {
        const i = S(x, y, AIR, 0);
        if (i >= 0) { zone[i] = Z_SHAFT; base[i] = caveC[0]; gk[i] = 0; }
      }
      if (shaftBottom > 0) {
        /* The rope goes down to just above the water. */
        const end = Math.max(shaftBottom, aq.top - 2);
        for (let y = SB - 7; y < end; y++) put(well, y, WOOD, K.wood[3]);
        put(well, end, WOOD, K.wood[1]);
        for (let y = SB; y < shaftBottom; y++) { mossGroup[idx(well - 2, y)] = 1; mossGroup[idx(well + 2, y)] = 1; }
      }
    }

    /* Terraces: stone retaining walls, beds and what grows in them. */
    if (seg.terraces) {
      const s = seg.terraces, starts = [266, 288, 310, 332];
      for (let k = 0; k < nTerr; k++) {
        const a = s.x0 + 21 * k, top = SB - 2 - 4 * k, ox = a - starts[k], oy = SB - 110;
        const S = (x, y, m, c) => put(x + ox, y + oy, m, c);
        const nx = a + 21;
        if (nx < GW && surf[nx] < top) {
          for (let y = surf[nx]; y <= top + 1; y++) for (let x = nx - 1; x <= nx; x++) {
            const blk = ((y - surf[nx]) % 2 === 0) && x === nx - 1;
            const i = put(x, y, MASON, K.stone[y === surf[nx] ? 3 : blk ? 0 : (x === nx - 1 ? 2 : 1)]);
            if (i >= 0) mossGroup[i] = 2;
          }
        }
        if (k === 0) {
          [269, 274].forEach((cx) => {
            for (let dy = 1; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
              if (dy === 3 && Math.abs(dx) === 2) continue;
              S(cx + dx, 108 - dy, GREEN, K.crop[pick(0.45 + 0.15 * dy - 0.08 * dx, 0.9, cx + dx, dy, 106)]);
            }
            S(cx, 106, GREEN, K.crop[3]);
            root(cx + ox, surf[clamp(cx + ox, 0, GW - 1)] + 2, 6 + Math.floor(CR() * 6), 1);
          });
          /* The creature, tending the cabbages, a sprout in its hand. */
          const F = ['.1...1.', '.22222.', '2202222', '2332221', '.33221.', '.0...0.'];
          for (let r = 0; r < F.length; r++) for (let c = 0; c < F[r].length; c++) {
            if (F[r][c] === '.') continue;
            const i = S(279 + c, 102 + r, CREATURE, K.creature[+F[r][c]]);
            if (r === 2 && c === 2) eye = i;
          }
          S(278, 105, GREEN, K.crop[3]); S(278, 104, GREEN, K.crop[2]); S(277, 104, GREEN, K.crop[3]);
        } else if (k === 1) {
          for (let cx = 291; cx < 305; cx += 4) {
            for (let dy = 1; dy <= 4; dy++) S(cx, 104 - dy, GREEN, K.crop[dy > 2 ? 3 : 2]);
            S(cx - 1, 101, GREEN, K.crop[2]); S(cx + 1, 102, GREEN, K.crop[1]); S(cx - 1, 102, GREEN, K.crop[1]); S(cx + 1, 100, GREEN, K.crop[3]);
            S(cx, 104, TILL, K.wild[0]);
            root(cx + ox, top + 2, 6 + Math.floor(CR() * 6), 1);
          }
        } else if (k === 2) {
          [313, 320, 327].forEach((sx) => { for (let y = 99; y >= 88; y--) S(sx, y, WOOD, K.wood[2]); });
          for (let x = 312; x <= 328; x++) S(x, 88, WOOD, K.wood[3]);
          for (let x = 312; x <= 328; x++) for (let y = 89; y <= 99; y++) {
            const near = Math.min(Math.abs(x - 313), Math.abs(x - 320), Math.abs(x - 327)), v = fbm(x / 2, y / 2, 107);
            if (near <= 2 && v > 0.42 - (y - 89) * 0.01 && at(x + ox, y + oy) !== WOOD) {
              if (hash(x, y, 108) < 0.08) S(x, y, GREEN, K.wild[2]);
              else S(x, y, GREEN, K.bush[pick(0.65 - 0.15 * (x % 8 > 4 ? 1 : 0) + (v - 0.5), 1.0, x, y, 109)]);
            }
          }
          [313, 320, 327].forEach((sx) => { root(sx + ox, top + 2, 6 + Math.floor(CR() * 6), 1); });
        } else if (k === 3) {
          for (let gx = 334; gx < 349; gx += 2) {
            const gh = 6 + Math.floor(hash(gx, 7, 110) * 3);
            for (let k4 = 1; k4 <= gh; k4++) S(gx, 96 - k4, GREEN, k4 > gh - 3 ? K.sand[3 - (k4 === gh ? 1 : 0)] : K.crop[2]);
            if (hash(gx, 8, 111) < 0.5) S(gx + 1, 96 - gh + 1, GREEN, K.sand[2]);
          }
          [336, 342].forEach((rx) => { root(rx + ox, top + 2, 6 + Math.floor(CR() * 6), 1); });
        }
      }
    }

    /* Grass blades, and the wildflowers of the opening. */
    const segOf = (x) => segAt[clamp(x, 0, GW - 1)];
    for (let x = 0; x < GW; x++) {
      const sy = surf[x];
      if (terraceAt(x) >= 0 || (pond && x > pond.L - 1 && x < pond.R + 1) || at(x, sy) !== TURF || at(x, sy - 1) !== AIR) continue;
      const id = segOf(x);
      const meadow = id === 'meadow' || id === 'edge' || id === 'orchard' || (id === 'grove' && x < seg.grove.x0 + 18);
      if (hash(x, 9, 112) > (meadow ? 0.85 : 0.6)) { bladeMax[x] = 1; continue; }
      const bh = 1 + Math.floor(hash(x, 10, 113) * (meadow ? 6 : 3)), lean = hash(x, 11, 114) < 0.5 ? -1 : 1;
      bladeMax[x] = bh;
      for (let k = 1; k <= bh; k++) {
        const bx = x + (k === bh && bh >= 3 ? lean : 0);
        if (at(bx, sy - k) === AIR) put(bx, sy - k, BLADE, K.grass[k === bh ? 3 : k >= bh - 1 ? 2 : 1]);
      }
    }

    /* -- Wildflowers: each one a plant with its own life. */

    const GROW = 0, OPEN = 1, SEEDING = 2, WITHER = 3;
    let plantCap = 3;
    function makePlant(x, g, h, kind, shade) {
      return {
        x, g, h, kind, shade, stem: [], leaves: [], head: [], roots: [], rootGoal: 5 + rint(6),
        stage: GROW, next: T + 40 + rint(40), drank: T, until: 0, side: rint(2) ? 1 : -1, seeds: 0, dry: false
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
      if (p.stem.length >= 3) {
        [c - 1, c + 1].forEach((s) => { if (mat[s] === AIR) { mat[s] = BLOOM; col[s] = fc[fs - 1]; p.head.push(s); } });
        if (mat[c - W] === AIR) { mat[c - W] = BLOOM; col[c - W] = fc[Math.min(3, fs + 1)]; p.head.push(c - W); }
      }
      p.stage = OPEN;
      p.until = T + 2400 + rint(4800);
    }
    if (GW > 0) {
      for (let x = 1; x < GW - 1; x++) {
        if (!plantable[x] || hash(x, 12, 115) > 0.16) continue;
        if (plants.some((p) => Math.abs(p.x - x) < 2)) continue;
        const g = idx(x, surf[x]);
        if (mat[g] !== TURF) continue;
        const stemH = 3 + Math.floor(hash(x, 13, 116) * 5);
        let ok = true;
        for (let k = 1; k <= stemH + 2 && ok; k++) { const m = mat[g - W * k]; if (m !== AIR && m !== BLADE) ok = false; }
        if (!ok) continue;
        for (let c = g - W; mat[c] === BLADE; c -= W) mat[c] = AIR;
        const p = makePlant(x, g, stemH, hash(x, 14, 117) < 0.4 ? 1 : 0, 1 + Math.floor(hash(x, 15, 118) * 3));
        for (let k = 1; k <= stemH; k++) { const c = g - W * k; mat[c] = STEM; col[c] = K.crop[1]; p.stem.push(c); }
        for (let k = 1; k <= 2 + Math.floor(hash(x, 16, 119) * 3); k++) {
          const c = g + W * k;
          if (SOAK[mat[c]]) { mat[c] = ROOT; col[c] = K.wood[k < 2 ? 1 : 0]; p.roots.push(c); }
        }
        openHead(p);
        p.until = T + 1600 + Math.floor(hash(x, 17, 120) * 9000);
        plants.push(p);
      }
    }
    plantCap = Math.max(3, Math.round(plantable.reduce((a, b) => a + b, 0) / 7));
    /* One of them is about done flowering, so the first seeds fall soon after the plate is shown. */
    if (plants.length) plants[Math.floor(plants.length / 2)].until = 180 + 640 + Math.floor(hash(GW, GH, 121) * 240);

    /* Fallen petals under the blossom tree. */
    if (seg.orchard) {
      for (let x = seg.orchard.x0; x < Math.min(GW, seg.orchard.x0 + 34); x++) {
        if (hash(x, 5, 91) < 0.18) { const i = putOpen(x, surf[x] - 1, LITTER, K.blossom[2 + (hash(x, 6, 92) < 0.5 ? 1 : 0)]); if (i >= 0) aux[i] = 40 + Math.floor(hash(x, 7, 93) * 200); }
      }
    }

    /* -- The cave: glowing fungi on its floor, small lights on its ceiling. */

    const FG = 0, FALIVE = 1, FFADE = 2;
    let fungiCap = 4;
    function fungusCap(f) {
      const top = f.stalk.length ? f.stalk[f.stalk.length - 1] : f.base + W;
      const cy = top - W, cw = f.h >= 5 ? 2 : 1;
      for (let dx = -cw; dx <= cw; dx++) {
        const c = cy + dx;
        if (mat[c] === AIR) { mat[c] = CAP; col[c] = K.glow[Math.abs(dx) === cw ? 1 : 2]; f.cap.push(c); }
      }
      if (f.h >= 5) {
        [[0, 3], [-1, 2], [1, 2]].forEach((q) => { const c = cy - W + q[0]; if (mat[c] === AIR) { mat[c] = CAP; col[c] = K.glow[q[1]]; f.cap.push(c); } });
      }
      f.cx = (cy % W) - 1;
      f.cy = ((cy / W) | 0) - 1;
    }
    function makeFungus(base, h) {
      return { base, h, stalk: [], cap: [], stage: FG, next: T + 60, until: 0, fade: 0, ph: rint(4000), per: 160 + rint(120), cx: 0, cy: 0 };
    }
    [[-0.71, 4], [-0.57, 6], [-0.48, 3], [-0.21, 5], [-0.1, 3], [0.19, 7], [0.33, 4], [0.5, 5], [0.67, 3]].forEach((q) => {
      const x = Math.round(cv.x + q[0] * cv.rx);
      if (x < 1 || x >= GW - 1 || (x >= pool.L - 2 && x <= pool.R + 2) || caveFloor[x] < 0) return;
      const fy = caveFloor[x], b = idx(x, fy - 1);
      for (let k = 0; k <= q[1] + 1; k++) if (mat[b - W * k] !== AIR) return;
      const f = makeFungus(b, q[1]);
      for (let k = 0; k < q[1] - 1; k++) { const c = b - W * k; mat[c] = STALK; col[c] = K.sand[3]; f.stalk.push(c); }
      fungusCap(f);
      f.stage = FALIVE;
      f.until = T + 14000 + Math.floor(hash(x, fy, 77) * 40000);
      fungi.push(f);
    });
    fungiCap = Math.max(3, fungi.length + 2);
    for (let x = Math.max(0, cv.x - cv.rx); x < Math.min(GW, cv.x + cv.rx); x++) {
      for (let y = cv.y - cv.ry - 3; y < cv.y; y++) {
        if (!inb(x, y) || zone[idx(x, y)] !== Z_CAVE || mat[idx(x, y)] !== AIR) continue;
        if (at(x, y - 1) === ROCK && hash(x, y, 76) < 0.22) {
          put(x, y, LAMP, K.glow[hash(x, y, 77) < 0.5 ? 0 : 1]);
          if (hash(x, y, 78) < 0.35) lights.push([x, y, 5, 0.3, 1]);
        }
        if (at(x, y - 1) === ROCK || at(x, y - 1) === LAMP) break;
      }
    }

    /* -- A worm or two in the topsoil. */

    function placeWorm(x0) {
      for (let tryN = 0; tryN < 30; tryN++) {
        const x = clamp(x0 + tryN * 3, 3, GW - 9);
        const y = surf[x] + 5 + (tryN % 3);
        const segs2 = [];
        for (let k = 0; k < 5; k++) { const i = idx(x + 4 - k, y); if (mat[i] !== SOIL) break; segs2.push(i); }
        if (segs2.length < 5) continue;
        segs2.forEach((i, k) => { mat[i] = WORM; col[i] = K.worm[k === 0 ? 3 : k === 4 ? 0 : 2 - (k & 1)]; });
        worms.push({ segs: segs2, dir: 1, every: 9 + rint(5), ph: rint(9), stuck: 0 });
        return;
      }
    }
    placeWorm(seg.meadow ? seg.meadow.x0 + 2 : seg.grove ? seg.grove.x0 + 4 : 4);
    if (GW >= 200) placeWorm(seg.grove ? seg.grove.x0 + 6 : seg.orchard ? seg.orchard.x0 + 2 : GW - 40);

    /* -- Fireflies, drifting over the grass and the water. */

    segs.forEach((s) => {
      const n = s.id === 'meadow' ? Math.round(s.w / 7) : s.id === 'pond' ? 2 : s.id === 'grove' || s.id === 'orchard' ? 2 : s.id === 'edge' ? Math.round(s.w / 24) : s.id === 'young' ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const x = s.x0 + 2 + Math.floor(CR() * Math.max(1, s.w - 4));
        const y = surf[clamp(x, 0, GW - 1)] - 6 - Math.floor(CR() * 22);
        if (at(x, y) !== AIR) continue;
        flies.push({ x, y, vx: CR() < 0.5 ? -1 : 1, vy: 0, lo: Math.max(1, s.x0 - 18), hi: Math.min(GW - 2, s.x0 + s.w + 18), every: 4 + Math.floor(CR() * 4), ph: Math.floor(CR() * 400), per: 150 + Math.floor(CR() * 160), alt: 30 });
      }
    });

    /* -- Stars and clouds: the sky behind everything. */

    const stars = [];
    for (let k = 0; k < Math.round(GW * SB / 800); k++) {
      const x = Math.floor(CR() * GW), y = Math.floor(CR() * SB * 0.5);
      if (Math.hypot(x - moon.x, y - moon.y) < 12 || sky[idx(x, y)] !== 1) continue;
      stars.push([x, y, CR() < 0.3 ? 1 : 0, Math.floor(CR() * 1000), 0.35 + CR() * 0.55]);
    }
    const clouds = [];
    [[0.16, 0.22, 46, 5], [0.52, 0.1, 64, 7], [0.86, 0.34, 34, 4], [0.34, 0.5, 28, 3], [0.02, 0.44, 22, 3], [0.7, 0.58, 26, 3]].forEach((c, ci) => {
      const L = c[2] / 2, h = c[3], cells = [];
      for (let dx = Math.floor(-L); dx <= L; dx++) {
        const u = dx / L, bump = 0.65 + 0.35 * Math.abs(Math.sin(dx * 0.23 + ci)) + 0.25 * (vnoise(dx / 5, ci, 21) - 0.5);
        const top = -h * Math.sqrt(Math.max(0, 1 - u * u)) * bump, bot = 1 + (Math.abs(u) < 0.7 ? 1 : 0);
        for (let dy = Math.floor(top); dy <= bot; dy++) {
          if (Math.abs(u) > 0.92 && hash(dx, dy, 31 + ci) < 0.5) continue;
          const tt = 1 - (dy - top) / Math.max(1, bot - top);
          cells.push(dx, dy, pick(0.25 + tt * 0.85, 0.7, dx, dy, 32 + ci));
        }
      }
      clouds.push({ x: c[0] * GW, y: Math.round(c[1] * SB) + 2, L: L, cells, v: 0.0035 + ci * 0.0007 });
    });

    /* -- The opening's damp: dry on top, damp lower down, wetter round the pond and in the beds. */

    const soilList = [];
    for (let i = W; i < N - W; i++) {
      const g = gk[i];
      if (g !== 1 && g !== 8 && g !== 9) continue;
      soilList.push(i);
      const x = (i % W) - 1, y = ((i / W) | 0) - 1, d = y - surf[x];
      let w = d >= 4 ? (hash(x, y, 140) < 0.5 ? 1 : 0) + (d >= 7 ? 1 : 0) : d <= 1 ? 1 : 0;
      if (pond && x > pond.L - 8 && x < pond.R + 8) w += 1;
      if (g === 9) w += 1;
      wet[i] = Math.min(WMAX, w);
    }
    const soilArr = Int32Array.from(soilList);

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
    const mossCol = (i) => pk(SH.bush[1 + Math.floor(hash(i, 3, 150) * 3)], depthK(((i / W) | 0) - 1) * (zone[i] || mat[i] === ROCK ? 0.82 : 1));

    /* Where drops form, and where the ground lets water in at the near end of the water under the beds, by the stream. */
    const dripAq = [], dripShaft = [], dripCave = [], seeps = [];
    for (let i = W; i < N - W; i++) {
      if (mat[i] !== AIR) continue;
      const z = zone[i], up = mat[i - W];
      if (z === Z_AQ && (up === ROCK)) dripAq.push(i);
      else if (z === Z_CAVE && (up === ROCK)) dripCave.push(i);
      else if (z === Z_STREAM && up === ROCK) dripCave.push(i);
      else if (z === Z_SHAFT && (mat[i - 1] === MASON || mat[i + 1] === MASON) && (i / W | 0) > SB + 4) dripShaft.push(i);
      if (z === Z_AQ && mat[i + W] === WATER && (i / W | 0) - 1 === aq.top - 1 && (i % W) - 1 < aq.x - aq.rx * 0.3) seeps.push(i);
    }
    const sporeSites = dripCave.filter((i) => zone[i] === Z_CAVE);
    /* Moss already on the wet stone of the cave. */
    mossC.forEach((i) => {
      if (mossGroup[i] !== 4 || hash(i, 1, 151) > 0.3) return;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (mat[i + dy * W + dx] === WATER) { near = true; break; }
      if (near) { mat[i] = MOSS; col[i] = mossCol(i); }
    });

    /* What the water bodies hold in the opening, and where they settle. */
    function countWater(z) { let n = 0; for (let i = W; i < N - W; i++) if (mat[i] === WATER && zone[i] === z) n++; return n; }
    const pondCap = countWater(Z_POND);
    let pondTop = 0;
    if (pond) for (let x = pond.L; x <= pond.R; x++) if (mat[idx(x, SB + 1)] === WATER) pondTop++;
    const pondTarget = pondCap - Math.round(pondTop * 0.8);
    const poolTarget = countWater(Z_POOL);

    /* -- Rules */

    const aqTarget = countWater(Z_AQ);
    let pondN = pondCap, poolN = poolTarget, aqN = aqTarget, pondLow = false, pondEvap = 0, poolHigh = false;
    let canopyN = canopy.length;
    const canopy0 = canopy.length;
    const rain = { on: false, next: 1e9, t0: 0, len: 1, total: 0, left: 0, x0: 0, x1: 0, acc: 0, i: 0 };
    let firstDrip = -1, lastWellDrip = -1e9, pondFullAt = -1e9;
    const mossSeen = new Uint8Array(8);
    const sporeList = [];

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
        for (let k = 2; k <= 3; k++) if (PASS[mat[i + W * k]]) { swap(i, i + W * k); return; }
      }
      /* Water standing anywhere but a pond, a stream or a pool dries, a drop at a time. */
      if (!z && ((q >>> 10) & 511) === 0) { toAir(i); hidden++; return; }
      const dir = (q >>> 8) & 1 ? 1 : -1;
      if (PASS[mat[d + dir]] && PASS[mat[i + dir]]) { swap(i, d + dir); return; }
      if (PASS[mat[d - dir]] && PASS[mat[i - dir]]) { swap(i, d - dir); return; }
      const up = mat[i - W];
      /* A pool levels at once. A lone drop runs a grain or two at a time. */
      const lone = md !== WATER && mat[i - 1] !== WATER && mat[i + 1] !== WATER && up !== WATER;
      const reach = lone ? 3 : 20;
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
      if ((tick & 31) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
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
      if (((q >>> 9) & 15) === 0 && takeRoot(i)) return;
      if (md !== TURF && md !== BLADE && md !== SOIL && md !== TILL) {
        const dir = (q >>> 13) & 1 ? 1 : -1;
        if (PASS[mat[d + dir]] && PASS[mat[i + dir]]) swap(i, d + dir);
        else if (PASS[mat[d - dir]] && PASS[mat[i - dir]]) swap(i, d - dir);
      }
    }

    function stepPetal(i) {
      const q = r32();
      if ((tick & 7) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
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
      if ((tick & 7) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      if (PASS[mat[i + W]] && (r32() & 3) === 0) swap(i, i + W);
    }

    /* Smoke rises slowly, spreads, leans with the breeze as it climbs, and thins to nothing. */
    function stepSmoke(i) {
      const q = r32();
      let age = aux[i];
      if (q & 1) { age++; aux[i] = age; }
      if (age > 180 || (age > 100 && ((q >>> 1) & 63) === 0)) { toAir(i); return; }
      const u = i - W, r = (q >>> 7) & 31, lean = age >> 6;
      if (mat[u] === EDGE || mat[i + 1] === EDGE) { toAir(i); return; }
      if (r < 4) {
        if (mat[u] === AIR) {
          const s = ((q >>> 12) & 3) === 0 ? 1 : 0;
          if (s && mat[u + 1] === AIR) swap(i, u + 1); else swap(i, u);
        }
      } else if (r < 5 + lean) { if (mat[i + 1] === AIR) swap(i, i + 1); }
      else if (r < 6 + lean) { if (mat[i - 1] === AIR) swap(i, i - 1); }
    }

    function stepSpore(i) {
      const q = r32();
      if ((tick & 3) === 0) { if (aux[i] === 0) { toAir(i); return; } aux[i]--; }
      const r = q & 15;
      let j = i;
      if (r < 2) j = i + W;
      else if (r === 2) j = i - W;
      else if (r < 5) j = i + ((q >>> 4) & 1 ? 1 : -1);
      if (j !== i && mat[j] === AIR && zone[j] === Z_CAVE) { swap(i, j); i = j; }
      sporeList.push(i);
      if (mat[i + W] === ROCK && ((q >>> 6) & 15) === 0) sprout(i);
    }

    /* -- Plants */

    function takeRoot(i) {
      const x = (i % W) - 1;
      if (x < 1 || x >= GW - 1 || !plantable[x] || plants.length >= plantCap) return false;
      let g = i + W, n = 0;
      while (mat[g] === BLADE && n < 8) { g += W; n++; }
      /* It wants damp ground, unless the meadow is thin, when it takes its chances and waits for rain. */
      if (mat[g] !== TURF) return false;
      if (plants.length >= plantCap * 0.5 && (wet[g] + wet[g + W] + wet[g + 2 * W] + wet[g + 3 * W]) < 1) return false;
      for (let k = 0; k < plants.length; k++) if (Math.abs(plants[k].x - x) < 2) return false;
      const b = g - W;
      for (let k = 1; k <= 5; k++) { const m = mat[b - W * k]; if (m !== AIR && m !== BLADE && m !== SEED) return false; }
      toAir(i);
      for (let c = b; c > b - W * 9 && (mat[c] === BLADE || c === b); c -= W) if (mat[c] === BLADE) toAir(c);
      const p = makePlant(x, g, 3 + rint(5), chance(0.4) ? 1 : 0, 1 + rint(3));
      mat[b] = STEM; col[b] = K.crop[1]; stamp[b] = stampNow;
      p.stem.push(b);
      plants.push(p);
      entry('A seed took root.', true);
      return true;
    }

    function growRoot(p) {
      const tip = p.roots.length ? p.roots[p.roots.length - 1] : p.g;
      const r = rint(5), c = tip + W + (r === 0 ? -1 : r === 1 ? 1 : 0);
      if (SOAK[mat[c]]) { mat[c] = ROOT; col[c] = K.wood[p.roots.length < 2 ? 1 : 0]; p.roots.push(c); }
      else p.rootGoal = p.roots.length;
    }
    function drink(p) {
      for (let k = 0; k < 2; k++) { const c = p.g + W * k; if (SOAK[mat[c]] && wet[c] > 0) { wet[c]--; hidden++; return true; } }
      for (let k = p.roots.length - 1; k >= 0; k--) {
        const r = p.roots[k];
        for (let n = 0; n < 4; n++) { const c = r + NB4[n]; if (SOAK[mat[c]] && wet[c] > 0) { wet[c]--; hidden++; return true; } }
      }
      return false;
    }

    /* A dry piece either drops as litter, to lie a while and go, or is simply gone. */
    function shed(c, toLitter) {
      if (toLitter) { mat[c] = LITTER; aux[c] = 30 + rint(80); } else toAir(c);
    }

    function stepPlant(p) {
      if (T < p.next) return;
      if (p.stage === GROW) {
        /* Roots go down looking for damp. Everything above ground drinks for every step it takes. */
        p.next = T + 50 + rint(60);
        const canRoot = p.roots.length < p.rootGoal;
        if (canRoot && p.roots.length <= p.stem.length + 1) { growRoot(p); return; }
        if (!drink(p)) {
          if (canRoot) { growRoot(p); return; }
          if (T - p.drank > 6000) { p.stage = WITHER; p.next = T; } else p.next = T + 60 + rint(60);
          return;
        }
        p.drank = T;
        if (p.stem.length < p.h) {
          const topc = p.stem[p.stem.length - 1];
          let c = topc - W;
          if (p.stem.length >= 3 && rint(5) === 0) { const s = rint(2) ? 1 : -1; if (mat[c + s] === AIR) c += s; }
          if (mat[c] === SEED || mat[c] === LITTER || mat[c] === PETAL) toAir(c);
          if (mat[c] !== AIR) { p.h = p.stem.length; return; }
          mat[c] = STEM; col[c] = K.crop[p.stem.length < 2 ? 1 : 2];
          p.stem.push(c);
          if (p.stem.length === 2 || (p.stem.length === 4 && p.h >= 6)) {
            const l = c + p.side;
            if (mat[l] === AIR) { mat[l] = LEAF; col[l] = K.crop[2 + rint(2)]; p.leaves.push(l); }
            p.side = -p.side;
          }
          return;
        }
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
          const spots = [c - 1, c + 1, c - W - 1, c - W + 1, c - W];
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
      /* Withering: it dries, comes down from the top, and the roots go back to soil. */
      p.next = T + 50 + rint(60);
      if (!p.dry) {
        p.dry = true;
        p.stem.forEach((c) => { if (mat[c] === STEM) col[c] = K.wood[2]; });
        p.leaves.forEach((c) => { if (mat[c] === LEAF) col[c] = K.sand[0]; });
        p.head.forEach((c) => { if (mat[c] === BLOOM) col[c] = K.wood[1]; });
        return;
      }
      if (p.head.length) { const c = p.head.pop(); if (mat[c] === BLOOM) shed(c, true); return; }
      if (p.stem.length) {
        const c = p.stem.pop();
        for (let k = p.leaves.length - 1; k >= 0; k--) {
          const l = p.leaves[k];
          if (l === c - 1 || l === c + 1) { if (mat[l] === LEAF) shed(l, rint(2) === 0); p.leaves.splice(k, 1); }
        }
        if (mat[c] === STEM) shed(c, rint(2) === 0);
        return;
      }
      if (p.leaves.length) { const l = p.leaves.pop(); if (mat[l] === LEAF) toAir(l); return; }
      if (p.roots.length) { const r = p.roots.pop(); if (mat[r] === ROOT) restore(r); return; }
      p.dead = true;
      entry('A plant is soil again.', true);
    }

    /* -- Fungi */

    function sprout(i) {
      const x = (i % W) - 1;
      if (fungi.length >= fungiCap || zone[i] !== Z_CAVE || (x >= pool.L - 2 && x <= pool.R + 2)) return;
      for (let k = 0; k < fungi.length; k++) if (Math.abs((fungi[k].base % W) - 1 - x) < 4) return;
      const h = 3 + rint(4);
      for (let k = 1; k <= h + 1; k++) if (mat[i - W * k] !== AIR) return;
      toAir(i);
      fungi.push(makeFungus(i, h));
    }

    function stepFungus(f) {
      if (f.stage === FG) {
        if (T < f.next) return;
        f.next = T + 70 + rint(50);
        if (f.stalk.length < f.h - 1) {
          const c = f.stalk.length ? f.stalk[f.stalk.length - 1] - W : f.base;
          if (mat[c] !== AIR) { f.h = f.stalk.length + 1; return; }
          mat[c] = STALK; col[c] = K.sand[3]; f.stalk.push(c);
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
          const s = f.cap[0] - W;
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

    /* -- Worms: a slow way through the damp, and a tunnel that closes behind. */

    const tunnels = [];
    let tunnelHead = 0;
    function wormCan(c) {
      const m = mat[c];
      if (m !== SOIL && m !== TUNNEL) return false;
      const up = mat[c - W], up2 = mat[c - 2 * W], dn = mat[c + W];
      return (SOAK[up] || up === TUNNEL || up === WORM || up === ROOT) && up2 !== AIR && up2 !== BLADE && up !== TURF &&
        dn !== AIR && zone[c + W] !== Z_CELLAR;
    }
    function stepWorm(w) {
      if ((tick + w.ph) % w.every) return;
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
      if (best < 0 || rint(40) === 0) {
        w.segs.reverse();
        w.dir = -w.dir;
        w.segs.forEach((c, k) => { col[c] = K.worm[k === 0 ? 3 : k === w.segs.length - 1 ? 0 : 2 - (k & 1)]; });
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
      w.segs.forEach((c, k) => { col[c] = K.worm[k === 0 ? 3 : k === w.segs.length - 1 ? 0 : 2 - (k & 1)]; });
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

    /* -- Fireflies and fish move on their own; they are drawn over the grains they pass. */

    function stepFlies() {
      for (let k = 0; k < flies.length; k++) {
        const f = flies[k];
        if ((tick + f.ph) % f.every) continue;
        if (chance(0.25)) f.vx = rint(3) - 1;
        if (chance(0.2)) f.vy = rint(3) - 1;
        const nx = f.x + f.vx;
        let ny = f.y + (chance(0.5) ? f.vy : 0);
        if (nx < f.lo || nx > f.hi || nx < 1 || nx > GW - 2) { f.vx = -f.vx; continue; }
        const s = surf[nx], low = s - (rain.on ? 3 : 2), high = Math.max(2, s - (rain.on ? 12 : f.alt));
        if (ny < high) { ny = high; f.vy = 1; }
        if (ny > low) { ny = low; f.vy = -1; }
        if (at(nx, ny) !== AIR) { f.vx = -f.vx; f.vy = -f.vy; continue; }
        f.x = nx;
        f.y = ny;
      }
    }
    function fishFits(x, y, dir) {
      for (let k = 0; k < 3; k++) if (at(x - dir * k, y) !== WATER) return false;
      return at(x, y - 1) === WATER && at(x - dir * 2, y - 1) === WATER;
    }
    function stepFish() {
      for (let k = 0; k < fish.length; k++) {
        const f = fish[k];
        if ((tick + f.ph) % f.every || chance(0.2)) continue;
        if (chance(0.02)) f.dir = -f.dir;
        const nx = f.x + f.dir, ny = f.y + (chance(0.1) ? (chance(0.5) ? 1 : -1) : 0);
        if (fishFits(nx, ny, f.dir)) { f.x = nx; f.y = ny; }
        else if (fishFits(nx, f.y, f.dir)) f.x = nx;
        else if (fishFits(f.x, f.y, f.dir)) { f.dir = -f.dir; f.x += 2 * f.dir; }
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
        if (m === TURF && open) {
          const q = r32();
          if ((q & 1023) === 0) blades(i, w);
          if (w && ((q >>> 10) & 1023) === 0) { wet[i] = w - 1; hidden++; continue; }
        } else if (w && open && (r32() & 1023) === 0) { wet[i] = w - 1; hidden++; continue; }
        if (!w) continue;
        const q = r32();
        if (((q >>> 3) & 255) !== 0) continue;
        const r = q & 7;
        const j = r < 5 ? i + W : r === 5 ? i - 1 : r === 6 ? i + 1 : i - W;
        const mj = mat[j];
        if (SOAK[mj]) {
          const wj = wet[j];
          if (j === i + W ? wj < WMAX && (wj < w || ((q >>> 11) & 3) === 0) : wj + 1 < w) { wet[i] = w - 1; wet[j] = wj + 1; }
        } else if (j === i + W && mj === ROCK && ((q >>> 11) & 15) === 0) {
          wet[i] = w - 1;
          hidden++;
        }
      }
    }
    function blades(i, w) {
      const x = (i % W) - 1;
      let top = i - W, h = 0;
      while (mat[top] === BLADE && h < 9) { top -= W; h++; }
      if (w >= 2 && h < bladeMax[x] && mat[top] === AIR) { mat[top] = BLADE; col[top] = K.grass[3]; if (h) col[top + W] = K.grass[h >= 2 ? 2 : 1]; }
      else if (w === 0 && h > Math.max(0, bladeMax[x] - 2)) { toAir(top + W); if (h > 1) col[top + 2 * W] = K.grass[3]; }
    }

    /* -- Moss, on wet stone. */

    function isDamp(i) {
      for (let dy = -2; dy <= 2; dy++) {
        const r = i + dy * W;
        for (let dx = -2; dx <= 2; dx++) { const m = mat[r + dx]; if (m === WATER || m === DRIP) return true; }
      }
      for (let k = 0; k < 4; k++) { const c = i + NB4[k]; if (SOAK[mat[c]] && wet[c] >= 2) return true; }
      return false;
    }
    const MOSS_SAYS = ['', 'Moss on the well.', 'Moss on the terrace wall.', 'Moss on the cabin stones.', ''];
    function mossPass() {
      if (!mossC.length) return;
      for (let n = 0; n < 3; n++) {
        const i = mossC[rint(mossC.length)], m = mat[i];
        if (m !== MOSS && m !== origM[i]) continue;
        const wetHere = isDamp(i);
        if (m === MOSS) { if (!wetHere && chance(0.05)) restore(i); continue; }
        if (!wetHere) continue;
        let near = false;
        for (let k = 0; k < 4 && !near; k++) if (mat[i + NB4[k]] === MOSS || mat[i + NB4[k] + (k < 2 ? 1 : W)] === MOSS) near = true;
        if ((near && chance(0.3)) || chance(0.012)) {
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
      const k = rint(canopy.length), i = canopy[k], m = mat[i];
      if (m === CANOPY) {
        if (!PASS[mat[i + W]] || canopyN < canopy0 * 0.93) return;
        if (chance(canopyBloom[k] ? 0.2 : 0.015)) { mat[i] = PETAL; aux[i] = 200; canopyN--; moved++; }
      } else if (m === AIR && chance(0.25)) {
        if (mat[i - 1] === CANOPY || mat[i + 1] === CANOPY || mat[i - W] === CANOPY || mat[i + W] === CANOPY) {
          mat[i] = CANOPY; col[i] = canopyCol[k]; canopyN++;
        }
      }
    }

    /* -- Weather, springs and drips: the water out of sight comes back. */

    function startRain() {
      rain.on = true;
      rain.t0 = T;
      rain.len = 1000 + rint(900);
      rain.total = Math.min(hidden - 300, 700 + rint(700));
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
      rain.x0 += 0.012;
      rain.x1 += 0.012;
      while (rain.acc >= 1 && rain.left > 0) {
        rain.acc -= 1;
        const x = Math.floor(rain.x0 + rf() * (rain.x1 - rain.x0));
        if (x < 0 || x >= GW) continue;
        const i = idx(x, rint(3));
        if (mat[i] !== AIR) continue;
        mat[i] = WATER; aux[i] = 0; stamp[i] = stampNow;
        hidden--;
        rain.left--;
      }
    }
    function drip(list, isWell) {
      if (!list.length || hidden < 40) return;
      const i = list[rint(list.length)];
      if (mat[i] !== AIR) return;
      mat[i] = DRIP; aux[i] = 30 + rint(90); col[i] = 0;
      hidden--;
      if (isWell) {
        if (T - lastWellDrip > 7200) entry('A drip in the well.', true);
        lastWellDrip = T;
      }
    }
    function director() {
      if (!rain.on) { if (T >= rain.next && hidden >= 640) startRain(); }
      else stepRain();
      /* Where the ground holds more, the spring under the beds runs harder, and so does the stream. */
      const seepP = aqN < aqTarget + 24 ? clamp((hidden - 220) / 2400, 0, 0.2) : 0;
      if (seepP > 0 && seeps.length && rf() < seepP) {
        const i = seeps[rint(seeps.length)];
        if (mat[i] === AIR) { mat[i] = WATER; stamp[i] = stampNow; hidden--; }
      }
      /* A pond that has sunk below its usual line is fed slowly from the ground under it. */
      if (pond && pondN < pondTarget && hidden > 200 && (r32() & 31) === 0) {
        const x = pond.L + 2 + rint(Math.max(1, pond.R - pond.L - 4));
        for (let y = SB; y < SB + pond.dep; y++) {
          const i = idx(x, y);
          if (mat[i] === AIR && mat[i + W] === WATER) { mat[i] = WATER; stamp[i] = stampNow; hidden--; pondN++; break; }
          if (mat[i] !== AIR && mat[i] !== LILY) break;
        }
      }
      if (T === firstDrip) drip(dripShaft, true);
      else if ((r32() & 63) === 0) {
        /* Drops form over the water under the beds while it has room, and in the cave. */
        const r = rint(10), full = aqN >= aqTarget + 24;
        if (r < 5) { if (!full) drip(dripAq, false); }
        else if (r < 7) { if (!full) drip(dripShaft, true); }
        else drip(dripCave, false);
      }
      if (chimney >= 0 && (tick & 3) === 0 && mat[chimney] === AIR && chance(0.9)) { mat[chimney] = SMOKE; aux[chimney] = 0; }
      /* The world goes on past the edge of the plate. When the meadow here is thin, a seed blows in from there. */
      if (plants.length < plantCap * 0.45 && (r32() & 511) === 0) {
        const x = rint(GW), i = idx(x, 1 + rint(Math.max(1, SB - 24)));
        if (plantable[x] && mat[i] === AIR) {
          mat[i] = SEED; col[i] = K.wood[2 + rint(2)]; aux[i] = 160 + rint(95);
          entry('Seeds on the wind.', true);
        }
      }
      /* Likewise in the cave: when its lights are few, a spore drifts down out of the dark. */
      if (fungi.length < Math.max(2, fungiCap * 0.5) && sporeSites.length && (r32() & 2047) === 0) {
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
      living = liv + flies.length + fish.length * 3;
      canopyN = can;
      pondN = pn;
      poolN = cn;
      poolHigh = poolN > poolTarget;
      pondEvap = pondN > pondTarget ? 1 / 1400 : 1 / 60000;
      if (pond) {
        if (pondN < pondCap - pondTop * 0.5) pondLow = true;
        else if (pondLow && pondN >= pondCap - 2) {
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

    function update() {
      tick++;
      T++;
      stampNow = (tick & 255) || 1;
      const t = stampNow;
      sporeList.length = 0;
      for (let y = H - 2; y >= 1; y--) {
        const row = y * W, ltr = ((y ^ tick) & 1) === 0;
        for (let k = 1; k < W - 1; k++) {
          const i = row + (ltr ? k : W - 1 - k), m = mat[i];
          if (m < WATER || stamp[i] === t) continue;
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
      }
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
    function render() {
      const sn = stampNow;
      let o = 0;
      for (let y = 1; y < H - 1; y++) {
        let i = y * W + 1;
        for (let x = 1; x < W - 1; x++, i++, o++) {
          const m = mat[i];
          switch (PAINT[m]) {
            case 0: out[o] = col[i]; break;
            case 1: out[o] = base[i]; break;
            case 2: {
              const up = mat[i - W];
              if (up !== WATER && up !== LILY && up !== DRIP) {
                if (PASS[mat[i + W]]) {
                  out[o] = C_RAIN;
                  if (y > 1 && mat[i - W] === AIR) out[o - GW] = blend(base[i - W], RAIN[0], RAIN[1], RAIN[2], 0.4);
                }
                else if (sky[i]) out[o] = hash(x, (T >> 4) + (x >> 3), 9) < 0.08 ? C_SHIM : K.water[3];
                else out[o] = stamp[i] === sn ? C_FLOW : K.water[2];
              } else if (mat[i - 2 * W] !== WATER) {
                out[o] = stamp[i] === sn ? C_FLOW : sky[i] ? C_SKYW : K.water[2];
              } else {
                const deep = mat[i - 4 * W] === WATER;
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
        }
      }
      /* Stars, then the clouds drifting over them. */
      for (let k = 0; k < stars.length; k++) {
        const s = stars[k], i = idx(s[0], s[1]);
        if (mat[i] !== AIR) continue;
        const b = s[4] * (0.6 + 0.4 * Math.sin((T + s[3]) * 0.021 + s[3]));
        const c = s[2] ? SH.moon[1] : SH.cloud[2], o2 = s[1] * GW + s[0];
        out[o2] = blend(out[o2], c[0], c[1], c[2], b);
      }
      const ri = rain.i;
      for (let k = 0; k < clouds.length; k++) {
        const cl = clouds[k], cx = Math.round(cl.x), cs = cl.cells;
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
        for (let n = 0; n < 3; n++) {
          const x = f.x - f.dir * n;
          if (at(x, f.y) === WATER) out[f.y * GW + x] = K.blossom[n === 0 ? 2 : n === 1 ? 1 : 0];
        }
        const fx = f.x - f.dir;
        if (at(fx, f.y - 1) === WATER && hash(f.x, f.y, T >> 3) < 0.5) out[(f.y - 1) * GW + fx] = K.blossom[0];
      }
      if (eye >= 0 && ((T % 230) < 5)) { const ex = (eye % W) - 1, ey = ((eye / W) | 0) - 1; out[ey * GW + ex] = K.creature[2]; }
      /* Light. */
      for (let k = 0; k < lights.length; k++) {
        const l = lights[k];
        let a = l[3];
        if (l[4] === 1) a *= 0.7 + 0.3 * Math.sin(T * 0.013 + l[0] * 1.7);
        else if (l[4] === 2) a *= 0.92 + 0.08 * Math.sin(T * 0.05) * Math.sin(T * 0.031 + 1);
        light(l[0], l[1], l[2], a);
      }
      for (let k = 0; k < fungi.length; k++) {
        const f = fungi[k];
        if (f.dead || f.stage === FG || !f.cap.length) continue;
        let a = 0.5 * (0.72 + 0.28 * Math.sin((T + f.ph) * 6.2832 / f.per));
        if (f.stage === FFADE) a *= Math.max(0, 1 - (T - f.fade) / 480);
        light(f.cx, f.cy, f.h >= 5 ? 12 : 8, a);
      }
      for (let k = 0; k < sporeList.length; k++) {
        const i = sporeList[k];
        if (mat[i] === SPORE) light((i % W) - 1, ((i / W) | 0) - 1, 3, 0.25);
      }
      for (let k = 0; k < flies.length; k++) {
        const f = flies[k], u = ((T + f.ph) % f.per) / f.per;
        let b = u < 0.32 ? Math.sin(Math.PI * u / 0.32) : 0;
        b *= 1 - 0.65 * ri;
        const o2 = f.y * GW + f.x;
        if (b > 0.05) {
          light(f.x, f.y, 4, 0.55 * b);
          out[o2] = blend(out[o2], SH.glow[3][0], SH.glow[3][1], SH.glow[3][2], 0.35 + 0.65 * b);
        } else {
          out[o2] = blend(out[o2], SH.glow[0][0], SH.glow[0][1], SH.glow[0][2], 0.3);
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    function drift() {
      for (let k = 0; k < clouds.length; k++) {
        const c = clouds[k];
        c.x += c.v;
        if (c.x - c.L > GW + 2) c.x = -c.L - 2 - (k * 17) % 40;
      }
    }

    const world = {
      GW, GH, line: 'T+0000000', render,
      update() { update(); drift(); },
      get T() { return T - T0; },
      get tick() { return tick; },
      get moved() { return moved; },
      get living() { return living; },
      next() { return queue.length ? [queue.shift(), queue.shift()] : null; },
      /* The opening is settled with the opening's dice. From here on each visit throws its own. */
      begin() {
        moved = 0;
        T0 = T;
        let s = 0;
        try {
          const a = new Uint32Array(1);
          (window.crypto || window.msCrypto).getRandomValues(a);
          s = a[0];
        } catch (e) { s = (Math.random() * 4294967296) >>> 0; }
        seed = (s ^ OPENING) || 0x9e3779b9;
        rain.next = T + 1800 + rint(2600);
        firstDrip = T + 90 + rint(90);
        lastWellDrip = -1e9;
        recording = true;
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

  /* A whole number of device pixels per grain, at any zoom. */
  function measure() {
    const dpr = window.devicePixelRatio || 1;
    const K2 = Math.max(1, Math.round(GRAIN * dpr));
    const g = K2 / dpr;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    return { dpr, g, sw, sh, w: Math.floor((sw + 0.01) / g), h: Math.floor((sh + 0.01) / g) };
  }

  /* Centred in the stage, and starting on a device pixel wherever the stage happens to fall. */
  function place(m) {
    if (m.g + 'px' !== document.documentElement.style.getPropertyValue('--grain')) {
      document.documentElement.style.setProperty('--grain', m.g + 'px');
    }
    const cw = (world ? world.GW : m.w) * m.g, ch = (world ? world.GH : m.h) * m.g;
    const box = stage.getBoundingClientRect();
    const px = box.left + window.scrollX + stage.clientLeft, py = box.top + window.scrollY + stage.clientTop;
    /* At a whole-number pixel ratio a whole CSS pixel is already a device pixel, and layout keeps it exactly. */
    const snap = (v) => Number.isInteger(m.dpr) ? Math.round(v) : Math.round(v * m.dpr) / m.dpr;
    const s = canvas.style;
    s.position = 'absolute';
    s.left = snap(px + (m.sw - cw) * 0.5) - px + 'px';
    s.top = snap(py + (m.sh - ch) / 2) - py + 'px';
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

  /* The opening settles for a moment before it is shown: the smoke finds its way up, the water finds its level. */
  function settle(left, w) {
    const n = Math.min(left, 6);
    for (let k = 0; k < n; k++) w.update();
    if (left > n) { setTimeout(settle, 0, left - n, w); return; }
    w.begin();
    w.render();
    counters();
    reveal();
    ready = true;
    kick();
  }

  function start(m) {
    if (m.w < 40 || m.h < 60 || starting) return;
    starting = true;
    try { world = boot(m.w, m.h); } catch (e) { return; }
    place(measure());
    settle(180, world);
  }

  /* One world for the visit. A new window size crops it, or leaves a margin; it does not start another. */
  let refitTimer = 0;
  function refit() {
    const m = measure();
    place(m);
    if (woken && !world) start(m);
  }

  runBtn.addEventListener('click', () => {
    wanted = !wanted;
    say();
    if (world) counters();
    kick();
  });

  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refit, 150);
  });
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
