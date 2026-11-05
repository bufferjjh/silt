/* Exhibit A, drawn live: the film's script, drawn with Exhibit B's own world, with no page attached.
   One place, laid out in Exhibit B's geography, is seen bare and then full. A small floating creature plants a seed,
   digs a hollow and lays a branch across it; the rain fills it, the damp finds its way down to the water underground,
   and a wheel the creature builds where that water spills lifts it back up to a garden. Then the days pass, the place
   grows into Exhibit B, and the camera pulls back onto Exhibit B's own picture, which carries on live below the film.
   The ground is simulated for real by Exhibit B's rules (js/sand.js): rain runs and soaks in, water fills what is dug
   and runs down the stair. The plot is choreographed: the creature follows a script. The last frame is drawn by
   Exhibit B's own code, so it is Exhibit B's frozen frame on every seed.
   This file touches no DOM, so it runs the same under Node.

     SiltReel.create({ seed })            the whole film, all at once
     SiltReel.load({ seed, slice, ... })  the same, a few ms at a time, as a promise
     SiltReel.pickSeed(x)                 a seed known to land the script, for x from 0 to 1
     SiltReel.words()                     frame() alone, with no world, for laying out type
     reel.reset(seed)                     back to t = 0
     reel.tick()                          1/60 s: scripted events and the physics
     reel.t                               seconds of film
     reel.frame(t, cols, rows)            what is on screen, as plain data
     reel.paint(rgba, cols, rows, cam)    one RGBA pixel per cell of the picture; cam comes from frame()
     reel.pace                            ms of ticks for the busiest second (burst), and ms to paint a cell (paint)
     reel.reduced                         set true: no twinkling, hard cuts, and days pass in fewer steps

   Three sizes of grain, all Exhibit B's composition: the film's world at 1.8 grains a step of Exhibit B's plan (a cell
   at 1:1 is one of its grains, 1.2 of Exhibit B's), the same place at 3.6 for the close-ups (2.4), and Exhibit B
   itself at 1.5 for the last shot. */
