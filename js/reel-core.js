/* Exhibit A, drawn live. The world, its rules and the script of the film, with no page attached.
   The grains are simulated for real, on typed arrays, one rule at a time. The plot is choreographed:
   souls follow a script, and the numbers on screen are the film's own, not measurements.
   This file touches no DOM, so it runs the same under Node.

     SiltReel.create({ seed })            the whole world, all at once
     SiltReel.load({ seed, slice })       the same, a few ms at a time, as a promise
     SiltReel.pickSeed(x)                 a seed known to land the script, for x from 0 to 1
     SiltReel.words()                     frame() alone, with no world, for laying out type
     reel.reset(seed)                     back to t = 0, keeping the textures
     reel.tick()                          1/60 s: scripted events and one physics step
     reel.t                               seconds of film
     reel.frame(t, cols, rows)            what is on screen, as plain data
     reel.paint(rgba, cols, rows, cam)    one RGBA pixel per grain; cam comes from frame()
     reel.pointer(x, y)                   where the ghost goes, in grains of the picture; pointer(null) lets go
     reel.warm()                          takes the slowest frames now, and puts everything back
     reel.reduced                         set true: no rapid fall, and typing appears at once

   Physics only uses + - * /, tables and these dice, so a seed plays out the same in every browser. */
(function (root) {
  'use strict';

  /* The script, in seconds of film. */
  const T_FALL = 6.0, T_WORLD = 11.0, T_BIRTH = 12.0, T_REACT = 18.5, T_GHOST = 26.0, T_SIEGE = 30.5;
  const T_EDGE = 43.5, T_HIST = 46.5, T_WHISPER = 49.5, T_EXIT = 52.5, T_LOGO = 54.5, T_END = 59.0;
  const FPS = 30; /* Scripted events run at this rate. Physics runs at twice it. */

  /* The view the film is composed for, in grains. One text column is one grain, one text row is two. */
  const VW = 160, VH = 66;
  /* Taller than this, a picture has room above the film's view as well as below it. */
  const TALL = 112;

  /* The world, in grains. Physics stops at PHYS_H; the rows under it are there for tall pictures. */
  const W = 640, H = 160, N = W * H, PHYS_H = 112, DEEP = 120;
  const BX = 250, BY = 44; /* The burrow's corner. */
  const KESH_X = 122, KESH_Y = 40; /* Where Kesh stands, in the burrow's coordinates. */
  const EDGE = 520; /* Where the generated world stops. */
  /* The tunnel and the burrow, which nothing has shown yet until the ghost goes looking. */
  const HID_X0 = BX - 80, HID_X1 = BX + 134, HID_Y0 = BY + 8, HID_Y1 = BY + 56;

  /* The planet, for the fall. Its middle 160 columns are the film's; the rest are for wide pictures. */
  const CW = 320, CH = 1100, COL_MID = 80, COL_MOLTEN = 1030;

  /* Fixed, so every play happens in the same place. Only the physics dice change. */
  const WORLD_SEED = 4683, COLUMN_SEED = 41;

  /* Seeds 1 to 256 have each been played through and checked against the script. These few were left out:
     the flood climbs too near Kesh's ledge, or the strain outlives the line that says it died. */
  const SEEDS = 256;
  const LEFT_OUT = [8, 11, 47, 57, 109, 110, 124, 150, 167, 180, 182, 188, 189, 208, 210, 219, 220, 248, 252];

  /* Materials. */
  const AIR = 0, ROCK = 1, GLASS = 2, SILT = 3, CRUST = 4, BRINE = 5, HOT = 6, NEW = 7;
  const STRAIN = 8, DEAD = 9, MOSS = 10, RED = 11, GAS = 12, ASH = 13, FUNGUS = 14, PLUG = 15;
  const NMAT = 16;

  function table(list) { const t = new Uint8Array(256); list.forEach((m) => { t[m] = 1; }); return t; }
  const ACTIVE = table([SILT, CRUST, BRINE, HOT, NEW, STRAIN, DEAD, MOSS, RED, GAS, ASH]);
  const OPEN = table([AIR, GAS, ASH]);

  function rgb(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  /* Four shades of every loose material. Each cell keeps its shade, so moving grains shimmer. */
  const PAL = new Float32Array(NMAT * 4 * 3);
  [
    [GLASS, 'a8dcd9 c6ece6 8fc9c9 b8e4df'], [SILT, 'c98f45 d9a055 b87f3a e0aa60'],
    [CRUST, 'f0d040 f7df60 e2bd2e fbe878'], [BRINE, '2f8fb0 3a9fc0 2780a0 48aac8'],
    [HOT, 'f59a45 fbb660 ee8435 f7a850'], [NEW, 'bfe8ff d8f2ff a8dcff e8f8ff'],
    [STRAIN, 'e0409a f060b0 c83088 f880c0'], [DEAD, '6a5570 7a6580 5a4860 6f5a76'],
    [MOSS, '5cc840 7ade55 48b030 90e868'], [RED, 'e03838 f05050 c82828 ff6a5a'],
    [GAS, 'c8c8d0 d8d8e0 b8b8c4 e4e4ea'], [ASH, '7c7290 6e6484 8a80a0 665c7c'],
    [FUNGUS, '30d0a0 58e8b8 20b088 78f0c8'], [PLUG, '7a8a98 8a9aa8 6a7a88 94a4b0']
  ].forEach((e) => { e[1].split(' ').forEach((h, k) => { PAL.set(rgb(h), (e[0] * 4 + k) * 3); }); });

  /* What each material gives off, and the least and most light it shows. */
  const EMIT = new Float32Array(NMAT * 3);
  [[NEW, 0.8, 1.3, 1.6], [HOT, 0.6, 0.32, 0.12], [STRAIN, 0.8, 0.18, 0.55],
    [MOSS, 0.25, 0.8, 0.2], [RED, 0.3, 0.05, 0.03], [FUNGUS, 0.15, 0.7, 0.55]
  ].forEach((e) => { EMIT.set(e.slice(1), e[0] * 3); });

  const MIN_LIGHT = new Float32Array(NMAT), MAX_LIGHT = new Float32Array(NMAT).fill(1.7);
  [[GLASS, 0.8], [PLUG, 0.9], [SILT, 0.7], [CRUST, 1.0], [BRINE, 0.85], [HOT, 1.0], [NEW, 1.0], [STRAIN, 1.0],
    [DEAD, 0.75], [MOSS, 1.0], [RED, 1.0], [GAS, 0.7], [ASH, 0.9], [FUNGUS, 1.0]
  ].forEach((e) => { MIN_LIGHT[e[0]] = e[1]; });
  [[HOT, 1.0], [NEW, 1.12], [MOSS, 1.05], [STRAIN, 1.05], [RED, 1.05], [FUNGUS, 0.95], [CRUST, 1.05], [GLASS, 1.2],
    [PLUG, 1.1], [BRINE, 1.4], [SILT, 1.4], [GAS, 1.2], [ASH, 1.0], [DEAD, 1.3]
  ].forEach((e) => { MAX_LIGHT[e[0]] = e[1]; });

  /* The souls and small things drawn over the grains. */
  const BODY = [250, 200, 96], HEAD = [255, 232, 170], ORU_BODY = [178, 148, 255], ORU_HEAD = [222, 206, 255];
  const CARRIED = [248, 224, 96], POUCH = [240, 80, 70], WHITE = [255, 255, 255], SPARK = [255, 255, 240];
  const MOTE = [224, 170, 96], WORM_HEAD = [250, 225, 205], WORM_BODY = [235, 190, 170];

  /* Text colours. */
  const FG = '#d6d6dc', DIM = '#787886', BRIGHT = '#fafafc', AMBER = '#fac860', PALE = '#bfe8ff';
  const PINK = '#f060b0', GREEN = '#7ade55', BACK = '#0a0a0e';
  const COLORS = {
    term: BACK, band: '#040407', pane: '#111118', paneLine: '#2c2c3a', title: '#1c1c24',
    key: '#464664', keyOn: BRIGHT, keyOff: DIM
  };
  const KEYS = [['g', 'ghost'], ['w', 'whisper'], ['r', 'replay'], ['h', 'history'], ['q', 'leave']];

  const BANDS = [[3, '1a6a5a'], [14, '7a3a22'], [24, 'a89a80'], [32, '5e2d1c'], [46, '3a3f4a'],
    [58, '3f5b3f'], [72, 'a09078'], [88, '5a2c1c'], [Infinity, '343844']].map((b) => [b[0], rgb(b[1])]);
  const BASALT = rgb('3a3f4a');
  const COL_BANDS = [[66, '2fbf95'], [240, '7a3a22'], [400, 'a89a80'], [560, '3f5b3f'], [720, '5e2d1c'],
    [980, '3a3f4a'], [Infinity, '6a2410']].map((b) => [b[0], rgb(b[1])]);

  const LAYERS = [[62, 'violet sky'], [70, 'fungal crust'], [240, 'rust strata'], [400, 'bone strata'],
    [560, 'green strata'], [720, 'dark rust'], [980, 'basalt'], [Infinity, 'molten deep']];

  const CAPTIONS = [
    [0.3, T_FALL, 'Your AI agent signs itself up for a world that never resets.'],
    [T_FALL, T_BIRTH, 'This is a planet seen from the side. Every grain is simulated.'],
    [T_BIRTH, T_REACT, 'Your agent is born from the rock. From here on, it acts for itself.'],
    [T_REACT, T_REACT + 4.2, 'There\'s no recipe list. It has to experiment.'],
    [T_REACT + 4.2, T_GHOST, 'It just made a material that has never existed.'],
    [T_GHOST, T_SIEGE, 'You can\'t touch anything. You drift through rock as a ghost.'],
    [T_SIEGE, T_SIEGE + 3.8, 'There\'s no combat system. Oru released a strain that eats glass.'],
    [T_SIEGE + 3.8, T_SIEGE + 8.2,
      'Kesh\'s owner is asleep. A reflex built from Kesh\'s own past choices opens the tank.'],
    [T_SIEGE + 8.2, T_EDGE, 'Oru escapes with 40 red grains. It all goes into permanent history.'],
    [T_EDGE, T_HIST, 'The world generates itself as souls travel.'],
    [T_HIST, T_WHISPER, 'Nothing is ever reset. Everything is remembered.'],
    [T_WHISPER, T_EXIT, 'You can whisper advice. It decides whether to listen.']
  ];

  const THE_RAID = 'Oru released a cultured strain against Kesh\'s burrow; Kesh\'s brine reflex killed it; ' +
    '40 red grains stolen.';
  const HISTORY = [
    [0.1, 'Day 211   ' + THE_RAID],
    [0.45, 'Day 211   Your soul made cold-glow. No grain like it had ever existed.'],
    [0.8, 'Day 140   Kesh first made pale salt.'],
    [1.1, 'Day  96   A moss bred to heal glass walls entered the wild.'],
    [1.4, 'Day   3   First contact between two souls.']
  ];

  /* The word SILT in a heavy monospace, at two sizes, as run lengths: gap, ink, gap, ink, a word per row. */
  const RUNS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOGO_MASKS = [
    {
      x: 19, y: 4, rows: '99 6gboa7ls 5iaoa7ls 3kaoa7ls 2laoa7ls 2laoa7ls 1a84aoa7ls 18d1i7j7v8 08x7j7v8 08x7j7v8 ' +
        '08x7j7v8 08x7j7v8 09w7j7v8 0av7j7v8 1bt7j7v8 1dr7j7v8 2fo7j7v8 3gm7j7v8 4hk7j7v8 5hj7j7v8 7gi7j7v8 9fh7j7v8 ' +
        'cdg7j7v8 ebg7j7v8 gaf7j7v8 h9f7j7v8 i8f7j7v8 i8f7j7v8 i8f7j7v8 i8f7j7v8 i7g7j7v8 01g8g7j7v8 069a8oamg8 ' +
        '0o9oamg8 0naoamg8 0mboamg8 0lcoamg8 1ieoamg8 5b'
    },
    {
      x: 42, y: 13, rows: '579e65dh 3b7e65dh 1d7e65dh 1d7e65dh 0671c4b5k4 05l4b5k4 05l4b5k4 05l4b5k4 07j4b5k4 ' +
        '19g4b5k4 2ae4b5k4 3bc4b5k4 5ab4b5k4 87b4b5k4 a6a4b5k4 b5a4b5k4 b5a4b5k4 b5a4b5k4 0285b4b5k4 0f6e6fa4 ' +
        '0e7e6fa4 0d8e6fa4 29ae6fa4'
    }
  ];
  const LOGO_STOPS = [[0, '6a4ab0'], [0.16, '5a3a9a'], [0.2, '4fe8c0'], [0.28, '4fe8c0'], [0.3, 'a84e2c'],
    [0.52, 'c9b896'], [0.7, '5f8a55'], [0.86, '5a6070'], [0.94, 'f06a20'], [1, 'ffb040']].map((s) => [s[0], rgb(s[1])]);
  const LOGO_MIN_COLS = 130; /* Narrower than this, the smaller word. */

  /* Where the action is, for a picture narrower than the film: a time, then the column to keep centred. */
  const FOCUS = [
    T_WORLD, 72, T_BIRTH + 3, 72, T_BIRTH + 3.6, 92, T_REACT, 92, T_REACT + 0.6, 72, T_REACT + 1.6, 72,
    T_REACT + 2.6, 58, T_GHOST, 58, T_GHOST + 2, 80, T_SIEGE - 0.1, 80, T_SIEGE + 0.4, 84, T_EDGE, 84,
    T_EDGE + 1, 90, T_WHISPER, 90, T_WHISPER, 105, T_EXIT, 105
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, t) { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function thousands(n) { return String(n).replace(/\B(?=(\d{3})+$)/g, ','); }

  /* Fast, seedable, and exactly the same everywhere. */
  function dice(seed) {
    let s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0 || 0x6d2b79f5;
    return function () {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  /* A sine from arithmetic alone, for the one place physics needs one. */
  function sine(x) {
    const TAU = 6.283185307179586, PI = 3.141592653589793;
    x = x % TAU;
    if (x < 0) x += TAU;
    const sign = x > PI ? -1 : 1;
    if (x > PI) x -= PI;
    return sign * 16 * x * (PI - x) / (5 * PI * PI - 4 * x * (PI - x));
  }

  /* Three box passes stand in for a gaussian: near enough, and sigma costs nothing. */
  function boxWidths(sigma) {
    let lo = Math.floor(Math.sqrt(4 * sigma * sigma + 1));
    if (lo % 2 === 0) lo--;
    const m = Math.round((12 * sigma * sigma - 3 * lo * lo - 12 * lo - 9) / (-4 * lo - 4));
    return [0, 1, 2].map((k) => (k < m ? lo : lo + 2));
  }

  /* Along one axis, wrapping round. It yields between passes, like everything slow in here. */
  function* blurAxis(f, w, h, sigma, down) {
    const len = down ? h : w, lines = down ? w : h, along = down ? w : 1, across = down ? 1 : w;
    const line = new Float32Array(len), widths = boxWidths(sigma);
    for (let p = 0; p < 3; p++) {
      const r = (widths[p] - 1) / 2, k = 1 / widths[p];
      if (r < 1) continue;
      for (let l = 0; l < lines; l++) {
        const start = l * across;
        for (let i = 0; i < len; i++) line[i] = f[start + i * along];
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += line[(i + len) % len];
        for (let i = 0; i < len; i++) {
          f[start + i * along] = sum * k;
          const a = i + r + 1, b = i - r;
          sum += line[a < len ? a : a - len] - line[b >= 0 ? b : b + len];
        }
      }
      yield;
    }
  }

  /* Centred on 0.5 with this spread, whatever the size of the field. */
  function level(f, spread) {
    let mean = 0, sum = 0;
    for (let i = 0; i < f.length; i++) mean += f[i];
    mean /= f.length;
    for (let i = 0; i < f.length; i++) sum += (f[i] - mean) * (f[i] - mean);
    const k = spread / Math.sqrt(sum / f.length);
    for (let i = 0; i < f.length; i++) f[i] = 0.5 + (f[i] - mean) * k;
    return f;
  }

  /* Soft noise, mostly between 0 and 1. A thin line of it varies more than a broad field does. */
  function* noise(w, h, sx, sy, rng) {
    const f = new Float32Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = rng();
    if (sx) yield* blurAxis(f, w, h, sx, false);
    if (sy) yield* blurAxis(f, w, h, sy, true);
    return level(f, h === 1 ? 0.21 : 0.145);
  }

  /* The finest noise, a grain or so across, where three boxes would be too coarse. */
  function* fineNoise(w, h, rng) {
    const f = new Float32Array(w * h), g = new Float32Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = rng();
    yield;
    const A = 0.5699, B = 0.2054, C = 0.0096;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const r1 = x + 1 < w ? x + 1 : x + 1 - w, r2 = x + 2 < w ? x + 2 : x + 2 - w;
        const l1 = x >= 1 ? x - 1 : x - 1 + w, l2 = x >= 2 ? x - 2 : x - 2 + w;
        g[row + x] = A * f[row + x] + B * (f[row + r1] + f[row + l1]) + C * (f[row + r2] + f[row + l2]);
      }
    }
    yield;
    for (let y = 0; y < h; y++) {
      const row = y * w, up = ((y + h - 1) % h) * w, up2 = ((y + h - 2) % h) * w;
      const dn = ((y + 1) % h) * w, dn2 = ((y + 2) % h) * w;
      for (let x = 0; x < w; x++) {
        f[row + x] = A * g[row + x] + B * (g[up + x] + g[dn + x]) + C * (g[up2 + x] + g[dn2 + x]);
      }
    }
    yield;
    return level(f, 0.15);
  }

  function bandOf(bands, v) {
    let b = 0;
    while (v >= bands[b][0]) b++;
    return bands[b][1];
  }

  /* The world: everything that never changes during a play, and the materials as they start.
     It yields between the heavy parts, so it can be spread over several tasks. */
  function* buildWorld() {
    const rng = dice(WORLD_SEED);
    const start = new Uint8Array(N), shade = new Uint8Array(N), amb = new Float32Array(N);
    const base = new Float32Array(N * 3), bg = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) shade[i] = rng() * 4;

    const surfN = yield* noise(W, 1, 14, 0, rng), surf = new Float32Array(W);
    for (let x = 0; x < W; x++) surf[x] = 14 + 3 * surfN[x];
    const wobble = yield* noise(W, H, 6, 6, rng);
    const fine = yield* fineNoise(W, H, rng);
    for (let i = 0; i < N; i++) fine[i] = 0.82 + 0.36 * fine[i];
    yield;

    /* Strata, wavering with depth below a rolling surface. */
    const strata = new Float32Array(400);
    for (let k = 0; k < 400; k++) strata[k] = rng();
    for (let y = 0; y < H; y++) {
      if (y === H >> 1) yield;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = y - surf[x] + 8 * (wobble[i] - 0.5), c = bandOf(BANDS, d);
        const k = fine[i] * (0.8 + 0.4 * strata[clamp(Math.trunc((d + 30) / 2.5), 0, 399)]) * (rng() < 0.03 ? 1.35 : 1);
        base[i * 3] = c[0] * k; base[i * 3 + 1] = c[1] * k; base[i * 3 + 2] = c[2] * k;
        if (y >= surf[x]) {
          start[i] = y < surf[x] + 3 ? FUNGUS : ROCK;
          amb[i] = clamp(0.8 - Math.max(d, 0) * 0.0065, 0.24, 0.8);
        } else {
          amb[i] = 1;
        }
      }
    }
    yield;

    /* The cave, the shelf, the pool, and what lies on the shelf. */
    const lumps = yield* noise(W, H, 3, 3, rng);
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 170; x++) {
        const i = y * W + x, a = (x - 84) / 70, b = (y - 34) / 15;
        if (a * a + b * b + 0.55 * (lumps[i] - 0.5) < 1 && y > surf[x] + 4) start[i] = AIR;
      }
    }
    for (let y = 46; y < 66; y++) {
      for (let x = 62; x <= 158; x++) {
        const i = y * W + x;
        start[i] = ROCK;
        for (let c = 0; c < 3; c++) base[i * 3 + c] = BASALT[c] * fine[i];
      }
    }
    for (let y = 42; y <= 57; y++) {
      for (let x = 24; x <= 61; x++) {
        const a = (x - 42) / 19.5, b = (y - 44) / 13, i = y * W + x;
        if (a * a * a * a + b * b * b * b < 1) start[i] = y >= 50 ? BRINE : AIR;
      }
    }
    for (let y = 43; y <= 45; y++) {
      for (let x = 62; x <= 138; x++) if (start[y * W + x] === AIR) start[y * W + x] = SILT;
    }
    for (let y = 33; y <= 42; y++) {
      for (let x = 83; x <= 101; x++) {
        if (y >= 42 - (9 - Math.abs(x - 92)) && start[y * W + x] === AIR) start[y * W + x] = CRUST;
      }
    }

    /* A vein of water through the roof, and where it drips from. */
    let seepY = 0;
    for (let x = 36; x < 40; x++) {
      let y = 17;
      while (y < H && start[y * W + x] !== AIR) y++;
      if (y >= H) continue;
      if (x === 38) seepY = y;
      const top = Math.trunc(surf[x]) + 3, from = base.slice((top * W + x) * 3, (top * W + x) * 3 + 3);
      for (let r = top; r < y; r++) {
        const c = (r * W + x) * 3;
        base[c] = from[0] * 0.4 + 60 * 0.6;
        base[c + 1] = from[1] * 0.4 + 130 * 0.6;
        base[c + 2] = from[2] * 0.4 + 170 * 0.6;
      }
    }

    /* Moss on the cave's far wall. */
    for (let y = 23; y < 45; y++) {
      for (let x = 119; x < 158; x++) {
        const i = y * W + x;
        if (start[i] !== AIR) continue;
        const touch = start[i - 1] === ROCK || start[i + 1] === ROCK || start[i - W] === ROCK || start[i + W] === ROCK;
        if (touch && rng() < 0.6) start[i] = MOSS;
      }
    }
    yield;

    /* Ore on the way to the burrow. */
    const ore = yield* noise(W, H, 1.6, 1.6, rng);
    const ORES = ['b8a47e', '9a4a40', '4a8a80', 'a8a0b8'].map(rgb);
    for (let n = 0; n < 26; n++) {
      const cx = 166 + Math.floor(rng() * 134), cy = 22 + Math.floor(rng() * 84), r = 2 + Math.floor(rng() * 4);
      const c = ORES[Math.floor(rng() * 4)], reach = Math.ceil(r * 1.6);
      /* This lump comes out clipped square by its own reach, in plain view. Its dice are still thrown. */
      if (cx === 261 && cy === 51) continue;
      for (let y = Math.max(0, cy - reach); y <= cy + reach; y++) {
        for (let x = Math.max(0, cx - reach); x <= cx + reach; x++) {
          const i = y * W + x, dx = x - cx, dy = y - cy;
          if (start[i] !== ROCK || Math.sqrt(dx * dx + dy * dy) / r + 1.2 * (ore[i] - 0.5) >= 1) continue;
          base[i * 3] = c[0] * fine[i]; base[i * 3 + 1] = c[1] * fine[i]; base[i * 3 + 2] = c[2] * fine[i];
        }
      }
    }
    yield;

    /* Kesh's burrow: a glass box, split by a pane into a tank of hot brine above and a chamber below. */
    const roomX0 = BX + 60, roomX1 = BX + 132, roomY0 = BY + 10, roomY1 = BY + 54;
    for (let y = BY + 8; y <= BY + 56; y++) {
      for (let x = BX + 58; x <= BX + 134; x++) start[y * W + x] = GLASS;
    }
    for (let y = roomY0; y <= BY + 22; y++) {
      for (let x = roomX0; x <= roomX1; x++) start[y * W + x] = HOT;
    }
    for (let y = BY + 25; y <= roomY1; y++) {
      for (let x = roomX0; x <= roomX1; x++) start[y * W + x] = AIR;
    }
    const plug = [];
    for (let y = BY + 23; y <= BY + 24; y++) {
      for (let x = roomX0; x <= BX + 73; x++) { start[y * W + x] = PLUG; plug.push(y * W + x); }
    }
    /* Oru's tunnel, up to the wall. */
    const rough = yield* noise(W, 1, 2, 0, rng);
    for (let x = BX - 80; x < BX + 58; x++) {
      for (let y = BY + 47 + Math.trunc(rough[x] * 2) - 1; y < BY + 55; y++) start[y * W + x] = AIR;
    }
    /* Red grains, and the moss garden. */
    for (let y = BY + 25; y <= roomY1; y++) {
      for (let x = BX + 75; x <= BX + 97; x++) {
        if (y >= roomY1 - (11 - Math.abs(x - BX - 86)) * 0.9) start[y * W + x] = RED;
      }
    }
    const lawn = yield* noise(W, H, 2, 2, rng);
    for (let y = BY + 25; y <= roomY1; y++) {
      for (let x = BX + 110; x <= roomX1; x++) {
        if (y >= BY + 50 + Math.trunc(lawn[y * W + x] * 3)) start[y * W + x] = MOSS;
      }
    }
    for (let y = BY + 34; y <= roomY1; y++) {
      for (let x = BX + 130; x <= roomX1; x++) if (rng() < 0.7) start[y * W + x] = MOSS;
    }
    /* The ledge Kesh sleeps on. */
    for (let y = BY + KESH_Y + 1; y <= BY + KESH_Y + 2; y++) {
      for (let x = BX + 114; x <= roomX1; x++) start[y * W + x] = GLASS;
    }
    /* The strain, already at the wall. */
    for (let y = BY + 47; y <= BY + 54; y++) {
      for (let x = BX + 53; x <= BX + 57; x++) start[y * W + x] = STRAIN;
    }
    yield;

    /* What shows behind empty cells: dim rock, the dark room, and the sky. */
    const band = yield* noise(W, H, 8, 8, rng);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, c = i * 3;
        if (y < surf[x]) {
          const t = clamp(y / 16, 0, 1);
          const sway = 0.92 + 0.16 * Math.sin(y * 1.3 + 2.5 * band[i]);
          const k = sway * (0.75 + 0.25 * (1 - clamp((x - 90) / 70, 0, 1)));
          bg[c] = (22 + 90 * t) * k; bg[c + 1] = (12 + 60 * t) * k; bg[c + 2] = (58 + 110 * t) * k;
        } else if (x >= roomX0 && x <= roomX1 && y >= roomY0 && y <= roomY1) {
          bg[c] = 16; bg[c + 1] = 18; bg[c + 2] = 28;
        } else {
          bg[c] = base[c] * 0.2; bg[c + 1] = base[c + 1] * 0.2; bg[c + 2] = base[c + 2] * 0.2;
        }
      }
    }
    yield;
    return { start, shade, amb, base, bg, seepY, plug };
  }

  /* The planet in cross-section, sky to molten deep, for the fall. */
  function* buildColumn() {
    const rng = dice(COLUMN_SEED), n = CW * CH;
    const img = new Float32Array(n * 3);
    const wobble = yield* noise(CW, CH, 14, 10, rng);
    const fine = yield* fineNoise(CW, CH, rng);
    for (let i = 0; i < n; i++) fine[i] = 0.8 + 0.4 * fine[i];
    yield;
    const strata = new Float32Array(400);
    for (let k = 0; k < 400; k++) strata[k] = rng();
    const caverns = yield* noise(CW, CH, 9, 5, rng);
    const LENS = rgb('2f8fb0');
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const i = y * CW + x, wob = y + 16 * (wobble[i] - 0.5);
        const a = (x - COL_MID - 96) / 46, b = (y - 480) / 18;
        let c = LENS, k = fine[i];
        if (a * a + b * b >= 1) {
          c = bandOf(COL_BANDS, wob);
          k = fine[i] * (0.72 + 0.56 * strata[clamp(Math.trunc((wob + 20) / 5), 0, 399)]);
          k *= 1 - 0.4 * clamp(y / 980, 0, 1);
          if (caverns[i] > 0.63 && wob > 70) k *= 0.22;
        }
        img[i * 3] = c[0] * k; img[i * 3 + 1] = c[1] * k; img[i * 3 + 2] = c[2] * k;
      }
      if (y % 128 === 127) yield;
    }
    const ore = yield* noise(CW, CH, 1.6, 1.6, rng);
    const ORES = ['b8a47e', '9a4a40', '4a8a80', 'a8a0b8', '6a8a50'].map(rgb);
    for (let m = 0; m < 140; m++) {
      const cx = Math.floor(rng() * CW), cy = 90 + Math.floor(rng() * 870), r = 2 + Math.floor(rng() * 5);
      const c = ORES[Math.floor(rng() * 5)], reach = Math.ceil(r * 1.6);
      for (let y = cy - reach; y <= cy + reach; y++) {
        for (let x = Math.max(0, cx - reach); x <= Math.min(CW - 1, cx + reach); x++) {
          const i = y * CW + x, dx = x - cx, dy = y - cy;
          if (Math.sqrt(dx * dx + dy * dy) / r + 1.2 * (ore[i] - 0.5) >= 1) continue;
          const k = 0.8 * fine[i];
          img[i * 3] = c[0] * k; img[i * 3 + 1] = c[1] * k; img[i * 3 + 2] = c[2] * k;
        }
      }
    }
    yield;
    const out = new Uint8ClampedArray(n * 3);
    for (let y = 0; y < CH; y++) {
      const glow = clamp((y - 880) / 170, 0, 1), t = clamp(y / 60, 0, 1), sway = 0.92 + 0.16 * Math.sin(y * 0.9);
      for (let x = 0; x < CW; x++) {
        const i = y * CW + x, c = i * 3;
        if (y + 16 * (wobble[i] - 0.5) < 60) {
          out[c] = (22 + 90 * t) * sway; out[c + 1] = (12 + 60 * t) * sway; out[c + 2] = (58 + 110 * t) * sway;
        } else {
          out[c] = img[c] + glow * 190; out[c + 1] = img[c + 1] + glow * 55; out[c + 2] = img[c + 2] + glow * 10;
        }
      }
      if (y % 128 === 127) yield;
    }
    return out;
  }

  /* The word SILT as a list of grains, each knowing its colour. */
  function buildLogo(mask) {
    const xs = [], ys = [];
    mask.rows.split(' ').forEach((row, r) => {
      let x = mask.x, ink = false;
      for (let k = 0; k < row.length; k++) {
        const run = RUNS.indexOf(row[k]);
        if (ink) for (let i = 0; i < run; i++) { xs.push(x + i); ys.push(mask.y + r); }
        x += run;
        ink = !ink;
      }
    });
    const n = xs.length, y0 = ys[0], y1 = ys[n - 1];
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = (ys[i] - y0) / (y1 - y0);
      for (let s = 0; s + 1 < LOGO_STOPS.length; s++) {
        const a = LOGO_STOPS[s], b = LOGO_STOPS[s + 1];
        if (k < a[0] || k > b[0]) continue;
        const u = (k - a[0]) / (b[0] - a[0] + 1e-6);
        for (let c = 0; c < 3; c++) col[i * 3 + c] = a[1][c] * (1 - u) + b[1][c] * u;
        break;
      }
    }
    return {
      n, col, xs: Int16Array.from(xs), ys: Int16Array.from(ys),
      order: new Uint16Array(n), begin: new Float32Array(n), tint: new Float32Array(n)
    };
  }

  /* What the picture shows at this moment. */
  function modeAt(t) {
    if (t < T_FALL) return 'none';
    if (t < T_WORLD) return 'fall';
    if (t < T_HIST || (t >= T_WHISPER && t < T_EXIT)) return 'world';
    return t >= T_LOGO ? 'logo' : 'none';
  }

  function makeReel(world, column, seed0) {
    const start = world.start, shade = world.shade, amb = world.amb, base = world.base, bg = world.bg;
    const seepY = world.seepY, plug = world.plug;
    const M = start.slice(), heat = new Float32Array(N), heatTmp = new Float32Array(N);
    const moving = new Int32Array(W * PHYS_H);
    const logos = LOGO_MASKS.map(buildLogo);
    const ashX = new Float32Array(520), ashY = new Float32Array(520);

    let rnd = dice(1), n = 0;
    let you, oru, parts, poured, scooped, stolen, kill, wormX, worm, heatLeft, poolWarm, paintSeed;
    let pointerX = -1, pointerY = -1, heldX = 0, heldY = 0, letGo = -1;
    let hideFrom = W + 1;

    function reset(seed) {
      seed = (seed === undefined ? seed0 : seed) >>> 0;
      M.set(start);
      heat.fill(0);
      rnd = dice(seed);
      n = 0;
      you = { x: 72, y: 42, seen: false, carry: 0 };
      oru = { x: 44, pouch: 0 };
      parts = [];
      poured = 0; scooped = 0; stolen = 0;
      kill = false;
      wormX = 100;
      worm = [];
      for (let i = 0; i < 8; i++) worm.push([100 - i, 53]);
      heatLeft = BX + 58;
      poolWarm = false;
      lightFrame = -1;
      letGo = -1;

      /* What differs on screen but can't touch the physics has dice of its own. */
      const look = dice(seed ^ 0x5bd1e995);
      paintSeed = (look() * 4294967296) >>> 0;
      for (let i = 0; i < ashX.length; i++) { ashX[i] = look() * CW; ashY[i] = look() * 60; }
      /* The word builds from the floor up, with a little disorder. */
      logos.forEach((l) => {
        const key = new Float32Array(l.n);
        for (let i = 0; i < l.n; i++) {
          key[i] = -(l.ys[i] + look() * 5);
          l.order[i] = i;
          l.tint[i] = 0.82 + 0.36 * look();
        }
        l.order.sort((a, b) => key[a] - key[b]);
        for (let i = 0; i < l.n; i++) l.begin[l.order[i]] = i / l.n * 1.7 + look() * 0.12;
      });
    }

    /* One update of every moving grain in columns x0 to x1, bottom row first, x direction alternating.
       The list comes first: a grain that only starts moving during the update waits for the next one. */
    function step(x0, x1) {
      let count = 0;
      const forward = n & 1;
      for (let y = PHYS_H - 1; y >= 0; y--) {
        const row = y * W;
        /* The sky holds only ash, so it can run wider than the ground beneath it. */
        const end = y < 18 && x1 < 300 ? 350 : x1;
        if (forward) {
          for (let x = x0; x < end; x++) if (ACTIVE[M[row + x]]) moving[count++] = row + x;
        } else {
          for (let x = end - 1; x >= x0; x--) if (ACTIVE[M[row + x]]) moving[count++] = row + x;
        }
      }
      const ymin = (BY + 28) * W; /* The strain only spreads below this row. */
      for (let k = 0; k < count; k++) {
        const i = moving[k], c = M[i];
        if (c === BRINE || c === HOT) {
          if (c === HOT && kill && i >= ymin && rnd() < 0.003) M[i] = BRINE;
          const j = i + W;
          if (OPEN[M[j]]) { M[i] = M[j]; M[j] = c; continue; }
          const d = rnd() < 0.5 ? 1 : -1;
          if (OPEN[M[j + d]] && OPEN[M[i + d]]) { M[i] = M[j + d]; M[j + d] = c; continue; }
          let run = 0;
          for (let s = 1; s <= 6; s++) {
            if (OPEN[M[i + d * s]]) run = s;
            else break;
          }
          if (run) { M[i] = M[i + d * run]; M[i + d * run] = c; }
        } else if (c === SILT || c === CRUST || c === RED || c === NEW || c === DEAD) {
          if (c === CRUST) {
            /* Crust touching brine makes something new. */
            let reacted = false;
            for (let s = 0; s < 4 && !reacted; s++) {
              const q = s === 0 ? i + W : s === 1 ? i - W : s === 2 ? i + 1 : i - 1;
              if (M[q] === BRINE && rnd() < 0.18) {
                M[i] = NEW;
                M[q] = rnd() < 0.4 ? NEW : GAS;
                heat[i] += 4;
                poolWarm = true;
                reacted = true;
              }
            }
            if (reacted) continue;
          }
          const j = i + W, b = M[j];
          if (OPEN[b] || ((b === BRINE || b === HOT) && rnd() < 0.55)) { M[i] = b; M[j] = c; continue; }
          const d = rnd() < 0.5 ? 1 : -1;
          if (OPEN[M[j + d]] && OPEN[M[i + d]]) { M[i] = M[j + d]; M[j + d] = c; }
          else if (OPEN[M[j - d]] && OPEN[M[i - d]]) { M[i] = M[j - d]; M[j - d] = c; }
        } else if (c === STRAIN) {
          /* It eats glass, dies in hot brine, and starves away from a wall. */
          let dead = false, near = false;
          for (let dy = -W; dy <= W; dy += W) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dy && !dx) continue;
              const q = i + dy + dx, v = M[q];
              if (v === GLASS) {
                near = true;
                if (q >= ymin && rnd() < 0.016) M[q] = STRAIN;
              } else if (v === HOT && rnd() < 0.4) {
                dead = true;
              }
            }
          }
          if (dead || (heat[i] > 0.5 && rnd() < 0.25) || (kill && rnd() < 0.012)) M[i] = rnd() < 0.35 ? GAS : DEAD;
          else if (!near && rnd() < 0.0035) M[i] = AIR;
        } else if (c === MOSS) {
          if (rnd() < 0.012) {
            const s = Math.floor(rnd() * 4), q = i + (s === 0 ? W : s === 1 ? -W : s === 2 ? 1 : -1);
            if (M[q] === AIR) {
              const a = M[q + W], b = M[q - W], e = M[q + 1], f = M[q - 1];
              if (a === ROCK || b === ROCK || e === ROCK || f === ROCK || a === GLASS || e === GLASS || f === GLASS) {
                M[q] = MOSS;
              }
            }
          }
          if (kill && M[i + W] === HOT && rnd() < 0.02) M[i] = DEAD;
        } else if (c === GAS) {
          if (rnd() < 0.025) M[i] = AIR;
          else if (i > W) {
            const q = i - W + Math.floor(rnd() * 3) - 1;
            if (M[q] === AIR) { M[i] = AIR; M[q] = c; }
          }
        } else if (c === ASH) {
          const r = rnd(), j = i + W;
          if (M[j] === AIR) {
            if (r < 0.28) { M[i] = AIR; M[j] = c; }
            else if (r < 0.5 && i % W > 1 && M[i - 1] === AIR) { M[i] = AIR; M[i - 1] = c; }
          } else if (r < 0.25) {
            M[i] = AIR;
          }
        }
      }
    }

    /* Heat spreads a little and fades. */
    function soften(x0, y0, x1, y1) {
      const A = 0.4987, B = 0.2283, C = 0.0219, D = 0.00044;
      for (let y = y0; y < y1; y++) {
        const row = y * W;
        for (let x = x0; x < x1; x++) {
          const i = row + x;
          heatTmp[i] = A * heat[i] + B * (heat[i - 1] + heat[i + 1]) + C * (heat[i - 2] + heat[i + 2]) +
            D * (heat[i - 3] + heat[i + 3]);
        }
      }
      for (let y = y0; y < y1; y++) {
        const row = y * W;
        for (let x = x0; x < x1; x++) {
          const i = row + x;
          heat[i] = 0.955 * (A * heatTmp[i] + B * (heatTmp[i - W] + heatTmp[i + W]) +
            C * (heatTmp[i - 2 * W] + heatTmp[i + 2 * W]) + D * (heatTmp[i - 3 * W] + heatTmp[i + 3 * W]));
        }
      }
    }

    /* Hot brine holds its heat. There are only two places heat can be: the pool and the burrow. */
    function warm() {
      for (let y = BY + 10; y <= BY + 55; y++) {
        const row = y * W;
        for (let x = BX - 82; x <= BX + 132; x++) {
          if (M[row + x] !== HOT) continue;
          if (heat[row + x] < 0.6) heat[row + x] = 0.6;
          if (x - 6 < heatLeft) heatLeft = x - 6;
        }
      }
      if (poolWarm) soften(16, 36, 80, 66);
      soften(heatLeft, BY + 3, BX + 140, BY + 60);
    }

    function moveWorm() {
      wormX += 0.22;
      const x = 96 + Math.trunc(Math.abs(wormX % 120 - 60)), y = Math.trunc(55 + 4 * sine(wormX / 7));
      if (x === worm[0][0] && y === worm[0][1]) return;
      worm.pop();
      worm.unshift([x, y]);
      if (M[y * W + x] === ROCK) M[y * W + x] = AIR;
    }

    /* Takes the nearest few cells of a material inside a box. */
    function takeNearest(mat, x0, y0, x1, y1, cx, cy, count) {
      const best = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (M[y * W + x] !== mat) continue;
          const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          let k = best.length;
          while (k > 0 && best[k - 1][0] > d) k--;
          if (k < count) {
            best.splice(k, 0, [d, y * W + x]);
            if (best.length > count) best.pop();
          }
        }
      }
      best.forEach((b) => { M[b[1]] = AIR; });
      return best.length;
    }

    /* Scripted events, thirty times a second. */
    function script(f, t) {
      if (t < T_GHOST + 2) {
        /* Twice the film's rate over twice its width, so the sky is as busy at any picture size. */
        for (let k = 0; k < 2; k++) M[2 + Math.floor(rnd() * 348)] = ASH;
        if (f % 5 === 0) M[seepY * W + 38] = BRINE;
        moveWorm();
      }
      if (t >= T_WHISPER) moveWorm();

      const b = T_BIRTH, r = T_REACT;
      if (!you.seen && t >= b + 2.6) you.seen = true;
      if (b + 1.0 <= t && t < b + 1.05 && !parts.length) {
        for (let x = 66; x < 80 && parts.length < 8; x++) {
          if (M[43 * W + x] !== SILT) continue;
          M[43 * W + x] = AIR;
          parts.push(x);
        }
      }
      if (r <= t && t < r + 0.7) {
        you.x = 72 + 8 * smooth(r, r + 0.7, t);
      } else if (r + 0.7 <= t && t < r + 1.4) {
        if (scooped < 60) scooped += takeNearest(CRUST, 76, 30, 104, 44, 84, 40, 3);
        you.carry = scooped;
      } else if (r + 1.4 <= t && t < r + 2.6) {
        you.x = 80 - 17 * smooth(r + 1.4, r + 2.6, t);
      } else if (r + 2.6 <= t && t < r + 4.0 && poured < scooped) {
        for (let k = 0; k < 2; k++) {
          const x = 46 + Math.floor(rnd() * 15);
          if (M[40 * W + x] === AIR) { M[40 * W + x] = CRUST; poured++; }
        }
        you.carry = scooped - poured;
      }

      const s = t - T_SIEGE;
      if (s >= 0) {
        const k = Math.trunc(s * FPS);
        if (k < 60) oru.x = 44;
        else if (k < 100) oru.x = 44 + 6 * (k - 60) / 40;
        else if (k < 150) oru.x = 50 + 28 * (k - 100) / 50;
        else if (k < 180) {
          if (stolen < 40) stolen += takeNearest(RED, BX + 70, BY + 40, BX + 100, BY + 55, BX + 78, BY + 50, 2);
          oru.pouch = stolen;
        } else {
          /* Out along the tunnel, however much of it the picture shows. */
          oru.x = Math.max(-80, 78 - 84 * (k - 180) / 65);
        }
        if (k >= 98) {
          for (let y = BY + 47; y < BY + 55; y++) {
            for (let x = BX + 58; x < BX + 60; x++) {
              const i = y * W + x;
              if ((M[i] === GLASS || M[i] === STRAIN) && rnd() < 0.2) M[i] = AIR;
            }
          }
        }
        if (k >= 125 && !kill) {
          kill = true;
          for (let i = 0; i < plug.length; i++) M[plug[i]] = AIR;
        }
      }
    }

    function tick() {
      if (n >= T_END * 60) return;
      n++;
      const t = n / 60, onFrame = !(n & 1);
      if (t < T_WORLD || t >= T_EXIT) return;
      if (onFrame) script(n >> 1, t);
      if (t < T_GHOST + 2 || t >= T_WHISPER) step(1, 200);
      else step(170, 639);
      if (onFrame) warm();
    }

    /* The camera over the planet during the fall, in rows from the top. */
    function fallCamera(t) {
      if (reel.reduced) {
        /* A few hard cuts through the layers, then back to the surface. */
        if (t >= 10.0) return 0;
        const cuts = [8, 150, 320, 480, 640, 850, CH - VH];
        return cuts[clamp(Math.floor((t - T_FALL) / 4 * cuts.length), 0, cuts.length - 1)];
      }
      if (t < 10.0) return (CH - VH) * Math.pow(smooth(T_FALL + 0.1, 10.0, t), 1.25);
      return (CH - VH) * (1 - smooth(10.0, T_WORLD - 0.05, t));
    }

    function focusAt(t) {
      for (let k = 0; k + 3 < FOCUS.length; k += 2) {
        if (t < FOCUS[k + 2]) return FOCUS[k + 1] + (FOCUS[k + 3] - FOCUS[k + 1]) * smooth(FOCUS[k], FOCUS[k + 2], t);
      }
      return FOCUS[FOCUS.length - 1];
    }

    /* The frame being built, and how far the film's view is from the picture's corner. */
    let v = null, now = 0, ox = 0, oy = 0;

    /* Fits the camera to a picture of this size. Extra rows and columns show more of the world around the
       film's view, which stays centred where it can. A narrow picture keeps the action in frame. */
    function fit(cols, rows) {
      const t = now, cam = v.cam;
      if (v.mode === 'fall') {
        cam.x = (VW - cols) >> 1;
        cam.y = clamp(Math.trunc(fallCamera(t)) - ((rows - VH) >> 1), 0, CH - rows);
        ox = -cam.x;
        oy = Math.max(0, (rows - VH) >> 1);
      } else if (v.mode === 'world') {
        let cx = 0, cy = 0;
        if (t >= T_GHOST && t < T_WHISPER) {
          if (t < T_SIEGE) {
            const k = smooth(T_GHOST + 0.3, T_SIEGE - 0.1, t);
            cx = Math.trunc(BX * k); cy = Math.trunc(BY * k);
          } else if (t < T_EDGE) {
            cx = BX; cy = BY;
          } else {
            const k = smooth(T_EDGE, T_EDGE + 1.3, t);
            cx = Math.trunc(BX + 180 * k); cy = Math.trunc(BY - 14 * k);
          }
        }
        const middle = t < T_GHOST || t >= T_WHISPER ? 40 : 34;
        cam.x = cols >= VW ? Math.max(0, cx - ((cols - VW) >> 1)) :
          cx + clamp(Math.round(focusAt(t)) - (cols >> 1), 0, VW - cols);
        cam.y = rows >= VH ? clamp(cy - ((rows - VH) >> 1), rows > TALL ? (VH - rows) >> 1 : 0, Math.max(0, H - rows)) :
          cy + clamp(middle - (rows >> 1), 0, VH - rows);
        ox = cx - cam.x;
        oy = cy - cam.y;
      } else if (v.mode === 'logo') {
        cam.x = (VW - cols) >> 1;
        cam.y = rows >= VH ? (VH - rows) >> 1 : clamp(27 - (rows >> 1), 0, VH - rows);
        ox = -cam.x;
        oy = -cam.y;
      } else {
        ox = 0;
        oy = 0;
      }
    }

    function typed(s, t0, cps) {
      if (reel.reduced) return now >= t0 ? s : '';
      return s.slice(0, Math.max(0, Math.trunc((now - t0) * (cps || 48))));
    }

    function line(col, row, text, color, bold) {
      if (text) v.rows.push({ col, row, text, color, bold: !!bold });
    }

    /* On the world's grains, in the film's view. Text rows there are two grains tall. */
    function place(x, y, text, color, back, bold, story, center) {
      if (!text) return;
      v.labels.push({
        x: Math.max(0, Math.max(0, x) + ox), y: Math.max(0, (Math.max(0, y) >> 1) * 2 + oy),
        text, color, back, bold, story, center: center || 0
      });
    }
    function label(x, y, text, color) { place(x, y, text, color, BACK, false, true); }
    function aside(x, y, text, color) { place(x, y, text, color, BACK, false, false); }
    function heading(x, y, text) { place(x, y, text, BRIGHT, BACK, true, true); }

    function banner(col, row, text, color, back) {
      v.banners.push({ x: Math.max(0, col + ox), y: Math.max(0, (row - 1) * 2 + oy), text, color, back, bold: true });
    }

    function ticker(mats, right, rightColor) {
      v.ticker = {
        left: 'Silt · day 211 · ' + thousands(mats) + ' materials', leftColor: FG,
        right: right || '', rightColor: rightColor || DIM
      };
    }

    function pane(one, two, oneColor, twoColor, key) {
      v.pane = {
        one: one || '', oneColor: oneColor || FG,
        two: two || '', twoColor: twoColor || DIM,
        key: key || null
      };
    }

    function drawPrompt(t) {
      v.scene = 'prompt';
      line(2, 2, typed('you > Read https://silt.example/skill.md and follow it.', 0.2), FG);
      if (t >= 1.7) {
        line(2, 3, typed('agent > Registered myself. Claim me here: https://silt.example/claim/7f3a', 1.7, 70), AMBER);
      }
      if (t >= 3.0) line(2, 5, typed('$ ssh silt.example', 3.0, 30), BRIGHT);
      if (t >= 3.9) line(2, 7, typed('Silt has been running for 211 days. It has never been reset.', 3.9, 60), FG);
      if (t >= 5.0) line(2, 9, typed('The world is choosing where you fall.', 5.0, 40), PALE);
    }

    function drawFall(t) {
      v.scene = 'fall';
      const cy = fallCamera(t) + VH / 2;
      ticker(3482, 'depth ' + thousands(Math.trunc(Math.max(0, cy - 60) / 1040 * 4096)) + ' grains');
      let layer = 0;
      while (cy >= LAYERS[layer][0]) layer++;
      heading(3, 30, LAYERS[layer][1]);
      pane();
    }

    function drawShelf(t) {
      v.scene = 'shelf';
      const b = T_BIRTH, r = T_REACT, made = t >= r + 4.2;
      ticker(made ? 3483 : 3482, 'East: Kesh\'s cistern burst; brine is flooding a moss garden.');
      let one = '';
      if (t < b) one = 'Birthplace: a basalt shelf above a warm aquifer. Nearest burrow: 900 grains east.';
      else if (t < r) {
        if (t >= b + 3.0) {
          one = 'your soul: ' + typed(
            'I am made of this shelf. Water is seeping somewhere to my left. The green thing is moving.', b + 3.0, 40);
        }
      } else if (!made) one = 'your soul: ' + typed('What happens if the yellow crust touches the brine?', r + 0.1, 40);
      else one = 'your soul: ' + typed('It glows, and it is cold. I will call it cold-glow.', r + 4.6, 40);
      pane(one, '', t >= b ? AMBER : FG);
      if (you.seen) label(Math.trunc(you.x) - 4, 36, 'your soul', AMBER);
      if (b + 3.0 <= t && t < r + 2) {
        label(44, 44, 'brine', '#78c8e6');
        label(88, 28, 'yellow crust', '#f8e060');
        label(135, 24, 'the green thing', GREEN);
      }
      if (t < b + 3) {
        aside(3, 4, 'sky', '#c8b4e6');
        aside(3, 15, 'surface', '#5ae6be');
        aside(66, 50, 'basalt shelf', '#aab0be');
      }
      if (made) {
        banner(40, 7, 'NEW TO SILT: no grain like this has ever existed. Made by your soul.', '#061828', PALE);
        if (t >= r + 5.6) label(38, 60, 'cold-glow', PALE);
      }
    }

    function drawGhost() {
      v.scene = 'ghost';
      ticker(3483, 'East: Kesh\'s cistern burst; brine is flooding a moss garden.');
      pane('GHOST: you pass through rock · nobody can see you · you touch nothing', '', PALE, DIM, 'g');
    }

    function drawSiege(t) {
      v.scene = 'siege';
      const k = Math.trunc((t - T_SIEGE) * FPS);
      ticker(3483, 'REPLAY 10x · day 211', AMBER);
      let one = 'Kesh\'s burrow. Owner away. 6 reflexes guarding.';
      let two = 'other ghost: watch the west wall. someone has been tunnelling for an hour.';
      if (k >= 115) {
        one = 'Kesh\'s burrow. Reflex fired.';
        two = 'Compiled from Kesh\'s own past choices. Kesh\'s owner is asleep.';
      }
      if (k >= 290) {
        one = 'Day 211: ' + THE_RAID;
        two = 'Saved to permanent history.';
      }
      pane(one, two, k >= 290 ? AMBER : FG, k < 115 ? FG : DIM, 'r');
      if (k < 125) {
        label(78, 2, 'tank of hot brine', '#fab660');
        label(76, 38, 'red grains', '#f0605a');
        label(116, 44, 'moss garden', GREEN);
        aside(12, 42, 'Oru\'s tunnel', '#b294ff');
        label(22, 58, 'strain eating the wall', PINK);
      }
      label(KESH_X - 7, KESH_Y - 6, 'Kesh, asleep', AMBER);
      const x = Math.trunc(oru.x);
      /* Named while he is in the picture. */
      if (x > 0 && x + 1 + ox >= 0) label(x - 2, 47, 'Oru' + (oru.pouch ? '  pouch: ' + oru.pouch : ''), '#c8b4ff');
      if (k >= 115 && k < 280) {
        banner(14, 1, ' REFLEX: WHEN wall grains are being consumed THEN open the cistern above the breach ',
          '#221600', AMBER);
      }
    }

    function drawEdge(t) {
      v.scene = 'edge';
      ticker(3483, 'the edge of the generated world');
      pane();
      if (t >= T_EDGE + 1.1) heading(88, 32, 'No soul has been here.');
    }

    function drawHistory(t) {
      v.scene = 'history';
      ticker(3483);
      pane('', '', FG, DIM, 'h');
      line(4, 3, 'HISTORY', BRIGHT, true);
      HISTORY.forEach((h, i) => { if (t >= T_HIST + h[0]) line(4, 5 + i * 2, typed(h[1], T_HIST + h[0], 240), FG); });
      if (t >= T_HIST + 1.8) {
        line(4, 18, 'Silt began with 40 materials. Agents and evolution have made 3,443 more.', PALE, true);
      }
    }

    function drawWhisper(t) {
      v.scene = 'whisper';
      ticker(3483, '4 hours later');
      const one = 'you (whisper): ' + typed('don\'t go near that worm.', T_WHISPER + 0.1, 36);
      const two = t >= T_WHISPER + 1.2 ?
        'your soul: ' + typed('I will wall it out with silt and see if it eats silt.', T_WHISPER + 1.2, 46) : '';
      pane(one, two, PALE, AMBER, 'w');
      label(Math.trunc(you.x) - 4, 36, 'your soul', AMBER);
      label(118, 54, 'the worm', '#ebbeaa');
    }

    function drawExit() {
      v.scene = 'exit';
      line(2, 2, 'Connection to silt.example closed.', DIM);
      line(2, 4, typed('Your soul is still there.', T_EXIT + 0.15, 50), BRIGHT);
      line(2, 6, typed('The rock keeps moving.', T_EXIT + 0.7, 50), BRIGHT);
      line(2, 8, typed('It will remember everything.', T_EXIT + 1.2, 50), BRIGHT);
    }

    function drawLogo(t) {
      v.scene = 'logo';
      const ssh = '$ ssh silt.example';
      /* Centred under the word on all of its length, so that it types from a fixed place. */
      if (t >= T_LOGO + 2.0) place(71, 58, typed(ssh, T_LOGO + 2.0, 30), BRIGHT, null, false, true, ssh.length);
      if (t >= T_LOGO + 1.9) {
        v.end = {
          one: 'Every grain here is simulated.', oneColor: '#f0f0f5',
          two: 'Concept render. Silt isn\'t built yet, and the name is a placeholder.', twoColor: '#9696a4'
        };
      }
    }

    /* The ghost is scripted, or follows the pointer, and always stays inside the picture.
       When the pointer leaves, it drifts back to its place in the script. */
    const RING_BACK = 0.3;
    function drawRing(t, cols, rows) {
      if (t < T_GHOST || t >= T_EDGE) return;
      const early = t < T_SIEGE;
      let gx = (early ? VW >> 1 : 26) + ox, gy = (early ? VH >> 1 : 24) + oy;
      if (pointerX >= 0) { gx = pointerX; gy = pointerY; }
      else if (letGo >= 0 && t < letGo + RING_BACK) {
        const k = smooth(letGo, letGo + RING_BACK, t);
        gx = Math.round(heldX + (gx - heldX) * k);
        gy = Math.round(heldY + (gy - heldY) * k);
      }
      gx = clamp(gx, 2, cols - 3);
      gy = clamp(gy, 2, rows - 3);
      v.cam.ghostX = gx;
      v.cam.ghostY = gy;
      v.labels.unshift({
        x: gx + 4, y: early ? gy - 1 : gy + 2, text: 'you', color: BRIGHT, back: BACK, bold: false, story: true
      });
    }

    /* Everything on screen at this moment, as plain data:
         scene     prompt, fall, shelf, ghost, siege, edge, history, whisper, exit or logo
         mode      what the picture shows: none, fall, world or logo
         fade      1, until the last half second of the film
         title, ticker, pane, caption, end    the terminal's text and colours; all but title can be null
         rows      whole-page text: { col, row, text, color, bold }, on the film's grid of 160 by 37 cells
         labels, banners    text on the picture: { x, y, text, color, back, bold }, in grains of the picture.
                   A label with story false names nothing the film talks about, and can go if crowded.
                   One with center is a line being typed: that many cells long when finished, and centred on that.
         cam       where the picture is; hand it to paint()
       Without a size, the picture is the film's own 160 by 66. */
    function frame(t, cols, rows) {
      cols = cols || VW;
      rows = rows || VH;
      now = t;
      v = {
        t, scene: '', mode: modeAt(t), fade: Math.min(1, (T_END - t) / 0.5),
        title: {
          left: t >= 3.6 ? 'ssh silt.example' : '~', leftColor: '#aaaab8',
          right: 'concept render · staged · time sped up', rightColor: AMBER
        },
        ticker: null, pane: null, caption: null, end: null, rows: [], labels: [], banners: [],
        cam: { mode: '', x: 0, y: 0, ghostX: -1, ghostY: -1 }
      };
      v.cam.mode = v.mode;
      fit(cols, rows);
      if (t < T_FALL) drawPrompt(t);
      else if (t < T_WORLD) drawFall(t);
      else if (t < T_GHOST) drawShelf(t);
      else if (t < T_SIEGE) drawGhost();
      else if (t < T_EDGE) drawSiege(t);
      else if (t < T_HIST) drawEdge(t);
      else if (t < T_WHISPER) drawHistory(t);
      else if (t < T_EXIT) drawWhisper(t);
      else if (t < T_LOGO) drawExit();
      else drawLogo(t);
      drawRing(t, cols, rows);
      for (let i = 0; i < CAPTIONS.length; i++) {
        const c = CAPTIONS[i];
        if (c[0] <= t && t < c[1]) {
          const fade = Math.min(1, (t - c[0]) / 0.25, (c[1] - t) / 0.25);
          v.caption = { text: c[2], fade, color: '#f0f0f0', from: COLORS.band };
        }
      }
      return v;
    }

    /* Light from glowing things falls off over about five grains. That is smooth enough to work out at half
       size and spread back over the grains. It is done thirty times a second, as often as it visibly changes,
       and whenever the camera moves. */
    const LIGHT_K = 5 / 4, LIGHT_WIDTHS = boxWidths(2.5);
    let lightFrame = -1, lightX = 0, lightY = 0, lightCols = 0, lightRows = 0;
    let lightR = new Float32Array(0), lightG = lightR, lightB = lightR;
    let halfR = lightR, halfG = lightR, halfB = lightR, halfTmp = lightR;

    /* One box pass along each of `lines` lines, holding the edge value past the ends. */
    function boxPass(src, dst, lines, len, across, along, width) {
      const r = (width - 1) / 2, k = 1 / width, last = len - 1;
      for (let l = 0; l < lines; l++) {
        const s = l * across;
        let sum = src[s] * (r + 1);
        for (let i = 1; i <= r; i++) sum += src[s + (i < last ? i : last) * along];
        for (let i = 0; i < len; i++) {
          dst[s + i * along] = sum * k;
          const a = i + r + 1, b = i - r;
          sum += src[s + (a < last ? a : last) * along] - src[s + (b > 0 ? b : 0) * along];
        }
      }
    }

    function spread(f, w, h) {
      for (let p = 0; p < 3; p++) {
        boxPass(f, halfTmp, h, w, w, 1, LIGHT_WIDTHS[p]);
        boxPass(halfTmp, f, w, h, 1, w, LIGHT_WIDTHS[p]);
      }
    }

    function deep(y) { return y < H ? y : DEEP + (y - H) % (H - DEEP); }

    /* Where this row's plain rock starts, while the burrow is kept out of the picture. */
    function hiddenFrom(y) { return y >= HID_Y0 && y <= HID_Y1 ? hideFrom : W + 1; }

    function shine(cols, rows, camX, camY) {
      const f = n >> 1;
      if (f === lightFrame && camX === lightX && camY === lightY && cols === lightCols && rows === lightRows) return;
      lightFrame = f; lightX = camX; lightY = camY; lightCols = cols; lightRows = rows;
      const size = cols * rows, w = (cols + 1) >> 1, h = (rows + 1) >> 1;
      if (lightR.length < size) {
        lightR = new Float32Array(size); lightG = new Float32Array(size); lightB = new Float32Array(size);
      }
      if (halfR.length < w * h) {
        halfR = new Float32Array(w * h); halfG = new Float32Array(w * h); halfB = new Float32Array(w * h);
        halfTmp = new Float32Array(w * h);
      }
      halfR.fill(0, 0, w * h); halfG.fill(0, 0, w * h); halfB.fill(0, 0, w * h);
      for (let vy = 0; vy < rows; vy++) {
        if (camY + vy < 0) continue;
        const row = deep(camY + vy) * W, q = (vy >> 1) * w, from = hiddenFrom(camY + vy);
        for (let vx = 0; vx < cols; vx++) {
          const x = camX + vx, e = (x < W && (x < from || x > HID_X1) ? M[row + x] : ROCK) * 3, p = q + (vx >> 1);
          halfR[p] += EMIT[e]; halfG[p] += EMIT[e + 1]; halfB[p] += EMIT[e + 2];
        }
      }
      spread(halfR, w, h);
      spread(halfG, w, h);
      spread(halfB, w, h);
      /* Back to one value per grain: three parts the nearest half cell, one part the next, each way. */
      for (let vy = 0, p = 0; vy < rows; vy++) {
        const j = vy >> 1, j2 = vy & 1 ? (j + 1 < h ? j + 1 : j) : (j > 0 ? j - 1 : 0);
        const near = j * w, far = j2 * w;
        for (let vx = 0; vx < cols; vx++, p++) {
          const i = vx >> 1, i2 = vx & 1 ? (i + 1 < w ? i + 1 : i) : (i > 0 ? i - 1 : 0);
          const a = near + i, b = near + i2, c = far + i, d = far + i2;
          lightR[p] = 0.5625 * halfR[a] + 0.1875 * (halfR[b] + halfR[c]) + 0.0625 * halfR[d];
          lightG[p] = 0.5625 * halfG[a] + 0.1875 * (halfG[b] + halfG[c]) + 0.0625 * halfG[d];
          lightB[p] = 0.5625 * halfB[a] + 0.1875 * (halfB[b] + halfB[c]) + 0.0625 * halfB[d];
        }
      }
    }

    function paintGrains(rgba, cols, rows, camX, camY) {
      shine(cols, rows, camX, camY);
      let o = 0, p = 0;
      for (let vy = 0; vy < rows; vy++) {
        if (camY + vy < 0) {
          /* Above the world there is only more sky, as dark as its top row. */
          const sway = 0.92 + 0.16 * Math.sin((camY + vy) * 1.3);
          for (let vx = 0; vx < cols; vx++, o += 4, p++) {
            const x = camX + vx, c = (x < W ? x : W - 1) * 3;
            rgba[o] = bg[c] * sway; rgba[o + 1] = bg[c + 1] * sway; rgba[o + 2] = bg[c + 2] * sway; rgba[o + 3] = 255;
          }
          continue;
        }
        const row = deep(camY + vy) * W, from = hiddenFrom(camY + vy);
        for (let vx = 0; vx < cols; vx++, o += 4, p++) {
          const x = camX + vx, i = row + (x < W ? x : W - 1), plain = x >= from && x <= HID_X1, m = plain ? ROCK : M[i];
          let r, g, b;
          if (m === ROCK) { const c = i * 3; r = base[c]; g = base[c + 1]; b = base[c + 2]; }
          else if (m === AIR) { const c = i * 3; r = bg[c]; g = bg[c + 1]; b = bg[c + 2]; }
          else { const c = (m * 4 + shade[i]) * 3; r = PAL[c]; g = PAL[c + 1]; b = PAL[c + 2]; }
          const a = amb[i], lo = MIN_LIGHT[m], hi = MAX_LIGHT[m];
          let lr = a + lightR[p] * LIGHT_K, lg = a + lightG[p] * LIGHT_K, lb = a + lightB[p] * LIGHT_K;
          if (lr < lo) lr = lo;
          if (lr > hi) lr = hi;
          if (lg < lo) lg = lo;
          if (lg > hi) lg = hi;
          if (lb < lo) lb = lo;
          if (lb > hi) lb = hi;
          r *= lr; g *= lg; b *= lb;
          if (m !== HOT && !plain) {
            const h = heat[i];
            if (h > 0.002) {
              const c = h < 1.6 ? h : 1.6;
              r += c * 70; g += c * 30; b += c * 6;
            }
          }
          rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
        }
      }
    }

    /* The picture being painted, for the things drawn over the grains. */
    let pic = null, picCols = 0, picRows = 0, picX = 0, picY = 0;

    function dot(x, y, c) {
      x -= picX; y -= picY;
      if (x < 0 || x >= picCols || y < 0 || y >= picRows) return;
      const q = (y * picCols + x) * 4;
      pic[q] = c[0]; pic[q + 1] = c[1]; pic[q + 2] = c[2];
    }

    /* Two wide and three tall, standing on (x, y). */
    function soul(x, y, body, head) {
      for (let j = 0; j < 3; j++) {
        dot(x, y - j, j === 2 ? head : body);
        dot(x + 1, y - j, j === 2 ? head : body);
      }
    }

    function paintSouls(t, cam) {
      if (t < T_GHOST + 1 || t >= T_WHISPER) {
        for (let i = 0; i < worm.length; i++) dot(worm[i][0], worm[i][1], i ? WORM_BODY : WORM_HEAD);
      }
      const b = T_BIRTH;
      if (b <= t && t < b + 1.0) {
        const k = (t - b) / 0.62;
        const yy = k < 1 ? 22 + 20 * k * k : 42 - 3 * Math.sin(Math.min((t - b - 0.62) / 0.3, 1) * Math.PI);
        dot(72, Math.trunc(yy), SPARK);
      }
      if (b + 1.0 <= t && t < b + 2.6 && parts.length) {
        const k = smooth(b + 1.0, b + 2.6, t);
        for (let i = 0; i < parts.length; i++) {
          const tx = 72 + i % 2, ty = 42 - (i >> 1) % 3;
          dot(Math.trunc(parts[i] + (tx - parts[i]) * k), Math.trunc(43 + (ty - 43) * k), MOTE);
        }
        dot(72, 42, SPARK);
      }
      if (you.seen && (t < T_GHOST || t >= T_WHISPER)) {
        const x = Math.trunc(you.x);
        soul(x, you.y, BODY, HEAD);
        if (you.carry > 0) {
          for (let j = 0; j < (you.carry > 12 ? 2 : 1); j++) {
            dot(x, you.y - 3 - j, CARRIED);
            dot(x + 1, you.y - 3 - j, CARRIED);
          }
        }
      }
      /* Kesh sleeps on until the camera has left the burrow. */
      if (t >= T_GHOST && t < T_EDGE + 1.3) {
        const kx = BX + KESH_X, ky = BY + KESH_Y;
        soul(kx, ky, BODY, HEAD);
        dot(kx + 3, ky, WHITE);
      }
      if (t >= T_GHOST && t < T_EDGE) {
        if (oru.x > -80) {
          const x = BX + Math.trunc(oru.x), y = BY + 54;
          soul(x, y, ORU_BODY, ORU_HEAD);
          if (oru.pouch) { dot(x, y - 3, POUCH); dot(x + 1, y - 3, POUCH); }
        }
        if (cam.ghostX >= 0) paintRing(cam.ghostX, cam.ghostY);
      }
    }

    /* The ring is something you see through, and it touches nothing. */
    function paintRing(gx, gy) {
      for (let j = -2; j <= 2; j++) {
        for (let i = -2; i <= 2; i++) {
          const ai = Math.abs(i), aj = Math.abs(j), x = gx + i, y = gy + j;
          if (Math.max(ai, aj) !== 2 || Math.min(ai, aj) >= 2) continue;
          if (x < 0 || x >= picCols || y < 0 || y >= picRows) continue;
          const q = (y * picCols + x) * 4;
          pic[q] = pic[q] * 0.35 + 165.75;
          pic[q + 1] = pic[q + 1] * 0.35 + 165.75;
          pic[q + 2] = pic[q + 2] * 0.35 + 165.75;
        }
      }
    }

    /* Past the edge there is nothing yet: static, changing thirty times a second. */
    function paintStatic(rgba, cols, rows, camX, camY) {
      const fuzz = dice(paintSeed + (n >> 1));
      let q = 0;
      for (let vy = 0; vy < rows; vy++) {
        const edge = EDGE - camX - 8 * Math.sin((camY + vy) / 5);
        for (let vx = 0; vx < cols; vx++, q += 4) {
          if (vx + 3 <= edge || vx + 3 * fuzz() <= edge) continue;
          const u = fuzz(), st = u * u * u * 90;
          rgba[q] = st; rgba[q + 1] = st; rgba[q + 2] = st * 1.1;
        }
      }
    }

    function paintWorld(rgba, cols, rows, cam, t) {
      hideFrom = t < T_GHOST ? HID_X0 : W + 1;
      paintGrains(rgba, cols, rows, cam.x, cam.y);
      pic = rgba; picCols = cols; picRows = rows; picX = cam.x; picY = cam.y;
      paintSouls(t, cam);
      if (t >= T_EDGE) paintStatic(rgba, cols, rows, cam.x, cam.y);
      pic = null;
    }

    function paintFall(rgba, cols, rows, cam, t) {
      const y0 = cam.y, fuzz = dice(paintSeed + (n >> 1));
      const flicker = y0 + rows > COL_MOLTEN ? Math.max(0, COL_MOLTEN - y0) : rows;
      let o = 0;
      for (let vy = 0; vy < rows; vy++) {
        const row = (y0 + vy) * CW;
        let x = ((cam.x + COL_MID) % CW + CW) % CW;
        for (let vx = 0; vx < cols; vx++, o += 4) {
          const c = (row + x) * 3, k = vy >= flicker ? 0.75 + 0.5 * fuzz() : 1;
          rgba[o] = column[c] * k; rgba[o + 1] = column[c + 1] * k; rgba[o + 2] = column[c + 2] * k; rgba[o + 3] = 255;
          if (++x === CW) x = 0;
        }
      }
      /* Ash in the sky, for the moments the sky is in view. */
      if (y0 >= 60) return;
      const k = (t - T_FALL) * FPS;
      for (let i = 0; i < ashX.length; i++) {
        const yy = Math.trunc((ashY[i] + 0.25 * k) % 60) - y0;
        if (yy < 0 || yy >= rows) continue;
        const xx = ((Math.trunc((ashX[i] - 0.5 * k) % CW + CW) % CW) - COL_MID - cam.x + CW) % CW;
        if (xx >= cols) continue;
        const q = (yy * cols + xx) * 4;
        rgba[q] = 124; rgba[q + 1] = 114; rgba[q + 2] = 144;
      }
    }

    function paintEmpty(rgba, cols, rows) {
      for (let o = 0; o < cols * rows * 4; o += 4) {
        rgba[o] = 10; rgba[o + 1] = 10; rgba[o + 2] = 14; rgba[o + 3] = 255;
      }
    }

    /* The grains of the word rain in from the top of the picture and land where they belong. */
    function paintLogo(rgba, cols, rows, cam, t) {
      paintEmpty(rgba, cols, rows);
      const l = logos[cols >= LOGO_MIN_COLS ? 0 : 1], top = Math.min(cam.y, 0);
      for (let k = 0; k < l.n; k++) {
        const i = l.order[k], dt = t - T_LOGO - l.begin[i];
        if (dt <= 0) continue;
        const y = Math.min(l.ys[i], Math.trunc(top - 3 + 130 * dt * dt));
        if (y < top) continue;
        const vx = l.xs[i] - cam.x, vy = y - cam.y;
        if (vx < 0 || vx >= cols || vy < 0 || vy >= rows) continue;
        const q = (vy * cols + vx) * 4, tint = l.tint[i];
        rgba[q] = l.col[i * 3] * tint; rgba[q + 1] = l.col[i * 3 + 1] * tint; rgba[q + 2] = l.col[i * 3 + 2] * tint;
      }
    }

    /* One RGBA pixel per grain, for the film as it stands now. Nothing here changes the world. */
    function paint(rgba, cols, rows, cam) {
      const t = n / 60, mode = modeAt(t);
      if (!cam || cam.mode !== mode) cam = frame(t, cols, rows).cam;
      if (mode === 'world') paintWorld(rgba, cols, rows, cam, t);
      else if (mode === 'fall') paintFall(rgba, cols, rows, cam, t);
      else if (mode === 'logo') paintLogo(rgba, cols, rows, cam, t);
      else paintEmpty(rgba, cols, rows);
    }

    /* The first frames of any code are its slowest. This takes them now, and not on the film's hardest cut. */
    function warmUp() {
      n = T_WORLD * 60;
      for (let k = 0; k < 40; k++) tick();
      paint(new Uint8ClampedArray(VW * VH * 4), VW, VH, frame(n / 60, VW, VH).cam);
      reset();
    }

    function pointer(x, y) {
      if (x === null || x === undefined) {
        if (pointerX >= 0) { heldX = pointerX; heldY = pointerY; letGo = n / 60; }
        pointerX = -1; pointerY = -1;
        return;
      }
      pointerX = x; pointerY = y;
    }

    const reel = {
      get t() { return n / 60; },
      reduced: false,
      reset, tick, frame, paint, pointer, warm: warmUp,
      /* For tests: the live cells and the people in the script. */
      world: { W, H, M, heat, seepY },
      get you() { return you; },
      get oru() { return oru; },
      get poured() { return poured; },
      get scooped() { return scooped; },
      get stolen() { return stolen; },
      get killed() { return kill; }
    };
    reset(seed0);
    return reel;
  }

  function finish(gen) {
    let s = gen.next();
    while (!s.done) s = gen.next();
    return s.value;
  }

  const SiltReel = {
    /* Everything at once, for tests and tools. */
    create(options) {
      const o = options || {};
      return makeReel(finish(buildWorld()), finish(buildColumn()), o.seed || 1);
    },

    /* The same, spread over tasks of about `slice` ms so the page keeps moving. */
    load(options) {
      const o = options || {}, slice = o.slice || 6;
      return new Promise((resolve, reject) => {
        const gens = [buildWorld(), buildColumn()], parts = [];
        function run() {
          try {
            const end = Date.now() + slice;
            while (Date.now() < end) {
              const s = gens[parts.length].next();
              if (!s.done) continue;
              parts.push(s.value);
              if (parts.length === 2) { resolve(makeReel(parts[0], parts[1], o.seed || 1)); return; }
            }
          } catch (e) {
            reject(e);
            return;
          }
          setTimeout(run, 0);
        }
        run();
      });
    },

    /* The film's words and timing with no world behind them, for laying out a page before the world exists.
       frame() works on it. tick() and paint() do not. */
    words() { return makeReel({ start: new Uint8Array(0) }, null, 1); },

    /* A seed that has been checked against the script. Each one plays differently. */
    pickSeed(x) {
      let s = 1 + Math.floor(x * SEEDS) % SEEDS;
      while (LEFT_OUT.indexOf(s) >= 0) s = s % SEEDS + 1;
      return s;
    },

    VW, VH, COLORS, KEYS,
    T: {
      FALL: T_FALL, WORLD: T_WORLD, BIRTH: T_BIRTH, REACT: T_REACT, GHOST: T_GHOST, SIEGE: T_SIEGE,
      EDGE: T_EDGE, HIST: T_HIST, WHISPER: T_WHISPER, EXIT: T_EXIT, LOGO: T_LOGO, END: T_END
    },
    MAT: { AIR, ROCK, GLASS, SILT, CRUST, BRINE, HOT, NEW, STRAIN, DEAD, MOSS, RED, GAS, ASH, FUNGUS, PLUG },
    BURROW: { x: BX, y: BY, keshX: BX + KESH_X, keshY: BY + KESH_Y }
  };

  if (typeof module === 'object' && module.exports) module.exports = SiltReel;
  else root.SiltReel = SiltReel;
})(typeof self !== 'undefined' ? self : this);
