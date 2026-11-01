/* Exhibit B. A falling-sand cross-section on typed arrays. Watch only.
   A simplified model written for this page, not the world itself.
   The opening is composed: the rooms, the first seep, the first walk and the strain on the wall are placed by hand.
   Later seeps, worms and outbreaks are dice. Collapse, the breach and the tank come from rules.
   Damage slowly heals back to the opening, so the story recurs.
   The record only writes what happened in these arrays. */
(function () {
  'use strict';

  const canvas = document.getElementById('sand');
  const stage = document.getElementById('sand-stage'), still = document.getElementById('sand-still');
  const ctl = document.getElementById('sand-ctl'), runBtn = document.getElementById('sand-run');
  const logEl = document.getElementById('sand-log'), movedEl = document.getElementById('sand-moved');
  const strainsEl = document.getElementById('sand-strains'), ghost = document.getElementById('sand-ghost');
  const hinge = document.getElementById('hinge-state'), tag = document.getElementById('sand-tag');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas. The frozen frame stays. */ }
  if (!ctx || !stage || !still || !ctl || !runBtn || !logEl || !movedEl ||
      !strainsEl || !ghost || !hinge || !tag) return;

  const SEED = 0xa368f539; /* One planet. */
  const STORY = 0xe341beb2; /* What it does first, picked so the first minute reads well across plate sizes. */
  const VERSION = 3; /* Bump to discard saved worlds. */
  const GRAIN = 3; /* CSS px, before snapping to device pixels. */

  /* Materials. Everything below RUBBLE stays where it is unless something acts on it. */

  const AIR = 0, RUST = 1, BONE = 2, GREEN = 3, BASALT = 4, GLASS = 5, GLOW = 6, PLUG = 7;
  const WORM = 8, SOUL = 9, EDGE = 10;
  const RUBBLE = 11, GOLD = 12, RED = 13, BRINE = 14, MOLTEN = 15;
  const STEAM = 16, DUST = 17, ASH = 18, SPORE = 19, LIFE = 20;

  function table(list) { const t = new Uint8Array(32); list.forEach((m) => { t[m] = 1; }); return t; }
  const FREE = table([AIR, STEAM, DUST, ASH, SPORE]);
  const LOOSE = table([AIR, STEAM, DUST, ASH, SPORE, BRINE]);
  const WALLY = table([RUST, BONE, GREEN, BASALT, GLASS, GLOW, PLUG, EDGE, RUBBLE, GOLD, RED]);
  const HARD = table([RUST, BONE, GREEN, BASALT, GLASS, GLOW, PLUG, EDGE]);
  const HOLD = table([RUST, BONE, GREEN, BASALT, GLASS, GLOW, PLUG, EDGE, LIFE, WORM, SOUL, MOLTEN]);
  const CUT = table([RUST, BONE, GREEN, BASALT]);
  /* The widest flat roof each rock will carry, in grains. */
  const SPAN = new Uint8Array(32);
  SPAN[RUST] = 34; SPAN[BONE] = 44; SPAN[GREEN] = 38; SPAN[BASALT] = 60;
  /* How readily a colony gets through each thing it can eat. */
  const SOFT = new Uint16Array(32);
  SOFT[RED] = 60; SOFT[RUBBLE] = 60; SOFT[GOLD] = 40;
  SOFT[BONE] = 18; SOFT[RUST] = 14; SOFT[GREEN] = 12; SOFT[BASALT] = 7;

  const FAM_MAT = 0, FAM_MOSS = 1, FAM_PINK = 2;
  const FAM_HUE = [162, 104, 326];
  const FAM_GLOW = [84, 44, 72];
  const MAX_STRAINS = 240;

  const C_RUST = 0, C_DEEP = 8, C_BONE = 16, C_GREEN = 24, C_BASALT = 32, C_SOIL = 40;
  const C_GLASS = 48, C_GLOW = 52, C_GOLD = 56, C_RED = 60, C_BRINE = 64, C_MOLTEN = 80;
  const C_STEAM = 88, C_DUST = 92, C_ASH = 96, C_WORM = 100, C_SOUL = 104, C_SLAG = 108;
  const LIFE_BASE = 128;
  const PAL = LIFE_BASE + MAX_STRAINS * 4;

  const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function pad(n, w) { let s = String(n); while (s.length < w) s = '0' + s; return s; }
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60)];
    return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
  }

  /* A world of this many grains. The arrays carry a one-grain frame the plate never shows,
     so a grain beside the plate edge sees a wall and no step can reach into the next row. */

  function boot(GW, GH, saved) {
    const W = GW + 2, H = GH + 2, N = W * H;
    const U = Math.min(H / 216, W / 150);
    const tall = W / H < 1.05;
    /* The composition, as fractions of the plate. A phone's column is drawn again, not cropped. */
    const L = tall ? {
      surf: 0.086, b1: 0.235, b2: 0.37, b4: 0.545, b5: 0.93,
      ga: 0.06, gb: 0.955, flat: 0.8, flip: true, gy: 0.45, gs: 0.68, shaft: 0.2,
      x0: 0.335, x1: 0.97, y0: 0.605, y1: 0.82,
      px: 0.625, py: 0.255, prx: 0.285, pry: 0.045, out: 0.6, gold: 0.76, side: -1,
      mx: 0.76, my: 0.885, mrx: 0.13, mry: 0.012,
      cracks: [[0.12, 24], [0.33, 34], [0.92, 26]], w1: [0.62, 0.165], w2: null, moss: [0.1, 0.3]
    } : {
      surf: 0.116, b1: 0.305, b2: 0.43, b4: 0.585, b5: 0.905,
      ga: 0.185, gb: 0.628, flat: 0.5, flip: false, gy: 0.48, gs: 1, shaft: 0.565,
      x0: 0.655, x1: 0.885, y0: 0.625, y1: 0.875,
      px: 0.128, py: 0.298, prx: 0.092, pry: 0.06, out: 0.165, gold: 0.285, side: 1,
      mx: 0.2, my: 0.77, mrx: 0.092, mry: 0.044,
      cracks: [[0.355, 34], [0.495, 18], [0.745, 44], [0.93, 30]], w1: [0.42, 0.66], w2: [0.83, 0.29], moss: [0.51, 0.6]
    };

    canvas.width = GW;
    canvas.height = GH;
    const image = ctx.createImageData(GW, GH);
    const out = new Uint32Array(image.data.buffer);

    let seed = SEED;
    function r32() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    }
    function rf() { return r32() / 4294967296; }
    function rint(n) { return Math.floor(rf() * n); }
    function chance(p) { return rf() < p; }

    function noise1() {
      const t = new Float32Array(256);
      for (let i = 0; i < 256; i++) t[i] = rf();
      return (x) => {
        const i = Math.floor(x);
        let f = x - i;
        f = f * f * (3 - 2 * f);
        return lerp(t[i & 255], t[(i + 1) & 255], f);
      };
    }
    function fbm(n, x) { return (n(x) + 0.5 * n(x * 2.03 + 11.3) + 0.25 * n(x * 4.01 + 37.1)) / 1.75; }

    const table2 = new Float32Array(16384);
    for (let i = 0; i < table2.length; i++) table2[i] = rf();
    function noise2(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y);
      let fx = x - ix, fy = y - iy;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const a = table2[(ix & 127) + ((iy & 127) << 7)];
      const b = table2[((ix + 1) & 127) + ((iy & 127) << 7)];
      const c = table2[(ix & 127) + (((iy + 1) & 127) << 7)];
      const d = table2[((ix + 1) & 127) + (((iy + 1) & 127) << 7)];
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    }

    const cells = () => new Uint8Array(N);
    const mat = cells(), stamp = cells(), col = new Uint16Array(N);
    const bgR = cells(), bgG = cells(), bgB = cells(), bgK = cells(), Lr = cells(), Lg = cells(), Lb = cells();
    /* What each place was in the composed opening. Dry ground slowly goes back to it. */
    const origM = cells(), origC = new Uint16Array(N);
    const Z = cells(), STACK = new Int32Array(N);

    /* Palette. pe is how much a colour lights itself and its surroundings. */

    const shade = () => new Uint8Array(PAL);
    const pr = shade(), pg = shade(), pb = shade(), pe = shade(), steep = shade();

    function setPal(i, c, e) { pr[i] = c[0]; pg[i] = c[1]; pb[i] = c[2]; pe[i] = e || 0; }
    function ramp(start, n, a, b, e, st) {
      const ca = hex(a), cb = hex(b);
      for (let k = 0; k < n; k++) {
        const t = n > 1 ? k / (n - 1) : 0;
        setPal(start + k, [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)], e);
        steep[start + k] = st ? 1 : 0;
      }
    }
    function list(start, cs, e) { cs.forEach((c, k) => { setPal(start + k, hex(c), e); }); }

    /* Rust, green and basalt rubble stand steeper than bone: the angle of repose. */
    ramp(C_RUST, 8, '#6a3220', '#b8683c', 0, 1);
    ramp(C_DEEP, 8, '#4a2018', '#8a3a28', 0, 1);
    ramp(C_BONE, 8, '#9a8a68', '#e6d4ac', 0, 0);
    ramp(C_GREEN, 8, '#3a5238', '#7a9a6c', 0, 1);
    ramp(C_BASALT, 8, '#3c424e', '#6f7786', 0, 1);
    ramp(C_SOIL, 8, '#8a4c28', '#d08a4c', 0, 1);
    list(C_GLASS, ['#a8cfc9', '#b4d8cf', '#bfe0d4', '#cbe7da'], 58);
    list(C_GLOW, ['#49b4f2', '#7fd0ff', '#bfe8ff', '#eefaff'], 210);
    list(C_GOLD, ['#c8962a', '#e3b538', '#f2cf52', '#f9e07c'], 34);
    list(C_RED, ['#c83030', '#e03838', '#ee4c48', '#f66a60'], 70);
    /* Brine by heat: the first four are cold and only differ in grain. */
    list(C_BRINE, ['#2f8fb0', '#2a7ea3', '#3a9cbc', '#2c88ac'], 14);
    list(C_BRINE + 4, ['#42889f', '#5e8096', '#7c7a8c', '#997880'], 22);
    list(C_BRINE + 8, ['#b27a68', '#c67a54', '#da7c42', '#ea8434'], 60);
    list(C_BRINE + 12, ['#ee8a38', '#f59a45', '#f9ad58', '#e67a2c'], 104);
    list(C_MOLTEN, ['#b8441a', '#d8581c', '#ec661f', '#f06a20', '#f06a20', '#f3702a', '#f67e30', '#fa9a44'], 255);
    list(C_STEAM, ['#5b6470', '#6c7682', '#7e8894', '#939da9'], 18);
    list(C_DUST, ['#6e6658', '#857c6a', '#9a917c', '#574f44'], 8);
    list(C_ASH, ['#8d87a6', '#a39db8', '#6f6a8c', '#bbb5cb'], 120);
    list(C_WORM, ['#f4d6c8', '#e9bfae', '#dca996', '#f8e4d8'], 44);
    list(C_SOUL, ['#ffdc90', '#f2b45a', '#e6a044', '#f7c470'], 150);
    list(C_SLAG, ['#7a4fc4', '#8f62d8', '#6a42ae', '#a57ce6'], 60);

    const NB4 = new Int32Array([-W, W, -1, 1]);
    const NB8 = new Int32Array([-W, W, -1, 1, -W - 1, -W + 1, W - 1, W + 1]);

    /* Strains. A strain is a genome: colour, appetite, rates. Each mutant is a new one. */

    function perStrain(T) { return new T(MAX_STRAINS); }
    const gFam = perStrain(Uint8Array), gSpread = perStrain(Uint8Array), gCreep = perStrain(Uint8Array);
    const gUsed = perStrain(Uint8Array), gPrey = perStrain(Uint8Array);
    const gDie = perStrain(Uint16Array), gMut = perStrain(Uint16Array), gFood = perStrain(Uint32Array);
    const gCount = perStrain(Int32Array), gPeak = perStrain(Int32Array), gSerial = perStrain(Int32Array);
    const gHue = perStrain(Float32Array), gSat = perStrain(Float32Array), gLig = perStrain(Float32Array);
    const famCount = new Int32Array(3);
    let liveStrains = 0, serial = 0, lifeCount = 0;
    const lifeCap = Math.round(N * 0.06);
    const famCap = [N, Math.round(N * 0.012), Math.round(N * 0.018)];
    /* What one outbreak can eat before it starves. */
    const fuelFull = Math.round(420 * U * U);
    let fuel = fuelFull;

    function paintStrain(s) {
      const base = LIFE_BASE + s * 4, e = FAM_GLOW[gFam[s]];
      setPal(base, hsl(gHue[s], gSat[s], gLig[s] - 0.09), e);
      setPal(base + 1, hsl(gHue[s], gSat[s], gLig[s] - 0.02), e);
      setPal(base + 2, hsl(gHue[s], gSat[s], gLig[s] + 0.05), e);
      setPal(base + 3, hsl(gHue[s] + 6, gSat[s] * 0.9, gLig[s] + 0.14), e + 26);
    }

    function makeStrain(fam, h, s, l, spread, creep, die, mut, food, prey) {
      let k = -1;
      for (let n = 0; n < MAX_STRAINS && k < 0; n++) if (!gUsed[n]) k = n;
      if (k < 0) return -1;
      gUsed[k] = 1;
      gFam[k] = fam; gHue[k] = h; gSat[k] = s; gLig[k] = l;
      gSpread[k] = spread; gCreep[k] = creep; gDie[k] = die; gMut[k] = mut;
      gFood[k] = food; gPrey[k] = prey;
      gCount[k] = 0; gPeak[k] = 0;
      gSerial[k] = ++serial;
      liveStrains++;
      paintStrain(k);
      return k;
    }

    function mutate(p) {
      const fam = gFam[p], base = FAM_HUE[fam];
      let h = gHue[p] + (rf() - 0.5) * (chance(0.08) ? 76 : 26);
      const d = ((h - base + 540) % 360) - 180;
      if (Math.abs(d) > 52) h = base + Math.sign(d) * 52;
      const k = makeStrain(fam, h,
        clamp(gSat[p] + (rf() - 0.5) * 0.12, 0.42, 0.92),
        clamp(gLig[p] + (rf() - 0.5) * 0.08, 0.42, 0.68),
        clamp(gSpread[p] * (0.8 + rf() * 0.45), 3, 70),
        clamp(gCreep[p] * (0.8 + rf() * 0.45), 1, 60),
        clamp(gDie[p] * (0.8 + rf() * 0.5), 1, 120),
        clamp(gMut[p] * (0.8 + rf() * 0.45), 1, 90),
        gFood[p], gPrey[p]);
      if (k < 0) return p;
      if (fam === FAM_PINK) {
        if (chance(0.12)) gFood[k] |= 1 << [BASALT, BONE, RUST, GREEN][rint(4)];
        if (chance(0.05)) gPrey[k] |= 1 << FAM_MAT;
      }
      return k;
    }

    function strainAt(i) { return (col[i] - LIFE_BASE) >> 2; }

    function dec(s) {
      gCount[s]--;
      famCount[gFam[s]]--;
      if (gCount[s] <= 0 && gUsed[s]) {
        gUsed[s] = 0;
        liveStrains--;
        if (gPeak[s] >= 6) entry('Strain ' + gSerial[s] + ' extinct.', true);
      }
    }

    function inc(s) {
      gCount[s]++;
      famCount[gFam[s]]++;
      if (gCount[s] > gPeak[s]) gPeak[s] = gCount[s];
    }

    function grow(n, s) {
      if (mat[n] === LIFE) {
        dec(strainAt(n));
        lifeCount--;
      }
      let child = s;
      if ((r32() & 4095) < gMut[s] && liveStrains < 32) child = mutate(s);
      mat[n] = LIFE;
      col[n] = LIFE_BASE + child * 4 + (r32() & 3);
      inc(child);
      lifeCount++;
    }

    function kill(i) {
      const s = strainAt(i);
      mat[i] = AIR;
      col[i] = 0;
      lifeCount--;
      dec(s);
    }

    let tick = 0, stampNow = 1, T = 0, moved = 0, recording = false;
    const surf = new Float32Array(W);
    const CS = 6;
    const cw = Math.ceil(W / CS) + 1, ch = Math.ceil(H / CS) + 1, CN = cw * ch;
    const wet = new Uint8Array(CN);
    const room = { x0: 0, x1: 0, y0: 0, y1: 0, yt: 0, tw: 0, tT: 0, tB: 0 };
    const pocket = { outX: 0, cy: 0, toX: 0, toY: 0 };
    let glassLost = 0, onWall = false, breached = false, tankOpen = false, crack = null;
    let grains = 0, seepPending = false;
    let seepT = 0, nextSeep = 0, nextWorm = 0, outbreakAt = 0, reviveAt = 0;
    let glowCount = 0, rock0 = 1, rockNow = 1, glass0 = 1, glassNow = 1;
    let tank0 = 1, tankNow = 1, water0 = 1, waterNow = 1, paneOK = true;
    let healMask = 127, glassSoft = 32, crackCells = [];
    const glowMax = Math.round(220 * U * U);
    const collapseMin = 24 * U * U;

    function swap(a, b) {
      const m = mat[a]; mat[a] = mat[b]; mat[b] = m;
      const c = col[a]; col[a] = col[b]; col[b] = c;
      stamp[a] = stampNow;
      stamp[b] = stampNow;
      moved++;
    }

    function toAir(i) { mat[i] = AIR; col[i] = 0; }

    function back(i, o) { mat[i] = o; col[i] = origC[i]; }

    /* Whatever is here goes, and the books stay straight. */
    function clear(i) {
      const m = mat[i];
      if (m === LIFE) { kill(i); return; }
      if (m === SPORE) dec(strainAt(i));
      toAir(i);
    }

    function stepPowder(i, m) {
      const q = r32();
      const d = i + W, md = mat[d];
      if (FREE[md]) { swap(i, d); return; }
      if (md === BRINE) { if ((q & 3) === 0) swap(i, d); return; }
      if (md === MOLTEN) { if ((q & 7) === 0) toAir(i); return; }
      if (m === RUBBLE ? ((q >>> 3) & 3) !== 0 : ((q >>> 3) & 1) !== 0) return;
      const st = steep[col[i]];
      const dir = q & 32 ? 1 : -1;
      let j = d + dir;
      if (LOOSE[mat[j]] && LOOSE[mat[i + dir]] && (!st || LOOSE[mat[j + W]])) { swap(i, j); return; }
      j = d - dir;
      if (LOOSE[mat[j]] && LOOSE[mat[i - dir]] && (!st || LOOSE[mat[j + W]])) swap(i, j);
    }

    function formed(bit) {
      if (grains & bit) return;
      grains |= bit;
      if (seepPending) { seepPending = false; entry('Seep.'); }
      entry('New grain. No name.');
    }

    function stepBrine(i) {
      const q = r32();
      const c = col[i];
      const lvl = c - C_BRINE;
      const n = i + NB4[q & 3];
      const nm = mat[n];
      if (nm === MOLTEN) {
        mat[i] = STEAM;
        col[i] = C_STEAM + ((q >>> 2) & 3);
        return;
      }
      if (nm === GOLD && ((q >>> 2) & 3) === 0) {
        mat[n] = GLOW;
        col[n] = C_GLOW + ((q >>> 6) & 3);
        glowCount++;
        toAir(i);
        formed(1);
        return;
      }
      if (nm === RED && lvl >= 8 && ((q >>> 2) & 31) === 0 && col[n] < C_SLAG) {
        col[n] = C_SLAG + ((q >>> 8) & 3);
        formed(2);
      }
      if (nm === GLOW && ((q >>> 2) & 255) === 0 && glowCount < glowMax) {
        mat[i] = GLOW;
        col[i] = C_GLOW + ((q >>> 10) & 3);
        glowCount++;
        return;
      }
      if (nm === LIFE && lvl >= 8 && ((q >>> 2) & 3) === 0) kill(n);
      if (nm === SOUL && lvl >= 9) scald(n);
      if (lvl > 0 && ((q >>> 12) & 2047) === 0) col[i] = c - 1;
      if (nm === BRINE && ((q >>> 12) & 31) === 0) {
        const o = col[n] - C_BRINE;
        if (o > lvl + 1) { col[i] = c + 1; col[n] = C_BRINE + o - 1; }
      }

      const d = i + W, md = mat[d];
      if (FREE[md]) { swap(i, d); return; }
      if (md === PLUG) {
        /* A porous grain passes a drop now and then, and sooner or later clogs. */
        const b = d + W;
        if (((q >>> 13) & 31) === 0 && FREE[mat[b]]) {
          clear(b);
          mat[b] = BRINE;
          col[b] = c;
          stamp[b] = stampNow;
          toAir(i);
          moved++;
          if (seepPending) { seepPending = false; entry('Seep.'); }
        } else if (((q >>> 18) & 8191) === 0) {
          unplug(d);
        }
        return;
      }
      const dir = (q >>> 24) & 1 ? 1 : -1;
      if (FREE[mat[d + dir]] && FREE[mat[i + dir]]) { swap(i, d + dir); return; }
      if (FREE[mat[d - dir]] && FREE[mat[i - dir]]) { swap(i, d - dir); return; }
      for (let k = 1; k <= 24; k++) {
        const s = i + dir * k;
        if (!FREE[mat[s]]) break;
        if (FREE[mat[s + W]]) {
          /* A pool levels at once. A lone drop runs along the flat, a few grains at a time. */
          const lone = mat[i - 1] !== BRINE && mat[i + 1] !== BRINE && mat[i - W] !== BRINE;
          swap(i, lone && k > 3 ? i + dir * 3 : s);
          return;
        }
      }
      if (((q >>> 25) & 15) === 0 && FREE[mat[i + dir]]) swap(i, i + dir);
    }

    function stepMolten(i) {
      const q = r32();
      if (q & 3) return;
      const d = i + W;
      if (FREE[mat[d]]) { swap(i, d); return; }
      const dir = (q >>> 12) & 1 ? 1 : -1;
      if (FREE[mat[i + dir]]) {
        if (FREE[mat[d + dir]]) swap(i, d + dir);
        else if (((q >>> 13) & 7) === 0) swap(i, i + dir);
      }
    }

    /* Half of it soaks into the rock. */
    function condense(i, q) {
      if (q & 0x800000) toAir(i);
      else { mat[i] = BRINE; col[i] = C_BRINE + 3; }
    }

    function stepSteam(i) {
      const q = r32();
      if (i < W * 2) { toAir(i); return; }
      if (bgK[i] && (q & 31) === 0) { toAir(i); return; }
      const up = i - W, mu = mat[up];
      if (mu !== AIR && mu !== DUST && mu !== MOLTEN && mu !== BRINE && mu !== STEAM) {
        if (((q >>> 6) & 31) === 0) { condense(i, q); return; }
      } else if (!bgK[i] && ((q >>> 6) & (mu === STEAM ? 255 : 2047)) === 0) {
        condense(i, q); return;
      }
      if (((q >>> 18) & 3) !== 0 && (mu === AIR || mu === DUST || mu === BRINE || mu === MOLTEN)) {
        swap(i, up);
        return;
      }
      const dir = (q >>> 20) & 1 ? 1 : -1;
      if (mat[i + dir] === AIR) swap(i, i + dir);
      else if (mat[up + dir] === AIR && mat[i - dir] !== AIR) swap(i, up + dir);
    }

    function stepDust(i) {
      const q = r32();
      if ((q & 63) === 0) { toAir(i); return; }
      if (((q >>> 6) & 3) !== 0) return;
      const d = i + W;
      const dir = (q >>> 8) & 1 ? 1 : -1;
      if (mat[d] === AIR) swap(i, d);
      else if (mat[i + dir] === AIR) swap(i, i + dir);
    }

    function stepAsh(i) {
      const q = r32();
      if ((q & 3) !== 0) return;
      const d = i + W;
      const dir = (q >>> 2) & 1 ? 1 : -1;
      if (mat[d] === AIR) {
        if (((q >>> 3) & 7) === 0 && mat[d + dir] === AIR) swap(i, d + dir);
        else swap(i, d);
      } else if (mat[d] !== ASH) {
        toAir(i);
      }
    }

    function stepSpore(i) {
      const q = r32();
      const s = strainAt(i);
      if ((q & 2047) === 0) { toAir(i); dec(s); return; }
      if (((q >>> 11) & 1) !== 0) return;
      const d = i + W, md = mat[d];
      const dir = (q >>> 12) & 1 ? 1 : -1;
      if (md === AIR) {
        if (((q >>> 13) & 3) === 0 && mat[i + dir] === AIR) swap(i, i + dir);
        else swap(i, d);
        return;
      }
      if (md === SPORE) return;
      const takes = gFam[s] === FAM_MOSS ? isWet(i) : ((gFood[s] >>> md) & 1) === 1;
      if (takes && WALLY[md]) {
        mat[i] = LIFE;
        lifeCount++;
      } else {
        toAir(i);
        dec(s);
      }
    }

    function isWet(i) {
      const x = i % W, y = (i / W) | 0;
      return wet[((y / CS) | 0) * cw + ((x / CS) | 0)] === 1;
    }

    function hasWall(n) {
      return WALLY[mat[n + W]] || WALLY[mat[n - W]] || WALLY[mat[n + 1]] || WALLY[mat[n - 1]];
    }

    function stepLife(i) {
      const q = r32();
      if (q & 7) return;
      const c = col[i];
      const s = (c - LIFE_BASE) >> 2;
      const fam = gFam[s];
      if (((q >>> 3) & 7) === 0) col[i] = (c & ~3) | ((q >>> 6) & 3);
      const n = i + NB8[(q >>> 8) & 7];
      const nm = mat[n];
      const roll = (q >>> 11) & 255;

      if (nm === LIFE) {
        const os = strainAt(n);
        if (os !== s && (gPrey[s] >>> gFam[os]) & 1) {
          if (roll < gSpread[s] && famCount[fam] < famCap[fam] && fuel > 0) grow(n, s);
        }
      } else if (nm === AIR) {
        if (roll < gCreep[s] && famCount[fam] < famCap[fam]) {
          if (fam === FAM_MAT) {
            const x = n % W, y = (n / W) | 0;
            if (y >= surf[x] - 4 * U && Lg[n] > 112 && mat[n + W] !== AIR) grow(n, s);
            else if (y > surf[x] && y < surf[x] + 26 * U && Lg[n] > 112 && hasWall(n) && !isWet(n)) grow(n, s);
          } else if (fam === FAM_MOSS) {
            if (origM[n] !== GLASS && (isWet(n) || inRoom(n)) && (hasWall(n) || ((q >>> 19) & 15) === 0)) grow(n, s);
          } else if (fuel > 0 && (hasWall(n) || ((q >>> 19) & 63) === 0)) {
            grow(n, s);
          }
        }
      } else if ((gFood[s] >>> nm) & 1) {
        if (fuel > 0 && (r32() & 4095) < ((gSpread[s] * (nm === GLASS ? glassSoft : SOFT[nm])) >> 4)) {
          fuel--;
          grow(n, s);
          if (nm === GLASS) glassEaten(n, s);
          else if (CUT[nm] && ((q >>> 19) & 15) === 0 && mat[n - W] === AIR) {
            mat[n - W] = DUST;
            col[n - W] = C_DUST + (q & 3);
          }
        }
      } else if (nm === MOLTEN) {
        kill(i);
        return;
      }

      let die = gDie[s];
      if (lifeCount > lifeCap) die *= 6;
      if (fam !== FAM_MAT && mat[i + W] === AIR && !hasWall(i)) die = (die + 8) * 10;
      if (((q >>> 19) & 4095) < die) {
        const food = gFood[s];
        const touching = food && fuel > 0 && lifeCount <= lifeCap && (
          (food >>> mat[i - W]) & 1 || (food >>> mat[i + W]) & 1 ||
          (food >>> mat[i - 1]) & 1 || (food >>> mat[i + 1]) & 1);
        if (!touching) { kill(i); return; }
      }

      /* Rarely, a colony sheds into open air. */
      if (mat[n] === AIR && fam !== FAM_MAT && ((r32() & 8191) === 0)) {
        mat[n] = SPORE;
        col[n] = LIFE_BASE + s * 4 + 3;
        inc(s);
      }
    }

    function inRoom(i) {
      const x = i % W, y = (i / W) | 0;
      return x > room.x0 && x < room.x1 && y > room.yt && y < room.y1;
    }

    /* The room. A hole only counts once you can see straight through the glass. */

    function holeAt(x, y) {
      const r = room;
      if (x < r.x0 + r.tw || x >= r.x1 - r.tw) {
        const a = x < r.x0 + r.tw ? r.x0 : r.x1 - r.tw;
        for (let k = 0; k < r.tw; k++) if (mat[y * W + a + k] === GLASS) return false;
        return true;
      }
      const a = y < r.y0 + r.tw ? r.y0 : y >= r.y1 - r.tw ? r.y1 - r.tw : r.yt;
      for (let k = 0; k < r.tw; k++) if (mat[(a + k) * W + x] === GLASS) return false;
      return true;
    }

    function onTheWall(s) {
      if (onWall) return;
      onWall = true;
      entry('Strain ' + gSerial[s] + ' on the wall.');
    }

    function glassEaten(n, s) {
      if (!recording) return;
      glassLost++;
      if (glassLost >= 6) onTheWall(s);
      const x = n % W, y = (n / W) | 0, r = room;
      if (tankOpen || crack || !holeAt(x, y)) return;
      if (y < r.y0 + r.tw) return;
      onTheWall(s);
      if (y < r.yt + r.tw) { tankHole(); return; }
      if (!breached) {
        breached = true;
        entry('Wall breached.');
        crack = { x: x, y: y, left: x < (r.x0 + r.x1) / 2 };
      }
    }

    /* Glass is brittle. A hole runs along the wall for whatever is hanging off it: the pane. */
    function stepCrack() {
      const r = room, c = crack;
      const wx = c.left ? r.x0 : r.x1 - r.tw;
      if (c.x < wx) c.x++;
      else if (c.x >= wx + r.tw) c.x--;
      else {
        c.y--;
        if ((r32() & 3) === 0) c.x = clamp(c.x + (r32() & 1 ? 1 : -1), wx, wx + r.tw - 1);
      }
      const i = c.y * W + c.x;
      if (mat[i] === GLASS) toAir(i);
      if (c.y > r.yt + r.tw) return;
      /* The pane has lost a side. */
      crack = null;
      const span = Math.max(6, Math.round(11 * U));
      for (let y = r.yt; y < r.yt + r.tw; y++) {
        for (let k = 0; k < span; k++) {
          const p = y * W + (c.left ? r.x0 + r.tw + k : r.x1 - r.tw - 1 - k);
          if (mat[p] === GLASS) { mat[p] = RUBBLE; }
        }
      }
      tankHole();
    }

    function tankHole() {
      if (tankOpen) return;
      tankOpen = true;
      if (tankNow < tank0 * 0.2) return;
      entry('Tank opened.' + (souls.every((s) => s.dead || s.asleep) ? ' Nobody awake.' : ''));
    }

    /* Worms and souls move themselves and are solid to everything else. */

    const worms = [];
    let oldTrail = [], oldHead = 0;
    const WORM_MEMORY = Math.round(260 * U), WORM_PAST = 40, maxWorms = L.w2 ? 2 : 1;
    const souls = [];

    function wormCellOk(x, y) {
      const m = mat[y * W + x];
      return CUT[m] === 1 || m === RUBBLE || m === AIR;
    }

    function paintWorm(w) {
      for (let k = 0; k < w.segs.length; k++) {
        const s = w.segs[k];
        const c = C_WORM + (k === 0 ? 3 : k % 3);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = (s[1] + dy) * W + s[0] + dx;
            mat[i] = WORM;
            col[i] = c;
          }
        }
      }
    }

    function remember(w, x, y) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (y + dy) * W + x + dx;
          if (mat[i] !== AIR && mat[i] !== WORM) w.trail.push(i, mat[i], col[i]);
        }
      }
    }

    function makeWorm(x, y, len, grow) {
      const w = {
        segs: [], a: rf() < 0.5 ? 0 : Math.PI, phase: rf() * 6, stuck: 0, every: 7 + rint(5),
        trail: [], homeY: y, grow: grow || 0, past: [], backing: 0
      };
      /* The body lies to the left of the head, and it has to fit on the plate. */
      x = Math.max(x, 2 * len + 2);
      x -= x % 2; y -= y % 2;
      for (let k = 0; k < len; k++) {
        const sx = x - 2 * k;
        w.segs.push([sx, y]);
        remember(w, sx, y);
      }
      paintWorm(w);
      worms.push(w);
      return w;
    }

    /* Old burrow is digested and becomes rock again, from the far end. */
    function digest(w, memory) {
      while (w.trail.length > memory * 3) {
        const i = w.trail[0];
        if (mat[i] === AIR) { mat[i] = w.trail[1]; col[i] = w.trail[2]; }
        w.trail.splice(0, 3);
      }
    }

    function clearAhead(x, y, dx, dy) {
      /* Worms stay inside rock: anything else just ahead of the head counts as a wall. */
      for (let k = 1; k <= 3; k++) {
        const ax = clamp(x + dx * k, 1, W - 3), ay = clamp(y + dy * k, 1, H - 3);
        const a = mat[ay * W + ax], b = mat[(ay + 1) * W + ax + 1];
        if (!(CUT[a] || a === WORM) || !(CUT[b] || b === WORM)) return false;
      }
      return true;
    }

    function wormTry(nx, ny, dx, dy) {
      if (nx < 8 || nx > W - 10 || ny < 8 || ny > H - 10) return false;
      if (ny < surf[nx] + 12 * U) return false;
      if (!(wormCellOk(nx, ny) && wormCellOk(nx + 1, ny) &&
            wormCellOk(nx, ny + 1) && wormCellOk(nx + 1, ny + 1))) return false;
      if (mat[ny * W + nx] === AIR || mat[(ny + 1) * W + nx + 1] === AIR) return false;
      /* It leaves a floor of rock under any pool, and a roof over it. */
      for (let k = 1; k <= 5; k++) {
        if (mat[(ny - k) * W + nx] === BRINE || mat[(ny + 1 + k) * W + nx] === BRINE) return false;
      }
      return clearAhead(nx, ny, dx, dy);
    }

    function clearSeg(p) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (p[1] + dy) * W + p[0] + dx;
          if (mat[i] === WORM) toAir(i);
        }
      }
    }

    /* One step back the way it came, tail first. It packs the dead end shut behind its head. */
    function backUp(w) {
      const p = w.past[w.past.length - 1];
      if (!p || w.segs.length < 2) return false;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (!wormCellOk(p[0] + dx, p[1] + dy)) return false;
        }
      }
      w.past.pop();
      remember(w, p[0], p[1]);
      const h = w.segs.shift();
      clearSeg(h);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (h[1] + dy) * W + h[0] + dx;
          if (mat[i] === AIR && CUT[origM[i]]) back(i, origM[i]);
        }
      }
      w.segs.push(p);
      moved += 4;
      return true;
    }

    function stepWorm(w) {
      const head = w.segs[0];
      w.phase += 0.22;
      /* It swims: a slow sine on its heading, some drift, a pull back to its own depth. */
      w.a += Math.sin(w.phase) * 0.3 + (rf() - 0.5) * 0.3;
      w.a += clamp((w.homeY - head[1]) / (26 * U), -1, 1) * 0.12 * Math.cos(w.a);
      /* It turns before it reaches the edge of the plate. */
      const margin = 30 * U;
      if (head[0] < margin) w.a += 0.25 * Math.sin(-w.a);
      else if (head[0] > W - margin) w.a += 0.25 * Math.sin(Math.PI - w.a);
      if (w.backing > 0) {
        w.backing--;
        if (backUp(w)) {
          paintWorm(w);
          digest(w, WORM_MEMORY);
          return;
        }
        w.backing = 0;
      }
      let went = false;
      for (let tries = 0; tries < 6 && !went; tries++) {
        const a = w.a + (tries ? (tries & 1 ? 1 : -1) * (0.5 + tries * 0.45) : 0);
        const dx = Math.round(Math.cos(a)) * 2, dy = Math.round(Math.sin(a)) * 2;
        if (!dx && !dy) continue;
        const nx = head[0] + dx, ny = head[1] + dy;
        if (!wormTry(nx, ny, dx, dy)) continue;
        w.a = a;
        remember(w, nx, ny);
        if (w.grow > 0) {
          w.grow--;
        } else {
          const tail = w.segs.pop();
          clearSeg(tail);
          w.past.push(tail);
          if (w.past.length > WORM_PAST) w.past.shift();
        }
        w.segs.unshift([nx, ny]);
        moved += 4;
        went = true;
      }
      if (!went) {
        w.stuck++;
        if (w.stuck > 7) { dissolveWorm(w); return; }
        if (w.past.length) {
          /* Blocked on every side: it backs down its own burrow and looks for another way. */
          w.backing = 3 + rint(6);
        } else {
          /* Nothing behind it yet: it turns round and leaves by its tail. */
          w.segs.reverse();
          const a = w.segs[0], b = w.segs[1] || a;
          w.a = Math.atan2(a[1] - b[1], a[0] - b[0]) + (rf() - 0.5);
        }
      } else {
        /* It takes a long free run to make up for a block, so one going round in a corner gives out. */
        w.stuck = Math.max(0, w.stuck - 0.125);
      }
      paintWorm(w);
      digest(w, WORM_MEMORY);
      const h = w.segs[0];
      const i = h[1] * W + h[0];
      if (mat[i - 2] === MOLTEN || mat[i + 3] === MOLTEN ||
          mat[i - 2 * W] === MOLTEN || mat[i + 3 * W] === MOLTEN) {
        dissolveWorm(w);
      }
    }

    function dissolveWorm(w) {
      for (let k = 0; k < w.segs.length; k++) {
        const s = w.segs[k];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = (s[1] + dy) * W + s[0] + dx;
            if (mat[i] === WORM) { mat[i] = DUST; col[i] = C_DUST + (k & 3); }
          }
        }
      }
      for (let k = 0; k < w.trail.length; k++) oldTrail.push(w.trail[k]);
      worms.splice(worms.indexOf(w), 1);
    }

    function newWorm() {
      for (let tries = 0; tries < 300; tries++) {
        const x = 16 + rint(W - 32);
        const y = Math.round(surf[x] + 20 * U + rf() * (H * 0.82 - surf[x]));
        if (y >= H - 12) continue;
        const len = 8 + rint(7), ax = x - x % 2, ay = y - y % 2;
        let ok = ax - 2 * len > 8;
        for (let k = -1; k < 2 * len - 1 && ok; k++) ok = CUT[mat[ay * W + ax - k]] && CUT[mat[(ay + 1) * W + ax - k]];
        if (!ok) continue;
        makeWorm(ax, ay, 1, len - 1);
        return;
      }
    }

    function inBody(i, s) {
      const x = i % W, y = (i / W) | 0;
      return x >= s.x && x < s.x + 2 && y >= s.y && y < s.y + 3;
    }

    function fits(s, x, y) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (y + dy) * W + x + dx, m = mat[i];
          if (LOOSE[m]) continue;
          if (m === SOUL && !s.dead && inBody(i, s)) continue;
          return false;
        }
      }
      return true;
    }

    /* It lifts its body and sets it down. Brine it steps into takes the place it left. */
    function placeSoul(s, x, y) {
      const left = [];
      if (!s.dead) {
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = (s.y + dy) * W + s.x + dx;
            if (mat[i] === SOUL) { toAir(i); left.push(i); }
          }
        }
      }
      s.x = x; s.y = y;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (y + dy) * W + x + dx;
          if (mat[i] === BRINE) {
            let j = -1;
            while (left.length && j < 0) { const k = left.pop(); if (!inBody(k, s)) j = k; }
            if (j >= 0) { mat[j] = BRINE; col[j] = col[i]; }
          } else if (mat[i] === SPORE) {
            dec(strainAt(i));
          }
          mat[i] = SOUL;
          col[i] = C_SOUL + (dy === 0 ? 0 : dy);
        }
      }
      moved += 6;
    }

    function scald(i) {
      for (let k = 0; k < souls.length; k++) if (!souls[k].dead && inBody(i, souls[k])) disperse(souls[k]);
    }

    function disperse(s) {
      s.dead = true;
      s.fall = 0;
      s.back = T + 2400 + rint(2400);
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = (s.y + dy) * W + s.x + dx;
          if (mat[i] === SOUL) { mat[i] = RUBBLE; col[i] = C_DUST + (dy & 1); }
        }
      }
    }

    function isHot(i) { return mat[i] === BRINE && col[i] - C_BRINE >= 8; }

    function safe(s, x, y) {
      if (x < 3 || x > W - 5 || y < 3 || y > H - 6) return false;
      if (!fits(s, x, y)) return false;
      const top = y * W + x;
      if (mat[top - W] === RUBBLE || mat[top - W + 1] === RUBBLE) return false;
      for (let dy = -1; dy < 4; dy++) {
        for (let dx = -1; dx < 3; dx++) {
          if (isHot((y + dy) * W + x + dx)) return false;
        }
      }
      return true;
    }

    function reform(s) {
      for (let k = 0; k < 36; k++) {
        for (let sign = -1; sign <= 1; sign += 2) {
          const x = s.hx + sign * k;
          for (let up = 0; up < 14; up++) {
            if (!safe(s, x, s.hy - up)) continue;
            placeSoul(s, x, s.hy - up);
            s.dead = false;
            return;
          }
        }
      }
      s.back = T + 600;
    }

    function stepSoul(s) {
      if (s.dead) { if (T >= s.back) reform(s); return; }
      if (recording && T >= s.until) {
        s.asleep = !s.asleep;
        s.until = T + (s.asleep ? 9600 + rint(14400) : 1600 + rint(2400));
      }
      const top = s.y * W + s.x;
      /* Enough loose rock on its head and it stops being a body. */
      if (mat[top - W] === RUBBLE && mat[top - W + 1] === RUBBLE &&
          mat[top - 2 * W] === RUBBLE && mat[top - 2 * W + 1] === RUBBLE) {
        disperse(s);
        return;
      }
      if (fits(s, s.x, s.y + 1)) {
        /* A long fall, or the melt, and it goes back to where it formed. */
        if (++s.fall > 30 * U) disperse(s); else placeSoul(s, s.x, s.y + 1);
        return;
      }
      s.fall = 0;
      if (mat[top + 3 * W] === MOLTEN || mat[top + 3 * W + 1] === MOLTEN) { disperse(s); return; }
      if (s.asleep || (tick % 11) !== 0) return;
      if (s.idle > 0) { s.idle--; return; }
      if (s.tx < 0 || s.x === s.tx) {
        if (chance(0.55)) {
          s.idle = 12 + rint(70);
          s.tx = -1;
        } else {
          s.tx = clamp(s.x + Math.round((rf() - 0.5) * 80 * U), 4, W - 6);
        }
      }
      if (s.tx >= 0 && s.x !== s.tx) {
        const dir = s.tx > s.x ? 1 : -1;
        if (fits(s, s.x + dir, s.y)) placeSoul(s, s.x + dir, s.y);
        else if (fits(s, s.x + dir, s.y - 1)) placeSoul(s, s.x + dir, s.y - 1);
        else if (fits(s, s.x + dir, s.y - 2)) placeSoul(s, s.x + dir, s.y - 2);
        else if (chance(0.3)) {
          /* It digs, at random. */
          for (let dy = 0; dy < 3; dy++) {
            const i = (s.y + dy) * W + s.x + (dir > 0 ? 2 : -1);
            if (CUT[mat[i]]) mat[i] = RUBBLE;
          }
        } else if (chance(0.3)) {
          s.tx = -1;
        }
      }
    }

    const queue = [];
    let quietUntil = 0;

    function entry(text, minor) {
      if (!recording) return;
      if (minor) {
        if (T < quietUntil) return;
        quietUntil = T + 1200;
      }
      if (queue.length < 8) queue.push(T, text);
    }

    /* Rock: a flat roof carries only so far, and a thin one less far. */

    function slab(l, r, y, thick) {
      let cells = 0;
      for (let d = 0; d < thick; d++) {
        const yy = y - d;
        if (yy < 3) break;
        const a = l + d * 3 + rint(3), b = r - d * 3 - rint(3);
        for (let x = a; x <= b; x++) {
          const i = yy * W + x;
          if (CUT[mat[i]]) { mat[i] = RUBBLE; cells++; }
          else if (mat[i] === LIFE) kill(i);
        }
      }
      for (let k = 0; k < cells / 8; k++) {
        const i = (y + 1 + rint(4)) * W + clamp(l + rint(r - l + 1), 1, W - 2);
        if (mat[i] === AIR) { mat[i] = DUST; col[i] = C_DUST + (r32() & 3); }
      }
      if (cells >= collapseMin) entry('Collapse.', true);
    }

    function roofTick(i, m) {
      if (!FREE[mat[i + W]]) return;
      const x = i % W, y = (i / W) | 0;
      if (y < surf[x] + 10 * U) return;
      /* Bumps weather first, so a rough roof slowly goes flat. */
      const sides = CUT[mat[i - 1]] + CUT[mat[i + 1]];
      if (sides < 2) {
        if ((r32() & (sides ? 2047 : 31)) === 0) mat[i] = RUBBLE;
        return;
      }
      let l = x, r = x;
      const row = y * W;
      while (x - l < 96 && CUT[mat[row + l - 1]] && FREE[mat[row + l - 1 + W]]) l--;
      while (r - x < 96 && CUT[mat[row + r + 1]] && FREE[mat[row + r + 1 + W]]) r++;
      const span = r - l + 1;
      if (span < 12) return;
      let thick = 1;
      const mid = row + ((l + r) >> 1);
      while (thick < 6 && CUT[mat[mid - thick * W]]) thick++;
      const lim = SPAN[m] * Math.max(0.7, U) * thick / 6;
      if (T > 600 && span > lim && rf() < Math.min(0.2, (span - lim) / lim * 0.0016)) slab(l, r, y, 2 + rint(3));
    }

    /* Whatever no longer connects to the frame comes down. */
    function anchor() {
      Z.fill(0);
      let sp = 0, k;
      for (let i = 0; i < N; i++) {
        if (mat[i] === EDGE) { Z[i] = 1; STACK[sp++] = i; }
      }
      while (sp > 0) {
        const i = STACK[--sp];
        k = i - W; if (k >= 0 && !Z[k] && HOLD[mat[k]]) { Z[k] = 1; STACK[sp++] = k; }
        k = i + W; if (k < N && !Z[k] && HOLD[mat[k]]) { Z[k] = 1; STACK[sp++] = k; }
        k = i - 1; if (k >= 0 && !Z[k] && HOLD[mat[k]]) { Z[k] = 1; STACK[sp++] = k; }
        k = i + 1; if (k < N && !Z[k] && HOLD[mat[k]]) { Z[k] = 1; STACK[sp++] = k; }
      }
      let cells = 0;
      for (let i = 0; i < N; i++) {
        if (!Z[i] && HARD[mat[i]]) {
          mat[i] = RUBBLE;
          cells++;
        }
      }
      if (cells >= 3 * collapseMin && T > 600) entry('Collapse.', true);
    }

    /* Slow things, sampled. Dry ground goes back to what it was; stray grains and brine go away. */

    function healAir(i) {
      const o = origM[i];
      if (!o) return;
      if (o === BRINE) {
        if (waterNow >= water0 || FREE[mat[i + W]] || (r32() & 15)) return;
        const y = (i / W) | 0;
        if (y < room.yt + room.tw && (i % W) > room.x0 && (i % W) < room.x1 && y > room.y0 &&
            !(paneOK && glassNow >= glass0 * 0.96)) return;
        mat[i] = BRINE; col[i] = origC[i];
        return;
      }
      if (o === MOLTEN || o === GOLD || o === RED) {
        if (FREE[mat[i + W]] || (r32() & 127)) return;
        back(i, o);
        return;
      }
      if (isWet(i)) return;
      let solid = 0;
      for (let k = 0; k < 4; k++) {
        const nm = mat[i + NB4[k]];
        if (nm === LIFE && (o !== GLASS || gFam[strainAt(i + NB4[k])] === FAM_PINK)) return;
        if (HARD[nm] || nm === RUBBLE || nm === GOLD || nm === RED) solid++;
        if (o === GLASS && nm === GLASS) solid++;
      }
      if (!solid || (r32() & (solid > 2 ? 15 : o === GLASS ? 127 : healMask)) || (solid === 1 && (r32() & 7))) return;
      back(i, o);
    }

    function looseTick(i, m) {
      const o = origM[i];
      if (o === m) return;
      const open = LOOSE[mat[i - W]];
      if (HARD[o] && !open && !LOOSE[mat[i + W]] && !LOOSE[mat[i - 1]] && !LOOSE[mat[i + 1]]) {
        if ((r32() & 63) === 0) back(i, o);
      } else if (o === GLASS && m === RUBBLE && !LOOSE[mat[i + W]]) {
        /* Loose rock lying where the glass was fuses back into it. */
        if ((r32() & 63) === 0) back(i, o);
      } else if (open && (!HARD[o] || m !== RUBBLE) && (r32() & 127) === 0) {
        toAir(i);
      }
    }

    function maintain() {
      const n = N >> 6, span = N - 4 * W, base = 2 * W;
      for (let k = 0; k < n; k++) {
        const i = base + rint(span), m = mat[i];
        if (m === AIR || m === DUST) healAir(i);
        else if (CUT[m]) roofTick(i, m);
        else if (m === RUBBLE || m === GOLD || m === RED) looseTick(i, m);
        else if (m === BRINE) {
          const o = origM[i];
          if (o === BRINE) continue;
          if (HARD[o]) { if (!FREE[mat[i + W]] && (r32() & 63) === 0) back(i, o); }
          else if (mat[i - W] === AIR && (r32() & 255) === 0) toAir(i);
        } else if (m === GLOW) {
          if (origM[i] !== GLOW && !isWet(i) && (r32() & 511) === 0) { toAir(i); glowCount--; }
        } else if (m === MOLTEN) {
          if (origM[i] !== MOLTEN && (r32() & 31) === 0) { mat[i] = RUBBLE; col[i] = C_BASALT + (r32() & 3); }
        } else if (m === LIFE) {
          if (origM[i] === GLASS && gFam[strainAt(i)] !== FAM_PINK && (r32() & 255) === 0) kill(i);
        } else if (m === PLUG) {
          if (mat[i - W] !== BRINE && (r32() & 63) === 0) unplug(i);
        }
      }
    }

    function carveCrack(x, y, tx, ty) {
      /* A hairline, always four-connected so that liquid can follow it. It leaves straight down,
         and it stops the moment it breaks into open space. */
      let guard = 500, first = true;
      while ((x !== tx || y !== ty) && guard-- > 0) {
        const dy = ty - y, dx = Math.abs(tx - x);
        if (first || (dy > 0 && (x === tx || chance((dy + 0.5) / (dx + dy + 1))))) y++;
        else if (x !== tx) x += tx > x ? 1 : -1;
        else y++;
        if (y >= H - 3) return;
        const i = y * W + x, m = mat[i];
        if (!first && m === AIR) return;
        first = false;
        if (m !== GLASS && m !== MOLTEN && m !== BRINE && m !== WORM && m !== SOUL) {
          clear(i);
          /* The rock leaves a running crack alone until the plug clogs. */
          if (origM[i]) { crackCells.push(i, origM[i]); origM[i] = 0; }
        }
      }
    }

    function unplug(i) {
      mat[i] = origM[i];
      col[i] = origC[i];
      for (let k = 0; k < crackCells.length; k += 2) origM[crackCells[k]] = crackCells[k + 1];
      crackCells = [];
    }

    function firstSeep() {
      /* The pocket's floor goes porous at one grain, and a hairline runs down from there. */
      for (let k = 0; k < 24; k++) {
        const x = pocket.outX + (k & 1 ? -k : k);
        let y = pocket.cy;
        while (y < H - 2 && mat[y * W + x] === AIR) y++;
        if (mat[y * W + x] !== BRINE) continue;
        while (y < H - 2 && mat[y * W + x] === BRINE) y++;
        if (!CUT[mat[y * W + x]] || !CUT[mat[(y + 1) * W + x]]) continue;
        mat[y * W + x] = PLUG;
        seepPending = true;
        carveCrack(x, y, pocket.toX, pocket.toY);
        return;
      }
    }

    /* Anywhere brine sits on a floor of rock with open space under it. */
    function randomSeep() {
      const spots = [];
      for (let i = W * 4; i < N - W * 4; i++) {
        if (mat[i] !== BRINE || !CUT[mat[i + W]]) continue;
        const x = i % W;
        let y = ((i / W) | 0) + 1, depth = 0;
        while (y < H - 3 && mat[y * W + x] !== AIR && mat[y * W + x] !== BRINE && depth < 60) { y++; depth++; }
        if (mat[y * W + x] === AIR && depth >= 4) spots.push(i, y);
      }
      if (!spots.length) return;
      const k = rint(spots.length / 2) * 2, i = spots[k], x = i % W;
      mat[i + W] = PLUG;
      seepPending = true;
      carveCrack(x, ((i / W) | 0) + 1, clamp(x + rint(7) - 3, 3, W - 4), spots[k + 1]);
    }

    function plantStrain(s) {
      const r = room;
      for (let y = r.tT - r.aH; y <= r.tB + 1; y++) {
        const fall = Math.max(0, (y - (r.tT - r.aH)) / (r.tB - r.tT + r.aH));
        for (let d = 1; d < 6 * U + 2; d++) {
          const i = y * W + r.x0 - d;
          if (mat[i] === AIR && rf() < (1 - d * 0.1 / U) * (0.4 + 0.6 * fall)) seedLife(i, s);
        }
      }
      for (let x = r.x0 - r.aW; x < r.x0; x++) {
        const y = surfaceBelow(x, r.tB - 2);
        if (rf() < 0.6 && mat[(y - 1) * W + x] === AIR) seedLife((y - 1) * W + x, s);
      }
    }

    function outbreak() {
      outbreakAt = 0;
      fuel = fuelFull;
      const food = (1 << GLASS) | (1 << RED) | (1 << RUBBLE);
      const s = makeStrain(FAM_PINK, 326 + (rf() - 0.5) * 40, 0.76, 0.58, 20, 24, 13, 70, food, 1 << FAM_MOSS);
      if (s < 0) return;
      plantStrain(s);
      if (!gCount[s]) { gUsed[s] = 0; liveStrains--; }
    }

    function revive() {
      if (!famCount[FAM_MOSS]) {
        const s = makeStrain(FAM_MOSS, 104 + (rf() - 0.5) * 40, 0.62, 0.5, 6, 12, 2, 24, 0, 0);
        if (s >= 0) {
          for (let x = room.x1 - room.tw - 12; x < room.x1 - room.tw; x++) {
            const y = surfaceBelow(x, room.yt + room.tw + 1) - 1;
            if (mat[y * W + x] === AIR) seedLife(y * W + x, s);
          }
          if (!gCount[s]) { gUsed[s] = 0; liveStrains--; }
        }
      }
    }

    function audit() {
      let rock = 0, glass = 0, water = 0, tankW = 0, glow = 0;
      const r = room;
      for (let i = 0; i < N; i++) {
        const m = mat[i];
        if (CUT[m]) rock++;
        else if (m === GLASS) glass++;
        else if (m === GLOW) glow++;
        else if (m === STEAM) water++;
        else if (m === BRINE) {
          water++;
          const y = (i / W) | 0;
          if (y < r.yt && y > r.y0) { const x = i % W; if (x > r.x0 && x < r.x1) tankW++; }
        }
      }
      rockNow = rock; glassNow = glass; waterNow = water; tankNow = tankW; glowCount = glow;
      healMask = rock > rock0 * 0.985 ? 127 : rock > rock0 * 0.96 ? 63 : 15;
      paneOK = true;
      for (let y = r.yt; y < r.yt + r.tw && paneOK; y++) {
        for (let x = r.x0 + r.tw; x < r.x1 - r.tw; x++) if (mat[y * W + x] !== GLASS) { paneOK = false; break; }
      }
      /* Healed, and refilled. It can happen again. */
      if (!outbreakAt && !famCount[FAM_PINK] && !crack && glass >= glass0 * 0.96 && tankW >= tank0 * 0.6) {
        onWall = false; breached = false; tankOpen = false; glassLost = 0;
        outbreakAt = T + 4800 + rint(14400);
      }
      if (!famCount[FAM_MOSS] && T >= reviveAt) {
        revive();
        reviveAt = T + 4800;
      }
    }

    function director() {
      T++;
      if (T === seepT) firstSeep();
      if (crack && T % 5 === 0) stepCrack();
      if (T >= nextSeep) {
        randomSeep();
        nextSeep = T + 7200 + rint(14400);
      }
      if (T >= nextWorm) {
        if (worms.length < maxWorms) newWorm();
        nextWorm = T + 2400 + rint(4800);
      }
      if (outbreakAt && T >= outbreakAt) outbreak();
      if ((T & 255) === 0) audit();
    }

    function curve(points) {
      return (x) => {
        if (x <= points[0][0]) return points[0][1];
        for (let k = 1; k < points.length; k++) {
          if (x <= points[k][0]) {
            let t = (x - points[k - 1][0]) / (points[k][0] - points[k - 1][0]);
            t = t * t * (3 - 2 * t);
            return lerp(points[k - 1][1], points[k][1], t);
          }
        }
        return points[points.length - 1][1];
      };
    }

    const lamNoise = noise1();
    function lamination(salt, d) { return lamNoise(d + salt * 31) * 0.7 + lamNoise(d * 2.7 + salt * 13) * 0.3; }

    function fillRock(i, x, y, top, ramp0, salt, bias) {
      const lam = lamination(salt, (y - top) * 0.46 / U);
      const blob = noise2(x * 0.03 / U + salt * 7, y * 0.08 / U + salt);
      const v = 0.62 * lam + 0.2 * blob + 0.18 * rf() + (bias || 0);
      col[i] = ramp0 + clamp(Math.floor(v * 8), 0, 7);
    }

    function setBg(i, c, k) {
      bgR[i] = pr[c] * k;
      bgG[i] = pg[c] * k;
      bgB[i] = pb[c] * k;
    }

    function seedLife(i, s) {
      if (mat[i] === LIFE) return;
      mat[i] = LIFE;
      col[i] = LIFE_BASE + s * 4 + (r32() & 3);
      inc(s);
      lifeCount++;
    }

    function surfaceBelow(x, y) {
      while (y < H - 2 && FREE[mat[y * W + x]]) y++;
      return y;
    }

    function roofAbove(x, y) {
      while (y > 2 && FREE[mat[y * W + x]]) y--;
      return y;
    }

    function pile(cx, base, halfW, height, m, c) {
      for (let x = cx - halfW; x <= cx + halfW; x++) {
        const t = 1 - Math.abs(x - cx) / halfW;
        const h = Math.round(height * t * (0.85 + 0.25 * noise2(x * 0.3, 11)));
        let y = surfaceBelow(x, base - height - 1) - 1;
        for (let d = 0; d < h; d++, y--) {
          const i = y * W + x;
          if (mat[i] !== AIR) continue;
          mat[i] = m;
          col[i] = c + (r32() & 3);
        }
      }
    }

    function buildWorld() {
      const n1 = noise1(), n2 = noise1(), n3 = noise1(), n4 = noise1(), n5 = noise1(), n6 = noise1(), n7 = noise1();
      const col1 = () => new Float32Array(W);
      const b1 = col1(), b2 = col1(), b3 = col1(), b4 = col1(), b5 = col1(), thick = col1();
      const XW = Math.max(W, 300);
      for (let x = 0; x < W; x++) {
        const X = x / XW;
        surf[x] = H * (L.surf + 0.05 * (fbm(n1, X * 7 + 0.3) - 0.5));
        thick[x] = (3 + 4.4 * n7(X * 26)) * U + 1;
        b1[x] = H * (L.b1 + 0.08 * (fbm(n2, X * 5 + 4) - 0.5));
        b2[x] = H * (L.b2 + 0.07 * (fbm(n3, X * 4 + 9) - 0.5));
        b3[x] = b2[x] + H * (0.03 + 0.028 * n4(X * 7));
        b4[x] = H * (L.b4 + 0.07 * (fbm(n5, X * 4 + 2) - 0.5));
        b5[x] = H * (L.b5 + 0.04 * (fbm(n6, X * 5 + 1) - 0.5));
      }

      const sky = [
        '#0d0a24', '#120f33', '#191547', '#201b56', '#2b2169',
        '#38287d', '#46308e', '#5a3a9a', '#6c48b4', '#7d58cc'
      ].map(hex);
      const skyEnd = H * (L.surf + 0.024);

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (y < surf[x]) {
            bgK[i] = 1;
            const band = (y / skyEnd) * (sky.length - 1) + 0.28 * Math.sin(y * 1.9 / U) +
              (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5);
            const c = sky[clamp(Math.round(band), 0, sky.length - 1)];
            bgR[i] = c[0]; bgG[i] = c[1]; bgB[i] = c[2];
            continue;
          }
          if (y < b1[x]) {
            const near = 1 - (y - surf[x]) / (b1[x] - surf[x]);
            fillRock(i, x, y, surf[x], near > 0.72 ? C_SOIL : C_RUST, 1, near * 0.1);
            mat[i] = RUST;
          } else if (y < b2[x]) {
            fillRock(i, x, y, b1[x], C_BONE, 2);
            mat[i] = BONE;
          } else if (y < b3[x]) {
            fillRock(i, x, y, b2[x], C_DEEP, 3);
            mat[i] = RUST;
          } else if (y < b4[x]) {
            fillRock(i, x, y, b3[x], C_GREEN, 4);
            mat[i] = GREEN;
          } else if (y < b5[x]) {
            fillRock(i, x, y, b4[x], C_BASALT, 5);
            mat[i] = BASALT;
          } else {
            mat[i] = MOLTEN;
            col[i] = C_MOLTEN + 3;
            bgR[i] = 30; bgG[i] = 10; bgB[i] = 4;
            continue;
          }
          setBg(i, col[i], 0.34);
        }
      }

      /* The gallery. Blunt at both ends, rough overhead, nearly flat underfoot, draining toward the shaft.
         One stretch of its roof is cut flat and wider than the rock will carry.
         That is on purpose, and it holds for 15 s. */
      const ceilY = curve([[0, 0.44], [0.19, 0.425], [0.395, 0.395], [0.62, 0.405], [0.82, 0.385], [1, 0.43]]);
      const floorY = curve([[0, 0.525], [0.214, 0.54], [0.485, 0.552], [0.78, 0.566], [0.903, 0.578], [1, 0.56]]);
      const nC = noise1(), nF = noise1(), nD = noise1();
      const xa = Math.round(L.ga * W), xb = Math.round(L.gb * W);
      const flatT = L.flat;
      const flatX = xa + (L.flip ? 1 - flatT : flatT) * (xb - xa);
      const flatY = Math.round(H * (L.gy + (ceilY(flatT) - 0.48) * L.gs));
      for (let x = xa; x <= xb; x++) {
        const X = x / XW;
        const t = L.flip ? (xb - x) / (xb - xa) : (x - xa) / (xb - xa);
        const e = clamp(Math.min(x - xa, xb - x) / (16 * U), 0, 1);
        const round = Math.sqrt(1 - (1 - e) * (1 - e));
        const c = L.gy + (ceilY(t) - 0.48) * L.gs + 0.045 * L.gs * (fbm(nC, X * 22) - 0.5) +
          0.016 * L.gs * (nD(X * 130) - 0.5);
        const f = L.gy + (floorY(t) - 0.48) * L.gs + 0.01 * L.gs * (fbm(nF, X * 16) - 0.5);
        const mid = (c + f) / 2;
        let top = H * (mid + (c - mid) * round);
        const bot = H * (mid + (f - mid) * round);
        if (e === 1 && Math.abs(x - flatX) < 31 * U) top = flatY;
        for (let y = Math.ceil(top); y < bot; y++) toAir(y * W + x);
      }

      /* The shaft from the gallery floor to the molten deep. */
      const nS = noise1();
      const shaftHalf = Math.max(2, 3 * U);
      for (let y = Math.round(H * (L.gy + 0.03)); y < H; y++) {
        const c = W * L.shaft + 5 * U * (nS(y * 0.05 / U) - 0.5);
        if (mat[y * W + Math.round(c)] === MOLTEN) break;
        for (let x = Math.round(c - shaftHalf); x <= Math.round(c + shaftHalf); x++) toAir(y * W + x);
      }

      /* A sealed glass room, in basalt, with a tank in its ceiling. */
      const x0 = Math.round(W * L.x0), x1 = Math.round(W * L.x1);
      const y0 = Math.round(H * L.y0), y1 = Math.round(H * L.y1);
      const tw = Math.max(2, Math.round(3 * U));
      /* A thick wall is eaten faster per grain, so that it stands about as long as a thin one. */
      glassSoft = Math.round(70 * Math.pow((tw === 2 ? 2 : tw === 3 ? 6 : 24) / (28 * U), 1 / tw));
      const yt = y0 + Math.round((y1 - y0) * 0.3);
      const fl = y1 - tw - 1;
      room.x0 = x0; room.x1 = x1; room.y0 = y0; room.y1 = y1; room.yt = yt; room.tw = tw;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * W + x;
          const wall = x < x0 + tw || x >= x1 - tw || y < y0 + tw || y >= y1 - tw || (y >= yt && y < yt + tw);
          if (wall) {
            mat[i] = GLASS;
            col[i] = C_GLASS + (r32() & 3);
          } else if (y < yt) {
            if (y >= y0 + tw + Math.round(2 * U)) {
              mat[i] = BRINE;
              col[i] = C_BRINE + 12 + (r32() & 3);
            } else {
              toAir(i);
            }
          } else {
            toAir(i);
          }
        }
      }

      /* A tunnel to the wall, carved here. */
      const shaftX = Math.round(W * L.shaft);
      const tBot = fl;
      const tTop = tBot - Math.max(5, Math.round(8 * U));
      const nT = noise1();
      for (let x = shaftX; x < x0; x++) {
        const a = Math.round(tTop + 2.4 * U * (nT(x * 0.09) - 0.5));
        const b = Math.round(tBot + 1.6 * U * (nT(x * 0.07 + 30) - 0.5));
        for (let y = a; y <= b; y++) toAir(y * W + x);
      }

      /* It widens where it meets the wall. */
      const anteW = Math.min(Math.round(12 * U), x0 - shaftX - Math.ceil(shaftHalf) - 1), anteH = Math.round(20 * U);
      for (let x = x0 - anteW; x < x0; x++) {
        const t = (x - (x0 - anteW)) / anteW;
        const top = Math.round(tTop - anteH * Math.sqrt(t) * (0.8 + 0.3 * noise2(x * 0.3, 21)));
        for (let y = top; y <= tBot; y++) toAir(y * W + x);
      }
      room.tT = tTop; room.tB = tBot; room.aW = anteW; room.aH = anteH;

      const px = W * L.px, py = H * L.py, prx = W * L.prx, pry = H * L.pry;
      pocket.cy = Math.round(py);
      for (let y = Math.floor(py - pry * 1.5); y < py + pry * 1.5; y++) {
        for (let x = Math.floor(px - prx * 1.5); x < px + prx * 1.5; x++) {
          if (x < 2 || x >= W - 2) continue;
          const dx = (x - px) / prx, dy = (y - py) / pry;
          if (dx * dx + dy * dy > 0.86 + 0.28 * noise2(x * 0.09, y * 0.16)) continue;
          const i = y * W + x;
          if (y > py - pry * 0.62) {
            mat[i] = BRINE;
            col[i] = C_BRINE + (r32() & 1);
          } else {
            toAir(i);
          }
        }
      }

      /* A lens of melt in the lower basalt, sealed for now. */
      const mx = W * L.mx, my = H * L.my, mrx = W * L.mrx, mry = H * L.mry;
      for (let y = Math.floor(my - mry * 1.4); y < my + mry * 1.4; y++) {
        for (let x = Math.floor(mx - mrx * 1.4); x < mx + mrx * 1.4; x++) {
          const dx = (x - mx) / mrx, dy = (y - my) / mry;
          if (dx * dx + dy * dy > 0.8 + 0.34 * noise2(x * 0.08 + 40, y * 0.14)) continue;
          const i = y * W + x;
          mat[i] = MOLTEN;
          col[i] = C_MOLTEN + 3;
          bgR[i] = 30; bgG[i] = 10; bgB[i] = 4;
        }
      }

      /* Fissures from the surface. The mats will find them. */
      for (let k = 0; k < L.cracks.length; k++) {
        let x = Math.round(W * L.cracks[k][0]);
        const start = Math.round(surf[x]);
        const len = Math.round(L.cracks[k][1] * U);
        for (let d = -1; d < len; d++) {
          const y = start + d;
          toAir(y * W + x);
          if (d < len * 0.5 || (d & 1)) toAir(y * W + x + 1);
          if (rf() < 0.33) x += r32() & 1 ? 1 : -1;
        }
      }

      /* What the opening is, so that it can be gone back to. */
      for (let i = 0; i < N; i++) {
        const m = mat[i];
        if (HARD[m] || m === BRINE || m === MOLTEN) { origM[i] = m; origC[i] = col[i]; }
        if (CUT[m]) rock0++;
        else if (m === GLASS) glass0++;
        else if (m === BRINE) {
          water0++;
          const y = (i / W) | 0, x = i % W;
          if (y < yt && y > y0 && x > x0 && x < x1) tank0++;
        }
      }

      const matS = makeStrain(FAM_MAT, 162, 0.68, 0.5, 8, 9, 1, 3, 0, 0);
      for (let x = 1; x < W - 1; x++) {
        const s = Math.round(surf[x]);
        for (let d = 0; d < thick[x]; d++) {
          const i = (s + d - 1) * W + x;
          if (mat[i] === AIR || CUT[mat[i]]) seedLife(i, matS);
        }
      }

      const mossS = makeStrain(FAM_MOSS, 104, 0.62, 0.5, 6, 12, 2, 24, 0, 0);
      const pinkFood = (1 << GLASS) | (1 << RED) | (1 << RUBBLE);
      const pinkS = makeStrain(FAM_PINK, 326, 0.76, 0.58, 20, 24, 13, 70, pinkFood, 1 << FAM_MOSS);

      /* The garden. */
      const gardenL = x1 - tw - Math.round((x1 - x0) * 0.27);
      for (let x = gardenL; x < x1 - tw; x++) {
        const t = (x - gardenL) / (x1 - tw - gardenL);
        const h = Math.round((3 + 5 * noise2(x * 0.2, 7)) * U) +
          (t > 0.86 ? Math.round((yt + tw + 3 - fl) * -0.72 * (0.7 + 0.3 * noise2(x, 3))) : 0);
        for (let d = 0; d < h; d++) {
          if (rf() < (d > 8 * U ? 0.72 : 0.97)) seedLife((fl - d) * W + x, mossS);
        }
      }

      pile(Math.round(x0 + (x1 - x0) * 0.47), fl, Math.round(15 * U), Math.round(15 * U), RED, C_RED);

      plantStrain(pinkS);

      /* Under the hairline, grains that do something when wet. */
      const goldX = Math.round(W * L.gold);
      const goldBase = surfaceBelow(goldX, Math.round(H * L.gy));
      pile(goldX, goldBase - 1, Math.round(15 * U), Math.round(12 * U), GOLD, C_GOLD);

      pocket.outX = Math.round(W * L.out);
      pocket.toX = goldX;
      pocket.toY = roofAbove(pocket.toX, Math.round(H * L.gy)) + 2;

      for (let x = Math.round(W * L.moss[0]); x < Math.round(W * L.moss[1]); x++) {
        const y = surfaceBelow(x, Math.round(H * L.gy));
        if (rf() < 0.28 && y < H * (L.gy + 0.14)) seedLife((y - 1) * W + x, mossS);
      }

      /* Two figures. One is awake for now, and walks over to the pile under the hairline. */
      const sx = x0 + Math.round((x1 - x0) * 0.62);
      const soul = (x, y, asleep, idle, until) => {
        souls.push({ x, y, hx: x, hy: y, asleep, dead: false, back: 0, idle, tx: -1, until, fall: 0 });
      };
      soul(sx, fl - 2, true, 0, 9600 + rint(9600));
      const gx = goldX + L.side * Math.round(30 * U);
      const gy = surfaceBelow(gx, Math.round(H * L.gy)) - 3;
      soul(gx, gy, false, 30, 600 + rint(200));
      souls[1].tx = goldX + L.side * (Math.round(15 * U) + 2);
      souls.forEach((s) => {
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const i = (s.y + dy) * W + s.x + dx;
            mat[i] = SOUL;
            col[i] = C_SOUL + (dy === 0 ? 0 : dy);
          }
        }
      });

      makeWorm(Math.round(W * L.w1[0]), Math.round(H * L.w1[1]), Math.round(11 + 3 * U));
      if (L.w2) makeWorm(Math.round(W * L.w2[0]), Math.round(H * L.w2[1]), Math.round(9 + 3 * U));
      for (let k = Math.round(W / 12); k > 0; k--) worms.slice().forEach(stepWorm);

      for (let x = 0; x < W; x++) { mat[x] = EDGE; mat[(H - 1) * W + x] = EDGE; }
      for (let y = 0; y < H; y++) { mat[y * W] = EDGE; mat[y * W + W - 1] = EDGE; }
    }

    /* Light. Sky from above, heat and glow from wherever they are, in a coarse field.
       Upsampled and dithered, so that the falloff is made of grains and never of blur. */

    const field = () => new Float32Array(CN);
    const eR = field(), eG = field(), eB = field();
    const lR = field(), lG = field(), lB = field();
    const nR = field(), nG = field(), nB = field();
    const solid = field(), skyF = field(), skyT = field(), VR = field(), VG = field(), VB = field();
    const ixOf = new Int32Array(W), wxOf = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const f = (x + 0.5) / CS - 0.5;
      const ix = f < 0 ? 0 : Math.floor(f);
      ixOf[x] = Math.min(ix, cw - 2);
      wxOf[x] = f < 0 ? 0 : f - ix;
    }

    function computeLight(iterations) {
      const flow = tick * 0.0009;
      eR.fill(0); eG.fill(0); eB.fill(0); solid.fill(0); wet.fill(0);
      for (let y = 0, i = 0; y < H; y++) {
        const cy = (y / CS) | 0;
        for (let x = 0; x < W; x++, i++) {
          const m = mat[i];
          if (m === AIR) continue;
          if (m === MOLTEN) {
            /* Close to one flat orange: a slow, shallow field, and a darker skin. */
            let v = noise2(x * 0.03 / U + flow * 0.7, y * 0.09 / U - flow) * 0.6 +
              noise2(x * 0.1 / U - flow * 1.4, y * 0.22 / U + flow * 0.5) * 0.4;
            v = 3.5 + (v - 0.5) * 5 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
            if (mat[i - W] !== MOLTEN) v = 0;
            else if (mat[i - 2 * W] !== MOLTEN) v = 1;
            else if (v < 2) v = 2;
            col[i] = C_MOLTEN + clamp(Math.round(v), 0, 7);
          }
          const k = cy * cw + ((x / CS) | 0);
          const c = col[i];
          const e = pe[c];
          if (e) {
            eR[k] += pr[c] * e;
            eG[k] += pg[c] * e;
            eB[k] += pb[c] * e;
          }
          if (WALLY[m] || m === LIFE || m === MOLTEN) solid[k] += 1;
          if (m === BRINE) wet[k] = 1;
        }
      }
      const fill = CS * CS;
      const gain = 1 / (255 * fill) * 1.25;
      for (let k = 0; k < CN; k++) {
        eR[k] *= gain; eG[k] *= gain; eB[k] *= gain;
        solid[k] /= fill;
      }
      /* Sky comes straight down and gets used up by rock. */
      for (let cx = 0; cx < cw; cx++) {
        let v = 1;
        for (let cy = 0; cy < ch; cy++) {
          const k = cy * cw + cx;
          skyF[k] = v;
          v *= (1 - 0.34 * solid[k]) * 0.985;
        }
      }
      for (let cy = 0; cy < ch; cy++) {
        for (let cx = 0; cx < cw; cx++) {
          const k = cy * cw + cx;
          const a = skyF[cx > 0 ? k - 1 : k], b = skyF[cx < cw - 1 ? k + 1 : k];
          skyT[k] = (a + b + skyF[k] * 2) * 0.25;
        }
      }
      for (let it = 0; it < iterations; it++) {
        for (let cy = 0; cy < ch; cy++) {
          for (let cx = 0; cx < cw; cx++) {
            const k = cy * cw + cx;
            const l = cx > 0 ? k - 1 : k, r = cx < cw - 1 ? k + 1 : k;
            const u = cy > 0 ? k - cw : k, d = cy < ch - 1 ? k + cw : k;
            const t = 0.245 * (1 - 0.6 * solid[k]);
            nR[k] = eR[k] + (lR[l] + lR[r] + lR[u] + lR[d]) * t;
            nG[k] = eG[k] + (lG[l] + lG[r] + lG[u] + lG[d]) * t;
            nB[k] = eB[k] + (lB[l] + lB[r] + lB[u] + lB[d]) * t;
          }
        }
        lR.set(nR); lG.set(nG); lB.set(nB);
      }
      for (let k = 0; k < CN; k++) {
        const s = skyT[k];
        VR[k] = 104 + s * 172 + lR[k];
        VG[k] = 98 + s * 160 + lG[k];
        VB[k] = 104 + s * 150 + lB[k];
      }
      for (let y = 0, i = 0; y < H; y++) {
        const fy = (y + 0.5) / CS - 0.5;
        const iy = fy < 0 ? 0 : Math.min(Math.floor(fy), ch - 2);
        const wy = fy < 0 ? 0 : fy - iy;
        const r0 = iy * cw, r1 = (iy + 1) * cw;
        const by = (y & 3) * 4;
        for (let x = 0; x < W; x++, i++) {
          const ix = ixOf[x], wx = wxOf[x];
          const a = r0 + ix, c = r1 + ix;
          const dith = BAYER[by + (x & 3)];
          let v;
          v = lerp(lerp(VR[a], VR[a + 1], wx), lerp(VR[c], VR[c + 1], wx), wy) + dith;
          Lr[i] = v >= 255 ? 255 : v & 0xf0;
          v = lerp(lerp(VG[a], VG[a + 1], wx), lerp(VG[c], VG[c + 1], wx), wy) + dith;
          Lg[i] = v >= 255 ? 255 : v & 0xf0;
          v = lerp(lerp(VB[a], VB[a + 1], wx), lerp(VB[c], VB[c + 1], wx), wy) + dith;
          Lb[i] = v >= 255 ? 255 : v & 0xf0;
        }
      }
    }

    function render() {
      let o = 0;
      for (let y = 1; y < H - 1; y++) {
        let i = y * W + 1;
        for (let x = 1; x < W - 1; x++, i++, o++) {
          const m = mat[i];
          if (m === AIR) {
            if (bgK[i]) {
              out[o] = 0xff000000 | (bgB[i] << 16) | (bgG[i] << 8) | bgR[i];
            } else {
              out[o] = 0xff000000 | (((bgB[i] * Lb[i]) >> 8) << 16) | (((bgG[i] * Lg[i]) >> 8) << 8) |
                ((bgR[i] * Lr[i]) >> 8);
            }
          } else {
            const c = col[i], e = pe[c];
            let lr = Lr[i] + e, lg = Lg[i] + e, lb = Lb[i] + e;
            if (lr > 256) lr = 256;
            if (lg > 256) lg = 256;
            if (lb > 256) lb = 256;
            out[o] = 0xff000000 | (((pb[c] * lb) >> 8) << 16) | (((pg[c] * lg) >> 8) << 8) | ((pr[c] * lr) >> 8);
          }
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    function update() {
      tick++;
      stampNow = (tick & 255) || 1;
      const t = stampNow;
      for (let y = H - 2; y >= 1; y--) {
        const row = y * W;
        const ltr = ((y ^ tick) & 1) === 0;
        for (let k = 1; k < W - 1; k++) {
          const i = row + (ltr ? k : W - 1 - k);
          const m = mat[i];
          if (m < RUBBLE || stamp[i] === t) continue;
          switch (m) {
            case RUBBLE: case GOLD: case RED: stepPowder(i, m); break;
            case BRINE: stepBrine(i); break;
            case MOLTEN: stepMolten(i); break;
            case STEAM: stepSteam(i); break;
            case DUST: stepDust(i); break;
            case ASH: stepAsh(i); break;
            case SPORE: stepSpore(i); break;
            case LIFE: stepLife(i); break;
          }
        }
      }
      if ((r32() & 3) === 0) {
        const i = W * 2 + rint(W);
        if (mat[i] === AIR) { mat[i] = ASH; col[i] = C_ASH + (r32() & 3); }
      }
      for (let k = worms.length - 1; k >= 0; k--) {
        if ((tick % worms[k].every) === 0) stepWorm(worms[k]);
      }
      if (oldHead < oldTrail.length && (tick & 3) === 0) {
        const i = oldTrail[oldHead];
        if (mat[i] === AIR) { mat[i] = oldTrail[oldHead + 1]; col[i] = oldTrail[oldHead + 2]; }
        oldHead += 3;
        if (oldHead >= oldTrail.length) { oldTrail = []; oldHead = 0; }
      }
      for (let k = 0; k < souls.length; k++) stepSoul(souls[k]);
      maintain();
      if (tick % 120 === 60) anchor();
      if (recording) director();
      if ((tick & 3) === 0) computeLight(2);
    }

    /* Keeping. The ground plan is rebuilt from the seed; the rest is saved as it is. */

    const kept = {
      mat, col, origM, origC, gFam, gSpread, gCreep, gDie, gMut, gFood, gPrey, gPeak, gSerial, gHue, gSat, gLig
    };

    function dump() {
      return {
        kept, worms, souls, oldTrail, crack, crackCells, line: world.line,
        s: {
          seed, tick, T, moved, serial, fuel, oldHead, glassLost, onWall, breached, tankOpen, grains,
          seepPending, seepT, nextSeep, nextWorm, outbreakAt, reviveAt, quietUntil, rock0, glass0, tank0, water0
        }
      };
    }

    function restore(d) {
      worms.length = 0;
      souls.length = 0;
      for (const k in kept) kept[k].set(d.kept[k]);
      d.worms.forEach((w) => { worms.push(w); });
      d.souls.forEach((s) => { souls.push(s); });
      oldTrail = d.oldTrail;
      crack = d.crack;
      crackCells = d.crackCells;
      ({
        seed, tick, T, moved, serial, fuel, oldHead, glassLost, onWall, breached, tankOpen, grains,
        seepPending, seepT, nextSeep, nextWorm, outbreakAt, reviveAt, quietUntil, rock0, glass0, tank0, water0
      } = d.s);
      /* The books come back from the grains. */
      gCount.fill(0); gUsed.fill(0); famCount.fill(0);
      lifeCount = 0;
      for (let i = 0; i < N; i++) {
        const m = mat[i];
        if (m === LIFE || m === SPORE) {
          const s = strainAt(i);
          gCount[s]++;
          famCount[gFam[s]]++;
          if (m === LIFE) lifeCount++;
        }
      }
      liveStrains = 0;
      for (let s = 0; s < MAX_STRAINS; s++) {
        if (gCount[s] > 0) { gUsed[s] = 1; liveStrains++; paintStrain(s); }
      }
      recording = true;
      world.line = d.line;
      audit();
      computeLight(40);
    }

    const world = {
      GW, GH, line: 'T+0000000', update, render, dump,
      get T() { return T; },
      get tick() { return tick; },
      get moved() { return moved; },
      get strains() { return liveStrains; },
      next() { return queue.length ? [queue.shift(), queue.shift()] : null; },
      begin() {
        /* The opening is clean. What the pre-run cut is rock again, right up to each worm. */
        oldTrail = [];
        oldHead = 0;
        for (let i = 0; i < N; i++) {
          const m = mat[i];
          if ((m === AIR || m === DUST) && CUT[origM[i]]) back(i, origM[i]);
          else if (m === GOLD || m === RED) { origM[i] = m; origC[i] = col[i]; }
        }
        audit();
        rock0 = rockNow; glass0 = glassNow; tank0 = tankNow; water0 = waterNow;
        moved = 0;
        recording = true;
        seed = (seed ^ STORY) || SEED;
        seepT = 170 + rint(80);
        nextSeep = 3600 + rint(3600);
        nextWorm = 2400 + rint(2400);
        reviveAt = 2400;
        computeLight(40);
      }
    };

    buildWorld();
    computeLight(40);
    if (saved) restore(saved);
    return world;
  }

  /* ---- Page ---- */

  const STEP = 1000 / 40;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let world = null, starting = false, woken = false, ready = false, live = false, wanted = !reduced;
  let inView = !('IntersectionObserver' in window), grain = GRAIN;
  let raf = 0, last = 0, acc = 0, savedAt = 0, shownT = -1000, shownMoved = -1, shownStrains = -1;

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
    const K = Math.max(1, Math.round(GRAIN * dpr));
    const g = K / dpr;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    return { dpr, g, sw, sh, w: Math.floor((sw + 0.01) / g), h: Math.floor((sh + 0.01) / g) };
  }

  /* Centred in the stage, and starting on a device pixel wherever the stage happens to fall.
     A world too wide for the stage keeps its right side, which is where the sealed room is. */
  function place(m) {
    grain = m.g;
    if (m.g + 'px' !== document.documentElement.style.getPropertyValue('--grain')) {
      document.documentElement.style.setProperty('--grain', m.g + 'px');
    }
    const cw = (world ? world.GW : m.w) * m.g, ch = (world ? world.GH : m.h) * m.g;
    const box = stage.getBoundingClientRect();
    const px = box.left + window.scrollX + stage.clientLeft, py = box.top + window.scrollY + stage.clientTop;
    const snap = (v) => Math.round(v * m.dpr) / m.dpr;
    const s = canvas.style;
    s.position = 'absolute';
    s.left = snap(px + (m.sw - cw) * (cw > m.sw ? 0.86 : 0.5)) - px + 'px';
    s.top = snap(py + (m.sh - ch) / 2) - py + 'px';
    s.width = cw + 'px';
    s.height = ch + 'px';
    s.imageRendering = 'pixelated';
  }

  /* Reloading does not reset it. The slice is kept in this browser and nowhere else. */
  let db = null;
  function openStore(done) {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    try {
      const r = indexedDB.open('silt', VERSION);
      r.onupgradeneeded = () => {
        if (r.result.objectStoreNames.contains('worlds')) r.result.deleteObjectStore('worlds');
        r.result.createObjectStore('worlds');
      };
      r.onsuccess = () => { if (!finished) db = r.result; finish(); };
      r.onerror = (e) => { if (e.preventDefault) e.preventDefault(); finish(); };
      r.onblocked = finish;
      setTimeout(finish, 800);
    } catch (e) { finish(); }
  }
  function readSaved(key, done) {
    if (!db) { done(null); return; }
    let answered = false;
    const answer = (v) => { if (!answered) { answered = true; done(v); } };
    /* A store that does not answer is left alone from here on, so what it holds stays safe. */
    setTimeout(() => { if (!answered) { db = null; answer(null); } }, 800);
    try {
      const q = db.transaction('worlds').objectStore('worlds').get(key);
      q.onsuccess = () => { answer(q.result || null); };
      q.onerror = (e) => { if (e.preventDefault) e.preventDefault(); answer(null); };
    } catch (e) { answer(null); }
  }
  function save() {
    if (!db || !world || !ready) return;
    try {
      const tx = db.transaction('worlds', 'readwrite');
      tx.objectStore('worlds').put(world.dump(), world.GW + 'x' + world.GH);
      if (tx.commit) tx.commit();
    } catch (e) { /* Not kept this time. */ }
  }

  function counters() {
    if (world.moved !== shownMoved) {
      shownMoved = world.moved;
      movedEl.textContent = pad(shownMoved, 9).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    if (world.strains !== shownStrains) { shownStrains = world.strains; strainsEl.textContent = pad(shownStrains, 3); }
  }

  /* The record is one row, overwritten. A line stays up long enough to read. */
  function show(text, t) {
    const line = 'T+' + pad(t, 7) + ' ' + text;
    logEl.textContent = line;
    return line;
  }
  function record() {
    if (world.T - shownT < 100) return;
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
    if (now - savedAt > 60000) { savedAt = now; save(); }
  }

  function going() { return wanted && inView && ready && !document.hidden && !isFull(); }

  /* Paused means stopped. Nothing is caught up. */
  function kick() {
    if (going() && !raf) {
      last = performance.now();
      if (!savedAt) savedAt = last - 45000;
      acc = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function settle(left, w) {
    const n = Math.min(left, 5);
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
    if (m.w < 8 || m.h < 8 || starting) return;
    starting = true;
    readSaved(m.w + 'x' + m.h, (saved) => {
      let w = null;
      try {
        if (saved) { try { w = boot(m.w, m.h, saved); } catch (e) { w = null; } }
        world = w || boot(m.w, m.h, null);
      } catch (e) { return; }
      place(measure());
      if (w) {
        logEl.textContent = w.line;
        shownT = w.T;
        w.render();
        counters();
        reveal();
        ready = true;
        kick();
      } else {
        settle(120, world);
      }
    });
  }

  /* One world for the visit. A new window size crops it, or leaves a margin; it does not start another. */
  let refitTimer = 0;
  function refit() {
    const m = measure();
    place(m);
    if (woken && !world) start(m);
  }

  /* The reader gets a ring. It passes through rock and changes nothing. */

  let lastTouch = -1e9, hideTimer = 0, pointerKind = 'mouse', lastPoint = null;
  function ringAt(e) {
    lastPoint = { clientX: e.clientX, clientY: e.clientY };
    const box = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, half = grain * 2.5;
    /* The ring itself starts on a device pixel. */
    const snap = (v) => Math.round((v - half) * dpr) / dpr + half;
    const x = snap(e.clientX - box.left), y = snap(e.clientY - box.top);
    ghost.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    ghost.hidden = false;
    const label = ghost.lastElementChild;
    if (label) {
      const lw = label.offsetLeft + label.offsetWidth, lh = label.offsetTop + label.offsetHeight;
      const dx = x + lw > stage.clientWidth ? -(label.offsetLeft + lw) : 0;
      const dy = y + lh > stage.clientHeight ? -(label.offsetTop + lh) : 0;
      label.style.transform = dx || dy ? 'translate(' + dx + 'px,' + dy + 'px)' : '';
    }
  }
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(hideTimer);
    ringAt(e);
    stage.style.cursor = 'none';
  });
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    ghost.hidden = true;
    stage.style.cursor = '';
  });
  stage.addEventListener('pointerdown', (e) => { pointerKind = e.pointerType; });
  stage.addEventListener('click', (e) => {
    if (pointerKind !== 'mouse') {
      ringAt(e);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { ghost.hidden = true; }, 1100);
    }
    const now = performance.now();
    if (now - lastTouch < 5000) return;
    lastTouch = now;
    show('You touched nothing.', world ? world.T : 0);
  });
  /* The wheel moves the rock under a resting pointer, and the pointer stays where it is. */
  window.addEventListener('scroll', () => { if (!ghost.hidden && lastPoint) ringAt(lastPoint); }, { passive: true });

  runBtn.addEventListener('click', () => {
    wanted = !wanted;
    say();
    if (world) counters();
    kick();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    kick();
  });
  /* Chrome throws away a transaction begun in pagehide on a reload. One begun in beforeunload lands. */
  window.addEventListener('beforeunload', save);
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(refit, 150);
  });
  if (window.ResizeObserver) new ResizeObserver(() => { place(measure()); }).observe(document.documentElement);

  place(measure());

  function go() {
    if (woken || isFull()) return;
    woken = true;
    let store = false;
    try { store = !!window.indexedDB; } catch (e) { /* Denied. Not kept, then. */ }
    if (store) openStore(() => { start(measure()); });
    else start(measure());
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