(function (root) {
  'use strict';

  const BEAT = 5 / 6;
  function beat(n) { return Math.round(n * BEAT * 1000) / 1000; }
  /* The script, in seconds. The soundtrack is 72 beats to the minute, and every act lands on one. */
  const T_ENTER = beat(2.5), T_UP = beat(3), T_SEED = beat(4), T_LAND = beat(5), T_PLANT = beat(6), T_GLIDE = beat(8);
  const T_DIG = beat(9), T_DUG = beat(12), T_BRANCH = beat(13), T_LAY = beat(14), T_RAIN = beat(15);
  const T_ONE0 = beat(17), T_ONE = beat(19), T_CLAY = beat(22), T_CAPTION = beat(23), T_DRY = beat(24);
  const T_SPROUT = beat(25), T_TILT = beat(26.5), T_LOW = beat(29.5), T_SPILL = beat(31), T_CAVE = beat(35);
  const T_SHAFT = beat(36), T_BREAK = beat(40), T_IN0 = beat(41), T_IN = beat(42), T_WHEEL = beat(44);
  const T_POTS = beat(45), T_OUT0 = beat(46), T_OUT = beat(47), T_LOOP = beat(48), T_FLOW = beat(49);
  const T_BED = beat(50), T_FLOW1 = beat(51.5), T_LAPSE = beat(52), T_UP0 = beat(55), T_UP1 = beat(58);
  const T_GOLD = beat(58), T_DUSK = beat(60), T_HOME = beat(60), T_PULL = beat(63), T_PULLED = beat(64);
  const T_RINGS1 = beat(65.5), T_CAP1 = beat(67.5), T_TAG = beat(68), T_WORDS = beat(69), T_END = 60;
  const T_LAST = 58.6;
  /* The days, one afternoon a beat once time runs. */
  const DAYS = [6, 9, 14, 21, 30, 42, 56, 72, 90, 105, 120];
  const DAYS_STILL = [6, 6, 6, 21, 21, 21, 61, 61, 120, 120, 120];
  function dayAt(t, reduced) {
    if (t < T_SPILL) return 1;
    if (t < T_CAVE) return 2;
    if (t < T_LOOP) return 3;
    if (t < T_FLOW1) return 4;
    if (t < T_LAPSE) return 5;
    const k = Math.min(DAYS.length - 1, Math.floor((t - T_LAPSE) / BEAT + 1e-6));
    return (reduced ? DAYS_STILL : DAYS)[k];
  }

  /* The view reel.js fits the box to, in cells. Q is kept for its sizes. */
  const Q = 4;
  const VW = 160 * Q, VH = 66 * Q;
  /* Exhibit B's plan, and the grains a step of it at each size. */
  const PW = 384, PH = 216, U_F = 1.5, U_1 = 1.8, U_C = 3.6;
  const S1 = U_1 / U_F; /* Cells a grain of Exhibit B at 1:1. */

  const SEEDS = 256;
  const LEFT_OUT = [];
  /* Milliseconds of work to make the worlds the film starts with, over which a device is far too slow to play it live. */
  const SLOW_BUILD = 1600;
  /* The dice the place uses once it has grown, the same for every seed, so every seed ends on the same picture. */
  const FIXED = 0x2a6e1f3d;
  /* The frozen frame of Exhibit B is the opening settled this many updates, then begun. */
  const SETTLE = 180, PLATE_BEGIN = 1;
  const clock = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

  /* Text colours. */
  const FG = '#e8ded1', DIM = '#968676', BRIGHT = '#fff6e8', AMBER = '#f5be6e', LANTERN = '#ffd49a', BACK = '#100d0b';
  const COLORS = {
    term: BACK, band: '#090706', pane: '#181310', paneLine: '#3b2f27', title: '#221b16',
    key: '#6b4c33', keyOn: BRIGHT, keyOff: DIM, cap: '#f4ece0', endTwo: '#a89888'
  };
  const KEYS = [['p', 'plant'], ['d', 'dig'], ['b', 'build'], ['i', 'inspect'], ['z', 'zoom']];
  const CAPTIONS = [
    [T_CAPTION, beat(28), 'Give a little. It gives back more.'],
    [T_PULLED, T_CAP1, 'All of this, from one seed.']
  ];
  const TAGLINE = 'Every afternoon leaves a layer.';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, t) { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function lin(a, b, t) { return clamp((t - a) / (b - a), 0, 1); }
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function pk(c) { return (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

  /* The creature. Its sprites, as rows of keys: the close-up's 24 and the 1:1's 12. */
  const SPRITES = {"spec":{"palette":{"o":"#6A4934","k":"#281C17","l":"#F7E6C4","p":"#DAC29C","s":"#B49A78","h":"#D2AC60","g":"#FFE09A"},"s24":["........................","........................","........................",".ollllllllllllllllllllo.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppgkppppppgkppppso.",".opppppkkppppppkkppppso.",".opppppkkppppppkkppppso.",".opppppppppppppppppppso.","..olppppppppppppppppso..","..oplpppppppppppppppso..","...osssssssssssssssso...","....osssssssssssssso....",".....osssssssssssso.....","......oooooooooooo......","..............s.........","...............s........","..............hhh.......",".............hgggh......",".............hhghh......","..............hhh.......","........................"],"idle":[["........................","........................","........................",".ollllllllllllllllllllo.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppgkppppppgkppppso.",".opppppkkppppppkkppppso.",".opppppkkppppppkkppppso.",".opppppppppppppppppppso.","..olppppppppppppppppso..","..oplpppppppppppppppso..","...osssssssssssssssso...","....osssssssssssssso....",".....osssssssssssso.....","......oooooooooooo......","..............s.........","...............s........","..............hhh.......",".............hgggh......",".............hhghh......","..............hhh.......","........................"],["........................","........................",".ollllllllllllllllllllo.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppppppppppppppppso.",".olppppgkppppppgkppppso.",".opppppkkppppppkkppppso.",".opppppkkppppppkkppppso.",".opppppppppppppppppppso.","..olppppppppppppppppso..","..oplpppppppppppppppso..","...osssssssssssssssso...","....osssssssssssssso....",".....osssssssssssso.....","......oooooooooooo......","..............s.........","...............s........","...............s........","..............hhh.......",".............hgggh......",".............hhghh......","..............hhh.......","........................"],["........................","........................","........................","........................","ollllllllllllllllllllllo","olppppppppppppppppppppso","olppppppppppppppppppppso","olppppppppppppppppppppso","olpppppgkppppppgkpppppso","oppppppkkppppppkkpppppso","oppppppkkppppppkkpppppso",".olppppppppppppppppppso.",".oplpppppppppppppppppso.","..opppppppppppppppppso..","...osssssssssssssssso...","....osssssssssssssso....",".....oooooooooooooo.....","..............s.........","...............s........","..............hhh.......",".............hgggh......",".............hhghh......","..............hhh.......","........................"]]},"s12":{"s12":["............","ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"],"idle12":[["............","ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"],["ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......s....",".......hh...",".......hg...","............"],["............","............","ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..",".......s....",".......hh...",".......hg...","............"]],"blink12":["............","ollllllllllo","olppppppppso","olppppppppso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hg...",".......hg...","............"],"lean12":[["olll........","olppllll....","olpppppplllo","opppgkppppso",".oppkkppgkso","..osppppkkso","...osssspso.","....ssssoo..",".......s....","......s.....","......hh....","......hg...."],["........lllo","....llllppso","olllppppppso","olppppgkppso","olgkppkkpso.","opkkppppso..",".oppsssso...","..oossss....",".......s....","........s...","........hh..","........hg.."]],"glance12":[["............","ollllllllllo","olppppppppso","olgkppgkppso","opkkppkkppso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"],["............","ollllllllllo","olppppppppso","olppgkppgkso","opppkkppkkso",".opppppppso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"]],"inspect12":[["............","........lllo","....llllppso","olllppppppso","olppppppppso","olppppgkpso.","opgkppppso..",".oppsssso...","..oossss....",".......s....",".......hh...",".......hg..."],["............","olll........","olppllll....","olpppppplllo","opppppppppso",".oppgkppppso","..osppppgkso","...osssspso.","....ssssoo..",".......s....",".......hh...",".......hg..."]],"discover12":[["............","ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opkkppkkso.","..osssssso..","...osssso...",".......s....",".......hh...",".......hg...","............"],["ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opkkppkkso.","..osssssso..","...osssso...",".......s....",".......gg...",".......gg...","............","............"],["............","ollllllllllo","olppppppppso","olpgkppgkpso","oppkkppkkpso",".opppppppso.","..osssssso..","...osssso...",".......s....","........hh..","........hg..","............"]],"construct12":[["ollllllllllo","olppppppppso","olppppppppso","opppgkppgkso",".opppppppso.","..osssssso..","...osssso...",".......s....","........s...","........hh..","........hg..","............"],["ollllllllllo","olppppppppso","olppppppppso","opppgkppgkso",".opppppppso.","..osssssso..","...osssso...",".......s....","........s...","........s...","........gg..","........gg.."]],"rest12":[["............","ollllllllllo","olppppppppso","olppppppppso","oppgkppgkpso",".opppppppso.","..osssssso..","...osssso...",".......s....","........s...","........hh..","........hg.."],["............","............","ollllllllllo","olppppppppso","olppppppppso","oppgkppgkpso",".opppppppso.","..osssssso..","...osssso...",".......s....","........hh..","........hg.."]]}};
  /* No umber corners on the 12's lip: on a world of grains with no outlines they read as ears (as in Exhibit B). */
  function lipFix(f) { return f.map((r) => r === 'ollllllllllo' ? 'llllllllllls' : r); }
  const C12 = {};
  ['s12', 'blink12'].forEach((k) => { C12[k] = lipFix(SPRITES.s12[k]); });
  ['idle12', 'lean12', 'glance12', 'inspect12', 'discover12', 'construct12', 'rest12'].forEach((k) => { C12[k] = SPRITES.s12[k].map(lipFix); });
  const C24 = { rest: SPRITES.spec.s24, idle: SPRITES.spec.idle };
  const CPAL = {};
  Object.keys(SPRITES.spec.palette).forEach((k) => { CPAL[k] = pk(rgb(SPRITES.spec.palette[k])); });
  /* Where the 24's line starts: the first row under the bowl that is only line. */
  function lineRow(f) { for (let r = 0; r < f.length; r++) if (/^\.*s\.*$/.test(f[r])) return r; return f.length; }
  const BOWL24 = C24.rest.slice(0, lineRow(C24.rest));
  const BEAD24 = ['.hhh.', 'hgggh', 'hhghh', '.hhh.'], BEAD24B = ['.ggg.', 'ggggg', 'hgggh', '.hhh.'];
  const BOWL12 = C12.s12.slice(0, lineRow(C12.s12));
  const BEAD12 = ['hh', 'hg'], BEAD12B = ['gg', 'gg'];

  /* Birds that come to drink: a body, a belly, a wing up or down. */
  const BIRD = [['.dbb.', 'dbbwh', '..ww.'], ['.dbb.', 'dbbbh', '.www.']];
  const BIRD_C = { d: pk(rgb('6a4630')), b: pk(rgb('9a6a44')), w: pk(rgb('7e5438')), h: pk(rgb('f4d2a8')) };
  const WOOD = ['3d2a20', '52382a', '6a4934', '845d42'].map((h) => pk(rgb(h)));
  const SILTC = ['8c7864', '9a8570', 'a8937e', 'b6a08c'].map((h) => pk(rgb(h)));
  const CLAYC = ['9a5236', 'ae6040', 'c27250', 'd08460'].map((h) => pk(rgb(h)));
  const LEAF = ['2d4c37', '3b5f42', '527651'].map((h) => pk(rgb(h)));
  const SEEDC = [pk(rgb('9c7a3c')), pk(rgb('d2ac60')), pk(rgb('fff6dc'))];
  const LANTERN_C = rgb('ffd49a'), WET_C = rgb('5e86a8'), FLOW_C = rgb('ffd49a');

  /* The sky through the day, over Exhibit B's dusk: the top, the horizon, and how much of it shows. */
  const DAY_SKY = { top: rgb('6a92b8'), hor: rgb('d6d6cc') }, GOLD_SKY = { top: rgb('5a6f92'), hor: rgb('eab680') };
  const RAIN_SKY = { top: rgb('5c6a7c'), hor: rgb('a8aaa6') };
  function dayness(t) { return t < T_GOLD ? 1 : 1 - smooth(T_GOLD, T_DUSK, t); }

  function finish(gen) { let s = gen.next(); while (!s.done) s = gen.next(); return s.value; }
  function Sand() {
    if (root.SiltSand) return root.SiltSand;
    if (typeof require === 'function') { try { return require('./sand.js'); } catch (e) { /* none */ } }
    return null;
  }
  function* build(U, opts, gw, gh) {
    const S = Sand();
    const GW = Math.max(Math.round(PW * U), gw || 0), GH = Math.max(Math.round(PH * U), gh || 0);
    const gen = S.boot(GW, GH, U, PW, PH, Object.assign({ bare: true }, opts || {}));
    let r = gen.next();
    while (!r.done) { yield; r = gen.next(); }
    return r.value;
  }

  /* ---- The reel ---- */

  function makeReel(worlds, seed0, size) {
    const alive = !!worlds;
    let W1 = worlds ? worlds.W1 : null, WC = worlds ? worlds.WC : null;
    let W1P = null, WF = null, plate = null;
    let bg = null; /* The worlds made while the film plays. */
    let n = 0, seed = seed0;
    const reel = { reduced: false, pace: { burst: 200, paint: 2e-5 }, buildMs: 0, loadMs: 0, slow: false, warmed: true };

    /* ---- What the place holds, found once in the film's world ---- */
    let G = null; /* geometry in the film's world (1:1 grains) */
    let bareOut = null, cOut = null; /* the film's world bare, as drawn; the close-up world bare, as drawn */
    let hollow = [], shaftCells = [], bedCells = [], turfCells = [], branchCells = [], plankCells = [];
    let surfY = null;

    function idx1(x, y) { return (y + 1) * W1.W + x + 1; }
    function survey() {
      const w = W1, geo = w.geo, GW = w.GW, GH = w.GH;
      surfY = new Int16Array(GW);
      for (let x = 0; x < GW; x++) {
        let y = 0;
        while (y < GH - 1 && (w.mat[idx1(x, y)] === 0)) y++;
        surfY[x] = y;
      }
      const pond = geo.pond || { L: Math.round(GW * 0.22), R: Math.round(GW * 0.38), top: surfY[Math.round(GW * 0.3)] };
      const hc = Math.round((pond.L + pond.R) / 2), hw = Math.max(14, Math.round((pond.R - pond.L) * 0.2));
      /* The sapling's place: the middle of what the composition stakes there. */
      let sx = 0, sn = 0;
      for (let i = 0; i < w.N; i++) if (w.tags.part[i] === 9) { sx += (i % w.W) - 1; sn++; }
      const sap = sn ? Math.round(sx / sn) : Math.round((pond.R + geo.well.ringL) / 2);
      const hub = geo.machine ? geo.machine.hub : [hc + 140, pond.top + 100];
      const hover = w.hover || { x: geo.bed ? geo.bed.x0 + 20 : hc + 300, y: pond.top - 16, w: 12, h: 12 };
      G = { pond, hc, hw, sap, well: geo.well, stair: geo.stair, hub, bed: geo.bed, hover, aqTop: geo.aqTop, aq: geo.aq,
        sb: pond.top, GW, GH, branch: [hc + hw + 26, hc + hw + 26 + 2 * hw + 6] };
      /* The hollow it digs: a bowl in the middle of the pond's basin, dug top down. */
      hollow = [];
      const depth = Math.max(8, Math.min(16, Math.round(hw * 0.6)));
      for (let y = pond.top; y < pond.top + depth; y++) for (let x = hc - hw; x <= hc + hw; x++) {
        const u = (x - hc) / hw, q = (y - pond.top + 0.5) / depth;
        if (u * u + q * q > 1) continue;
        const i = idx1(x, y);
        if (w.mat[i] === 10) hollow.push(i);
      }
      /* Its bed: a grain or two under the bowl, which holds the water, and turns to clay under it. */
      const inBowl = new Set(hollow);
      bedCells = [];
      for (let x = hc - hw - 1; x <= hc + hw + 1; x++) {
        for (let y = pond.top; y < pond.top + depth + 3; y++) {
          const i = idx1(x, y);
          if (inBowl.has(i)) continue;
          if (inBowl.has(i - w.W) || inBowl.has(i - 1) || inBowl.has(i + 1) || inBowl.has(i - 2 * w.W) || inBowl.has(i - 2) || inBowl.has(i + 2)) bedCells.push(i);
        }
      }
      /* The shaft it digs: the well's, top down. */
      shaftCells = [];
      for (let i = 0; i < w.N; i++) if (w.tags.part[i] === 3) shaftCells.push(i);
      shaftCells.sort((a, b) => a - b);
      /* The turf to come back where it is damp. */
      turfCells = [];
      for (let i = 0; i < w.N; i++) if (w.tags.prevM[i] === 11 && w.mat[i] === 10) turfCells.push(i);
      /* The branch on the ground, and the plank it becomes. */
      branchCells = []; plankCells = [];
      for (let x = G.branch[0]; x <= G.branch[1]; x++) branchCells.push(idx1(x, surfY[x] - 1));
      /* The plank lies across the hollow in front of the cut, so it is drawn over the ground and stops no rain. */
      for (let x = hc - hw - 4; x <= hc + hw + 4; x++) plankCells.push([x, Math.min(surfY[hc - hw - 4], surfY[hc + hw + 4]) - 1]);
    }

    /* ---- The worlds, made, bare, and made again ---- */

    function* makeW1(gw, gh) {
      W1 = yield* build(U_1, { tags: true }, gw, gh);
      W1.makeBare();
      W1.begin(seed);
      initW1();
    }
    /* The film's world, bare, with the branch lying where it will be found; and how it looks before anything happens. */
    function initW1() {
      W1.ctl.clouds = true; W1.ctl.stars = false; W1.ctl.lights = 0;
      survey();
      for (const i of branchCells) { W1.mat[i] = 4; W1.col[i] = WOOD[1 + (i % 3 === 0 ? 1 : 0)]; }
      W1.render();
      bareOut = new Uint32Array(W1.out);
    }
    function initWC() {
      WC.ctl.clouds = false; WC.ctl.stars = false; WC.ctl.lights = 0;
      WC.begin(1);
      WC.render();
      cOut = new Uint32Array(WC.out);
    }
    /* The place grown, for every seed the same; and Exhibit B's frozen frame. Made while the film plays. */
    function* later() {
      const p = yield* build(U_1, { tags: true }, W1.GW, W1.GH);
      for (let k = 0; k < SETTLE; k += 10) { p.settle(10); yield; }
      p.begin(FIXED);
      p.ctl.creature = false; p.ctl.stars = false; p.ctl.lights = 0; p.ctl.flies = false;
      W1P = p;
      yield;
      /* As wide as the widest picture seen in play: 576 (Exhibit B's own) unless the picture is wider than 577. */
      const wide = Math.max(seen.cols, size ? size[0] : 0), tall = Math.max(seen.rows, size ? size[1] : 0);
      const f = yield* build(U_F, {}, wide > 577 ? wide : 576, Math.max(324, tall));
      for (let k = 0; k < SETTLE; k += 10) { f.settle(10); yield; }
      f.begin(PLATE_BEGIN);
      f.render();
      WF = f;
      plate = new Uint32Array(f.out);
      makeDates();
    }

    /* ---- When each grain of the grown place comes in, in days ---- */
    let dates = null;
    function makeDates() {
      const w = W1P, N = w.N, part = w.tags.part, GW = w.GW;
      dates = new Uint8Array(N);
      const box = {};
      for (let i = 0; i < N; i++) {
        const p = part[i]; if (!p) continue;
        const x = (i % w.W) - 1, y = ((i / w.W) | 0) - 1;
        const b = box[p] || (box[p] = { x0: 1e9, x1: -1, y0: 1e9, y1: -1 });
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
      const up = (p, y, a, b) => { const bx = box[p]; return a + (b - a) * (bx ? (bx.y1 - y) / Math.max(1, bx.y1 - bx.y0) : 0); };
      const across = (p, x, a, b) => { const bx = box[p]; return a + (b - a) * (bx ? (x - bx.x0) / Math.max(1, bx.x1 - bx.x0) : 0); };
      for (let i = 0; i < N; i++) {
        const x = (i % w.W) - 1, y = ((i / w.W) | 0) - 1, p = part[i], j = hash(x, y, 31);
        let d;
        switch (p) {
          case 3: d = 6; break;
          case 6: d = 9 + 20 * j; break;
          case 7: d = up(7, y, 21, 42) + 4 * j; break;
          case 8: d = 30 + 36 * hash(Math.floor(x / 40), 0, 33) + up(8, y, 0, 14); break;
          case 9: d = 14; break;
          case 10: d = up(10, y, 42, 70); break;
          case 11: d = across(11, x, 21, 86) + up(11, y, 0, 3); break;
          case 12: d = 9 + Math.min(32, Math.abs(x - G.hc) / GW * 70) + 4 * j; break;
          case 13: d = 56 + 48 * j; break;
          case 14: d = 6 + 14 * j; break;
          case 15: d = 14; break;
          default: d = (w.tags.prevM[i] === 11 || w.tags.prevM[i] === 12) ? 9 + Math.min(32, Math.abs(x - G.hc) / GW * 70) + 4 * j : 6;
        }
        dates[i] = clamp(Math.round(d), 0, 120);
      }
    }

    /* ---- The script, tick by tick ---- */

    const S = { rain: 0, seep: 0, machine: 0, dug: 0, shaft: 0, clay: 0, turf: 0, frozen: false, home: false, bed: false };
    let lastBed = 0;

    function rainAt(t) {
      if (t < T_RAIN) return 0;
      if (t < T_ONE0) return 0.5 * lin(T_RAIN, beat(16), t) + 0.5 * lin(beat(16), T_ONE0, t);
      if (t < beat(23)) return 1;
      if (t < T_DRY) return 1 - lin(beat(23), T_DRY, t);
      return 0;
    }
    function seepAt(t) {
      if (t >= T_LOW && t < beat(33.5)) return 9;
      if (t >= beat(43) && t < T_LAPSE) return 4;
      return 0;
    }
    /* The water under the beds comes over into the stair: as the drops raise it, and again when the wheel is ready. */
    function spillAt(t) {
      if (t >= beat(30) && t < beat(34.5)) return 24;
      if (t >= beat(43.6) && t < T_LAPSE) return 3;
      return 0;
    }
    /* While the days pass, the ground runs this many times as fast. */
    function speedAt(t) { return t >= beat(30.5) && t < T_CAVE + 0.2 ? 4 : 1; }
    function machineAt(t) {
      if (t < beat(42.5)) return 0;
      if (t < beat(43.5)) return 1;
      if (t < T_POTS) return 2;
      if (t < beat(47.5)) return 3;
      return 4;
    }

    function tick() {
      n++;
      const t = n / 60;
      if (!alive) return;
      if (bg) { const r = bg.next(); if (r.done) bg = null; }
      if (t < T_LAPSE) {
        const ctl = W1.ctl;
        const r = rainAt(t);
        ctl.rain = r > 0 ? { i: r, x0: G.hc - 3 * G.hw, x1: G.hc + 3 * G.hw, rate: 9 } : null;
        ctl.seep = seepAt(t);
        ctl.spill = spillAt(t);
        ctl.machine = machineAt(t);
        ctl.hold = t < T_WHEEL;
        ctl.clouds = true;
        script(t);
        for (let k = speedAt(t); k > 0; k--) W1.update();
      } else if (!S.frozen) {
        S.frozen = true;
        W1.ctl.rain = null;
        W1.render();
      }
      if (t >= T_LAPSE && W1P) {
        W1P.ctl.flies = t >= beat(59.5);
        W1P.ctl.stars = t >= beat(61.5);
        W1P.ctl.lights = smooth(T_GOLD, T_DUSK, t);
        if (!S.home && t >= T_HOME) { S.home = true; W1P.ctl.creature = true; }
        if (t < T_PULLED) W1P.update();
      }
    }

    /* Scripted changes to the ground, each at its tick. */
    function script(t) {
      const w = W1, mat = w.mat, col = w.col;
      /* The hollow, dug top down; what comes out is thrown onto the rims. */
      const dug = Math.floor(hollow.length * smooth(T_DIG, T_DUG, t));
      for (; S.dug < dug; S.dug++) {
        const i = hollow[S.dug];
        w.restore(i);
        mat[i] = 0; col[i] = 0;
        if (S.dug % 9 === 0) {
          const x = (i % w.W) - 1, side = S.dug % 18 === 0 ? -1 : 1;
          const rx = G.hc + side * (G.hw + 3 + (S.dug % 7)), ry = surfY[clamp(rx, 0, G.GW - 1)] - 3;
          const j = idx1(clamp(rx, 0, G.GW - 1), Math.max(1, ry));
          if (mat[j] === 0) { mat[j] = 27; col[j] = SILTC[x & 3]; w.aux[j] = 120; }
        }
      }
      /* The ground it pats down round the bowl holds what falls in: the bed takes no water. */
      if (S.dug >= hollow.length && !S.bed) { S.bed = true; for (const i of bedCells) if (mat[i] === 10) mat[i] = 2; }
      /* The branch is lifted (it is carried under the bead, then laid across: see overlays). */
      if (t >= beat(13.5) && branchCells.length && mat[branchCells[0]] === 4) for (const i of branchCells) { mat[i] = 0; col[i] = 0; }
      /* Under standing water, the bed turns to clay. */
      if (t >= T_CLAY && S.clay < bedCells.length) {
        const k = Math.min(bedCells.length, S.clay + 5);
        for (; S.clay < k; S.clay++) { const i = bedCells[S.clay]; if (mat[i] === 2) col[i] = CLAYC[(i * 7 + (i >> 5)) & 3]; }
      }
      /* The seed comes up where the damp reached it. */
      if (t >= T_SPROUT && t < T_SPROUT + 1 / 60 + 1e-9) sprout(0);
      if (t >= beat(26) && t < beat(26) + 1 / 60 + 1e-9) sprout(1);
      /* Turf comes back where the ground is damp. */
      if (t >= T_SPROUT && (n & 3) === 0) {
        const near = t < T_BED ? 1 : 2;
        for (let k = 0; k < turfCells.length; k++) {
          const i = turfCells[k];
          if (mat[i] !== 10) continue;
          const x = (i % w.W) - 1;
          const damp = w.wet[i] > 40 || w.wet[i + w.W] > 40;
          const byBed = near === 2 && G.bed && x >= G.bed.x0 - 30 && x <= G.bed.x1 + 10;
          if ((damp && hash(x, i, 5) < 0.08) || (byBed && hash(x, n, 6) < 0.05)) { mat[i] = 11; col[i] = w.tags.prevC[i]; }
        }
      }
      /* The shaft, dug down as the bead goes down. */
      const sh = Math.floor(shaftCells.length * smooth(T_SHAFT, T_BREAK, t));
      for (; S.shaft < sh; S.shaft++) w.restore(shaftCells[S.shaft]);
      /* The first terrace and its cabbages. */
      if (t >= beat(50.5) && t < beat(50.5) + 1 / 60 + 1e-9 && G.bed) {
        for (let i = 0; i < w.N; i++) {
          if (w.tags.part[i] !== 11) continue;
          const x = (i % w.W) - 1;
          if (x < G.hover.x - 50 || x > G.hover.x + 16) continue;
          if (w.tags.prevM[i] === 6) continue;
          w.restore(i);
        }
      }
    }
    function sprout(k) {
      const w = W1, x = G.sap, y = surfY[x] - 1;
      const put = (dx, dy, m, c) => { const i = idx1(x + dx, y + dy); if (w.mat[i] === 0) { w.mat[i] = m; w.col[i] = c; } };
      put(0, 0, 15, LEAF[1]);
      if (k) { put(0, -1, 15, LEAF[1]); put(-1, -2, 16, LEAF[2]); put(1, -2, 16, LEAF[2]); }
    }

    function reset(s) {
      seed = s || 1;
      n = 0;
      Object.keys(S).forEach((k) => { S[k] = typeof S[k] === 'boolean' ? false : 0; });
      if (!alive) return;
      finish(makeW1(W1.GW, W1.GH));
      W1P = null;
      if (!WF) bg = later();
      else bg = (function* () {
        const p = yield* build(U_1, { tags: true }, W1.GW, W1.GH);
        for (let k = 0; k < SETTLE; k += 10) { p.settle(10); yield; }
        p.begin(FIXED);
        p.ctl.creature = false; p.ctl.stars = false; p.ctl.lights = 0; p.ctl.flies = false;
        W1P = p;
      })();
    }

    /* ---- The creature: where, and how ---- */

    /* Its grid's top left in the film's world, and its pose. Keyed: time, x, y (both as offsets from places), pose. */
    function you(t) {
      const g = G || { hc: 210, hw: 24, sap: 354, sb: 126, hover: { x: 504, y: 109 }, well: { ropeX: 463, ringTop: 115 }, hub: [413, 260] };
      const air = (x) => (surfY ? surfY[clamp(Math.round(x), 0, surfY.length - 1)] : g.sb) - 14;
      const keys = [
        [0, g.hc + 28, air(g.hc + 34), 'idle'], [T_SEED, g.hc + 28, air(g.hc + 34), 'look'],
        [T_LAND - 0.3, g.sap - 4, air(g.sap) - 2, 'move'], [T_PLANT, g.sap - 4, air(g.sap) + 2, 'plant'],
        [beat(7), g.sap - 4, air(g.sap), 'idle'], [T_GLIDE, g.hc - 6, air(g.hc) - 4, 'move'],
        [T_DIG, g.hc - 6, air(g.hc) - 2, 'dig'], [T_DUG, g.hc - 6, air(g.hc) - 2, 'look'],
        [T_BRANCH, g.branch ? g.branch[0] + 8 : g.hc + 60, air(g.hc + 60) - 2, 'move'], [beat(13.5), g.branch ? g.branch[0] + 8 : g.hc + 60, air(g.hc + 60) - 2, 'carry'],
        [T_LAY, g.hc - 6, air(g.hc) - 8, 'carry'], [beat(15), g.hc + g.hw + 8, air(g.hc + g.hw + 10), 'idle'],
        [T_CLAY, g.hc + g.hw + 8, air(g.hc + g.hw + 10), 'discover'], [beat(23), g.hc + g.hw + 8, air(g.hc + g.hw + 10), 'idle'],
        [T_SPROUT, g.sap - 16, air(g.sap - 10), 'look'], [beat(28), g.well.ropeX - 6, air(g.well.ropeX) - 4, 'move'],
        [T_SHAFT, g.well.ropeX - 6, air(g.well.ropeX) - 2, 'shaft'], [T_BREAK, g.well.ropeX - 6, air(g.well.ropeX) - 2, 'discover'],
        [T_IN0, g.well.ropeX - 6, air(g.well.ropeX) - 2, 'build'], [T_OUT, g.well.ropeX - 6, air(g.well.ropeX) - 2, 'build'],
        [T_LOOP, g.well.ropeX + 10, air(g.well.ropeX + 16) - 2, 'look'], [T_BED, g.hover.x - 20, g.hover.y + 1, 'plant'],
        [beat(51.5), g.hover.x - 20, g.hover.y, 'idle'], [beat(55), g.hover.x - 60, g.hover.y - 6, 'move'],
        [beat(58), g.hover.x - 10, g.hover.y - 2, 'look'], [T_HOME - 0.35, g.hover.x, g.hover.y, 'move'], [T_HOME, g.hover.x, g.hover.y, 'home']
      ];
      let k = 0;
      while (k + 1 < keys.length && t >= keys[k + 1][0]) k++;
      const a = keys[k], b = keys[k + 1] || a;
      const move = b !== a && (b[3] === 'move' || b[3] === 'carry' || a[3] === 'move');
      const u = move ? smooth(a[0], b[0], t) : 0;
      return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u, pose: a[3], dir: b[1] >= a[1] ? 1 : -1, t0: a[0] };
    }

    /* ---- The camera ---- */

    /* Where the picture is, for this time and size: a view ('C' the close-up, 'W' the film's world, 'F' Exhibit B),
       its top left in that view's grains, and maybe a second picture it is dissolving to. */
    function camAt(t, cols, rows) {
      const g = G || { hc: 210, hw: 24, sap: 354, sb: 126, hub: [413, 260], hover: { x: 504, y: 109 }, GW: 691, GH: 389, well: { ropeX: 463 } };
      const y1 = you(t), red = reel.reduced;
      const fitX = (cx, gw, focus, m) => {
        let x = Math.round(cx - cols / 2);
        if (focus !== undefined) x = clamp(x, Math.round(focus - cols + m), Math.round(focus - m));
        return gw >= cols ? clamp(x, 0, gw - cols) : Math.round((gw - cols) / 2);
      };
      const close = () => ({ v: 'C', x: fitX((g.hc + g.sap) + 40, g.GW * 2, 2 * y1.x + 12, 40), y: Math.round(2 * g.sb - rows * 0.46) });
      const wide = (low) => ({ v: 'W', x: fitX(346, g.GW, y1.x + 6, 30), y: Math.round(low * 58 + 36) });
      const tilt = (a, b, t0, t1) => red ? (t < (t0 + t1) / 2 ? a : b) : a + (b - a) * smooth(t0, t1, t);
      const push = () => ({ v: 'C', x: fitX(2 * g.hub[0] + 30, g.GW * 2), y: Math.round(2 * g.hub[1] - rows * 0.5) });
      const final = () => ({ v: 'F', x: cols >= 577 ? 0 : clamp(Math.round(376 - cols / 2), 0, 576 - cols), y: 0 });
      const mix = (a, b, t0, t1) => {
        const u = red ? (t >= t0 ? 1 : 0) : lin(t0, t1, t);
        if (u <= 0) return a;
        if (u >= 1) return b;
        a.to = b; a.a = u; return a;
      };
      if (t < T_ONE0) return close();
      if (t < T_ONE) return mix(close(), wide(0), T_ONE0, T_ONE);
      let low = t < T_TILT ? 0 : t < T_LAPSE ? tilt(0, 1, T_TILT, T_LOW) : tilt(1, 0, T_UP0, T_UP1);
      const w = wide(low);
      w.y = Math.round(36 + low * 58);
      if (t >= T_IN0 && t < T_IN) return mix(w, push(), T_IN0, T_IN);
      if (t >= T_IN && t < T_OUT0) return push();
      if (t >= T_OUT0 && t < T_OUT) return mix(push(), w, T_OUT0, T_OUT);
      if (t < T_PULL) return w;
      if (t < T_PULLED) return mix(w, final(), T_PULL, T_PULLED);
      return final();
    }

    /* ---- Words ---- */

    let v = null;
    const seen = { cols: 0, rows: 0 };
    function frame(t, cols, rows) {
      cols = cols || VW; rows = rows || VH;
      if (alive) { seen.cols = Math.max(seen.cols, cols); seen.rows = Math.max(seen.rows, rows); }
      v = {
        t, scene: t < T_ONE ? 'open' : t < T_PULL ? 'place' : 'end', mode: 'world',
        title: { left: 'silt', leftColor: '#c8bcae', right: 'concept render · time sped up', rightColor: AMBER },
        ticker: null, pane: null, caption: null, end: null, rows: [], labels: [], banners: [],
        cam: camAt(t, cols, rows)
      };
      v.cam.cols = cols; v.cam.rows = rows; v.cam.t = t;
      if (t < T_ENTER) {
        const typed = 'silt'.slice(0, Math.max(0, Math.floor((t - beat(0.5)) / (BEAT / 2)) + 1));
        v.labels.push({ x: 2, y: 3, text: '$ ' + typed + (Math.floor(t * 2.4) % 2 ? '' : '_'), color: FG, back: null, story: true, center: 0 });
      }
      if (t >= T_ENTER && t < T_PULLED) v.ticker = { left: 'day ' + dayAt(t, reel.reduced), leftColor: FG, right: '', rightColor: DIM };
      if (t >= T_ENTER && t < T_PULL + BEAT) {
        let one = '';
        if (t >= T_DRY && t < beat(27.5)) one = 'inspect · moisture';
        else if (t >= T_FLOW && t < T_FLOW1) one = 'inspect · flow';
        v.pane = { one, oneColor: LANTERN, two: '', twoColor: DIM, key: keyAt(t) };
      }
      for (let i = 0; i < CAPTIONS.length; i++) {
        const c = CAPTIONS[i];
        if (c[0] <= t && t < c[1]) {
          const fade = Math.min(1, (t - c[0]) / 0.25, (c[1] - t) / 0.25);
          v.caption = { text: c[2], fade, color: COLORS.cap, from: COLORS.band };
        }
      }
      if (t >= T_WORDS) v.end = { one: '', oneColor: BRIGHT, two: 'Concept render · in development · working title', twoColor: COLORS.endTwo };
      if (t >= T_TAG) {
        /* The tagline sits over the frame, on plain rock at its foot. */
        const cx = Math.round(cols / 2), y = Math.min(rows - 3, 276 - v.cam.y);
        v.labels.push({ x: cx, y, text: TAGLINE, color: BRIGHT, back: null, story: true, center: TAGLINE.length });
      }
      /* "you", over the creature, at the start and at the first wide moment. */
      if ((t >= T_UP && t < beat(4.5)) || (t >= T_ONE && t < beat(20.5))) {
        const p = toScreen(you(t), v.cam);
        if (p) v.labels.push({ x: Math.round(p[0]), y: Math.round(p[1]) - 2, text: 'you', color: LANTERN, back: BACK, story: true, center: 0 });
      }
      return v;
    }
    function keyAt(t) {
      if (t >= T_PLANT && t < beat(7.5)) return 'p';
      if (t >= T_DIG && t < T_DUG) return 'd';
      if (t >= T_BRANCH && t < T_RAIN) return 'b';
      if (t >= T_DRY && t < beat(27.5)) return 'i';
      if (t >= T_SHAFT && t < T_BREAK) return 'd';
      if (t >= T_IN0 && t < T_OUT0) return 'b';
      if (t >= beat(47) && t < T_LOOP) return 'b';
      if (t >= T_FLOW && t < T_FLOW1) return 'i';
      if (t >= T_BED && t < beat(51)) return 'p';
      if (t >= T_HOME && t < beat(61)) return 'p';
      if (t >= T_PULL && t < T_PULLED) return 'z';
      return null;
    }
    /* Where the creature's head is, in cells of this picture. */
    function toScreen(p, cam) {
      if (cam.v === 'C') return [2 * p.x - cam.x + 4, 2 * p.y - cam.y + 2];
      if (cam.v === 'W') return [p.x - cam.x + 2, p.y - cam.y + 1];
      return null;
    }

    /* ---- Painting ---- */

    let A = new Uint32Array(0), B = new Uint32Array(0);
    function paint(rgba, cols, rows, cam) {
      const out = new Uint32Array(rgba.buffer, rgba.byteOffset, cols * rows);
      const t = cam.t !== undefined ? cam.t : n / 60;
      if (!alive) { out.fill(pk(rgb('100d0b'))); return; }
      if (A.length < cols * rows) { A = new Uint32Array(cols * rows); B = new Uint32Array(cols * rows); }
      picture(A, cols, rows, cam, t);
      if (cam.to) {
        picture(B, cols, rows, cam.to, t);
        const th = cam.a * 16;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const o = y * cols + x;
          out[o] = BAYER[(y & 3) * 4 + (x & 3)] < th ? B[o] : A[o];
        }
      } else out.set(A.subarray(0, cols * rows));
      /* Up from black at the start. */
      if (t < T_UP) {
        const f = t < T_ENTER ? 0 : (Math.floor((t - T_ENTER) / ((T_UP - T_ENTER) / 4)) + 1) / 5;
        const bk = rgb('100d0b');
        for (let o = 0; o < cols * rows; o++) {
          const c = out[o];
          out[o] = pk([bk[0] + ((c & 255) - bk[0]) * f, bk[1] + (((c >> 8) & 255) - bk[1]) * f, bk[2] + (((c >> 16) & 255) - bk[2]) * f].map((q) => q | 0));
        }
      }
    }

    function blend(c, r, g, b, a) {
      const cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
      return (0xff000000 | (((cb + (b - cb) * a) | 0) << 16) | (((cg + (g - cg) * a) | 0) << 8) | ((cr + (r - cr) * a) | 0)) >>> 0;
    }

    /* One whole picture of a view, into dst. */
    function picture(dst, cols, rows, cam, t) {
      const view = cam.v;
      if (view === 'F' && WF) {
        copyFrom(dst, cols, rows, plate, WF.GW, WF.GH, cam.x, cam.y);
        rings(dst, cols, rows, cam, t);
        return;
      }
      const lapse = t >= T_LAPSE && W1P && dates;
      if (!S.frozen || !lapse) W1.render();
      if (lapse) { W1P.render(); }
      const day = lapse ? dayAt(t, reel.reduced) : 0;
      const w1 = W1.out, wp = lapse ? W1P.out : null;
      const src = (g) => (wp && dates[gIdx(g)] <= day ? wp[g] : w1[g]);
      const GW = W1.GW, GH = W1.GH;
      const sky = (lapse ? W1P : W1).sky, mat = (lapse ? W1P : W1).mat, wW = W1.W;
      const dn = dayness(t), rain = W1.ctl.rain ? W1.ctl.rain.i : 0;
      const top = mixc(DAY_SKY.top, GOLD_SKY.top, smooth(T_GOLD - BEAT, T_DUSK, t)), hor = mixc(DAY_SKY.hor, GOLD_SKY.hor, smooth(T_GOLD - BEAT, T_DUSK, t));
      const topR = mixc(top, RAIN_SKY.top, rain * 0.8), horR = mixc(hor, RAIN_SKY.hor, rain * 0.8);
      const lift = 1 + 0.1 * dn - 0.12 * rain;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let gx, gy, c, fine = -1;
          if (view === 'C') {
            const cx = cam.x + x, cy = cam.y + y;
            gx = cx >> 1; gy = cy >> 1;
            if (cx < 0 || cy < 0 || gx >= GW || gy >= GH) { dst[y * cols + x] = pk(rgb('100d0b')); continue; }
            const g = gy * GW + gx;
            c = w1[g];
            if (c === bareOut[g] && cx < WC.GW && cy < WC.GH) fine = cOut[cy * WC.GW + cx];
          } else {
            gx = cam.x + x; gy = cam.y + y;
            if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) { dst[y * cols + x] = pk(rgb('100d0b')); continue; }
            c = src(gy * GW + gx);
          }
          if (fine >= 0) c = fine;
          const i = (gy + 1) * wW + gx + 1;
          if (dn > 0 && mat[i] === 0 && sky[i] === 1 && (c === (lapse ? W1P : W1).base[i] || fine >= 0)) {
            /* Afternoon sky over Exhibit B's dusk. */
            const f = clamp(gy / Math.max(1, G.sb), 0, 1);
            const r = topR[0] + (horR[0] - topR[0]) * f, gg = topR[1] + (horR[1] - topR[1]) * f, b = topR[2] + (horR[2] - topR[2]) * f;
            const d = (BAYER[(gy & 3) * 4 + (gx & 3)] / 16 - 0.5) * 6;
            c = blend(c, r + d, gg + d, b + d, dn);
          } else if (dn > 0 && lift !== 1) {
            const k = 1 + (lift - 1) * dn;
            c = (0xff000000 | (Math.min(255, (((c >> 16) & 255) * (k - 0.02)) | 0) << 16) | (Math.min(255, (((c >> 8) & 255) * k) | 0) << 8) | Math.min(255, ((c & 255) * (k + 0.02)) | 0)) >>> 0;
          }
          dst[y * cols + x] = c;
        }
      }
      overlays(dst, cols, rows, cam, t);
    }
    function gIdx(g) { const GW = W1.GW; return ((g / GW) | 0) * W1.W + (g % GW) + W1.W + 1; }
    function mixc(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
    function copyFrom(dst, cols, rows, src, sw, sh, x0, y0) {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const sx = clamp(x0 + x, 0, sw - 1), sy = clamp(y0 + y, 0, sh - 1);
        dst[y * cols + x] = src[sy * sw + sx];
      }
    }

    /* What is drawn over the ground: the moisture and flow views, the birds, the seed, the creature, the close-up's wheel. */
    function overlays(dst, cols, rows, cam, t) {
      const k = cam.v === 'C' ? 2 : 1;
      const put = (gx, gy, c, a) => {
        const sx = Math.round(gx * k - cam.x), sy = Math.round(gy * k - cam.y);
        for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const o = y * cols + x;
          dst[o] = a === undefined ? c : blend(dst[o], c[0], c[1], c[2], a);
        }
      };
      const cell = (x, y, c) => { if (x >= 0 && y >= 0 && x < cols && y < rows) dst[y * cols + x] = c; };
      /* The moisture view: each grain of ground tinted by the water it holds, and the damp's way down to the stone and
         along it to the water under the beds. */
      const mo = t >= T_DRY && t < beat(27.5) ? Math.min(1, (t - T_DRY) / 0.3, (beat(27.5) - t) / 0.3) : 0;
      if (mo > 0 && cam.v === 'W') {
        const w = W1, GW = w.GW;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const gx = cam.x + x, gy = cam.y + y;
          if (gx < 0 || gy < 0 || gx >= GW || gy >= w.GH) continue;
          const i = (gy + 1) * w.W + gx + 1, m = w.mat[i];
          if (m === 0 || m === 22) continue;
          const wet = w.wet[i] / 255;
          let a = wet * 0.7;
          const p = seepAt2(gx, gy, t);
          if (p > a) a = p;
          if (a > 0.02) dst[y * cols + x] = blend(dst[y * cols + x], WET_C[0], WET_C[1], WET_C[2], a * mo);
        }
      }
      /* The flow view: the water's way round, traced in lantern light. */
      const fl = t >= T_FLOW && t < T_FLOW1 ? Math.min(1, (t - T_FLOW) / 0.3, (T_FLOW1 - t) / 0.3) : 0;
      if (fl > 0 && cam.v === 'W' && loopPath.length) {
        const off = Math.floor(t * 24);
        for (let q = 0; q < loopPath.length; q++) {
          if (((q + off) % 6) > 2) continue;
          const [gx, gy] = loopPath[q];
          cell(gx - cam.x, gy - cam.y, blend(dst[clamp(gy - cam.y, 0, rows - 1) * cols + clamp(gx - cam.x, 0, cols - 1)], FLOW_C[0], FLOW_C[1], FLOW_C[2], 0.85 * fl));
        }
      }
      /* The seed, drifting in and landing. */
      if (t >= T_SEED && t < T_PLANT + 0.2 && G) {
        const u = smooth(T_SEED, T_LAND, t);
        const sx = G.hc - 60 + (G.sap - G.hc + 60) * u, sy = (G.sb - 70) + (surfY[G.sap] - 1 - G.sb + 70) * u + Math.sin(u * 9) * 3 * (1 - u);
        put(sx, sy, SEEDC[1]); put(sx + 0.5, sy, SEEDC[0]);
      }
      /* The plank across the hollow, until the place grows its footbridge. */
      if (t >= T_LAY && t < T_LAPSE && G) plankCells.forEach(([x, y], q) => { put(x, y, WOOD[q % 5 === 0 ? 1 : 2]); if (q % 7 === 3) put(x, y + 1, WOOD[0]); });
      /* In close, the wheel at its own size: its niche, rim, spokes and paddles, turning with the water; the belt up to
         the drum; and the creature's line coming down the shaft to the work while it builds. */
      if (cam.v === 'C' && t >= T_IN0 && t < T_OUT && W1.geo.machine && W1.ctl.machine >= 1) {
        const m = W1.geo.machine, hx = 2 * m.hub[0] + 1 - cam.x, hy = 2 * m.hub[1] + 1 - cam.y, R = 2 * m.R + 1;
        const a = W1.machine ? W1.machine.angle : 0;
        const dark = pk(rgb('1f1d1c'));
        for (let y = -R - 3; y <= R + 3; y++) for (let x = -R - 3; x <= R + 3; x++) if (x * x + y * y <= (R + 2.5) * (R + 2.5)) cell(hx + x, hy + y, dark);
        if (W1.ctl.machine >= 2) {
          const dx = 2 * m.drum[0] + 1 - cam.x, dy = 2 * m.drum[1] + 1 - cam.y, nn = Math.max(Math.abs(dx - hx), Math.abs(dy - hy));
          for (let q = 0; q <= nn; q++) cell(Math.round(hx + (dx - hx) * q / nn), Math.round(hy + (dy - hy) * q / nn), ((q + Math.floor(a * R)) % 8) < 1 ? WOOD[2] : CPAL.s);
          for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) cell(dx + x, dy + y, (Math.abs(x) === 2 || Math.abs(y) === 2) ? WOOD[1] : WOOD[3]);
        }
        for (let s = 0; s < 6; s++) {
          const th = a + s * Math.PI / 3, c = Math.cos(th), si = Math.sin(th);
          for (let r = 1; r < R; r++) cell(Math.round(hx + c * r), Math.round(hy + si * r), WOOD[2]);
          for (let r = R; r <= R + 2; r++) for (let w = -1; w <= 1; w++) cell(Math.round(hx + c * r - si * w * 0.6), Math.round(hy + si * r + c * w * 0.6), WOOD[r === R + 2 ? 1 : 0]);
        }
        for (let s = 0; s < 12 * R; s++) { const th = s * Math.PI * 2 / (12 * R); cell(Math.round(hx + Math.cos(th) * R), Math.round(hy + Math.sin(th) * R), WOOD[3]); }
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) cell(hx + x, hy + y, x || y ? WOOD[1] : WOOD[3]);
        if (t < T_WHEEL) {
          /* The line, down the shaft and across to the hub, its bead at the work. */
          const sx = 2 * G.well.ropeX - cam.x, dy2 = 2 * m.drum[1] - cam.y;
          for (let y = 0; y <= dy2; y++) cell(sx, y, CPAL.s);
          const nn = Math.max(Math.abs(sx - hx), Math.abs(dy2 - hy));
          for (let q = 0; q <= nn; q++) cell(Math.round(sx + (hx - sx) * q / nn), Math.round(dy2 + (hy - dy2) * q / nn), CPAL.s);
          const bb = (Math.floor(t * 4) & 1) === 0 ? BEAD24B : BEAD24;
          for (let r = 0; r < bb.length; r++) for (let q = 0; q < bb[r].length; q++) if (bb[r][q] !== '.') cell(hx - 2 + q, hy - 6 + r, CPAL[bb[r][q]]);
        }
      }
      /* The branch, carried under the bead. */
      const y1 = you(t);
      if (y1.pose === 'carry' && G) {
        const len = G.branch[1] - G.branch[0];
        const bx = y1.x + 6 - len / 2, by = y1.y + 16;
        for (let q = 0; q <= len; q++) put(bx + q, by + (q > len * 0.8 ? 1 : 0), WOOD[q % 4 === 0 ? 1 : 2]);
      }
      /* Birds come to drink, and go. */
      if (cam.v === 'W' && G && t >= T_DRY && t < beat(30)) {
        for (let b = 0; b < 3; b++) {
          const t0 = T_DRY + b * 0.35, land = t0 + 1.0, go = beat(28.5) + b * 0.3;
          const tx = G.hc + G.hw + 4 + b * 7, ty = surfY[clamp(Math.round(G.hc + G.hw + 4 + b * 7), 0, G.GW - 1)] - 3;
          let x, y, f;
          if (t < t0) continue;
          if (t < land) { const u = smooth(t0, land, t); x = tx + (1 - u) * 220; y = ty - (1 - u) * 70; f = Math.floor(t * 8) & 1; }
          else if (t < go) { x = tx; y = ty; f = 1; }
          else { const u = smooth(go, go + 1.2, t); x = tx + u * 260; y = ty - u * 90; f = Math.floor(t * 8) & 1; }
          const sp = BIRD[f];
          for (let r = 0; r < sp.length; r++) for (let q = 0; q < sp[r].length; q++) {
            const ch = sp[r][q]; if (ch === '.') continue;
            put(x + q - 2, y + r, BIRD_C[ch]);
          }
        }
      }
      /* The creature. */
      if (!(t >= T_HOME && S.home) && G) drawYou(dst, cols, rows, cam, t, k, y1);
    }

    /* The way the water goes round, for the flow view: down the stair to the wheel, along the belt, up the pots, along
       the trough to the bed, and down through the ground to the water under the beds. */
    let loopPath = [];
    function makeLoop() {
      loopPath = [];
      if (!G || !W1.geo.machine) return;
      const m = W1.geo.machine;
      const seg = (a, b) => {
        const n2 = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        for (let q = 0; q <= n2; q++) loopPath.push([Math.round(a[0] + (b[0] - a[0]) * q / n2), Math.round(a[1] + (b[1] - a[1]) * q / n2)]);
      };
      const st = W1.geo.stair, lip = st && st.steps[0] ? [st.steps[0].xb, st.steps[0].water] : m.hub;
      seg([G.aq.x - 30, G.aqTop], lip); seg(lip, m.hub); seg(m.hub, m.drum);
      seg(m.drum, [m.shaft, G.well.ringTop - 2]);
      if (m.trough) { seg([m.shaft, G.well.ringTop - 2], [m.trough[0], m.trough[2]]); seg([m.trough[0], m.trough[2]], [m.trough[1], m.trough[2] + 2]); seg([m.trough[1], m.trough[2] + 2], [m.trough[1], G.aqTop - 6]); }
    }
    function seepAt2(gx, gy, t) {
      /* The damp's way: straight down from the hollow to the stone, then along the top of the stone to the water. */
      if (!G) return 0;
      const front = smooth(beat(24.5), beat(27), t);
      const x0 = G.hc, y0 = G.sb + 12, ys = G.sb + 100, x1 = G.aq.x - G.aq.rx * 0.6;
      if (Math.abs(gx - x0) <= 2 && gy >= y0 && gy <= y0 + (ys - y0) * Math.min(1, front * 2)) return 0.55;
      if (front > 0.5 && gy >= ys - 2 && gy <= ys + 1 && gx >= x0 && gx <= x0 + (x1 - x0) * (front - 0.5) * 2) return 0.55;
      return 0;
    }

    function drawYou(dst, cols, rows, cam, t, k, p) {
      const big = cam.v === 'C';
      const ph = Math.floor(t * 60) % 120, f = ph < 40 ? 0 : ph < 100 ? 1 : 2;
      const blink = (Math.floor(t * 60) % 330) < 6;
      let bowl, beadLen = 1, beadDx = 0, bright = false, hop = 0, lean = 0;
      switch (p.pose) {
        case 'plant': case 'dig': beadLen = 4 + (Math.floor(t * 6) & 1); beadDx = 1; break;
        case 'shaft': beadLen = 4; break;
        case 'build': beadLen = 3; beadDx = 1; bright = (Math.floor(t * 4) & 1) === 0; break;
        case 'discover': hop = t - p.t0 < 0.4 ? -1 : 0; bright = t - p.t0 < 0.8; break;
        case 'move': case 'carry': lean = p.dir; break;
        default: break;
      }
      if (reel.reduced) { hop = 0; }
      const lift = reel.reduced ? 0 : f === 1 ? -1 : 0;
      const ox = big ? 2 * p.x - cam.x : Math.round(p.x) - cam.x, oy = (big ? 2 * p.y - cam.y : Math.round(p.y) - cam.y) + (lift + hop) * (big ? 2 : 1);
      const rowsBowl = big ? BOWL24 : BOWL12;
      const draw = (sp, x0, y0) => {
        for (let r = 0; r < sp.length; r++) for (let q = 0; q < sp[r].length; q++) {
          let ch = sp[r][q]; if (ch === '.') continue;
          if (blink && (ch === 'k' || ch === 'g') && r < sp.length) ch = ch === 'g' ? 'p' : ch;
          const x = x0 + q, y = y0 + r;
          if (x >= 0 && y >= 0 && x < cols && y < rows) dst[y * cols + x] = CPAL[ch];
        }
      };
      if (big) {
        const bowl2 = p.pose === 'idle' || p.pose === 'look' ? C24.idle[f].slice(0, lineRow(C24.idle[f])) : rowsBowl;
        draw(bowl2, Math.round(ox), Math.round(oy));
        const tieX = Math.round(ox) + 12, tieY = Math.round(oy) + bowl2.length;
        const len = (p.pose === 'shaft' ? 2 : 1) + beadLen * 2;
        for (let q = 0; q < len; q++) { const x = tieX + (q >= 1 && beadDx ? beadDx : 0), y = tieY + q; if (x >= 0 && y >= 0 && x < cols && y < rows) dst[y * cols + x] = CPAL.s; }
        draw(bright ? BEAD24B : BEAD24, tieX - 2 + beadDx + 1, tieY + len);
      } else {
        const fr = p.pose === 'discover' && C12.discover12 ? C12.discover12[Math.min(2, Math.floor((t - p.t0) / 0.3))] :
          p.pose === 'move' || p.pose === 'carry' ? C12.lean12[p.dir > 0 ? 0 : 1] :
          p.pose === 'look' ? C12.inspect12[0] :
          p.pose === 'build' || p.pose === 'plant' || p.pose === 'dig' ? C12.construct12[Math.floor(t * 3) & 1] :
          blink ? C12.blink12 : C12.idle12[f];
        draw(fr, Math.round(ox), Math.round(oy));
        if (p.pose === 'shaft') {
          /* The bead goes down the shaft on its line, digging. */
          const tieX = Math.round(ox) + 7, tieY = Math.round(oy) + 8;
          const depth = Math.round(smooth(T_SHAFT, T_BREAK, t) * Math.max(0, G.well.bottom - (p.y + 8)));
          for (let q = 0; q < depth; q++) { const y = tieY + q; if (tieX >= 0 && y >= 0 && tieX < cols && y < rows) dst[y * cols + tieX] = CPAL.s; }
          draw(BEAD12B, tieX, tieY + depth);
        }
      }
    }

    /* The earlier views, nested, as the picture lands on Exhibit B: lantern outlines that fade. */
    function rings(dst, cols, rows, cam, t) {
      if (t < T_PULL || t >= T_CAP1) return;
      const a = 0.5 * (t < T_PULLED ? lin(T_PULL, T_PULLED, t) : 1) * (1 - lin(T_RINGS1, T_CAP1, t));
      if (a <= 0.01 || !G) return;
      const g = G;
      /* The close-up's frame and the 1:1's, in Exhibit B's grains. */
      const cw = (cam.cols || cols), ch = (cam.rows || rows);
      const close = { x: (((g.hc + g.sap) + 40 - cw / 2) / 2) / S1, y: (g.sb - ch * 0.23) / S1, w: cw / 2.4, h: ch / 2.4 };
      const wide = { x: (346 - cw / 2) / S1, y: 36 / S1, w: cw / S1, h: ch / S1 };
      [close, wide].forEach((r) => {
        const x0 = Math.round(r.x - cam.x), y0 = Math.round(r.y - cam.y), x1 = Math.round(r.x + r.w - cam.x), y1 = Math.round(r.y + r.h - cam.y);
        const edge = (x, y) => { if (x >= 0 && y >= 0 && x < cols && y < rows) { const o = y * cols + x; dst[o] = blend(dst[o], LANTERN_C[0], LANTERN_C[1], LANTERN_C[2], reel.reduced ? 0.5 : a); } };
        for (let x = x0; x <= x1; x++) { edge(x, y0); edge(x, y1); }
        for (let y = y0; y <= y1; y++) { edge(x0, y); edge(x1, y); }
      });
    }

    /* ---- The warm-up: how fast this device runs the busiest second, and paints ---- */
    function* warming(judge, size) {
      const cols = size ? size[0] : VW, rows = size ? size[1] : VH;
      const t0 = clock();
      W1.ctl.rain = { i: 1, x0: 0, x1: W1.GW, rate: 6 };
      for (let k = 0; k < 12; k++) { W1.update(); if ((k & 3) === 3) yield; }
      const per = (clock() - t0) / 12;
      W1.ctl.rain = null;
      const img = new Uint8ClampedArray(cols * rows * 4);
      const p0 = clock();
      paint(img, cols, rows, Object.assign(camAt(20, cols, rows), { t: 20 }));
      const pp = (clock() - p0) / (cols * rows);
      /* The busiest second runs the ground four times over (the stair, while the days pass). */
      reel.pace = { burst: per * 60 * 4, paint: pp };
      if (judge && !judge(reel.pace)) reel.slow = true;
    }

    if (alive) { initWC(); initW1(); makeLoop(); bg = later(); }

    /* Getters stay getters (Object.assign would copy their values once). */
    Object.defineProperties(reel, Object.getOwnPropertyDescriptors({
      tick, frame, paint, reset, warming,
      get t() { return n / 60; },
      get worlds() { return { W1, WC, W1P, WF }; },
      get G() { return G; },
      get you() { return you(n / 60); },
      get plate() { return plate; },
      get ready() { return !!(WF && W1P); },
      prepareAll() { while (bg) { const r = bg.next(); if (r.done) bg = null; } }
    }));
    return reel;
  }

  /* Everything the film starts with: the close-up's world and the film's own, bare. The rest is made as it plays. */
  function* everything(seed, slow, judge, size) {
    if (!Sand()) throw new Error('Exhibit B (sand.js) is not loaded');
    const WC = yield* build(U_C, { tags: true });
    WC.makeBare();
    yield;
    const W1 = yield* build(U_1, { tags: true }, size ? size[0] : 0, size ? size[1] : 0);
    W1.makeBare();
    W1.begin(seed);
    const reel = makeReel({ W1, WC }, seed, size);
    reel.warmed = !(slow && slow());
    if (reel.warmed) yield* reel.warming(judge, size);
    reel.reset(seed);
    return reel;
  }

  const SiltReel = {
    create(options) {
      const o = options || {};
      const r = finish(everything(o.seed || 1, null, null, o.size));
      if (o.all !== false) r.prepareAll();
      return r;
    },
    load(options) {
      const o = options || {}, slice = o.slice || 6;
      return new Promise((resolve, reject) => {
        let busy = 0, buildMs = -1, told = false;
        const gen = everything(o.seed || 1, () => { buildMs = busy; return busy > SLOW_BUILD; }, o.keeps, o.size);
        const chan = typeof MessageChannel === 'function' ? new MessageChannel() : null;
        const later = chan ? () => chan.port2.postMessage(0) : () => setTimeout(run, 0);
        if (chan) chan.port1.onmessage = run;
        function run() {
          if (o.stop && o.stop()) { if (chan) chan.port1.close(); return; }
          const start = Date.now(), end = start + slice;
          try {
            while (Date.now() < end) {
              const s = gen.next();
              if (s.done) {
                busy += Date.now() - start;
                if (chan) chan.port1.close();
                s.value.buildMs = buildMs;
                s.value.loadMs = busy;
                resolve(s.value);
                return;
              }
            }
          } catch (e) {
            if (chan) chan.port1.close();
            reject(e);
            return;
          }
          busy += Date.now() - start;
          if (!told && buildMs < 0 && o.onBusy && busy > o.busy) { told = true; o.onBusy(); }
          later();
        }
        run();
      });
    },
    words() { return makeReel(null, 1); },
    pickSeed(x) {
      let s = 1 + Math.floor(x * SEEDS) % SEEDS;
      while (LEFT_OUT.indexOf(s) >= 0) s = s % SEEDS + 1;
      return s;
    },
    VW, VH, Q, COLORS, KEYS, SLOW_BUILD, LEFT_OUT, SEEDS,
    T: {
      ENTER: T_ENTER, UP: T_UP, SEED: T_SEED, LAND: T_LAND, PLANT: T_PLANT, DIG: T_DIG, DUG: T_DUG, LAY: T_LAY,
      RAIN: T_RAIN, ONE0: T_ONE0, ONE: T_ONE, CLAY: T_CLAY, DRY: T_DRY, SPROUT: T_SPROUT, TILT: T_TILT, LOW: T_LOW,
      SPILL: T_SPILL, CAVE: T_CAVE, SHAFT: T_SHAFT, BREAK: T_BREAK, IN0: T_IN0, IN: T_IN, WHEEL: T_WHEEL,
      POTS: T_POTS, OUT: T_OUT, LOOP: T_LOOP, FLOW: T_FLOW, BED: T_BED, LAPSE: T_LAPSE, GOLD: T_GOLD, DUSK: T_DUSK,
      HOME: T_HOME, PULL: T_PULL, PULLED: T_PULLED, TAG: T_TAG, WORDS: T_WORDS, LOGO: T_PULL, LAST: T_LAST, END: T_END
    },
    beat, DAYS
  };

  if (typeof module === 'object' && module.exports) module.exports = SiltReel;
  else root.SiltReel = SiltReel;
})(typeof self !== 'undefined' ? self : this);
