/* Exhibit A, drawn live. The world, its rules and the script of the film, with no page attached.
   The grains around the creature are simulated for real, on typed arrays, one rule at a time: water runs and
   soaks in, damp silt darkens, grass and roots spread, fine silt under standing water turns to clay. The plot is
   choreographed: the creature follows a script. The valley the camera steps back to was laid out at load, every
   grain of it dated, so that days can pass in a second. The counts on screen are counted from the arrays.
   This file touches no DOM, so it runs the same under Node.

     SiltReel.create({ seed })            the whole world, all at once
     SiltReel.load({ seed, slice })       the same, a few ms at a time, as a promise
     SiltReel.pickSeed(x)                 a seed known to land the script, for x from 0 to 1
     SiltReel.words()                     frame() alone, with no world, for laying out type
     reel.reset(seed)                     back to t = 0, keeping the world
     reel.tick()                          1/60 s: scripted events and one physics step
     reel.t                               seconds of film
     reel.frame(t, cols, rows)            what is on screen, as plain data
     reel.paint(rgba, cols, rows, cam)    one RGBA pixel per cell of the picture; cam comes from frame()
     reel.warm()                          takes the slowest frames now, and puts everything back
     reel.reduced                         set true: no twinkling, and days pass in fewer steps

   A cell of the picture is one grain, two grains a side when the camera is close, and a square of 2, 4 or 8 grains
   a side once it steps back, the way a terminal would zoom out. Physics only uses + - * /, tables and these dice,
   so a seed plays out the same in every browser. */
(function (root) {
  'use strict';

  /* The script, in seconds of film. The soundtrack is 72 beats to the minute, and every act lands on one. */
  const BEAT = 5 / 6;
  function beat(n) { return Math.round(n * BEAT * 1000) / 1000; }
  const T_LIGHT = 0.5, T_DRIFT = 2.083, T_LAND = beat(4), T_PICK = beat(5), T_SCRATCH = beat(7), T_SOW = beat(8);
  const T_COVER = beat(8.5), T_DIG = beat(10), T_OPEN = beat(12), T_ONE = beat(16), T_CAPTION = beat(17);
  const T_CLAY = beat(31), T_SCOOP = beat(35), T_BRICK = beat(38), T_REEDS = beat(43), T_BIRD = beat(44);
  const T_GOLD = beat(50), T_KEY = beat(53.5), T_X2 = beat(54), T_X4 = beat(56), T_X8 = beat(58), T_RINGS = beat(60);
  const T_NIGHT = beat(64), T_DARK = beat(66), T_LOGO = beat(67), T_WORDS = beat(69), T_LAST = 58.6, T_END = 60;
  const FPS = 30; /* Scripted events run at this rate. Physics runs at twice it. */

  /* Days pass only once the camera steps back, and only in these steps. */
  const DAYS = [1, 2, 3, 5, 7, 9, 12, 16, 21, 27, 34, 42, 51, 61, 72, 84, 97, 110, 120];
  const DAY_AT = [0, 45.417, 45.833, 47.0, 47.333, 47.667, 48.0, 48.6, 48.88, 49.16, 49.44, 49.72, 50.0, 50.28,
    50.56, 50.84, 51.12, 51.4, 51.68];
  /* With reduced motion, the same days in a few hard steps. */
  const DAY_AT_STILL = [0, 99, 45.833, 99, 99, 99, 48.0, 99, 99, 99, 49.0, 99, 99, 99, 99, 99, 99, 99, 50.0];

  /* The view the film is composed for, in cells. One text column is one cell, one text row is two. */
  const VW = 160, VH = 66;

  /* The world, in grains. The patch is the film's own view at 1:1; its grains are live in the window around it. */
  const W = 1600, H = 560, N = W * H;
  const PX = 720, PY = 128;
  const WX0 = PX - 32, WX1 = PX + 192, WY0 = PY, WY1 = PY + 72;
  /* The composed view at each zoom, by its corner in grains. Each one holds the one before. */
  const VIEWS = [[0.5, PX + 16, PY + 8], [1, PX, PY], [2, PX - 80, PY - 40], [4, PX - 240, PY - 64], [8, PX - 560, PY - 128]];
  const MIDDLE = { 0.5: 38, 1: 34, 2: 33, 4: 30, 8: 33 }; /* The row to keep in a short picture. */

  /* Fixed, so every play happens in the same valley. Only the physics dice change. */
  const WORLD_SEED = 7;

  /* Seeds 1 to 256 have each been played through and checked against the script. These few were left out: the
     seed is slow to take, or the pond is slow to reach the notch in the wall. */
  const SEEDS = 256;
  const LEFT_OUT = [7, 15, 23, 31, 59, 69, 78, 93, 102, 108, 116, 158, 170, 172, 179, 191, 198, 202, 204, 208, 220, 229, 234, 249];

  /* Materials. */
  const AIR = 0, STONE = 1, SOIL = 2, STRATA_A = 3, STRATA_B = 4, STRATA_C = 5, SILT = 6, FINE = 7, WATER = 8;
  const CLAY = 9, BRICK = 10, SEED = 11, WOOD = 12, LAMP = 13, FUNGUS = 14, SAND = 15, CRYSTAL = 16;
  const NMAT = 17;
  /* What grows. It lives in a layer of its own, standing in air or water, roots in soil, and blocks nothing. */
  const STEM = 1, LEAF = 2, GRASS = 3, FLOWER = 4, REED = 5, ROOT = 6, BLOSSOM = 7, BUSH = 8, CROP = 9;
  const NFLO = 10;
  const KEEP = 255, NEVER = 255; /* No change; never born. */

  function table(list, n) { const t = new Uint8Array(n || 256); list.forEach((m) => { t[m] = 1; }); return t; }
  const ACTIVE = table([SILT, FINE, WATER, CLAY, SEED]);
  const SOAKS = table([SILT, SOIL]); /* Takes water in, and darkens. Fine silt and clay hold water and take none. */
  const SOAK_RATE = 0.04, SOAK_STEP = 60; /* Dry ground drinks at this rate, damp ground far slower; each grain dampens it this much. */
  const SOAK_FULL = new Uint8Array(256); SOAK_FULL[SILT] = 230; SOAK_FULL[SOIL] = 230; 
  const EARTH = table([SILT, FINE, SOIL, STRATA_A, CLAY, SAND]); /* Roots go through it. */
  const BUILT = table([BRICK, WOOD]);

  function rgb(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shades(list, n) {
    const p = new Float32Array(n * 12);
    list.forEach((e) => { e[1].split(' ').forEach((h, k) => { p.set(rgb(h), (e[0] * 4 + k) * 3); }); });
    return p;
  }
  /* Four shades of each, dark to light. Clay, dusk and lantern. */
  const PAL = shades([
    [STONE, '3e3a38 4a4643 57534f 66615c'], [SOIL, '281c17 34251e 422f26 513b2f'],
    [STRATA_A, '7b4331 90523b a56346 b97654'], [STRATA_B, '87684a 987756 aa8763 bb9872'],
    [STRATA_C, '4e4a38 5a5641 67624b 746f56'], [SILT, '8c7864 9a8570 a8937e b6a08c'],
    [FINE, 'a99682 b6a390 c3b09c d0bea9'], [WATER, '273d52 2f475c 355066 4c687c'],
    [CLAY, '9a5236 ae6040 c27250 d08460'], [BRICK, '7e4630 93553a a86848 b87a58'],
    [SEED, '9c7a3c b8914a d2ac60 e6c47a'], [WOOD, '3d2a20 52382a 6a4934 845d42'],
    [LAMP, 'f2a24a fbc66a ffe09a fff6dc'], [FUNGUS, 'd9a85a e8c07a f4d89c fdeccc'],
    [SAND, 'a4876a b69876 c7a884 d8ba95'], [CRYSTAL, '7fa6b8 a8ccd8 d0ecf0 f4fcff']
  ], NMAT);
  const FPAL = shades([
    [STEM, '3d2a20 52382a 6a4934 845d42'], [LEAF, '223a2b 2d4c37 3b5f42 527651'],
    [GRASS, '2b4430 38573a 4a6b40 62824b'], [FLOWER, 'c8743e e39c52 efc46c f7e6c4'],
    [REED, '58673a 6c7c43 83924f a0aa60'], [ROOT, 'a08868 b49a78 c8ae8a dac29c'],
    [BLOSSOM, 'b3564c cf7a62 e6a17a f5d2ae'], [BUSH, '2b4431 39573e 4c6b49 668458'],
    [CROP, '6c7c43 83924f a0aa60 c0c47a']
  ], NFLO);
  /* The light each glowing thing gives, and its colour. */
  const EMIT = new Float32Array(NMAT * 3);
  [[LAMP, 1.0, 0.72, 0.36], [FUNGUS, 0.5, 0.42, 0.22], [CRYSTAL, 0.2, 0.3, 0.38]].forEach((e) => { EMIT.set(e.slice(1), e[0] * 3); });
  const GLOWS = table([LAMP, FUNGUS, CRYSTAL]);

  const CRE_EYE = rgb('221917'), CRE_SHADOW = rgb('c9a47e'), CRE_BODY = rgb('e2c29c'), CRE_BELLY = rgb('fbebd2');
  const SEED_C = rgb('e6c47a'), BIRD_C = rgb('9a6a44'), BIRD_BELLY = rgb('f4d2a8'), BEE = rgb('f2a24a');
  const FLY = rgb('ffe09a'), LAMPC = rgb('ffd49a'), CLAY_A = rgb('c27250'), CLAY_B = rgb('d08460');

  /* Text colours. */
  const FG = '#e8ded1', DIM = '#968676', BRIGHT = '#fff6e8', AMBER = '#f5be6e', LANTERN = '#ffd49a';
  const GREEN = '#a0aa60', CLAYC = '#d08460', BACK = '#100d0b';
  const COLORS = {
    term: BACK, band: '#090706', pane: '#181310', paneLine: '#3b2f27', title: '#221b16',
    key: '#6b4c33', keyOn: BRIGHT, keyOff: DIM, cap: '#f4ece0', endTwo: '#a89888'
  };
  const KEYS = [['p', 'plant'], ['d', 'dig'], ['b', 'build'], ['z', 'zoom']];

  const CAPTIONS = [
    [T_CAPTION, beat(23), 'Give a little. It gives back more.'],
    [T_RINGS, T_NIGHT, 'All of this, from one seed.']
  ];

  /* The sky through the day: a time, then the colour at the top and at the horizon. */
  const SKY = [
    [0, '3b4762', 'c89478'], [8, '5c7ea0', 'd8c4ae'], [T_ONE, '6a92b8', 'd6d6cc'], [30, '6a96bc', 'd8dccf'],
    [38, '5e82a4', 'e0cfa8'], [T_GOLD, '4d566e', 'eab680'], [T_X4, '3b4762', 'c89478'], [T_X8 + 2, '2e3b56', 'b8887a'],
    [T_NIGHT, '24304a', '977b78'], [beat(64.5), '1a2238', '5e5260'], [beat(65), '121828', '34303e'], [T_END, '121828', '34303e']
  ].map((k) => [k[0], rgb(k[1]), rgb(k[2])]);
  /* Light on the ground through the day, as red, green and blue. Night comes in three steps. */
  const DAYLIGHT = [
    [0, 0.8, 0.76, 0.82], [8, 1.05, 1.02, 1.0], [T_ONE, 1.24, 1.21, 1.14], [30, 1.28, 1.25, 1.18], [38, 1.2, 1.13, 1.02],
    [T_GOLD, 1.13, 1.0, 0.86], [T_X2, 1.04, 0.92, 0.82], [T_X8, 1.0, 0.9, 0.88], [T_NIGHT, 0.96, 0.87, 0.87],
    [T_NIGHT + 0.001, 0.68, 0.63, 0.72], [beat(64.5), 0.48, 0.46, 0.6], [beat(65), 0.33, 0.33, 0.48], [T_END, 0.33, 0.33, 0.48]
  ];

  /* The patch's surface, in its own grains: x, then the row. A rock shoulder, a dip, a long slope, a basin, a lip. */
  const PATCH = [[-32, 10], [0, 14], [20, 16], [34, 19], [38, 20], [39, 27], [54, 29], [56, 30], [59, 32], [62, 31],
    [64, 30], [104, 37], [107, 38], [113, 41], [121, 43], [130, 42], [136, 39], [142, 39], [192, 50]];
  /* The rest of the valley, in grains: hills on both sides, the patch on a slope, terraces down to a lake. */
  const LAND = [[0, 96], [120, 88], [220, 100], [300, 116], [420, 126], [520, 124], [600, 116], [650, 120], [688, 138],
    [912, 178], [1160, 246], [1172, 254], [1350, 256], [1362, 248], [1420, 196], [1480, 168], [1540, 176], [1600, 186]];
  const LAKE_X0 = 1176, LAKE_X1 = 1346, LAKE_Y = 252; /* The valley's lake, and its surface. */
  /* How deep the rock shoulder goes under the patch's left, by patch column. */
  const ROCK = [[-70, 0], [-50, 12], [-20, 24], [10, 26], [25, 20], [34, 14], [38, 10]];
  /* Caves under the hills, x, y and radii; the day each is reached and lit; and the tunnels dug between them. */
  const CAVES = [[620, 328, 52, 17], [930, 384, 40, 14], [1080, 424, 54, 17], [1250, 404, 44, 15], [1392, 352, 34, 13],
    [330, 382, 42, 14], [524, 444, 48, 15]];
  const CAVE_DAYS = [40, 58, 70, 82, 95, 108, 50];
  const TUNNELS = [
    [[[850, 204], [826, 232], [770, 268], [700, 300], [650, 318]], 27, 40],
    [[[600, 338], [566, 390], [530, 432]], 42, 50],
    [[[668, 338], [760, 362], [890, 380]], 51, 58],
    [[[968, 390], [1030, 412]], 61, 70],
    [[[1132, 424], [1206, 406]], 72, 82],
    [[[1292, 396], [1360, 360]], 84, 95],
    [[[1392, 340], [1420, 260], [1440, 186]], 95, 100],
    [[[476, 444], [380, 392]], 97, 108],
    [[[320, 368], [300, 260], [290, 128]], 108, 116]
  ];
  /* Terraces: from, to, the day, and whether it grows crops rather than holding a pond. */
  const TERRACES = [[912, 962, 2, 0], [962, 1012, 3, 0], [1012, 1062, 5, 1], [1062, 1112, 8, 0], [1112, 1162, 12, 1]];
  /* Trees: where, how tall, the day they are planted. */
  const TREES = [
    [668, 30, 5, { blossom: true }], [646, 38, 9], [936, 26, 6], [994, 40, 10, { blossom: true }], [1046, 30, 14], [1092, 44, 18],
    [1146, 36, 22], [1168, 48, 27], [1356, 46, 38], [1384, 36, 44], [1418, 40, 55, { blossom: true }], [1446, 32, 66],
    [618, 44, 12, { blossom: true }], [596, 52, 16], [566, 40, 20], [540, 58, 24], [512, 46, 28], [452, 62, 36],
    [424, 48, 42, { blossom: true }], [398, 56, 48], [370, 44, 55], [344, 60, 62], [316, 50, 70], [290, 42, 78, { blossom: true }],
    [266, 54, 86], [246, 38, 94]
  ];
  /* Houses: where, the day, how wide and how tall. */
  const HOUSES = [[574, 34, 22, 12], [500, 61, 18, 10], [1356, 51, 22, 12], [1424, 72, 20, 11], [296, 97, 20, 11]];

  /* Where the creature is: from this time, at this column of the patch, facing this way, doing this. */
  const PATH = [
    [0, 44, 1, 'sit'], [T_PICK, 44, 1, 'walk'], [5.75, 58, 1, 'stand'], [7.29, 58, -1, 'walk'], [8.25, 39, -1, 'stand'],
    [10.25, 39, 1, 'walk'], [11.1, 47, 1, 'sit'], [14.2, 47, 1, 'walk'], [15.8, 56, 1, 'sit'],
    [20.4, 56, 1, 'walk'], [21.4, 64, 1, 'stand'], [22.0, 64, -1, 'walk'], [22.8, 57, -1, 'sit'],
    [26.0, 57, 1, 'walk'], [28.33, 124, 1, 'stand'], [30.0, 124, 1, 'walk'], [31.3, 141, -1, 'stand'],
    [beat(42.6), 141, -1, 'walk'], [37.4, 100, -1, 'stand'], [37.9, 100, 1, 'sit'], [T_END, 100, 1, 'sit']
  ];
  /* The spring: water held in the rock behind a plug, three grains across and two high, and where it comes in from. */
  const PLUG = [[38, 24], [37, 24], [36, 24]];
  const SOURCE = [27, 21], SPRING = 1.0;
  const SOW_X = 62; /* Where the seed goes. */
  /* How long, in frames, fine silt has to lie under water to become clay, and a seed has to be damp to sprout. */
  const CLAY_AFTER = 125, SPROUT_AFTER = 170;
  /* The film's water is timed so that the clay comes when the words say it does: it starts to settle from here. */
  const CLAY_FROM = 20.6 * 60;
  /* The wall: ten grains of clay, bottom row first, with a notch in the top row. */
  const WALL = [[137, 38], [138, 38], [139, 38], [140, 38], [137, 37], [138, 37], [139, 37], [140, 37], [137, 36], [140, 36]];

  /* Where the action is, for a picture narrower than the film: a time, then the patch column to keep centred. */
  const FOCUS = [0, 50, 4.2, 52, 6.0, 60, 7.5, 58, 8.3, 46, 10.0, 46, T_ONE, 60, 16, 68, 20, 80, 24, 96, 26, 104, 29, 118,
    beat(42.6), 118, 37.0, 98, T_X2, 80];

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

  /* Noise from integer hashing and arithmetic alone, so the world is the same grain for grain everywhere. */
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  function fbm(x, y, s) { return 0.6 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.1 * vnoise(x * 4.3, y * 4.3, s + 13); }

  function lerpAt(pts, x, eased) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      if (x > b[0] && k + 2 < pts.length) continue;
      let u = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
      if (eased) u = u * u * (3 - 2 * u);
      return a[1] + (b[1] - a[1]) * u;
    }
    return pts[pts.length - 1][1];
  }

  /* Where the camera is: 2 is a cell of 2 x 2 grains, 0.5 is a grain drawn 2 x 2. */
  function zoomAt(t) { return t < T_ONE ? 0.5 : t < T_X2 ? 1 : t < T_X4 ? 2 : t < T_X8 ? 4 : 8; }
  function viewOf(z) { for (let k = 0; k < VIEWS.length; k++) if (VIEWS[k][0] === z) return VIEWS[k]; return VIEWS[1]; }
  function dayStepAt(t, reduced) {
    const at = reduced ? DAY_AT_STILL : DAY_AT;
    let s = 0;
    for (let k = 1; k < at.length; k++) if (t >= at[k]) s = k;
    return s;
  }
  function stepOfDay(d) { let s = 0; while (s + 1 < DAYS.length && DAYS[s] < d) s++; return s; }

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
  /* The word fills from the floor up in the film's own materials: silt, clay, soil, leaf, grass, flower, lantern. */
  const LOGO_STOPS = [[0, 'b6a08c'], [0.16, 'c3b09c'], [0.2, 'c27250'], [0.34, 'b86a48'], [0.38, '6a4c3a'],
    [0.5, '7a5a44'], [0.54, '4a6b40'], [0.68, '62824b'], [0.72, 'e39c52'], [0.84, 'efc46c'], [0.9, 'ffe09a'], [1, 'fff6dc']]
    .map((s) => [s[0], rgb(s[1])]);
  const LOGO_MIN_COLS = 130; /* Narrower than this, the smaller word. */

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
      const k = 1 - (ys[i] - y0) / (y1 - y0);
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
      order: new Uint16Array(n), begin: new Float32Array(n), tint: new Float32Array(n), sway: new Float32Array(n)
    };
  }

  /* ---- The valley ---- */

  /* Everything that never changes during a play, the materials as they start, and what each grain becomes and on
     which day. It yields between the heavy parts, so it can be spread over several tasks. */
  function* buildWorld() {
    const M0 = new Uint8Array(N), SH = new Uint8Array(N), MO0 = new Uint8Array(N);
    const FIN = new Uint8Array(N).fill(KEEP), FLF = new Uint8Array(N);
    const BM = new Uint8Array(N).fill(NEVER), BF = new Uint8Array(N).fill(NEVER);
    const surf = new Int16Array(W);
    const rng = dice(WORLD_SEED);

    function inWindow(x, y) { return x >= WX0 && x < WX1 && y >= WY0 && y < WY1; }
    function at(x, y) { return y * W + x; }
    function ok(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }

    /* The surface. Inside the window it is exact; outside it rolls a little. */
    for (let x = 0; x < W; x++) {
      let y;
      if (x >= WX0 && x < WX1) y = PY + lerpAt(PATCH, x - PX, false);
      else y = lerpAt(LAND, x, true) + 4 * (fbm(x / 53, 0.5, 11) - 0.5) + 1.5 * (vnoise(x / 11, 3.5, 12) - 0.5);
      surf[x] = Math.floor(y);
    }
    yield;

    /* Strata, wavering with depth below the surface, and the rock shoulder at the patch's left. */
    for (let y = 0; y < H; y++) {
      if ((y & 63) === 0) yield;
      for (let x = 0; x < W; x++) {
        const i = at(x, y), s = surf[x];
        if (y < s) continue;
        const d = y - s, px = x - PX;
        const wob = 8 * (vnoise(x / 31, y / 13, 3) - 0.5) + 6 * (vnoise(x / 97, 1.5, 4) - 0.5);
        const e = d + (d > 6 ? wob : 0);
        const rock = px <= 38 && px >= -70 ? lerpAt(ROCK, px, true) + 4 * (vnoise(x / 6, y / 5, 21) - 0.5) : 0;
        let m;
        if (d < rock) m = STONE;
        else if (e < 5) m = px >= 104 && px <= 142 && d < 6 ? FINE : SILT;
        else if (e < 15) m = SOIL;
        else if (e < 32) m = STRATA_A;
        else if (e < 56) m = STRATA_B;
        else if (e < 92) m = STRATA_C;
        else m = STONE;
        M0[i] = m;
        /* Fine banding inside each layer, and a little grain to grain. Deep stone lies in beds. */
        const band = vnoise(x / 23, y / 2.2, 5), jit = hash(x, y, 6);
        let sh = Math.floor(clamp(band * 2.6 + jit * 1.6 - 0.3, 0, 3.99));
        if (m === STONE && d > 92) sh = ((y + Math.floor(5 * vnoise(x / 40, y / 40, 8))) % 11 === 0) ? 0 : sh;
        SH[i] = sh | (Math.floor(jit * 64) << 2);
      }
    }
    yield;

    /* The spring: a pocket of water in the shoulder, plugged at the face. */
    for (let py = 19; py <= 27; py++) {
      for (let px = 25; px <= 38; px++) {
        const a = (px - 31) / 4.6, b = (py - 23) / 3.4;
        if (a * a + b * b < 1 && px <= 35) M0[at(PX + px, PY + py)] = WATER;
      }
    }
    for (let px = 36; px <= 38; px++) {
      M0[at(PX + px, PY + 23)] = STONE;
      M0[at(PX + px, PY + 26)] = STONE;
    }
    M0[at(PX + 35, PY + 24)] = WATER;
    M0[at(PX + 35, PY + 25)] = WATER;
    PLUG.forEach((p) => { M0[at(PX + p[0], PY + p[1])] = SILT; M0[at(PX + p[0], PY + p[1] + 1)] = SILT; });

    function blob(cx, cy, rx, ry, salt, fn) {
      for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
        for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
          if (!ok(x, y) || inWindow(x, y)) continue;
          const a = (x - cx) / rx, b = (y - cy) / ry;
          if (a * a + b * b + 0.5 * (vnoise(x / 6, y / 4, salt) - 0.5) < 1) fn(at(x, y), x, y);
        }
      }
    }
    function carve(pts, r, fn) {
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1], len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        for (let s = 0; s <= len; s++) {
          const u = s / len, cx = a[0] + (b[0] - a[0]) * u, cy = a[1] + (b[1] - a[1]) * u + 2 * (vnoise(s / 9, k, 31) - 0.5);
          for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
            for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
              const x = Math.round(cx + dx), y = Math.round(cy + dy);
              if (!ok(x, y) || inWindow(x, y) || dx * dx + dy * dy > r * r + 0.5) continue;
              fn(at(x, y), x, y, (k + u) / (pts.length - 1));
            }
          }
        }
      }
    }

    /* Under the hills: a lake in the rock, the vein that feeds the spring, and caves where fungi glow. */
    blob(440, 252, 104, 15, 41, (i, x, y) => { M0[i] = y >= 248 ? WATER : AIR; });
    carve([[540, 256], [600, 236], [650, 214], [684, 204]], 0.8, (i) => { M0[i] = WATER; });
    carve([[520, 262], [566, 300], [600, 322]], 0.7, (i) => { M0[i] = WATER; });
    /* Thin veins of water through the deep rock. */
    [[[700, 360], [780, 400], [860, 470]], [[1000, 300], [1060, 350], [1150, 360]], [[1180, 300], [1230, 340], [1320, 470]],
      [[260, 300], [300, 420], [380, 500]], [[1450, 260], [1470, 380], [1500, 470]]].forEach((v) => { carve(v, 0.6, (i) => { if (M0[i] !== AIR) M0[i] = WATER; }); });
    CAVES.forEach((c, k) => { blob(c[0], c[1], c[2], c[3], 42 + k, (i) => { M0[i] = AIR; }); });
    yield;
    /* Cave floors drift with sand; pools gather at the low ends; fungi stand on the floors and hang from ceilings. */
    function floors(x0, x1, y0, y1, fungus, pool) {
      for (let x = x0; x <= x1; x++) {
        let y = y1;
        while (y > y0 && M0[at(x, y)] !== AIR) y--;
        if (M0[at(x, y)] !== AIR) continue;
        const depth = 1 + Math.floor(2 * vnoise(x / 5, y0, 51));
        for (let k = 0; k < depth; k++) if (M0[at(x, y - k)] === AIR) M0[at(x, y - k)] = SAND;
        if (pool && x > pool[0] && x < pool[1]) M0[at(x, y - depth)] = WATER;
        if (hash(x, y, 52) < fungus) {
          const tall = 1 + Math.floor(hash(x, y, 53) * 3);
          for (let k = 0; k < tall; k++) if (M0[at(x, y - depth - k)] === AIR) M0[at(x, y - depth - k)] = FUNGUS;
        }
        let top = y0;
        while (top < y && M0[at(x, top)] !== AIR) top++;
        if (top < y && hash(x, top, 54) < fungus * 0.35) M0[at(x, top)] = FUNGUS;
      }
    }
    CAVES.forEach((c, k) => {
      floors(c[0] - c[2] - 3, c[0] + c[2] + 3, c[1] - c[3] - 3, c[1] + c[3] + 3, 0.09, k === 0 ? [c[0] - 30, c[0] - 8] : null);
    });
    /* A geode, for whoever digs that far. */
    blob(1430, 470, 6, 5, 46, (i, x, y) => {
      const a = (x - 1430) / 6, b = (y - 470) / 5;
      M0[i] = a * a + b * b < 0.35 ? AIR : CRYSTAL;
      SH[i] = (SH[i] & 0xfc) | Math.floor(hash(x, y, 47) * 4);
    });
    /* Pebbles and boulders in the soil and strata. */
    for (let k = 0; k < 640; k++) {
      const cx = Math.floor(rng() * W), cy = surf[clamp(cx, 0, W - 1)] + 8 + Math.floor(rng() * 300);
      const r = 1 + rng() * (rng() < 0.15 ? 4.5 : 1.6);
      blob(cx, cy, r, r * 0.8, 48, (i, x, y) => {
        if (M0[i] === AIR || M0[i] === WATER || M0[i] === FUNGUS || M0[i] === SAND) return;
        M0[i] = STONE;
        SH[i] = (SH[i] & 0xfc) | (y < cy ? 3 : y > cy + r * 0.4 ? 0 : 2);
      });
    }
    /* The valley's lake. */
    for (let x = LAKE_X0; x <= LAKE_X1; x++) {
      const depth = Math.round(16 * Math.sqrt(Math.max(0, Math.sin(Math.PI * (x - LAKE_X0) / (LAKE_X1 - LAKE_X0)))));
      for (let y = Math.min(surf[x], LAKE_Y); y < LAKE_Y; y++) M0[at(x, y)] = AIR;
      for (let y = LAKE_Y; y < LAKE_Y + depth; y++) M0[at(x, y)] = WATER;
      for (let y = LAKE_Y + depth; y < LAKE_Y + depth + 3; y++) if (M0[at(x, y)] !== WATER) M0[at(x, y)] = SAND;
      surf[x] = LAKE_Y;
    }
    /* Damp around water under the ground. */
    for (let y = 200; y < H - 3; y++) {
      for (let x = 260; x < 1500; x++) {
        if (M0[at(x, y)] !== WATER || inWindow(x, y)) continue;
        for (let d = -3; d <= 3; d++) if (SOAKS[M0[at(x, y + d)]]) MO0[at(x, y + d)] = 200;
      }
    }
    yield;

    /* ---- What grows and gets built, and on which day ---- */

    function mat(x, y, m, day, sh) {
      if (!ok(x, y)) return;
      const i = at(x, y);
      if (BM[i] !== NEVER && BM[i] <= day) return;
      FIN[i] = m;
      BM[i] = clamp(Math.round(day), 2, 120);
      if (sh !== undefined) SH[i] = (SH[i] & 0xfc) | sh;
    }
    function flo(x, y, f, day, sh) {
      if (!ok(x, y)) return;
      const i = at(x, y);
      if (BF[i] !== NEVER && BF[i] <= day) return;
      FLF[i] = f;
      BF[i] = clamp(Math.round(day), 2, 120);
      if (sh !== undefined) SH[i] = (SH[i] & 0xfc) | sh;
    }
    function now(i) { return BM[i] !== NEVER ? FIN[i] : M0[i]; }
    function solid(x, y) { const m = now(at(x, y)); return m !== AIR && m !== WATER; }
    /* The surface once everything is built. */
    function topAt(x) {
      let y = 0;
      while (y < H - 1 && now(at(x, y)) === AIR) y++;
      return y;
    }
    function groundAt(x) {
      let y = 0;
      while (y < H - 1 && !solid(x, y)) y++;
      return y;
    }

    /* Terraces down the slope below the patch: a clay lip, the soil levelled behind it, and a pond. Two grow crops. */
    TERRACES.forEach((tr) => {
      const x0 = tr[0], x1 = tr[1], day = tr[2], crops = tr[3], L = surf[x0];
      for (let x = x0; x < x1; x++) {
        const lip = x >= x1 - 4;
        for (let y = L - 4; y < surf[x]; y++) {
          if (lip) mat(x, y, BRICK, day, (x + (y % 2) * 2) % 4 === 0 ? 0 : 2);
          else if (y >= L || (crops ? y >= L - 1 : x < x0 + 10)) mat(x, y, SOIL, day, 2);
          else if (!crops) mat(x, y, WATER, day + 1, 1);
        }
        if (crops && !lip && x > x0 + 2 && x % 3 !== 0) {
          const h = 3 + Math.floor(hash(x, day, 61) * 4);
          for (let k = 1; k <= h; k++) flo(x, L - 1 - k, CROP, day + 2 + k * 0.5, Math.min(3, k));
        }
      }
      /* The overflow, falling down the face of the lip. */
      for (let y = L - 4; y < surf[x1]; y++) { mat(x1, y, WATER, day + 1, 2); mat(x1 + 1, y, WATER, day + 1, 3); }
    });
    yield;

    /* How soon a place gets tended: near the patch first, then outward. The far edges never. */
    function dayFor(x, spread) {
      if (x < 236 || x > 1452) return NEVER;
      const d = Math.abs(x - (PX + 80));
      const k = Math.pow(clamp((d - 60) / 660, 0, 1), 1.1);
      return clamp(Math.round(2 + 118 * k + (spread || 6) * (hash(x, 9, 62) - 0.5)), 2, 120);
    }

    /* Roots: pale threads down through the earth. */
    function root(x, y, len, day, wander) {
      for (let k = 0; k < len; k++) {
        if (!ok(x, y) || !EARTH[now(at(x, y))] && now(at(x, y)) !== STRATA_B && now(at(x, y)) !== STRATA_C) break;
        flo(x, y, ROOT, day + k * 0.25, 1 + Math.floor(hash(x, y, 63) * 3));
        const r = hash(x, y, 64 + k);
        x += r < wander ? -1 : r > 1 - wander ? 1 : 0;
        y += 1;
        if (k > 6 && hash(x, y, 65) < 0.04 && len > 20) root(x, y, (len - k) >> 1, day + k * 0.25, wander);
      }
    }
    /* A tree: a trunk, a few branches and round clusters of leaves. Some blossom. */
    function tree(bx, h, day, opts) {
      const by = groundAt(bx);
      if (by >= H - 2) return;
      const base = opts.w || Math.max(2, Math.round(h / 14)), top = by - h;
      for (let y = by - 1; y >= top + h * 0.25; y--) {
        const k = (by - y) / h, w = Math.max(1, Math.round(base * (1 - k * 0.6)));
        for (let i = 0; i < w; i++) flo(bx - (w >> 1) + i, y, STEM, day + 5 * k, i === 0 ? 3 : 1);
      }
      const r = opts.r || Math.max(4, h / 3.3), clusters = opts.clusters || Math.max(3, Math.round(h / 8));
      for (let c = 0; c < clusters; c++) {
        const cx = bx + (c === 0 ? 0 : (hash(bx, c, 66) - 0.5) * r * 2.2), cy = top + r * 0.9 + (c === 0 ? -r * 0.3 : hash(bx, c, 67) * r * 0.9);
        const rr = r * (c === 0 ? 1 : 0.55 + 0.35 * hash(bx, c, 68));
        for (let k = 0; c > 0 && k <= 6; k++) flo(Math.round(bx + (cx - bx) * k / 6), Math.round(by - h * 0.45 + (cy - by + h * 0.45) * k / 6), STEM, day + 3, 1);
        for (let y = Math.floor(cy - rr - 1); y <= cy + rr + 1; y++) {
          for (let x = Math.floor(cx - rr - 1); x <= cx + rr + 1; x++) {
            const a = (x - cx) / rr, b = (y - cy) / (rr * 0.85);
            if (a * a + b * b > 0.82 + 0.36 * vnoise(x / 3, y / 3, 69)) continue;
            if (!ok(x, y) || solid(x, y)) continue;
            const light = 0.55 - 0.35 * a - 0.45 * b + (vnoise(x / 2.5, y / 2.5, 70) - 0.5) * 0.6;
            const blossom = opts.blossom && vnoise(x / 2.4, y / 2.4, 71) > 0.64;
            flo(x, y, blossom ? BLOSSOM : LEAF, day + 3 + 6 * (a * a + b * b), Math.floor(clamp(light * 4, 0, 3.99)));
          }
        }
      }
      const roots = 3 + Math.round(h / 12);
      for (let k = 0; k < roots; k++) {
        root(bx - base + Math.floor(hash(bx, k, 72) * base * 2 + 1), by + 1, Math.round(h * (0.6 + 0.9 * hash(bx, k, 73))), day + 2, 0.3);
      }
    }
    /* A clay house with lit windows, a door, a roof thatched with moss and a chimney. */
    function house(x0, day, w, ht) {
      w = w || 22; ht = ht || 11;
      let floor = H;
      for (let x = x0 - 1; x <= x0 + w; x++) floor = Math.min(floor, groundAt(x));
      for (let x = x0 - 1; x <= x0 + w; x++) { const g = groundAt(x); for (let y = floor; y <= g; y++) mat(x, y, STONE, day, 1); }
      for (let y = floor - ht; y < floor; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const row = floor - y;
          const win = row >= ht - 4 && row <= ht - 2 && ((x - x0) % 8 === 2 || (x - x0) % 8 === 3 || (x - x0) % 8 === 4) && x < x0 + w - 6;
          const door = x >= x0 + w - 5 && x <= x0 + w - 3 && row <= 6;
          if (win) mat(x, y, LAMP, day, row === ht - 2 ? 2 : 1);
          else if (door) mat(x, y, WOOD, day, 1);
          else mat(x, y, BRICK, day, (x + (y % 2) * 2) % 4 === 0 ? 0 : 2 + (hash(x, y, 74) < 0.3 ? 1 : 0));
        }
      }
      const pitch = Math.ceil((w + 4) / 2);
      for (let r = 0; r < pitch; r++) {
        const y = floor - ht - 1 - Math.floor(r * 0.75), x0r = x0 - 2 + r, x1r = x0 + w + 1 - r;
        if (x1r < x0r) break;
        for (let x = x0r; x <= x1r; x++) {
          if (x === x0r || x === x1r) mat(x, y, WOOD, day, 0);
          else flo(x, y, BUSH, day + 2, 1 + Math.floor(vnoise(x / 2, y / 2, 75) * 3));
          if (r === 0) mat(x, y, WOOD, day, 1);
        }
      }
      for (let y = floor - ht - 1 - Math.floor(pitch * 0.5); y < floor - ht; y++) { mat(x0 + w - 5, y, BRICK, day, 1); mat(x0 + w - 4, y, BRICK, day, 2); }
    }
    function lantern(x, day) {
      const y = groundAt(x);
      for (let k = 1; k <= 4; k++) mat(x, y - k, WOOD, day, 1);
      mat(x, y - 5, LAMP, day, 3);
    }
    function tower(x0, day) {
      const base = groundAt(x0 + 5);
      for (let x = x0 - 1; x < x0 + 11; x++) { const g = groundAt(x); for (let y = base; y <= g; y++) mat(x, y, STONE, day, 1); }
      for (let y = base - 52; y < base; y++) {
        for (let x = x0; x < x0 + 10; x++) {
          const win = (base - y) % 12 === 6 && x >= x0 + 4 && x <= x0 + 5;
          mat(x, y, win ? LAMP : BRICK, day, win ? 2 : (y % 3 === 0 || x === x0) ? 0 : 2);
        }
      }
      for (let x = x0 - 2; x < x0 + 12; x++) mat(x, base - 53, WOOD, day, 1);
      for (let y = base - 58; y < base - 53; y++) for (let x = x0 + 3; x < x0 + 7; x++) mat(x, y, LAMP, day, y === base - 58 ? 3 : 2);
    }

    /* Meadows: grass wherever a place has been tended, flowers in it, a bush here and there, roots below. */
    for (let x = 236; x <= 1452; x++) {
      const day = dayFor(x, 8);
      if (day === NEVER) continue;
      if (inWindow(x, surf[x] - 1)) continue;
      const y = topAt(x);
      if (y >= H - 1 || now(at(x, y)) === WATER) continue;
      const tall = 1 + Math.floor(hash(x, 3, 77) * 3.4);
      for (let k = 1; k <= tall; k++) flo(x, y - k, GRASS, day + k * 0.6, k === tall ? 3 : 1 + (k & 1));
      if (hash(x, 4, 78) < 0.08) flo(x, y - tall - 1, hash(x, 5, 79) < 0.2 ? BLOSSOM : FLOWER, day + 5, 1 + Math.floor(hash(x, 6, 80) * 2));
      if (hash(x, 7, 81) < 0.4) root(x, y + 1, 4 + Math.floor(hash(x, 8, 82) * 18), day + 3, 0.25);
      if (hash(x, 10, 83) < 0.035) {
        const w = 3 + Math.floor(hash(x, 11, 84) * 5);
        for (let dx = -w; dx <= w; dx++) {
          const yy = topAt(x + dx), hgt = Math.round((w - Math.abs(dx)) * 0.9) + 1;
          if (now(at(x + dx, yy)) === WATER) continue;
          for (let k = 1; k <= hgt; k++) flo(x + dx, yy - k, BUSH, day + 6, Math.floor(clamp(3 - k * 0.6 + hash(x + dx, k, 85), 0, 3.99)));
        }
      }
    }
    /* Reeds along the terrace ponds and the lake. */
    for (let x = 912; x <= LAKE_X1 + 4; x++) {
      const y = topAt(x);
      if (now(at(x, y)) !== WATER || hash(x, 12, 86) > 0.32) continue;
      let bed = y;
      while (bed < H - 1 && now(at(x, bed)) === WATER) bed++;
      if (bed - y > 7) continue;
      const day = Math.max(dayFor(x, 6) + 3, x > LAKE_X0 ? 30 : 4);
      const h = bed - y + 3 + Math.floor(hash(x, 13, 87) * 5);
      for (let k = 1; k <= h; k++) flo(x, bed - k, REED, day + k * 0.4, k === h ? 3 : 1 + (k & 1));
    }
    yield;

    /* Trees: a young grove near the patch, groves along the terraces and the lake, a forest on the high ground. */
    TREES.forEach((tr) => { tree(tr[0], tr[1], tr[2], tr[3] || {}); });
    yield;

    /* Houses, a tower, a bridge, lanterns along the way. */
    HOUSES.forEach((h) => { house(h[0], h[1], h[2], h[3]); });
    tower(1470, 97);
    for (let x = 1214; x <= 1290; x++) {
      const deck = Math.round(LAKE_Y - 4 - 8 * Math.sin(Math.PI * (x - 1214) / 76));
      mat(x, deck, WOOD, 61, 1);
      mat(x, deck + 1, WOOD, 61, 0);
      if (x % 5 === 0) mat(x, deck - 1, WOOD, 61, 2);
      if (x === 1214 || x === 1290 || x % 19 === 0) for (let y = deck + 2; y < LAKE_Y + 14; y++) mat(x, y, WOOD, 61, 0);
    }
    [[908, 22], [960, 25], [1014, 27], [1060, 30], [1104, 34], [1156, 42], [1208, 61], [1296, 61], [1352, 51], [618, 34],
      [548, 42], [500, 61], [420, 72], [372, 84], [300, 97], [1406, 72], [1440, 84], [256, 110]].forEach((l) => { lantern(l[0], l[1]); });
    /* The well, down to the lake in the rock. */
    {
      const x0 = 480, y0 = groundAt(x0);
      for (let y = y0 - 4; y < 250; y++) {
        mat(x0 - 3, y, BRICK, 42, 1);
        mat(x0 + 3, y, BRICK, 42, 1);
        for (let x = x0 - 2; x <= x0 + 2; x++) if (y >= y0) mat(x, y, AIR, 42);
      }
      for (let x = x0 - 4; x <= x0 + 4; x++) mat(x, y0 - 9, WOOD, 42, 0);
      for (let y = y0 - 8; y < y0 - 4; y++) { mat(x0 - 4, y, WOOD, 42, 1); mat(x0 + 4, y, WOOD, 42, 1); }
    }
    /* Tunnels, dug a little further each day and lit as they go: from the basin down to the glowing cave, and on, until
       the caves are joined up. */
    function tunnel(pts, day0, day1) {
      carve(pts, 1.6, (i, x, y, u) => { if (M0[i] !== WATER) mat(x, y, AIR, day0 + (day1 - day0) * u); });
      /* Then a lantern on the floor every so often along it. */
      let along = 0;
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k], b = pts[k + 1], len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        for (let s = 0; s < len; s++, along++) {
          if (along % 24 !== 12) continue;
          const x = Math.round(a[0] + (b[0] - a[0]) * s / len);
          let y = Math.round(a[1] + (b[1] - a[1]) * s / len);
          while (y < H - 1 && !solid(x, y + 1)) y++;
          /* Set into the floor: a grain changes only once, and the tunnel has already changed the one above. */
          if (!inWindow(x, y + 1)) mat(x, y + 1, LAMP, day0 + (day1 - day0) * (k + s / len) / (pts.length - 1) + 2, 2);
        }
      }
    }
    TUNNELS.forEach((tn) => { tunnel(tn[0], tn[1], tn[2]); });
    CAVES.forEach((c, k) => {
      for (let j = 0; j < 4; j++) {
        const x = Math.round(c[0] + (j - 1.5) * c[2] * 0.45);
        let y = c[1];
        while (y < H - 1 && now(at(x, y + 1)) === AIR) y++;
        mat(x, y, LAMP, CAVE_DAYS[k] + j * 2, 3);
      }
    });

    /* Inside the patch, after the film's day: grass where none grew, flowers, a house by the pond, two trees. */
    for (let x = WX0 + 2; x < WX1 - 2; x++) {
      if (x - PX < 40) continue;
      const y = surf[x], day = 2 + Math.floor(hash(x, 14, 88) * 18);
      const tall = 1 + Math.floor(hash(x, 15, 89) * 3);
      for (let k = 1; k <= tall; k++) flo(x, y - k, GRASS, day + k, k === tall ? 3 : 1);
      if (hash(x, 16, 90) < 0.16) flo(x, y - tall - 1, FLOWER, day + 4, 1 + Math.floor(hash(x, 17, 91) * 2));
    }
    house(PX + 150, 16, 16, 9);
    tree(PX + 18, 26, 7, { blossom: true });
    tree(PX + 92, 30, 12, {});
    yield;

    /* Fireflies for the long view: where they rise, and from which day. */
    const flies = [];
    for (let k = 0; k < 110; k++) {
      const x = 260 + Math.floor(rng() * 1180), day = dayFor(x, 8);
      if (day === NEVER) continue;
      flies.push(x, topAt(x) - 4 - Math.floor(rng() * 24), day + 10, Math.floor(rng() * 1000));
    }
    return { M0, SH, MO0, FIN, FLF, BM, BF, surf, flies: Int16Array.from(flies) };
  }

  /* ---- The long views ---- */

  /* For each zoom, one cell per square of grains: what it shows on the day the film has got to. */
  function makeGrid(z) {
    const gw = W / z, gh = H / z, n = gw * gh;
    return { z, gw, gh, col: new Uint32Array(n), kind: new Uint8Array(n), glow: new Uint8Array(n), sun: new Uint8Array(n),
      col0: null, kind0: null, glow0: null, sun0: null, mask: new Uint32Array(n), step: 0 };
  }

  /* What a cell shows. */
  const K_SKY = 0, K_CAVE = 1, K_WATER = 2, K_TOP = 3, K_LIT = 4, K_GROUND = 5, K_GREEN = 6;

  function makeReel(world, seed0) {
    const M0 = world.M0, SH = world.SH, MO0 = world.MO0, FIN = world.FIN, FLF = world.FLF, BM = world.BM, BF = world.BF;
    const surf = world.surf, flies = world.flies, alive = !!M0;
    const M = alive ? M0.slice() : null, FL = alive ? new Uint8Array(N) : null;
    const MO = alive ? MO0.slice() : null, WET = alive ? new Uint8Array(N) : null;
    const moving = new Int32Array(alive ? (WX1 - WX0) * (WY1 - WY0) : 0);
    const logos = LOGO_MASKS.map(buildLogo);
    const grids = alive ? { 2: makeGrid(2), 4: makeGrid(4), 8: makeGrid(8) } : {};
    let floraOut = new Uint32Array(122); /* Grains growing outside the window by each day. */

    let rnd = dice(1), look = dice(2), n = 0;
    let you, plant, roots, reeds, built, carried, scooped, sown, opened, stepNo, liveGrowing, firstClay, damp;
    let bees, fireflies, bird;

    /* ---- Resolving a grain on a day ---- */

    function inWin(x, y) { return x >= WX0 && x < WX1 && y >= WY0 && y < WY1; }

    /* The material and what grows in it, for a grain outside the window on day d. */
    let RM = 0, RF = 0;
    function resolve(i, d) {
      RM = BM[i] <= d ? FIN[i] : M0[i];
      RF = BF[i] <= d ? FLF[i] : 0;
    }
    /* The same inside the window, where the live grains come first. */
    function resolveLive(i, d) {
      const m = M[i];
      RM = m;
      RF = FL[i];
      if (d <= 1) return;
      if (BM[i] <= d && (m === AIR || m === M0[i])) RM = FIN[i];
      if (!RF && BF[i] <= d) {
        const f = FLF[i];
        if (f === ROOT ? EARTH[RM] : RM === AIR || RM === WATER) RF = f;
      }
    }

    /* The colour of one grain, as CR, CG, CB, with what kind of thing it is, and what light it gives. */
    let CR = 0, CG = 0, CB = 0, CK = 0, CL = 0, CS = 1;
    function tone(i, x, y, m, f) {
      CL = 0;
      CS = 1;
      const s = SH[i], k = s & 3, tint = 0.92 + 0.16 * ((s >> 2) / 63);
      if (f && (m === AIR || m === WATER || (f === ROOT && EARTH[m]))) {
        const c = (f * 4 + k) * 3;
        CR = FPAL[c] * tint; CG = FPAL[c + 1] * tint; CB = FPAL[c + 2] * tint;
        if (m === WATER) { CR = CR * 0.6 + 26; CG = CG * 0.6 + 34; CB = CB * 0.6 + 44; }
        else if (f === ROOT) { const dk = depthOf(x, y); CR *= dk; CG *= dk; CB *= dk; CS = sunOf(x, y); }
        CK = K_GREEN;
        return;
      }
      if (m === AIR) {
        if (y <= surf[x]) { CK = K_SKY; return; }
        const dk = depthOf(x, y) * 0.6;
        CR = 34 * dk; CG = 31 * dk; CB = 29 * dk;
        CK = K_CAVE;
        CS = 0;
        return;
      }
      const c = (m * 4 + k) * 3;
      CR = PAL[c] * tint; CG = PAL[c + 1] * tint; CB = PAL[c + 2] * tint;
      if (m === WATER) {
        CK = y > 0 && M[i - W] === AIR && y - 1 <= surf[x] ? K_TOP : K_WATER;
        CS = sunOf(x, y);
        return;
      }
      if (SOAKS[m]) {
        const wet = 1 - 0.36 * MO[i] / 255;
        CR *= wet; CG *= wet; CB *= wet * 1.04;
      }
      if (GLOWS[m]) { CK = K_LIT; CL = m; return; }
      const dk = depthOf(x, y);
      CR *= dk; CG *= dk; CB *= dk;
      CK = K_GROUND;
      CS = sunOf(x, y);
    }
    /* Deep ground is darker, and the hour of the day reaches only a little way into it. */
    function depthOf(x, y) { return 1 - 0.4 * clamp((y - surf[x] - 8) / 260, 0, 1); }
    function sunOf(x, y) { return clamp(1 - (y - surf[x]) / 18, 0, 1); }

    /* One square of z x z grains, down to one colour: what glows wins, then water, then what grows, then what was
       built, then whatever there is most of. */
    const CNT = new Uint16Array(64), REP = new Int32Array(64), seen = [];
    let POOL_I = 0;
    function pool(z, bx, by, d, live) {
      const x0 = bx * z, y0 = by * z;
      let glowI = -1, glowM = 0, best = 0, caves = 0, caveI = -1;
      seen.length = 0;
      for (let y = y0; y < y0 + z; y++) {
        for (let x = x0; x < x0 + z; x++) {
          const i = y * W + x;
          if (live && inWin(x, y)) resolveLive(i, d); else resolve(i, d);
          let code;
          if (RF && (RM === AIR || RM === WATER || (RF === ROOT && EARTH[RM]))) code = 32 + RF;
          else code = RM;
          if (GLOWS[RM] && EMIT[RM * 3] >= best) { best = EMIT[RM * 3]; glowI = i; glowM = RM; }
          if (code === AIR && y > surf[x]) { caves++; caveI = i; }
          if (!CNT[code]) { seen.push(code); REP[code] = i; }
          CNT[code]++;
        }
      }
      let pick = -1;
      if (glowI >= 0) pick = glowM;
      else if (CNT[WATER] >= z) pick = WATER;
      else if (caves >= z) pick = -2;
      else {
        const bloom = CNT[32 + FLOWER] + CNT[32 + BLOSSOM];
        let green = 0, most = 0, mostC = -1;
        for (let k = 0; k < seen.length; k++) {
          const c = seen[k];
          if (c > 32 && c !== 32 + ROOT) { green += CNT[c]; if (CNT[c] > most) { most = CNT[c]; mostC = c; } }
        }
        if (bloom >= z) pick = CNT[32 + FLOWER] >= CNT[32 + BLOSSOM] ? 32 + FLOWER : 32 + BLOSSOM;
        else if (green >= z) pick = mostC;
        else if (CNT[32 + ROOT] >= z) pick = 32 + ROOT;
        else if (CNT[BRICK] + CNT[WOOD] >= z) pick = CNT[BRICK] >= CNT[WOOD] ? BRICK : WOOD;
        else {
          let m = -1;
          for (let k = 0; k < seen.length; k++) if (CNT[seen[k]] > m) { m = CNT[seen[k]]; pick = seen[k]; }
        }
      }
      const i = pick === -2 ? caveI : pick === glowM && glowI >= 0 ? glowI : REP[pick], x = i % W, y = (i / W) | 0;
      POOL_I = i;
      if (pick === -2) pick = AIR;
      for (let k = 0; k < seen.length; k++) CNT[seen[k]] = 0;
      if (pick >= 32) tone(i, x, y, pick === 32 + ROOT ? SOIL : AIR, pick - 32);
      else tone(i, x, y, pick, 0);
      if (pick === WATER) {
        /* Water at the top of the square takes the sky. */
        const up = y0 > 0 ? y0 * W - W + x0 : -1;
        if (up >= 0) {
          if (live && inWin(x0, y0 - 1)) resolveLive(up, d); else resolve(up, d);
          CK = RM === AIR && !RF && y0 - 1 <= surf[x0] ? K_TOP : K_WATER;
        }
      }
    }

    function poolInto(g, bx, by, d) {
      pool(g.z, bx, by, d, false);
      const p = by * g.gw + bx;
      g.col[p] = (CR > 255 ? 255 : CR & 255) | ((CG > 255 ? 255 : CG & 255) << 8) | ((CB > 255 ? 255 : CB & 255) << 16);
      g.kind[p] = CK;
      g.glow[p] = CL;
      g.sun[p] = CS * 255;
    }

    /* Each zoom's day-one picture, and which squares change at each later step. */
    function* prepare() {
      for (const z of [2, 4, 8]) {
        const g = grids[z];
        for (let by = 0; by < g.gh; by++) {
          for (let bx = 0; bx < g.gw; bx++) poolInto(g, bx, by, 1);
          if ((by & 15) === 15) yield;
        }
        g.col0 = g.col.slice(); g.kind0 = g.kind.slice(); g.glow0 = g.glow.slice(); g.sun0 = g.sun.slice();
      }
      const stepOf = new Uint8Array(256);
      for (let d = 0; d < 256; d++) stepOf[d] = d > 120 ? 0 : stepOfDay(d);
      const g2 = grids[2], g4 = grids[4], g8 = grids[8];
      for (let y = 0; y < H; y++) {
        if ((y & 63) === 63) yield;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const b = Math.min(BM[i], BF[i]);
          if (b === NEVER || b <= 1) continue;
          const bits = (BM[i] <= 120 ? 1 << stepOf[BM[i]] : 0) | (BF[i] <= 120 ? 1 << stepOf[BF[i]] : 0);
          g2.mask[(y >> 1) * g2.gw + (x >> 1)] |= bits;
          g4.mask[(y >> 2) * g4.gw + (x >> 2)] |= bits;
          g8.mask[(y >> 3) * g8.gw + (x >> 3)] |= bits;
          if (BF[i] <= 120 && !inWin(x, y)) floraOut[BF[i]]++;
        }
      }
      for (let d = 1; d < floraOut.length; d++) floraOut[d] += floraOut[d - 1];
    }

    /* Brings a zoom's picture up to a step. Only squares with something dated in between are worked out again. */
    function advance(g, s) {
      if (s <= g.step) return;
      let bits = 0;
      for (let k = g.step + 1; k <= s; k++) bits |= 1 << k;
      const d = DAYS[s];
      for (let p = 0; p < g.mask.length; p++) {
        if (!(g.mask[p] & bits)) continue;
        poolInto(g, p % g.gw, (p / g.gw) | 0, d);
      }
      g.step = s;
    }

    /* ---- A play ---- */

    function reset(seed) {
      seed = (seed === undefined ? seed0 : seed) >>> 0;
      if (alive) {
        M.set(M0);
        MO.set(MO0);
        for (let y = WY0; y < WY1; y++) { FL.fill(0, y * W + WX0, y * W + WX1); WET.fill(0, y * W + WX0, y * W + WX1); }
      }
      rnd = dice(seed);
      /* What differs on screen but can't touch the physics has dice of its own. */
      look = dice(seed ^ 0x5bd1e995);
      n = 0;
      you = { x: 44, y: 0, face: 1, pose: 'sit', carry: 0, walk: 0 };
      plant = null;
      roots = [];
      reeds = [];
      built = 0;
      carried = 0;
      scooped = 0;
      sown = -1;
      opened = 0;
      stepNo = 0;
      liveGrowing = 0;
      firstClay = -1;
      damp = 0;
      bees = [];
      fireflies = [];
      bird = null;
      [2, 4, 8].forEach((z) => {
        const g = grids[z];
        if (!g || !g.col0) return;
        g.col.set(g.col0); g.kind.set(g.kind0); g.glow.set(g.glow0); g.sun.set(g.sun0);
        g.step = 0;
      });
      lightFrame = -1;
      logos.forEach((l) => {
        const key = new Float32Array(l.n);
        for (let i = 0; i < l.n; i++) {
          key[i] = -(l.ys[i] + look() * 4);
          l.order[i] = i;
          l.tint[i] = 0.86 + 0.28 * look();
          l.sway[i] = look() * 6.283;
        }
        l.order.sort((a, b) => key[a] - key[b]);
        for (let i = 0; i < l.n; i++) l.begin[l.order[i]] = i / l.n * 1.7 + look() * 0.1;
      });
    }

    /* The top of the ground, water included, under a column of the patch. */
    function groundAt(px) {
      const x = PX + px;
      let y = WY0;
      while (y < WY1 - 1 && M[y * W + x] === AIR) y++;
      return y - PY;
    }
    function soilAt(px) {
      const x = PX + px;
      let y = WY0;
      while (y < WY1 - 1 && (M[y * W + x] === AIR || M[y * W + x] === WATER)) y++;
      return y - PY;
    }

    /* The creature on its path. Its feet are on whatever is under its middle, water included: it paddles. */
    function place(t) {
      let k = 0;
      while (k + 1 < PATH.length && t >= PATH[k + 1][0]) k++;
      const a = PATH[k], b = PATH[k + 1] || a;
      let x = a[1];
      if (a[3] === 'walk') x = Math.round(a[1] + (b[1] - a[1]) * clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
      you.x = x;
      you.face = a[2];
      you.pose = a[3];
      you.walk = a[3] === 'walk' ? Math.floor(t * 8) & 1 : 0;
      you.y = Math.min(groundAt(x + 1), groundAt(x + 2)) - 1;
    }

    /* Takes the nearest few cells of a material inside a box of the patch. */
    function takeNearest(mat, x0, y0, x1, y1, cx, cy, count) {
      const best = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (PY + y) * W + PX + x;
          if (M[i] !== mat) continue;
          const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          let k = best.length;
          while (k > 0 && best[k - 1][0] > d) k--;
          if (k < count) {
            best.splice(k, 0, [d, i]);
            if (best.length > count) best.pop();
          }
        }
      }
      best.forEach((b) => { M[b[1]] = AIR; FL[b[1]] = 0; });
      return best.length;
    }
    function setP(px, py, m) { const i = (PY + py) * W + PX + px; M[i] = m; return i; }
    function getP(px, py) { return M[(PY + py) * W + PX + px]; }
    /* A grain thrown aside: it lands where it lands. */
    function toss(px, py) {
      for (let k = 0; k < 4; k++) if (getP(px, py - k) === AIR) { setP(px, py - k, SILT); return; }
    }

    /* One update of every moving grain in the window, bottom row first, x direction alternating.
       The list comes first: a grain that only starts moving during the update waits for the next one. */
    function step() {
      let count = 0;
      const forward = n & 1;
      for (let y = WY1 - 2; y >= WY0; y--) {
        const row = y * W;
        if (forward) {
          for (let x = WX0 + 1; x < WX1 - 1; x++) if (ACTIVE[M[row + x]]) moving[count++] = row + x;
        } else {
          for (let x = WX1 - 2; x > WX0; x--) if (ACTIVE[M[row + x]]) moving[count++] = row + x;
        }
      }
      for (let k = 0; k < count; k++) {
        const i = moving[k], c = M[i];
        if (c === WATER) {
          const x = i % W;
          /* Off the edges of the window it runs on into ground that isn't simulated. */
          if (x <= WX0 + 2 || x >= WX1 - 3) { M[i] = AIR; continue; }
          const j = i + W, b = M[j];
          if (b === AIR) { M[i] = AIR; M[j] = WATER; continue; }
          if (MO[j] < SOAK_FULL[b]) {
            const dry = 1 - MO[j] / SOAK_FULL[b];
            if (rnd() < SOAK_RATE * dry * dry * dry) { M[i] = AIR; MO[j] += SOAK_STEP; continue; }
          }
          const d = rnd() < 0.5 ? 1 : -1;
          if (M[j + d] === AIR && M[i + d] === AIR) { M[i] = AIR; M[j + d] = WATER; continue; }
          let run = 0;
          for (let s = 1; s <= 6; s++) {
            if (M[i + d * s] === AIR) run = s;
            else break;
          }
          if (run) { M[i] = AIR; M[i + d * run] = WATER; }
        } else {
          if (c === FINE) {
            /* Fine silt under standing water turns to clay. */
            if (M[i - W] === WATER && M[i - W - W] === WATER && n >= CLAY_FROM) {
              if (WET[i] < 255 && (n & 1)) WET[i]++;
              if (WET[i] >= CLAY_AFTER) { M[i] = CLAY; continue; }
            } else WET[i] = 0;
          }
          const j = i + W, b = M[j];
          if (b === AIR || (b === WATER && rnd() < 0.5)) {
            M[i] = b; M[j] = c;
            const mo = MO[i]; MO[i] = MO[j]; MO[j] = mo;
            if (FL[i] === ROOT) FL[i] = 0;
            if (FL[j] && FL[j] !== ROOT) FL[j] = 0;
            continue;
          }
          /* Only dry silt slides. Damp silt holds its shape, and clay and seeds only fall. */
          if ((c !== SILT && c !== FINE) || MO[i] > 90) continue;
          const d = rnd() < 0.5 ? 1 : -1;
          let q = -1;
          if (M[j + d] === AIR && M[i + d] === AIR) q = j + d;
          else if (M[j - d] === AIR && M[i - d] === AIR) q = j - d;
          if (q >= 0) {
            M[i] = AIR; M[q] = c;
            MO[q] = MO[i]; MO[i] = 0;
            if (FL[i] === ROOT) FL[i] = 0;
            if (FL[q] && FL[q] !== ROOT) FL[q] = 0;
          }
        }
      }
    }

    /* Damp spreads through soil: down most, sideways less, up a little. */
    function seep() {
      for (let y = WY0; y < WY1 - 1; y++) {
        const row = y * W;
        for (let x = WX0 + 1; x < WX1 - 1; x++) {
          const i = row + x, m = M[i];
          if (!SOAKS[m] && m !== SEED) continue;
          let v = MO[i];
          if (v < 12) continue;
          const j = i + W;
          if ((SOAKS[M[j]] || M[j] === SEED) && MO[j] < v) { const q = (v - MO[j]) >> 5; MO[j] += q; v -= q; }
          for (let d = -1; d <= 1; d += 2) {
            const s = i + d;
            if (SOAKS[M[s]] && MO[s] + 8 < v) { const q = (v - MO[s]) >> 6; MO[s] += q; v -= q; }
          }
          const u = i - W;
          if ((SOAKS[M[u]] || M[u] === SEED) && MO[u] + 40 < v) { const q = (v - MO[u]) >> 6; MO[u] += q; v -= q; }
          MO[i] = v;
        }
      }
    }

    /* Grass where the ground is damp; taller tufts; flowers on some tips; roots under some of it. */
    function green(t) {
      const tries = 90;
      for (let k = 0; k < tries; k++) {
        const x = WX0 + 3 + Math.floor(rnd() * (WX1 - WX0 - 6));
        let y = WY0;
        while (y < WY1 - 1 && (M[y * W + x] === AIR || M[y * W + x] === WATER)) y++;
        const s = y * W + x, c = s - W;
        if (!SOAKS[M[s]] || MO[s] < 100 || M[c - W] === WATER) continue;
        if (!FL[c]) {
          const near = (FL[c - 1] === GRASS) + (FL[c + 1] === GRASS) + (FL[c - 1 - W] === GRASS) + (FL[c + 1 - W] === GRASS) +
            (FL[c - 1 + W] === GRASS) + (FL[c + 1 + W] === GRASS);
          if (rnd() < (near ? 0.5 : 0.03)) {
            FL[c] = GRASS;
            if (rnd() < 0.3 && roots.length < 90) roots.push([x, y + 1, 2 + Math.floor(rnd() * 7)]);
          }
          continue;
        }
        /* Up the tuft to its top. */
        let top = c, h = 1;
        while (FL[top - W] === GRASS || FL[top - W] === FLOWER) { top -= W; h++; }
        if (FL[top] === FLOWER) continue;
        const most = 1 + ((x * 7) % 3);
        if (h < most && M[top - W] === AIR && rnd() < 0.3) FL[top - W] = GRASS;
        else if (t > 21.5 && h >= 2 && M[top - W] === AIR && ((x * 13) % 5) < 2 && rnd() < 0.08) FL[top - W] = FLOWER;
      }
    }

    /* Root tips: down through damp earth, a grain at a time. */
    function dig() {
      for (let k = roots.length - 1; k >= 0; k--) {
        const r = roots[k];
        if (r[2] <= 0) { roots.splice(k, 1); continue; }
        const x = r[0], y = r[1];
        if (y >= WY1 - 1) { roots.splice(k, 1); continue; }
        const i = y * W + x;
        if (EARTH[M[i]] && !FL[i]) FL[i] = ROOT;
        const d = rnd() < 0.5 ? -1 : 1, dn = i + W;
        let nx = x;
        if (rnd() < 0.3 && EARTH[M[dn + d]] && MO[dn + d] >= MO[dn]) nx = x + d;
        r[0] = nx; r[1] = y + 1; r[2]--;
        if (r[3] && rnd() < 0.08 && roots.length < 90) roots.push([nx, y + 1, r[2] >> 1]);
      }
    }

    /* The plant from the seed: a stem that rises a grain at a time to a set height, branches, leaves round the tips,
       blossom late. */
    function growPlant(t) {
      const p = plant;
      const want = Math.min(18, Math.floor((t - p.at) * 0.95));
      const x0 = PX + p.x;
      while (p.h < want) {
        let x = p.top % W;
        if (p.h >= 6 && rnd() < 0.18) x += rnd() < 0.5 ? -1 : 1;
        if (Math.abs(x - x0) > 2) x = x0 + (x > x0 ? 2 : -2);
        const y = ((p.top / W) | 0) - 1, i = y * W + x;
        p.top = i;
        FL[i] = STEM;
        p.h++;
        if (p.h >= 5 && p.h % 3 === 2) p.tips.push([x, y, rnd() < 0.5 ? -1 : 1, 2 + Math.floor(rnd() * 3)]);
      }
      for (let k = 0; k < p.tips.length; k++) {
        const b = p.tips[k];
        if (b[3] > 0 && rnd() < 0.2) {
          b[0] += b[2]; b[1] -= rnd() < 0.6 ? 1 : 0; b[3]--;
          const i = b[1] * W + b[0];
          if (!FL[i] && (M[i] === AIR || M[i] === WATER)) FL[i] = STEM;
        }
      }
      /* Leaves round the tips and the top, in a crown that widens as it grows. */
      for (let k = 0; k < 5; k++) {
        const anchors = p.tips.length + 1, a = Math.floor(rnd() * anchors);
        let ax, ay, r;
        if (a === p.tips.length) { ax = p.top % W; ay = ((p.top / W) | 0) + (p.h >> 3); r = 2 + p.h / 4.5; }
        else { ax = p.tips[a][0]; ay = p.tips[a][1]; r = 1.5 + p.h / 7; }
        const dx = Math.round((rnd() * 2 - 1) * r), dy = Math.round((rnd() * 2 - 1) * r * 0.8);
        if (dx * dx + dy * dy > r * r + 0.5 || p.h < 3) continue;
        const i = (ay + dy) * W + ax + dx;
        if (!FL[i] && M[i] === AIR) FL[i] = t > 38 && rnd() < 0.25 ? BLOSSOM : LEAF;
      }
    }

    /* Reeds at the pond's shallow edges, once there is a pond. */
    function sprout(t) {
      for (let k = 0; k < 6; k++) {
        const px = 104 + Math.floor(rnd() * 40), x = PX + px;
        let y = WY0;
        while (y < WY1 - 1 && M[y * W + x] === AIR) y++;
        let bed = y;
        while (bed < WY1 - 1 && M[bed * W + x] === WATER) bed++;
        const depth = bed - y;
        if (depth < 1 || depth > 3 || !EARTH[M[bed * W + x]] || reeds.some((r) => Math.abs(r[0] - x) < 3)) continue;
        if (rnd() < 0.35) reeds.push([x, bed - 1, depth + 2 + Math.floor(rnd() * 4), 0]);
      }
    }
    function growReeds() {
      for (let k = 0; k < reeds.length; k++) {
        const r = reeds[k];
        if (r[3] >= r[2] || rnd() > 0.22) continue;
        const i = (r[1] - r[3]) * W + r[0];
        if (M[i] === AIR || M[i] === WATER) FL[i] = REED;
        r[3]++;
      }
    }

    function countGrowing() {
      let c = 0;
      for (let y = WY0; y < WY1; y++) for (let x = WX0; x < WX1; x++) if (FL[y * W + x]) c++;
      liveGrowing = c;
    }

    /* Scripted events, thirty times a second. */
    function script(f, t) {
      place(t);
      /* The wind lifts dry grains off the slope, and they settle again. */
      if (t > T_LIGHT && t < T_ONE + 4 && f % 3 === 0) {
        const px = 40 + Math.floor(rnd() * 64), sy = soilAt(px);
        const i = (PY + sy) * W + PX + px;
        if (M[i] === SILT && MO[i] < 20 && getP(px + 1, sy - 1) === AIR && getP(px + 1, sy - 2) === AIR) {
          M[i] = AIR;
          setP(px + 1, sy - 2, SILT);
        }
      }
      if (t >= T_LAND && sown < 0 && you.carry === 0 && t < T_PICK) {
        if (sown === -1) { sown = -2; setP(49, soilAt(49) - 1, SEED); }
      }
      if (t >= T_PICK && sown === -2) {
        sown = -3;
        takeNearest(SEED, 44, 0, 56, 40, 49, 26, 1);
        you.carry = 1;
      }
      if (t >= T_SCRATCH && sown === -3) {
        /* Its paws leave the ground round the hole damp, so the hole keeps its shape. */
        sown = -4;
        const s = soilAt(SOW_X);
        for (let y = s - 1; y <= s + 3; y++) for (let x = SOW_X - 2; x <= SOW_X + 2; x++) {
          const i = (PY + y) * W + PX + x;
          if (SOAKS[M[i]] && MO[i] < 96) MO[i] = 96;
        }
        setP(SOW_X, s, AIR);
        toss(SOW_X + 7, s - 3);
      }
      if (t >= T_SCRATCH + BEAT / 2 && sown === -4) { sown = -5; const s = soilAt(SOW_X); setP(SOW_X, s, AIR); toss(SOW_X + 8, s - 3); }
      if (t >= T_SOW && sown === -5) { sown = -6; setP(SOW_X, soilAt(SOW_X) - 1, SEED); you.carry = 0; }
      if (t >= T_COVER && sown === -6) { sown = soilAt(SOW_X); MO[setP(SOW_X, sown - 1, SILT)] = 96; }
      for (let k = 0; k < 3; k++) {
        if (t >= T_DIG + k * BEAT && opened === k) {
          opened++;
          setP(PLUG[k][0], PLUG[k][1], AIR);
          setP(PLUG[k][0], PLUG[k][1] + 1, AIR);
          toss(41 + k, 20);
          toss(43 + k, 19);
        }
      }
      /* The spring keeps coming, at the rate of the vein behind it. */
      if (opened === 3) {
        for (let k = 0; k < 3; k++) {
          const i = (PY + SOURCE[1]) * W + PX + SOURCE[0] + k;
          if (M[i] === AIR && rnd() < SPRING) M[i] = WATER;
        }
      }
      /* The seed takes when it has been damp a while. */
      if (sown >= 0 && !plant) {
        const i = (PY + sown) * W + PX + SOW_X;
        if (M[i] === SEED && Math.max(MO[i - W], MO[i - 1], MO[i + 1], MO[i + W], MO[i - W - 1], MO[i - W + 1]) >= 110) {
          if (++damp >= SPROUT_AFTER) {
            M[i] = SOIL; MO[i] = 200;
            plant = { x: SOW_X, at: t, h: 0, top: i - W, tips: [] };
            FL[i] = ROOT;
            roots.push([PX + SOW_X, PY + sown + 1, 16, 1], [PX + SOW_X - 1, PY + sown + 2, 11, 1], [PX + SOW_X + 1, PY + sown + 2, 12, 1]);
          }
        }
      }
      if (plant) growPlant(t);
      if (t >= T_SCOOP && carried === 0 && scooped === 0) {
        scooped = takeNearest(CLAY, 110, 34, 142, 46, 131, 41, WALL.length);
        carried = scooped;
        you.carry = scooped ? 2 : 0;
      }
      while (built < carried && t >= T_BRICK + built * BEAT / 2) {
        const w = WALL[built++];
        const i = setP(w[0], w[1], BRICK);
        FL[i] = 0;
        if (built === carried) you.carry = 0;
      }
      if (t >= T_REEDS - 2.5) sprout(t);
      growReeds();
      green(t);
      if ((f & 3) === 0) dig();
      if (f % 6 === 0) countGrowing();
      if (firstClay < 0) {
        for (let x = PX + 104; x < PX + 143; x++) {
          for (let y = PY + 36; y < PY + 46; y++) if (M[y * W + x] === CLAY) { firstClay = t; break; }
          if (firstClay >= 0) break;
        }
      }
    }

    function tick() {
      if (n >= T_END * 60) return;
      n++;
      const t = n / 60, onFrame = !(n & 1);
      if (t >= T_LOGO) return;
      if (onFrame) script(n >> 1, t);
      step();
      if (onFrame && !(n & 6)) seep();
      const s = dayStepAt(t, reel.reduced);
      if (s !== stepNo) stepNo = s;
    }

    /* ---- Words ---- */

    function focusAt(t, z) {
      if (z >= 2) return VW >> 1;
      let x = FOCUS[FOCUS.length - 1];
      for (let k = 0; k + 3 < FOCUS.length; k += 2) {
        if (t < FOCUS[k + 2]) { x = FOCUS[k + 1] + (FOCUS[k + 3] - FOCUS[k + 1]) * smooth(FOCUS[k], FOCUS[k + 2], t); break; }
      }
      return z === 1 ? x : (x - (VIEWS[0][1] - PX)) * 2;
    }

    /* The frame being built, and how far the film's view is from the picture's corner, in cells. */
    let v = null, now = 0, ox = 0, oy = 0;

    /* Fits the camera to a picture of this size. Extra rows and columns show more of the world around the film's
       view, which stays centred. A narrow picture keeps the action in frame. */
    function fit(cols, rows) {
      const t = now, cam = v.cam;
      if (v.mode === 'logo') {
        cam.z = 1;
        cam.x = (VW - cols) >> 1;
        cam.y = rows >= VH ? (VH - rows) >> 1 : clamp(27 - (rows >> 1), 0, VH - rows);
        ox = -cam.x; oy = -cam.y;
        return;
      }
      const z = zoomAt(t), view = viewOf(z);
      const px0 = cols >= VW ? -((cols - VW) >> 1) : clamp(Math.round(focusAt(t, z)) - (cols >> 1), 0, VW - cols);
      const py0 = rows >= VH ? -((rows - VH) >> 1) : clamp(MIDDLE[z] - (rows >> 1), 0, VH - rows);
      cam.z = z;
      cam.x = view[1] / z + px0;
      cam.y = view[2] / z + py0;
      ox = -px0; oy = -py0;
    }

    function line(col, row, text, color, bold) {
      if (text) v.rows.push({ col, row, text, color, bold: !!bold });
    }
    /* On the picture, in the cells of the film's view. Text rows there are two cells tall. */
    function placeText(x, y, text, color, back, bold, story) {
      if (!text) return;
      v.labels.push({
        x: Math.max(0, Math.max(0, x) + ox), y: Math.max(0, (Math.max(0, y) >> 1) * 2 + oy),
        text, color, back, bold, story, center: 0
      });
    }
    function label(x, y, text, color) { placeText(x, y, text, color, BACK, false, true); }

    function ticker(left, right) {
      v.ticker = { left, leftColor: FG, right: right || '', rightColor: DIM };
    }
    function pane(one, oneColor, key) {
      v.pane = { one: one || '', oneColor: oneColor || FG, two: '', twoColor: DIM, key: key || null };
    }

    /* Grains growing: counted in the window, and dated outside it. Without a world, a number as wide as the real one. */
    function growing(t) {
      if (!alive) {
        if (t < T_SOW) return 0;
        if (t < T_ONE) return 1;
        if (t < T_X2) return 888;
        return t < T_X8 ? 88888 : 888888;
      }
      const s = reel.reduced ? dayStepAt(t, true) : dayStepAt(t, false);
      const live = t < T_SOW ? 0 : Math.max(liveGrowing, t >= T_SOW ? 1 : 0);
      return s ? live + floraOut[DAYS[s]] : live;
    }

    /* The creature, in cells of the film's view at this zoom. */
    function youAt(t) {
      let x = you.x, y = you.y;
      if (!alive) {
        let k = 0;
        while (k + 1 < PATH.length && t >= PATH[k + 1][0]) k++;
        x = PATH[k][1];
        y = Math.floor(lerpAt(PATCH, x + 1, false)) - 1;
      }
      const z = zoomAt(t), view = viewOf(z);
      return [(PX + x - view[1]) / z, (PY + y - view[2]) / z];
    }

    function key(t) {
      if (t >= T_PICK && t < T_COVER) return 'p';
      if (t >= T_DIG && t < T_OPEN + 0.4) return 'd';
      if (t >= T_SCOOP && t < T_BRICK + 9 * BEAT / 2 + 0.2) return 'b';
      if (t >= T_KEY && t < T_DARK) return 'z';
      return null;
    }

    function drawWords(t) {
      const z = zoomAt(t);
      v.scene = z <= 1 ? (t < T_ONE ? 'open' : 'patch') : 'valley';
      if (t >= T_DARK) return;
      const s = dayStepAt(t, reel.reduced), g = growing(t);
      ticker('day ' + DAYS[s], g === 1 ? '1 grain growing' : thousands(g) + ' grains growing');
      let one = '', color = FG;
      if (t >= T_CLAY && t < T_SCOOP) { one = 'new material: clay'; color = CLAYC; }
      else if (t >= T_REEDS && t < beat(47)) { one = 'new life: reeds'; color = GREEN; }
      pane(one, color, key(t));
      if ((t >= 1.67 && t < T_PICK) || (t >= T_RINGS + BEAT && t < T_NIGHT)) {
        const p = youAt(t);
        if (z <= 1) label(Math.round(p[0]) - 1, Math.round(p[1]) - 8, 'you', LANTERN);
        else label(Math.round(p[0]) + 2, Math.round(p[1]) - 3, 'you', LANTERN);
      }
    }

    function drawLogoWords(t) {
      v.scene = 'logo';
      if (t >= T_WORDS) {
        v.end = {
          one: 'Every afternoon leaves a layer.', oneColor: BRIGHT,
          two: 'Concept render · in development · working title', twoColor: COLORS.endTwo
        };
      }
    }

    /* Everything on screen at this moment, as plain data:
         scene     open, patch, valley or logo
         mode      what the picture shows: world or logo
         title, ticker, pane, caption, end    the terminal's text and colours; all but title can be null
         rows      whole-page text, none in this film
         labels, banners    text on the picture: { x, y, text, color, back, bold }, in cells of the picture
         cam       where the picture is, with its zoom; hand it to paint()
       Without a size, the picture is the film's own 160 by 66. */
    function frame(t, cols, rows) {
      cols = cols || VW;
      rows = rows || VH;
      now = t;
      v = {
        t, scene: '', mode: t < T_LOGO ? 'world' : 'logo',
        title: { left: 'silt', leftColor: '#c8bcae', right: 'concept render · time sped up', rightColor: AMBER },
        ticker: null, pane: null, caption: null, end: null, rows: [], labels: [], banners: [],
        cam: { mode: '', z: 1, x: 0, y: 0 }
      };
      v.cam.mode = v.mode;
      fit(cols, rows);
      if (t < T_LOGO) drawWords(t);
      else drawLogoWords(t);
      for (let i = 0; i < CAPTIONS.length; i++) {
        const c = CAPTIONS[i];
        if (c[0] <= t && t < c[1]) {
          const fade = Math.min(1, (t - c[0]) / 0.25, (c[1] - t) / 0.25);
          v.caption = { text: c[2], fade, color: COLORS.cap, from: COLORS.band };
        }
      }
      return v;
    }

    /* ---- Light ---- */

    /* Light from glowing things falls off over about five cells. That is smooth enough to work out at half size and
       spread back over the cells. It is done thirty times a second, as often as it visibly changes. */
    const LIGHT_K = 5 / 4, LIGHT_WIDTHS = boxWidths(2.5);
    let lightFrame = -1, lightKey = '';
    let lightR = new Float32Array(0), lightG = lightR, lightB = lightR;
    let halfR = lightR, halfG = lightR, halfB = lightR, halfTmp = lightR;

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

    /* ---- Painting ---- */

    let baseR = new Float32Array(0), baseG = baseR, baseB = baseR, kinds = new Uint8Array(0), glows = kinds, suns = kinds;
    let pic = null, picCols = 0, picRows = 0, camZ = 1, camX = 0, camY = 0;
    let skyTop = [0, 0, 0], skyHor = [0, 0, 0], amb = [0, 0, 0], fade = 1;
    const BAYER = new Uint8Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

    function keyed(list, t, out) {
      let k = 0;
      while (k + 1 < list.length && t >= list[k + 1][0]) k++;
      const a = list[k], b = list[k + 1] || a, u = b[0] > a[0] ? clamp((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      for (let c = 0; c < out.length; c++) {
        const av = Array.isArray(a[1]) ? a[1 + (c / 3 | 0)][c % 3] : a[1 + c];
        const bv = Array.isArray(b[1]) ? b[1 + (c / 3 | 0)][c % 3] : b[1 + c];
        out[c] = av + (bv - av) * u;
      }
      return out;
    }
    const skyBoth = new Float32Array(6);

    /* The light of the hour, and how far up from black the picture is. */
    function hour(t) {
      keyed(SKY, t, skyBoth);
      skyTop[0] = skyBoth[0]; skyTop[1] = skyBoth[1]; skyTop[2] = skyBoth[2];
      skyHor[0] = skyBoth[3]; skyHor[1] = skyBoth[4]; skyHor[2] = skyBoth[5];
      keyed(DAYLIGHT, t, amb);
      /* It gets light in five steps, and goes dark at the end. */
      if (t < T_LIGHT) fade = 0;
      else if (t < 2.5) fade = (Math.floor((t - T_LIGHT) / 0.4) + 1) / 5;
      else fade = 1;
      fade *= 1 - smooth(T_DARK, T_LOGO - 0.05, t);
    }

    function cloudAt(vx, vy, cols, rows, t) {
      const drift = t * 0.6;
      for (let c = 0; c < 4; c++) {
        const w = 12 + c * 5, cx = ((c * 53 + 17 + drift * (0.6 + c * 0.15)) % (cols + w * 2)) - w, cy = 3 + c * 3 + (c & 1) * 2;
        const dx = (vx - cx) / w, dy = (vy - cy) / 2.2;
        if (dy > 1 || dy < -1.4 || dx < -1 || dx > 1) continue;
        const puff = 0.75 + 0.35 * hash(Math.floor(vx / 3), c, 92) - 0.25 * Math.abs(dx);
        if (dx * dx + (dy < 0 ? dy * dy * 0.6 : dy * dy * 2.2) < puff) return dy < 0 ? 2 : 1;
      }
      return 0;
    }

    function skyColour(vx, vy, cols, rows, t, out) {
      const f = clamp(vy / (rows * 0.48), 0, 1);
      const steps = f * 7, b = Math.floor(steps), th = (BAYER[(vy & 3) * 4 + (vx & 3)] + 0.5) / 16;
      const u = Math.min(7, steps - b > th ? b + 1 : b) / 7;
      let r = skyTop[0] + (skyHor[0] - skyTop[0]) * u, g = skyTop[1] + (skyHor[1] - skyTop[1]) * u, bl = skyTop[2] + (skyHor[2] - skyTop[2]) * u;
      /* Far ridges, in the haze. */
      const far = rows * 0.36 + 16 * (fbm(vx / 46 + camZ * 7, 1.5, 93) - 0.5), mid = rows * 0.46 + 20 * (fbm(vx / 34 + camZ * 3, 2.5, 94) - 0.5);
      if (vy >= mid) { r = r * 0.46 + 30; g = g * 0.46 + 44; bl = bl * 0.46 + 40; }
      else if (vy >= far) { r = r * 0.72 + 16; g = g * 0.72 + 24; bl = bl * 0.72 + 26; }
      else {
        const cl = cloudAt(vx, vy, cols, rows, t);
        if (cl) {
          const k = cl === 2 ? 0.55 : 0.32;
          const cr = skyHor[0] * 0.6 + 104, cg = skyHor[1] * 0.6 + 98, cb = skyHor[2] * 0.6 + 96;
          r += (cr - r) * k; g += (cg - g) * k; bl += (cb - bl) * k;
        }
        /* Stars, once the light has gone. */
        if (t > T_NIGHT && hash(vx, vy, 95) < 0.012) {
          const tw = reel.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * 3 + hash(vx, vy, 96) * 9);
          const k = (0.35 + 0.5 * tw) * smooth(T_NIGHT, T_NIGHT + 1.2, t);
          r += (230 - r) * k; g += (226 - g) * k; bl += (214 - bl) * k;
        }
      }
      out[0] = r; out[1] = g; out[2] = bl;
    }

    function ensure(size) {
      if (baseR.length < size) {
        baseR = new Float32Array(size); baseG = new Float32Array(size); baseB = new Float32Array(size);
        kinds = new Uint8Array(size); glows = new Uint8Array(size); suns = new Uint8Array(size);
        lightR = new Float32Array(size); lightG = new Float32Array(size); lightB = new Float32Array(size);
      }
    }

    /* A grain of the world into a cell, at z = 1 or closer. */
    function cellNear(p, gx, gy) {
      if (gy < 0) { kinds[p] = K_SKY; return; }
      if (gy >= H) gy = H - 40 + (gy - H) % 40;
      if (gx < 0) gx = 0; else if (gx >= W) gx = W - 1;
      const i = gy * W + gx;
      tone(i, gx, gy, M[i], FL[i]);
      if (CK === K_WATER || CK === K_TOP) waterTone(i, gx, gy);
      baseR[p] = CR; baseG[p] = CG; baseB[p] = CB; kinds[p] = CK; glows[p] = CL; suns[p] = CS * 255;
    }
    /* Water shimmers: each grain drifts between shades, and the top takes the sky. */
    function waterTone(i, gx, gy) {
      const k = (hash(gx, gy, (n >> 4) + 97) < 0.5 ? 0 : 1) + (CK === K_TOP ? 2 : 0), c = (WATER * 4 + k) * 3;
      CR = PAL[c]; CG = PAL[c + 1]; CB = PAL[c + 2];
      if (CK === K_TOP) { CR = CR * 0.6 + skyHor[0] * 0.4; CG = CG * 0.6 + skyHor[1] * 0.4; CB = CB * 0.6 + skyHor[2] * 0.4; }
    }

    function paintWorld(rgba, cols, rows, cam, t) {
      const z = cam.z, size = cols * rows;
      ensure(size);
      hour(t);
      pic = rgba; picCols = cols; picRows = rows; camZ = z; camX = cam.x; camY = cam.y;
      const s = dayStepAt(t, reel.reduced), d = DAYS[s];
      if (z >= 2) {
        const g = grids[z];
        advance(g, s);
        const gw = g.gw, gh = g.gh, wx0 = Math.floor(WX0 / z), wx1 = Math.ceil(WX1 / z), wy0 = Math.floor(WY0 / z), wy1 = Math.ceil(WY1 / z);
        for (let vy = 0, p = 0; vy < rows; vy++) {
          let by = cam.y + vy;
          if (by < 0) { for (let vx = 0; vx < cols; vx++, p++) kinds[p] = K_SKY; continue; }
          if (by >= gh) by = gh - Math.ceil(40 / z) + (by - gh) % Math.ceil(40 / z);
          for (let vx = 0; vx < cols; vx++, p++) {
            const bx = clamp(cam.x + vx, 0, gw - 1);
            if (bx >= wx0 && bx < wx1 && by >= wy0 && by < wy1) {
              pool(z, bx, by, d, true);
              if (CK === K_WATER || CK === K_TOP) waterTone(POOL_I, POOL_I % W, (POOL_I / W) | 0);
              baseR[p] = CR; baseG[p] = CG; baseB[p] = CB; kinds[p] = CK; glows[p] = CL; suns[p] = CS * 255;
            } else {
              const q = by * gw + bx, c = g.col[q];
              baseR[p] = c & 255; baseG[p] = (c >> 8) & 255; baseB[p] = (c >> 16) & 255; kinds[p] = g.kind[q]; glows[p] = g.glow[q]; suns[p] = g.sun[q];
              if (kinds[p] === K_TOP) { baseR[p] = baseR[p] * 0.75 + skyHor[0] * 0.25; baseG[p] = baseG[p] * 0.75 + skyHor[1] * 0.25; baseB[p] = baseB[p] * 0.75 + skyHor[2] * 0.25; }
            }
          }
        }
      } else if (z === 1) {
        for (let vy = 0, p = 0; vy < rows; vy++) for (let vx = 0; vx < cols; vx++, p++) cellNear(p, cam.x + vx, cam.y + vy);
      } else {
        for (let vy = 0, p = 0; vy < rows; vy++) for (let vx = 0; vx < cols; vx++, p++) cellNear(p, (cam.x + vx) >> 1, (cam.y + vy) >> 1);
      }
      shine(cols, rows, z, t);
      const sky = [0, 0, 0];
      for (let vy = 0, p = 0, o = 0; vy < rows; vy++) {
        for (let vx = 0; vx < cols; vx++, p++, o += 4) {
          const k = kinds[p];
          let r, g, b;
          const lr = lightR[p] * LIGHT_K, lg = lightG[p] * LIGHT_K, lb = lightB[p] * LIGHT_K;
          if (k === K_SKY) {
            skyColour(vx, vy, cols, rows, t, sky);
            r = sky[0] + lr * 60; g = sky[1] + lg * 50; b = sky[2] + lb * 30;
          } else if (k === K_LIT) {
            const flick = reel.reduced ? 1 : 0.92 + 0.08 * hash(vx + camX, vy + camY, (n >> 3) + 98);
            r = baseR[p] * flick; g = baseG[p] * flick; b = baseB[p] * flick;
          } else {
            /* Sunlight on the surface; underground, only the dark of night reaches. */
            const sn = suns[p] / 255, ar = amb[0] * sn + Math.min(amb[0], 0.9) * (1 - sn);
            const ag = amb[1] * sn + Math.min(amb[1], 0.9) * (1 - sn), ab = amb[2] * sn + Math.min(amb[2], 0.9) * (1 - sn);
            r = baseR[p] * Math.min(1.6, ar + lr); g = baseG[p] * Math.min(1.6, ag + lg); b = baseB[p] * Math.min(1.6, ab + lb);
          }
          r *= fade; g *= fade; b *= fade;
          rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
        }
      }
      paintLife(t, z);
      paintMarks(t, z);
      pic = null;
    }

    /* Light spreads from whatever glows, and from the fireflies. */
    function shine(cols, rows, z, t) {
      const f = n >> 1, keyNow = cols + ',' + rows + ',' + camX + ',' + camY + ',' + z;
      if (f === lightFrame && keyNow === lightKey) return;
      lightFrame = f; lightKey = keyNow;
      const w = (cols + 1) >> 1, h = (rows + 1) >> 1;
      if (halfR.length < w * h) {
        halfR = new Float32Array(w * h); halfG = new Float32Array(w * h); halfB = new Float32Array(w * h); halfTmp = new Float32Array(w * h);
      }
      halfR.fill(0, 0, w * h); halfG.fill(0, 0, w * h); halfB.fill(0, 0, w * h);
      const gain = z >= 4 ? 0.55 : z === 2 ? 0.8 : 1;
      for (let vy = 0, p = 0; vy < rows; vy++) {
        const q = (vy >> 1) * w;
        for (let vx = 0; vx < cols; vx++, p++) {
          const m = glows[p];
          if (!m) continue;
          const e = m * 3, i = q + (vx >> 1);
          halfR[i] += EMIT[e] * gain; halfG[i] += EMIT[e + 1] * gain; halfB[i] += EMIT[e + 2] * gain;
        }
      }
      lifeLight(w, h, z, t);
      spread(halfR, w, h);
      spread(halfG, w, h);
      spread(halfB, w, h);
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

    /* A grain of the world on the picture, at whatever zoom. */
    function cellOf(gx, gy) {
      if (camZ >= 1) { CELLX = Math.floor(gx / camZ) - camX; CELLY = Math.floor(gy / camZ) - camY; }
      else { CELLX = gx * 2 - camX; CELLY = gy * 2 - camY; }
    }
    let CELLX = 0, CELLY = 0;
    function dot(gx, gy, c, k) {
      cellOf(gx, gy);
      const span = camZ < 1 ? 2 : 1;
      for (let dy = 0; dy < span; dy++) {
        for (let dx = 0; dx < span; dx++) {
          const x = CELLX + dx, y = CELLY + dy;
          if (x < 0 || x >= picCols || y < 0 || y >= picRows) continue;
          const q = (y * picCols + x) * 4, a = k === undefined ? fade : fade * k;
          pic[q] = c[0] * a + pic[q] * (1 - (k === undefined ? 1 : k));
          pic[q + 1] = c[1] * a + pic[q + 1] * (1 - (k === undefined ? 1 : k));
          pic[q + 2] = c[2] * a + pic[q + 2] * (1 - (k === undefined ? 1 : k));
        }
      }
    }

    /* The creature: four grains wide and three tall, standing on (x, y). At a distance, a grain of itself. */
    const SPRITE = { sit: ['.s.s', 'sbbe', 'bllb'], stand: ['.s.s', 'sbbe', 'flLf'], walk: ['.s.s', 'sbbe', '.ff.'] };
    function paintYou(t) {
      const gx = PX + you.x, gy = PY + you.y;
      if (camZ >= 4) { dot(gx + 1, gy, CRE_BELLY); return; }
      if (camZ === 2) { dot(gx, gy - 1, CRE_BODY); dot(gx + 2, gy - 1, CRE_EYE); dot(gx, gy, CRE_BELLY); dot(gx + 2, gy, CRE_BODY); return; }
      const rows = SPRITE[you.pose === 'walk' && !you.walk ? 'stand' : you.pose] || SPRITE.sit;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const ch = rows[r][you.face > 0 ? c : 3 - c];
          if (ch === '.') continue;
          const col = ch === 's' ? CRE_SHADOW : ch === 'b' ? CRE_BODY : ch === 'e' || ch === 'f' ? CRE_EYE : CRE_BELLY;
          dot(gx + c, gy - 2 + r, col);
        }
      }
      if (you.carry === 1) dot(gx + 1 + (you.face > 0 ? 1 : 0), gy - 3, SEED_C);
      if (you.carry === 2) { dot(gx + 1, gy - 3, CLAY_A); dot(gx + 2, gy - 3, CLAY_B); }
    }

    /* The seed on the wind, the bird, the bees and the fireflies. None of them touches a grain. */
    function lifeAt(t) {
      if (bird === null && t >= T_BIRD - 0.9 && plant) bird = { land: plant.top, at: T_BIRD - 0.9 };
      if (t >= T_REEDS - 0.5 && bees.length < 3 && look() < 0.03) bees.push({ x: PX + 170 + look() * 10, y: PY + 10 + look() * 12, to: -1, at: t });
      if (t >= T_GOLD - 0.4 && fireflies.length < 10 && look() < 0.08) {
        const x = PX + 70 + Math.floor(look() * 76);
        fireflies.push({ x, y: PY + groundAt(x - PX) - 2, ph: look() * 6.28, sp: 0.6 + look() * 0.8 });
      }
    }
    function paintLife(t, z) {
      if (t >= T_DRIFT && t < T_LAND) {
        const u = (t - T_DRIFT) / (T_LAND - T_DRIFT), sy = groundAt(49) - 1;
        dot(PX + Math.round(100 + (49 - 100) * u), PY + Math.round(2 + (sy - 2) * Math.pow(u, 1.6) + 2 * Math.sin(u * 9)), SEED_C);
      }
      if (z <= 2) {
        if (bird) {
          const top = bird.land, tx = top % W, ty = ((top / W) | 0) - 1, u = clamp((t - bird.at) / 0.9, 0, 1);
          const hop = (t > T_BIRD + 0.4 && t < T_BIRD + 0.55) || (t > beat(47.5) && t < beat(47.5) + 0.15) ? 1 : 0;
          const x = Math.round(tx + (1 - u) * 60), y = Math.round(ty - (1 - u) * 24 * (1 - u) - hop);
          dot(x - 1, y, BIRD_C); dot(x, y, BIRD_C); dot(x + 1, y - (u < 1 && (n >> 2) & 1 ? 1 : 0), BIRD_C);
          if (u >= 1) dot(x, y + 1, BIRD_BELLY);
        }
        for (let k = 0; k < bees.length; k++) {
          const b = bees[k], wob = Math.sin(t * 9 + k) * 1.2;
          dot(Math.round(b.x), Math.round(b.y + wob), BEE);
        }
        for (let k = 0; k < fireflies.length; k++) {
          const f = fireflies[k], on = reel.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2.2 * f.sp + f.ph);
          if (on > 0.25) dot(Math.round(f.x + 3 * Math.sin(t * 0.5 + f.ph)), Math.round(f.y - (t - T_GOLD) * f.sp * 1.2 % 14), FLY, Math.min(1, on));
        }
      } else if (t >= T_X4) {
        const d = DAYS[dayStepAt(t, reel.reduced)];
        for (let k = 0; k < flies.length; k += 4) {
          if (flies[k + 2] > d) continue;
          const ph = flies[k + 3] / 159, on = reel.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 1.9 + ph);
          if (on > 0.35) dot(flies[k] + Math.round(6 * Math.sin(t * 0.4 + ph)), flies[k + 1] + Math.round(4 * Math.sin(t * 0.3 + ph * 2)), FLY, Math.min(0.85, on) * (z === 8 ? 0.7 : 1));
        }
      }
      paintYou(t);
    }
    function lifeLight(w, h, z, t) {
      const add = (gx, gy, k) => {
        cellOf(gx, gy);
        if (CELLX < 0 || CELLY < 0 || CELLX >= picCols || CELLY >= picRows) return;
        const i = (CELLY >> 1) * w + (CELLX >> 1);
        halfR[i] += 0.8 * k; halfG[i] += 0.66 * k; halfB[i] += 0.3 * k;
      };
      if (z <= 2) {
        for (let k = 0; k < fireflies.length; k++) {
          const f = fireflies[k];
          add(Math.round(f.x + 3 * Math.sin(t * 0.5 + f.ph)), Math.round(f.y - (t - T_GOLD) * f.sp * 1.2 % 14), 0.6);
        }
      } else if (t >= T_X4) {
        const d = DAYS[dayStepAt(t, reel.reduced)];
        for (let k = 0; k < flies.length; k += 4) if (flies[k + 2] <= d) add(flies[k], flies[k + 1], 0.25);
      }
    }

    /* Where the last view was, for a moment after each step back; and at the widest, every view, as rings. */
    function rect(x0, y0, x1, y1, c, k, corners) {
      const a = clamp(k, 0, 1);
      if (a <= 0) return;
      const put = (x, y) => {
        if (x < 0 || x >= picCols || y < 0 || y >= picRows) return;
        const q = (y * picCols + x) * 4;
        pic[q] = pic[q] + (c[0] - pic[q]) * a; pic[q + 1] = pic[q + 1] + (c[1] - pic[q + 1]) * a; pic[q + 2] = pic[q + 2] + (c[2] - pic[q + 2]) * a;
      };
      for (let x = x0; x <= x1; x++) {
        if (corners && x - x0 > 2 && x1 - x > 2) continue;
        put(x, y0); put(x, y1);
      }
      for (let y = y0 + 1; y < y1; y++) {
        if (corners && y - y0 > 2 && y1 - y > 2) continue;
        put(x0, y); put(x1, y);
      }
    }
    function viewRect(z0, c, k, corners) {
      const v0 = viewOf(z0);
      cellOf(v0[1], v0[2]);
      const x0 = CELLX, y0 = CELLY;
      cellOf(v0[1] + VW * z0, v0[2] + VH * z0);
      rect(x0, y0, CELLX - 1, CELLY - 1, c, k, corners);
    }
    function paintMarks(t, z) {
      const cuts = [[T_ONE, 0.5], [T_X2, 1], [T_X4, 2], [T_X8, 4]];
      for (let k = 0; k < cuts.length; k++) {
        if (t >= cuts[k][0] && t < cuts[k][0] + 0.8) viewRect(cuts[k][1], LAMPC, 0.55 * (1 - (t - cuts[k][0]) / 0.8), true);
      }
      if (z === 8 && t >= T_RINGS && t < T_RINGS + 2.2) {
        [0.5, 1, 2, 4].forEach((r, k) => {
          const a = t - T_RINGS - (reel.reduced ? 0 : k * 0.15);
          if (a >= 0) viewRect(r, LAMPC, 0.5 * (1 - a / 1.6), false);
        });
      }
    }

    /* The grains of the word drift down through the dark, slowly, like silt through still water, and settle. */
    function paintLogo(rgba, cols, rows, cam, t) {
      for (let o = 0; o < cols * rows * 4; o += 4) { rgba[o] = 16; rgba[o + 1] = 13; rgba[o + 2] = 11; rgba[o + 3] = 255; }
      const l = logos[cols >= LOGO_MIN_COLS ? 0 : 1], top = Math.min(cam.y, 0) - 2;
      const end = 1 - smooth(T_END - 0.5, T_END, t);
      for (let k = 0; k < l.n; k++) {
        const i = l.order[k], dt = t - T_LOGO - l.begin[i];
        if (dt <= 0) continue;
        const u = clamp(dt / 1.05, 0, 1), ease = 1 - (1 - u) * (1 - u);
        const y = Math.round(top + (l.ys[i] - top) * ease), x = l.xs[i] + Math.round(1.6 * (1 - u) * Math.sin(dt * 5 + l.sway[i]));
        const vx = x - cam.x, vy = y - cam.y;
        if (vx < 0 || vx >= cols || vy < 0 || vy >= rows) continue;
        const q = (vy * cols + vx) * 4, tint = l.tint[i] * end, lit = u < 1 ? 0.75 : 1;
        rgba[q] = l.col[i * 3] * tint * lit + 16 * (1 - end); rgba[q + 1] = l.col[i * 3 + 1] * tint * lit + 13 * (1 - end);
        rgba[q + 2] = l.col[i * 3 + 2] * tint * lit + 11 * (1 - end);
      }
    }

    /* One RGBA pixel per cell, for the film as it stands now. Nothing here changes the world. */
    function paint(rgba, cols, rows, cam) {
      const t = n / 60, mode = t < T_LOGO ? 'world' : 'logo';
      if (!cam || cam.mode !== mode) cam = frame(t, cols, rows).cam;
      if (mode === 'world') paintWorld(rgba, cols, rows, cam, t);
      else paintLogo(rgba, cols, rows, cam, t);
    }

    /* The bees go from flower to flower. */
    function fly(t) {
      for (let k = 0; k < bees.length; k++) {
        const b = bees[k];
        if (b.to < 0 || look() < 0.01) {
          let best = -1;
          for (let tries = 0; tries < 40; tries++) {
            const x = PX + 40 + Math.floor(look() * 110);
            for (let y = WY0; y < WY1; y++) if (FL[y * W + x] === FLOWER || FL[y * W + x] === BLOSSOM) { best = y * W + x; break; }
            if (best >= 0) break;
          }
          b.to = best;
        }
        if (b.to >= 0) {
          const tx = b.to % W, ty = ((b.to / W) | 0) - 1;
          b.x += clamp(tx - b.x, -0.6, 0.6); b.y += clamp(ty - b.y, -0.4, 0.4);
        } else { b.x -= 0.4; }
      }
    }

    /* The first frames of any code are its slowest. This takes them now, and not on the film's hardest cut. */
    function warmUp() {
      const buf = new Uint8ClampedArray(VW * VH * 4);
      n = Math.round(T_ONE * 60);
      for (let k = 0; k < 40; k++) tick();
      paint(buf, VW, VH, frame(n / 60, VW, VH).cam);
      [T_X2 + 0.1, T_X4 + 0.1, T_X8 + 0.1].forEach((t) => { n = Math.round(t * 60); tick(); paint(buf, VW, VH, frame(n / 60, VW, VH).cam); });
      reset();
    }

    const reel = {
      get t() { return n / 60; },
      reduced: false,
      reset, frame, paint, warm: warmUp,
      tick() { tick(); if (!(n & 1)) { lifeAt(n / 60); fly(n / 60); } },
      /* For tests: the live cells, and how far the script has got. */
      world: { W, H, M, FL, MO, PX, PY },
      get you() { return you; },
      get plant() { return plant; },
      get built() { return built; },
      get scooped() { return scooped; },
      get firstClay() { return firstClay; },
      get growing() { return growing(n / 60); },
      get reeds() { return reeds.length; }
    };
    reel.prepare = prepare;
    reset(seed0);
    return reel;
  }

  /* Three box passes stand in for a gaussian: near enough, and sigma costs nothing. */
  function boxWidths(sigma) {
    let lo = Math.floor(Math.sqrt(4 * sigma * sigma + 1));
    if (lo % 2 === 0) lo--;
    const m = Math.round((12 * sigma * sigma - 3 * lo * lo - 12 * lo - 9) / (-4 * lo - 4));
    return [0, 1, 2].map((k) => (k < m ? lo : lo + 2));
  }

  function finish(gen) {
    let s = gen.next();
    while (!s.done) s = gen.next();
    return s.value;
  }

  function* everything(seed) {
    const world = yield* buildWorld();
    const reel = makeReel(world, seed);
    yield* reel.prepare();
    reel.reset(seed);
    return reel;
  }

  const SiltReel = {
    /* Everything at once, for tests and tools. */
    create(options) {
      const o = options || {};
      return finish(everything(o.seed || 1));
    },

    /* The same, spread over tasks of about `slice` ms so the page keeps moving. */
    load(options) {
      const o = options || {}, slice = o.slice || 6;
      return new Promise((resolve, reject) => {
        const gen = everything(o.seed || 1);
        function run() {
          try {
            const end = Date.now() + slice;
            while (Date.now() < end) {
              const s = gen.next();
              if (s.done) { resolve(s.value); return; }
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
    words() { return makeReel({ M0: null, SH: null, MO0: null, FIN: null, FLF: null, BM: null, BF: null, surf: null, flies: null }, 1); },

    /* A seed that has been checked against the script. Each one plays differently. */
    pickSeed(x) {
      let s = 1 + Math.floor(x * SEEDS) % SEEDS;
      while (LEFT_OUT.indexOf(s) >= 0) s = s % SEEDS + 1;
      return s;
    },

    VW, VH, COLORS, KEYS,
    T: {
      LAND: T_LAND, PICK: T_PICK, SOW: T_SOW, DIG: T_DIG, OPEN: T_OPEN, ONE: T_ONE, CLAY: T_CLAY, SCOOP: T_SCOOP,
      BRICK: T_BRICK, REEDS: T_REEDS, BIRD: T_BIRD, GOLD: T_GOLD, X2: T_X2, X4: T_X4, X8: T_X8, RINGS: T_RINGS,
      NIGHT: T_NIGHT, DARK: T_DARK, LOGO: T_LOGO, WORDS: T_WORDS, LAST: T_LAST, END: T_END
    },
    MAT: { AIR, STONE, SOIL, SILT, FINE, WATER, CLAY, BRICK, SEED, WOOD, LAMP, FUNGUS, SAND },
    FLORA: { STEM, LEAF, GRASS, FLOWER, REED, ROOT, BLOSSOM, BUSH, CROP },
    PATCH: { x: PX, y: PY, wall: WALL, sow: SOW_X }
  };

  if (typeof module === 'object' && module.exports) module.exports = SiltReel;
  else root.SiltReel = SiltReel;
})(typeof self !== 'undefined' ? self : this);
