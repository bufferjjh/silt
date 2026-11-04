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
     reel.tick()                          1/60 s: scripted events and the physics
     reel.t                               seconds of film
     reel.frame(t, cols, rows)            what is on screen, as plain data
     reel.paint(rgba, cols, rows, cam)    one RGBA pixel per cell of the picture; cam comes from frame()
     reel.warm()                          takes the slowest frames now, and puts everything back (create has
                                          done it already, and so has load unless reel.warmed is false)
     reel.pace                            what the warm-up timed: ms of ticks for the spring's busiest second
                                          of film (burst), and ms to paint one cell of a picture with nothing
                                          new in it (paint)
     reel.reduced                         set true: no twinkling, and days pass in fewer steps

   There are three sizes of grain. The valley is laid out in valley grains. The ground the camera is close to is
   made again in finer grains and simulated in them: the opening close-up in grains an eighth of a valley grain a
   side, and the window round the patch in grains a quarter of one. A cell of the picture stays about the same size
   on screen as the camera steps back, so it holds more of the world each time: a close-up grain in the opening, a
   window grain at 1:1, half a valley grain a side at x2, a valley grain at x4, and four valley grains at x8.
   Physics only uses + - * /, tables and these dice, so a seed plays out the same in every browser. */
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
  const LOGO_FALL = 1.05; /* Seconds a grain of the end card's word takes to fall. */

  /* Days pass only once the camera steps back, and only in these steps. */
  const DAYS = [1, 2, 3, 5, 7, 9, 12, 16, 21, 27, 34, 42, 51, 61, 72, 84, 97, 110, 120];
  const DAY_AT = [0, 45.417, 45.833, 47.0, 47.333, 47.667, 48.0, 48.6, 48.88, 49.16, 49.44, 49.72, 50.0, 50.28,
    50.56, 50.84, 51.12, 51.4, 51.68];
  /* With reduced motion, the same days in a few hard steps. */
  const DAY_AT_STILL = [0, 99, 45.833, 99, 99, 99, 48.0, 99, 99, 99, 49.0, 99, 99, 99, 99, 99, 99, 99, 50.0];

  /* The view the film is composed for, in cells. At 1:1 a valley grain is Q cells a side. */
  const Q = 4;
  const VW = 160 * Q, VH = 66 * Q;

  /* The world, in valley grains. The patch is the film's own view at 1:1; its grains are live in the window around it. */
  const W = 1600, H = 560, N = W * H;
  const PX = 720, PY = 128;
  const WX0 = PX - 32, WX1 = PX + 192, WY0 = PY, WY1 = PY + 72;
  /* The ground simulated in finer grains, as boxes of the patch in valley grains, with how many fine grains go
     along a valley grain. The close-up holds the opening's view with room either side; the window is the one above. */
  const CLOSE = { S: 8, x0: 0, x1: 112, y0: 4, y1: 52 };
  const NEAR = { S: 4, x0: WX0 - PX, x1: WX1 - PX, y0: 0, y1: WY1 - PY };
  /* The composed view at each zoom, by its corner in valley grains. Each one holds the one before. A cell at zoom z
     is z / Q valley grains a side. */
  const VIEWS = [[0.5, PX + 16, PY + 8], [1, PX, PY], [2, PX - 80, PY - 40], [4, PX - 240, PY - 64], [8, PX - 560, PY - 128]];
  const MIDDLE = { 0.5: 38 * Q, 1: 34 * Q, 2: 33 * Q, 4: 30 * Q, 8: 33 * Q }; /* The row to keep in a short picture. */
  /* As the bird comes in to land on the sapling's crown, a picture too short to have it looks up to keep it in: its
     top rises to BIRD_TOP over these seconds, and stays there until the cut. A picture whose top is that high already
     stays where it is. */
  const BIRD_TOP = 14, BIRD_LOOK = [beat(42), beat(43)];

  /* Fixed, so every play happens in the same valley. Only the physics dice change. */
  const WORLD_SEED = 7;

  /* Seeds 1 to 256 have each been played through and checked against the script, and all of them keep to it. One
     that didn't would be listed in LEFT_OUT and never picked. */
  const SEEDS = 256;
  const LEFT_OUT = [];
  /* Milliseconds of work to make the world, over which a device is far too slow to play the film live: it is not
     warmed up, and the page gives it the video. A fast desktop takes about 300. Under it, the warm-up times the
     device on the film's own work (`pace`), and that decides. */
  const SLOW_BUILD = 1400;
  /* The warm-up times this many ticks of running water. The spring's busiest second of film, the worst of any seed,
     takes about BURST times as long as one of them to work out and colour in: the seeds differ by a few per cent
     there. */
  const PACE_TICKS = 24, BURST = 72;
  const clock = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

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
  /* Dry ground drinks at this rate, damp ground far slower; each grain dampens it this much. The rate is a chance per
     update, for a fine grain as for a valley grain: there are S times as many grains along the ground and S times as
     many updates, so a stretch of ground drinks as much water a second as it did. */
  const SOAK_RATE = 0.04, SOAK_STEP = 60;
  /* How far water can run along a row in one update, in valley grains. */
  const RUN_ALONG = 6;
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
  const SEED_RIM = rgb('9c7a3c'), SEED_MID = rgb('d2ac60'), GLINT = rgb('fff6dc'), BIRD_DARK = rgb('6a4630');
  const BIRD_WING = rgb('7e5438'), BEE_BAND = rgb('3d2a20'), WING = rgb('f7e6c4');

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

  /* The patch's surface, in valley grains: x, then the row. A rock shoulder, a dip, a long slope, a basin, a lip. */
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
  /* The spring: water held in the rock behind a plug, three valley grains across and two high, and where it comes
     in from. Everything the script places is in valley grains of the patch, and made of fine grains. */
  const PLUG = [[38, 24], [37, 24], [36, 24]];
  const SOURCE = [27, 21], SPRING = 1.0;
  const SOW_X = 62; /* Where the seed goes. */
  /* How long, in frames, fine silt has to lie under water to become clay, and a seed has to be damp to sprout.
     Clay forms a grain deep and creeps down a little further, each layer a little later, every grain in its own time. */
  const CLAY_AFTER = 125, CLAY_DEEPER = 14, CLAY_SPREAD = 30, SPROUT_AFTER = 135;
  /* The film's water is timed so that the clay comes when the words say it does: it starts to settle from here. */
  const CLAY_FROM = 20.6 * 60;
  /* The wall: ten valley grains of clay, bottom row first, with a notch in the top row. */
  const WALL = [[137, 38], [138, 38], [139, 38], [140, 38], [137, 37], [138, 37], [139, 37], [140, 37], [137, 36], [140, 36]];
  /* Growth in fine grains: how often a fine column tries to grow grass, in the close-up or the window, and the most
     root tips at once. */
  const GRASS_TRY = 0.45, ROOTS_MOST = 360;

  /* Where the action is, for a picture narrower than the film: a time, then the patch column to keep centred. */
  const FOCUS = [0, 50, 4.2, 52, 6.0, 60, 7.5, 58, 8.3, 46, 10.0, 46, T_ONE, 60, 16, 68, 20, 80, 24, 92, 26, 100, 29, 118,
    beat(42.6), 118, 37.0, 98, T_X2, 80];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, t) { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function thousands(n) { return String(n).replace(/\B(?=(\d{3})+$)/g, ','); }
  function sq(v) { return v * v; }

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

  /* The rock shoulder's outline. Columns and rows of the patch here count from a valley grain's left and top edges, so
     a valley grain's middle is at +0.5. Its face ends at column 39; above the spring's lip, and below the ground
     under it, the face is set back a little at each row, and its top corner is worn round. The lip, the plug and the
     rows between are left as they are. */
  function faceBack(py) {
    if (py < 23) return 0.5 + 0.6 * vnoise(py / 0.9, 3.5, 24) + 0.5 * vnoise(py / 0.35, 4.5, 27) + 1.4 * sq(clamp(1 - (py - 20) / 2.5, 0, 1));
    if (py < 27.5) return 0;
    return (0.3 + 0.9 * vnoise(py / 1.2, 5.5, 25) + 0.5 * vnoise(py / 0.4, 6.5, 28)) * clamp((py - 27.5) * 2, 0, 1);
  }
  /* How deep the shoulder's top is bitten into at a column; only a little where it is thin over the spring. */
  function topBite(px) {
    const b = 0.6 * vnoise(px / 1.7, 9.5, 26) + 0.4 * vnoise(px / 0.6, 10.5, 29);
    return px >= 24 && px < 36 ? 0.35 * b : 1.1 * b * (0.4 + 0.6 * vnoise(px / 5.3, 11.5, 30));
  }
  /* The shoulder's foot breaks the strata: under the shoulder they lie as far below its top as they lie below the
     dip's ground beside it, DIP_TOP. Below the rock the break is a fault that leans back under the shoulder and
     wavers with depth, and the two sides mix grain by grain over a few valley grains. True where a point lies on the
     dip's side of it; `mix` is the grain's own roll, from -1 to 1. Every column from 39 on is on the dip's side. */
  const DIP_TOP = 27, FAULT_Y = 30, FAULT_LEAN = 0.35;
  function pastFault(px, py, mix) {
    const r = clamp((py - FAULT_Y) / 4, 0, 1);
    const fx = 39 - FAULT_LEAN * Math.max(0, py - FAULT_Y) - r * (2 + 2.4 * (vnoise(py / 5, 7.5, 22) - 0.5) + 1.2 * (vnoise(py / 1.8, 8.5, 32) - 0.5));
    return px + 1.5 * r * mix >= fx;
  }

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

  /* Where the camera is: 1 is the film's 1:1, 2 a step back, 0.5 the close-up. A cell is z / Q valley grains. */
  function zoomAt(t) { return t < T_ONE ? 0.5 : t < T_X2 ? 1 : t < T_X4 ? 2 : t < T_X8 ? 4 : 8; }
  function viewOf(z) { for (let k = 0; k < VIEWS.length; k++) if (VIEWS[k][0] === z) return VIEWS[k]; return VIEWS[1]; }
  function dayStepAt(t, reduced) {
    const at = reduced ? DAY_AT_STILL : DAY_AT;
    let s = 0;
    for (let k = 1; k < at.length; k++) if (t >= at[k]) s = k;
    return s;
  }
  function stepOfDay(d) { let s = 0; while (s + 1 < DAYS.length && DAYS[s] < d) s++; return s; }

  /* The word SILT in a heavy monospace, at two sizes, a cell a grain, its curves traced smooth: for each row, the
     lengths of gap, ink, gap, ink, as two characters each. */
  const RUNS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOGO_MASKS = [
    {
      x: 76, y: 16, rows: '0I0k 0C0w 0z0C 0w0J 0t0Q0S1s0K0m1s1I 0r0U0O1w0G0q1o1M 0p0Y0M1w0G0q1o1M 0n120J1y0E0s1m1O 0m140I1y0E0s1m1O ' +
        '0k170H1y0E0s1m1O 0j180H1y0E0s1m1O 0h1b0G1y0E0s1m1O 0g1c0G1y0E0s1m1O 0e1e0G1y0E0s1m1O 0d1g0F1y0E0s1m1O ' +
        '0c1h0F1y0E0s1m1O 0b1i0F1y0E0s1m1O 0a1j0F1y0E0s1m1O 0a1j0F1y0E0s1m1O 091k0F1y0E0s1m1O 081l0F1y0E0s1m1O ' +
        '081k0G1y0E0s1m1O 071l0G1y0E0s1m1O 061m0G1y0E0s1m1O 060J0j0j0H1y0E0s1m1O 050F0t0d0J1w0F0s1n1M ' +
        '050D0z070L1w0F0s1n1M 040C1v1s0H0s1p1I 040A1X0y1b0s1X0C 030A200u1d0s1Z0y 030y220u1d0s1Z0y ' +
        '030x240s1e0s200w 020y240s1e0s200w 020x250s1e0s200w 020w260s1e0s200w 010x260s1e0s200w 010x260s1e0s200w ' +
        '010w270s1e0s200w 010w270s1e0s200w 000x270s1e0s200w 000x270s1e0s200w 000x270s1e0s200w 000x270s1e0s200w ' +
        '000y260s1e0s200w 000y260s1e0s200w 000y260s1e0s200w 000z250s1e0s200w 000z250s1e0s200w 000A240s1e0s200w ' +
        '010A230s1e0s200w 010A230s1e0s200w 010B220s1e0s200w 010D200s1e0s200w 020D1Z0s1e0s200w 020E1Y0s1e0s200w ' +
        '020G1W0s1e0s200w 030G1V0s1e0s200w 030I1T0s1e0s200w 040J1R0s1e0s200w 040L1P0s1e0s200w 050M1N0s1e0s200w ' +
        '050O1L0s1e0s200w 060Q1I0s1e0s200w 070S1F0s1e0s200w 070U1D0s1e0s200w 080W1A0s1e0s200w 090X1y0s1e0s200w ' +
        '0a0Z1v0s1e0s200w 0b101t0s1e0s200w 0c111r0s1e0s200w 0d121p0s1e0s200w 0e131n0s1e0s200w 0f131m0s1e0s200w ' +
        '0g141k0s1e0s200w 0h141j0s1e0s200w 0i151h0s1e0s200w 0j151g0s1e0s200w 0l141f0s1e0s200w 0m141e0s1e0s200w ' +
        '0o131d0s1e0s200w 0p131c0s1e0s200w 0r121b0s1e0s200w 0t111a0s1e0s200w 0v10190s1e0s200w 0x0Z180s1e0s200w ' +
        '0A0X170s1e0s200w 0C0W160s1e0s200w 0F0U150s1e0s200w 0H0S150s1e0s200w 0K0Q140s1e0s200w 0N0O130s1e0s200w ' +
        '0P0M130s1e0s200w 0R0L120s1e0s200w 0T0J120s1e0s200w 0V0I110s1e0s200w 0X0G110s1e0s200w 0Y0G100s1e0s200w ' +
        '100F0Z0s1e0s200w 110E0Z0s1e0s200w 130C0Z0s1e0s200w 140C0Y0s1e0s200w 150B0Y0s1e0s200w 150B0Y0s1e0s200w ' +
        '160A0Y0s1e0s200w 170z0Y0s1e0s200w 170z0Y0s1e0s200w 180y0Y0s1e0s200w 180y0Y0s1e0s200w 190x0Y0s1e0s200w ' +
        '190x0Y0s1e0s200w 190x0Y0s1e0s200w 190x0Y0s1e0s200w 190x0Y0s1e0s200w 190x0Y0s1e0s200w 190x0Y0s1e0s200w ' +
        '190x0Y0s1e0s200w 190w0Z0s1e0s200w 190w0Z0s1e0s200w 190w0Z0s1e0s200w 190v100s1e0s200w 180w100s1e0s200w ' +
        '180v110s1e0s200w 170w110s1e0s200w 160x110s1e0s200w 160w120s1e0s200w 150x110u1d0t1Z0w 130z110u1d0t1Z0w ' +
        '120z100y1b0v1X0w 08080K0B0A1s0H1n150w 050g0D0C0z1w0F1p130w 040l0x0E0z1w0F1p130w 030r0n0I0z1y0E1q120w ' +
        '021w0A1y0E1q120w 021w0A1y0E1q120w 011w0B1y0E1q120w 011v0C1y0E1q120w 011u0D1y0E1q120w 011t0E1y0E1q120w ' +
        '011s0F1y0E1q120w 011r0G1y0E1q120w 011q0H1y0E1q120w 011p0I1y0E1q120w 011o0J1y0E1q120w 021m0K1y0E1q120w ' +
        '021l0L1y0E1q120w 031i0N1y0E1q120w 031h0O1y0E1q120w 041e0Q1y0E1q120w 051b0S1y0E1q120w 07170V1w0G1o140u ' +
        '08140X1w0G1o140u 0b0Y121s0K1k180q 0f0R 0j0K 0m0D 0s0s'
    },
    {
      x: 169, y: 52, rows: '1o0O0u0e0W10 0o0h0H0S0q0i0S14 0l0n0E0S0q0i0S14 0i0s0B0U0o0k0Q16 0g0w0z0U0o0k0Q16 0e0z0y0U0o0k0Q16 ' +
        '0c0C0x0U0o0k0Q16 0a0F0w0U0o0k0Q16 080H0w0U0o0k0Q16 070I0w0U0o0k0Q16 060J0w0U0o0k0Q16 050K0w0U0o0k0Q16 ' +
        '040L0w0U0o0k0Q16 030L0y0S0p0k0R14 030J0A0S0p0k0R14 020A0M0O0r0k0T10 020s180m0F0k1f0m 010q1d0i0H0k1h0i ' +
        '010o1f0i0H0k1h0i 010n1h0g0I0k1i0g 000n1i0g0I0k1i0g 000n1i0g0I0k1i0g 000m1j0g0I0k1i0g 000m1j0g0I0k1i0g ' +
        '000m1j0g0I0k1i0g 000m1j0g0I0k1i0g 000m1j0g0I0k1i0g 000m1j0g0I0k1i0g 000m1j0g0I0k1i0g 000n1i0g0I0k1i0g ' +
        '000o1h0g0I0k1i0g 010n1h0g0I0k1i0g 010p1f0g0I0k1i0g 010q1e0g0I0k1i0g 020r1c0g0I0k1i0g 020t1a0g0I0k1i0g ' +
        '030u180g0I0k1i0g 040w150g0I0k1i0g 050y120g0I0k1i0g 050A100g0I0k1i0g 060B0Y0g0I0k1i0g 080B0W0g0I0k1i0g ' +
        '090C0U0g0I0k1i0g 0a0D0S0g0I0k1i0g 0b0D0R0g0I0k1i0g 0c0E0P0g0I0k1i0g 0e0D0O0g0I0k1i0g 0g0C0N0g0I0k1i0g ' +
        '0i0B0M0g0I0k1i0g 0k0A0L0g0I0k1i0g 0m0z0K0g0I0k1i0g 0p0x0J0g0I0k1i0g 0s0v0I0g0I0k1i0g 0u0t0I0g0I0k1i0g ' +
        '0w0s0H0g0I0k1i0g 0y0q0H0g0I0k1i0g 0z0q0G0g0I0k1i0g 0B0o0G0g0I0k1i0g 0C0o0F0g0I0k1i0g 0D0n0F0g0I0k1i0g ' +
        '0D0n0F0g0I0k1i0g 0E0n0E0g0I0k1i0g 0E0n0E0g0I0k1i0g 0F0m0E0g0I0k1i0g 0F0m0E0g0I0k1i0g 0F0m0E0g0I0k1i0g ' +
        '0F0m0E0g0I0k1i0g 0F0l0F0g0I0k1i0g 0F0l0F0g0I0k1i0g 0E0m0F0g0I0k1i0g 0E0l0G0g0I0k1i0g 0D0m0G0g0I0k1i0g ' +
        '0C0m0H0g0I0k1i0g 0B0n0G0i0H0l1h0g 0A0n0H0i0H0l1h0g 0x0q0F0m0F0n1f0g 060b090w0s0O0r0V0H0g ' +
        '040R0r0S0p0X0F0g 030S0r0S0p0X0F0g 030R0r0U0o0Y0E0g 020R0s0U0o0Y0E0g 020Q0t0U0o0Y0E0g 020P0u0U0o0Y0E0g ' +
        '030N0v0U0o0Y0E0g 030M0w0U0o0Y0E0g 040J0y0U0o0Y0E0g 050H0z0U0o0Y0E0g 060E0B0U0o0Y0E0g 070B0D0U0o0Y0E0g ' +
        '0a0v0H0S0q0W0G0e 0d0p0K0S0q0W0G0e 1o0O0u0S0K0a'
    }
  ];
  /* The word fills from the floor up in the film's own materials: silt, clay, soil, leaf, grass, flower, lantern. */
  const LOGO_STOPS = [[0, 'b6a08c'], [0.16, 'c3b09c'], [0.2, 'c27250'], [0.34, 'b86a48'], [0.38, '6a4c3a'],
    [0.5, '7a5a44'], [0.54, '4a6b40'], [0.68, '62824b'], [0.72, 'e39c52'], [0.84, 'efc46c'], [0.9, 'ffe09a'], [1, 'fff6dc']]
    .map((s) => [s[0], rgb(s[1])]);
  const LOGO_MIN_COLS = 130 * Q; /* Narrower than this, the smaller word. */

  function buildLogo(mask) {
    const xs = [], ys = [];
    mask.rows.split(' ').forEach((row, r) => {
      let x = mask.x, ink = false;
      for (let k = 0; k + 1 < row.length; k += 2) {
        const run = RUNS.indexOf(row[k]) * 62 + RUNS.indexOf(row[k + 1]);
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
        const d = y - s, px = x - PX, shoulder = px <= 38 && px >= -70;
        /* Where the shoulder's face is set back under the ground, the dip's ground comes in. */
        const open = shoulder && y - PY >= 28 && px + 0.5 >= 39 - faceBack(y - PY + 0.5);
        /* The strata's own depth: past the face or the fault under the shoulder, from the dip's level. */
        const ds = open || (shoulder && pastFault(px + 0.5, y - PY + 0.5, hash(x, y, 23) + hash(x, y, 24) - 1)) ? y - PY - DIP_TOP : d;
        const wob = 8 * (vnoise(x / 31, y / 13, 3) - 0.5) + 6 * (vnoise(x / 97, 1.5, 4) - 0.5);
        const e = ds + (ds > 6 ? wob : 0);
        const rock = shoulder ? lerpAt(ROCK, px, true) + 4 * (vnoise(x / 6, y / 5, 21) - 0.5) : 0;
        let m;
        /* The shoulder's ragged top, and its face under the ground. Inside the window the valley takes the window's
           grains before it is seen, so the face above the ground is the window's alone. */
        if (d < rock && d + 0.5 < topBite(px + 0.5)) continue;
        if (d < rock && !open) m = STONE;
        /* Under the rock is soil, not silt. Where the shoulder thins out to the left the silt comes back grain by
           grain over twenty-odd columns, so the change draws no line. */
        else if (e < 5 && shoulder && !open && px + 22 * hash(x, y, 33) + 8 * (vnoise(x / 9, y / 3, 34) - 0.5) >= -48) m = SOIL;
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
          else if (y >= L || (crops ? y >= L - 1 : x < x0 + 10)) mat(x, y, SOIL, day, 1 + Math.floor(hash(x, y, 62) * 3));
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

  /* ---- The fine ground ---- */

  /* A box of the patch made again in fine grains, from the same surface, rock and strata as the valley, so the two
     agree wherever they meet. A fine grain at (x, y) in the box stands for the point a fraction of the way across its
     valley grain; the spring, the plug and the basin's fine silt keep to whole valley grains. */
  function* buildLevel(spec) {
    const S = spec.S, w = (spec.x1 - spec.x0) * S, h = (spec.y1 - spec.y0) * S, n = w * h;
    const gx0 = (PX + spec.x0) * S, gy0 = (PY + spec.y0) * S;
    const M0 = new Uint8Array(n), MO0 = new Uint8Array(n), SH0 = new Uint8Array(n), surf = new Int16Array(w);
    const xs = new Float32Array(w), ys = new Float32Array(w), rocks = new Float32Array(w), wobs = new Float32Array(w);
    const rockTop = new Float32Array(w);
    const cols = new Int16Array(w);
    for (let x = 0; x < w; x++) {
      const xv = (gx0 + x + 0.5) / S - 0.5, px = xv - PX;
      xs[x] = xv;
      /* The surface at the grain's middle, so the rock's step down stays inside the rock's own column. */
      ys[x] = PY + lerpAt(PATCH, px + 0.5, false);
      cols[x] = Math.floor((gx0 + x) / S) - PX;
      rocks[x] = cols[x] <= 38 && cols[x] >= -70 ? lerpAt(ROCK, px, true) : -99;
      /* The rock goes down from where the shoulder's top is, so its face stays upright where the surface steps down. */
      rockTop[x] = PY + lerpAt(PATCH, Math.min(px + 0.5, 38), false);
      wobs[x] = 6 * (vnoise(xv / 97, 1.5, 4) - 0.5);
      surf[x] = clamp(Math.ceil(ys[x] * S - gy0 - 0.5), 0, h - 1);
    }
    for (let j = 0; j < h; j++) {
      if ((j & 31) === 31) yield;
      const yv = (gy0 + j + 0.5) / S - 0.5, py = yv + 0.5 - PY, face = 39 - faceBack(py);
      for (let x = 0; x < w; x++) {
        const d = yv + 0.5 - ys[x];
        if (d < 0) continue;
        const i = j * w + x, xv = xs[x], px = xv + 0.5 - PX, shoulder = rocks[x] > -99;
        const rag = 0.3 * (hash(gx0 + x, gy0 + j, 31) - 0.5);
        /* Where the shoulder's face is set back under the ground, the dip's ground comes in. */
        const open = shoulder && py >= 27.5 && px + rag >= face;
        /* The strata's own depth: under the shoulder from its top, or past its face or the fault from the dip's level. */
        const ds = !shoulder ? d : open || pastFault(px, py, hash(gx0 + x, gy0 + j, 23) + hash(gx0 + x, gy0 + j, 24) - 1) ? py - DIP_TOP : yv + 0.5 - rockTop[x];
        /* The valley's waver comes in over a valley grain or two rather than all at once, and every boundary is a
           little ragged, so no layer ends in a ruled line. */
        const wob = 8 * (vnoise(xv / 31, yv / 13, 3) - 0.5) + wobs[x];
        const e = ds + wob * clamp(ds - 5.5, 0, 1) + 0.9 * (vnoise(xv / 1.7, yv / 1.7, 17) - 0.5);
        const rock = shoulder ? rocks[x] + 4 * (vnoise(xv / 6, yv / 5, 21) - 0.5) : 0;
        const inRock = yv + 0.5 - rockTop[x] < rock;
        let m;
        /* The shoulder's ragged top and face are air, a grain or two more or less in each fine grain. */
        if (inRock && py < 23 && (yv + 0.5 - rockTop[x] + rag < topBite(px) || px + rag >= face)) continue;
        if (inRock && !open) m = STONE;
        /* Under the rock is soil, as in the valley: the dip's silt doesn't come in under it. */
        else if (e < 5 && shoulder && !open) m = SOIL;
        else if (e < 5) {
          /* The basin's fine silt, from column 104 to 142 as in the valley, with sides that waver with depth and
             mix in grain by grain over a few valley grains, so they don't draw a line down the ground. */
          const u = xv + 0.5 - PX + 1.6 * (vnoise(yv / 1.4, xv / 9, 18) - 0.5) + 2.5 * (hash(gx0 + x, gy0 + j, 19) + hash(gx0 + x, gy0 + j, 20) - 1);
          m = u >= 104 && u < 143 && d < 6 ? FINE : SILT;
        }
        else if (e < 15) m = SOIL;
        else if (e < 32) m = STRATA_A;
        else if (e < 56) m = STRATA_B;
        else if (e < 92) m = STRATA_C;
        else m = STONE;
        M0[i] = m;
        /* The same banding as the valley's, broken by clumps about a valley grain across, and each grain its own. */
        const grain = hash(gx0 + x, gy0 + j, 6);
        const jit = 0.5 * grain + 0.5 * vnoise(xv * 1.3, yv * 1.3, 16);
        SH0[i] = Math.floor(clamp(vnoise(xv / 23, yv / 2.2, 5) * 2.6 + jit * 1.7 - 0.35, 0, 3.99)) | (Math.floor(grain * 64) << 2);
      }
    }
    /* Where the shoulder's top and face are worn away, the open air reaches down to the rock, and reads as sky. */
    for (let x = 0; x < w; x++) while (surf[x] < h - 1 && M0[surf[x] * w + x] === AIR) surf[x]++;
    /* A grain worn away under one that wasn't would be a hole in the rock with no way in. It stays rock. */
    for (let x = 0; x < w; x++) {
      if (rocks[x] === -99) continue;
      for (let j = surf[x] + 1; j < Math.min(h, (PY + 23) * S - gy0); j++) {
        const i = j * w + x;
        if (M0[i] !== AIR) continue;
        M0[i] = STONE;
        const xv = xs[x], yv = (gy0 + j + 0.5) / S - 0.5, grain = hash(gx0 + x, gy0 + j, 6);
        const jit = 0.5 * grain + 0.5 * vnoise(xv * 1.3, yv * 1.3, 16);
        SH0[i] = Math.floor(clamp(vnoise(xv / 23, yv / 2.2, 5) * 2.6 + jit * 1.7 - 0.35, 0, 3.99)) | (Math.floor(grain * 64) << 2);
      }
    }
    /* The spring: a pocket of water in the shoulder, plugged at the face. */
    for (let j = Math.max(0, (PY + 18) * S - gy0); j < Math.min(h, (PY + 28) * S - gy0); j++) {
      const yv = (gy0 + j + 0.5) / S - 0.5, py = yv - PY, cy = Math.floor((gy0 + j) / S) - PY;
      for (let x = Math.max(0, (PX + 24) * S - gx0); x < Math.min(w, (PX + 40) * S - gx0); x++) {
        const i = j * w + x, px = xs[x] - PX, cx = cols[x];
        const a = (px - 31) / 4.6, b = (py - 23) / 3.4;
        if (a * a + b * b < 1 && cx <= 35) M0[i] = WATER;
        if (cx >= 36 && cx <= 38 && (cy === 23 || cy === 26)) M0[i] = STONE;
        if (cx === 35 && (cy === 24 || cy === 25)) M0[i] = WATER;
        /* The plug is damp from the water behind it, so it holds its shape until it is dug out. */
        if (cx >= 36 && cx <= 38 && (cy === 24 || cy === 25)) { M0[i] = SILT; MO0[i] = 140; }
      }
    }
    yield;
    return { S, px0: spec.x0, py0: spec.y0, w, h, n, gx0, gy0, M0, MO0, SH0, surf };
  }

  /* ---- The long views ---- */

  /* The valley as the long views see it, one entry per valley grain and one per square of two by two: what it shows
     on the day the film has got to, and what kind of thing that is. For each day step, the entries that change. */
  function makeGrid(z) {
    const gw = W / z, gh = H / z, n = gw * gh;
    return { z, gw, gh, n, col: new Uint32Array(n), kind: new Uint8Array(n), glow: new Uint8Array(n), sun: new Uint8Array(n),
      code: new Uint8Array(n), saved: null, at: null, list: null, step: 0 };
  }

  /* What a cell shows. */
  const K_SKY = 0, K_CAVE = 1, K_WATER = 2, K_TOP = 3, K_LIT = 4, K_GROUND = 5, K_GREEN = 6;
  /* What a long view's cell is made of, for telling one thing's edge from another's: the material, or 32 and up for
     what grows, or this for open ground under the surface. */
  const C_CAVE = 31, C_GREEN = 32;
  /* Pixels are written four bytes at a time, in the machine's own order. */
  const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  function makeReel(world, seed0) {
    const M0 = world.M0, SH = world.SH, MO0 = world.MO0, FIN = world.FIN, FLF = world.FLF, BM = world.BM, BF = world.BF;
    const surf = world.surf, flies = world.flies, alive = !!M0;
    const M = alive ? M0.slice() : null, FL = alive ? new Uint8Array(N) : null;
    const MO = alive ? MO0.slice() : null;
    const logos = alive ? LOGO_MASKS.map(buildLogo) : []; /* Words alone need no word to paint. */
    const grids = alive ? { 1: makeGrid(1), 2: makeGrid(2) } : {};
    let floraOut = new Uint32Array(122); /* Valley grains growing outside the window by each day. */

    let rnd = dice(1), look = dice(2), n = 0;
    let you, plant, roots, reeds, built, carried, scooped, sown, opened, stepNo, liveGrowing, firstClay, damp;
    let bees, fireflies, bird, seedAt, baked, pooled, repoolY;

    /* ---- Resolving a grain on a day ---- */

    function inWin(x, y) { return x >= WX0 && x < WX1 && y >= WY0 && y < WY1; }

    /* The material and what grows in it, for a grain outside the window on day d. */
    let RM = 0, RF = 0;
    function resolve(i, d) {
      RM = BM[i] <= d ? FIN[i] : M0[i];
      RF = BF[i] <= d ? FLF[i] : 0;
    }
    /* The same inside the window, where what the window's grains came to comes first. */
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

    /* Colours are packed as red, green and blue in one number. With each, what kind of thing it is (CK), what light
       it gives (CL), and how much sun reaches it (CSU, out of 255). */
    let CK = 0, CL = 0, CSU = 255;
    function pack(r, g, b) { return (r > 255 ? 255 : r | 0) | ((g > 255 ? 255 : g | 0) << 8) | ((b > 255 ? 255 : b | 0) << 16); }
    /* The colour of one valley grain. */
    function tone(i, x, y, m, f) {
      CL = 0;
      CSU = 255;
      const s = SH[i], k = s & 3, tint = 0.92 + 0.16 * ((s >> 2) / 63);
      if (f && (m === AIR || m === WATER || (f === ROOT && EARTH[m]))) {
        const c = (f * 4 + k) * 3;
        let r = FPAL[c] * tint, g = FPAL[c + 1] * tint, b = FPAL[c + 2] * tint;
        if (m === WATER) { r = r * 0.6 + 26; g = g * 0.6 + 34; b = b * 0.6 + 44; }
        else if (f === ROOT) { const dk = depthOf(x, y); r *= dk; g *= dk; b *= dk; CSU = sunOf(x, y) * 255 | 0; }
        CK = K_GREEN;
        return pack(r, g, b);
      }
      if (m === AIR) {
        if (y <= surf[x]) { CK = K_SKY; return 0; }
        const dk = depthOf(x, y) * 0.6;
        CK = K_CAVE;
        CSU = 0;
        return pack(34 * dk, 31 * dk, 29 * dk);
      }
      const c = (m * 4 + k) * 3;
      let r = PAL[c] * tint, g = PAL[c + 1] * tint, b = PAL[c + 2] * tint;
      if (m === WATER) {
        CK = y > 0 && M[i - W] === AIR && y - 1 <= surf[x] ? K_TOP : K_WATER;
        CSU = sunOf(x, y) * 255 | 0;
        return pack(r, g, b);
      }
      if (SOAKS[m]) {
        const wet = 1 - 0.36 * MO[i] / 255;
        r *= wet; g *= wet; b *= wet * 1.04;
      }
      if (GLOWS[m]) { CK = K_LIT; CL = m; return pack(r, g, b); }
      const dk = depthOf(x, y);
      CK = K_GROUND;
      CSU = sunOf(x, y) * 255 | 0;
      return pack(r * dk, g * dk, b * dk);
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
      PC = pick === -2 ? C_CAVE : pick;
      if (pick === -2) pick = AIR;
      for (let k = 0; k < seen.length; k++) CNT[seen[k]] = 0;
      const c = pick >= 32 ? tone(i, x, y, pick === 32 + ROOT ? SOIL : AIR, pick - 32) : tone(i, x, y, pick, 0);
      if (pick === WATER) {
        /* Water at the top of the square takes the sky. */
        const up = y0 > 0 ? y0 * W - W + x0 : -1;
        if (up >= 0) {
          if (live && inWin(x0, y0 - 1)) resolveLive(up, d); else resolve(up, d);
          CK = RM === AIR && !RF && y0 - 1 <= surf[x0] ? K_TOP : K_WATER;
        }
      }
      return c;
    }

    /* One valley grain on day d: its colour, what it is, and the sky's colour on water that lies open to it. */
    let PC = 0;
    function one(x, y, d, live) {
      const i = y * W + x;
      if (live && inWin(x, y)) resolveLive(i, d); else resolve(i, d);
      const m = RM, f = RF;
      if (f && (m === AIR || m === WATER || (f === ROOT && EARTH[m]))) { PC = C_GREEN + f; return tone(i, x, y, m, f); }
      PC = m === AIR && y > surf[x] ? C_CAVE : m;
      const c = tone(i, x, y, m, 0);
      if (m === WATER && y > 0) {
        if (live && inWin(x, y - 1)) resolveLive(i - W, d); else resolve(i - W, d);
        CK = RM === AIR && !RF && y - 1 <= surf[x] ? K_TOP : K_WATER;
      }
      return c;
    }

    function poolInto(g, bx, by, d, live) {
      const c = g.z === 1 ? one(bx, by, d, live) : pool(g.z, bx, by, d, live), p = by * g.gw + bx;
      g.col[p] = c;
      g.kind[p] = CK;
      g.glow[p] = CL;
      g.sun[p] = CSU;
      g.code[p] = PC;
    }

    /* Each long view's day-one valley, which entries change at each later step, and the fine ground as it starts. */
    function* prepare() {
      for (const z of [1, 2]) {
        const g = grids[z];
        for (let by = 0; by < g.gh; by++) {
          for (let bx = 0; bx < g.gw; bx++) poolInto(g, bx, by, 1, false);
          if ((by & 3) === 3) yield;
        }
        g.saved = [g.col.slice(), g.kind.slice(), g.glow.slice(), g.sun.slice(), g.code.slice()];
        yield;
      }
      const stepOf = new Uint8Array(256);
      for (let d = 0; d < 256; d++) stepOf[d] = d > 120 ? 0 : stepOfDay(d);
      const g1 = grids[1], g2 = grids[2], steps = DAYS.length;
      const bits1 = new Uint32Array(N), bits2 = new Uint32Array(g2.n);
      for (let y = 0; y < H; y++) {
        if ((y & 63) === 63) yield;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const b = Math.min(BM[i], BF[i]);
          if (b === NEVER || b <= 1) continue;
          const bits = (BM[i] <= 120 ? 1 << stepOf[BM[i]] : 0) | (BF[i] <= 120 ? 1 << stepOf[BF[i]] : 0);
          bits1[i] |= bits;
          bits2[(y >> 1) * g2.gw + (x >> 1)] |= bits;
          if (BF[i] <= 120 && !inWin(x, y)) floraOut[BF[i]]++;
        }
      }
      for (let d = 1; d < floraOut.length; d++) floraOut[d] += floraOut[d - 1];
      /* The lists: for each step, every entry that changes on it. */
      for (const [g, bits] of [[g1, bits1], [g2, bits2]]) {
        const at = new Int32Array(steps + 1);
        for (let p = 0; p < g.n; p++) {
          const b = bits[p];
          if (b) for (let s = 1; s < steps; s++) if (b & (1 << s)) at[s + 1]++;
          if ((p & 0x1ffff) === 0x1ffff) yield;
        }
        for (let s = 1; s <= steps; s++) at[s] += at[s - 1];
        const list = new Int32Array(at[steps]), fill = at.slice();
        for (let p = 0; p < g.n; p++) {
          const b = bits[p];
          if (b) for (let s = 1; s < steps; s++) if (b & (1 << s)) list[fill[s]++] = p;
          if ((p & 0x1ffff) === 0x1ffff) yield;
        }
        g.at = at; g.list = list;
        yield;
      }
      /* The fine ground is let settle once, with the world's own dice, so that it starts at rest: no grain of it moves
         until something moves it. */
      for (const lv of [close, win]) {
        const keepDice = rnd;
        rnd = dice(WORLD_SEED + lv.S);
        lv.next.fill(1);
        for (let k = 0; k < 400 && lv.next.indexOf(1) >= 0; k++) {
          step(lv, false);
          if ((k & 7) === 7) yield;
        }
        rnd = keepDice;
        lv.M0.set(lv.M); lv.MO0.set(lv.MO);
        lv.next.fill(0);
        lv.staleN = 0; lv.stale.fill(0); lv.allStale = false;
        for (let i = 0; i < lv.n; i++) {
          toneFine(lv, i);
          if ((i & 65535) === 65535) yield;
        }
        lv.col0 = lv.col.slice(); lv.kind0 = lv.kind.slice(); lv.sun0 = lv.sun.slice();
      }
    }

    /* Brings a long view's valley up to a step. Only entries with something dated in between are worked out again;
       in the window, from what its grains came to. */
    function advance(g, s) {
      if (s <= g.step) return;
      const d = DAYS[s], list = g.list, gw = g.gw;
      for (let k = g.step + 1; k <= s; k++) {
        for (let q = g.at[k]; q < g.at[k + 1]; q++) { const p = list[q]; poolInto(g, p % gw, (p / gw) | 0, d, pooled); }
      }
      g.step = s;
    }
    /* After the window is pooled, its part of both long views' valleys is worked out again from it, a few rows a
       tick, well before the camera gets out far enough to see it. */
    function repool() {
      const g1 = grids[1], g2 = grids[2], d = DAYS[stepNo], y1 = Math.min(WY1, repoolY + 8);
      for (let y = repoolY; y < y1; y++) {
        for (let x = WX0; x < WX1; x++) poolInto(g1, x, y, d, true);
        if (!(y & 1)) for (let x = WX0 >> 1; x < WX1 >> 1; x++) poolInto(g2, x, y >> 1, d, true);
      }
      repoolY = y1;
    }

    /* ---- The fine ground, live ---- */

    /* Each box gets its grains, what grows in them, how damp they are, and how long fine silt has lain under water.
       The box is cut into squares of 16 grains a side: only a square where something moved, or might, is looked at
       again, and only the grains that changed are coloured again. */
    function live(lv) {
      const n = lv.n, CW = Math.ceil(lv.w / 16), CH = Math.ceil(lv.h / 16);
      return Object.assign(lv, {
        M: lv.M0.slice(), MO: lv.MO0.slice(), FL: new Uint8Array(n), WET: new Uint8Array(n), SH: lv.SH0.slice(),
        col: new Uint32Array(n), kind: new Uint8Array(n), sun: new Uint8Array(n), col0: null, kind0: null, sun0: null,
        lit: new Uint32Array(n), litKey: -0.5, relight: true,
        rowKey: new Float64Array(lv.h).fill(-1), rowA: new Int16Array(lv.h), rowB: new Int16Array(lv.h),
        stale: new Uint8Array(n), staleList: new Int32Array(65536), staleN: 0, allStale: false,
        CW, CH, awake: new Uint8Array(CW * CH), next: new Uint8Array(CW * CH),
        wet: new Uint8Array(CW * CH), wetNext: new Uint8Array(CW * CH), turn: 0,
        ax: new Int16Array(CW * CH), rowFrom: new Int32Array(CH), rowTo: new Int32Array(CH),
        list: new Int32Array(n), top: new Int16Array(lv.w), ground: new Int16Array(lv.w), colDirty: new Uint8Array(lv.w).fill(1)
      });
    }
    const close = alive ? live(world.levels[0]) : null, win = alive ? live(world.levels[1]) : null;

    /* The left fine column, and the top fine row, of a patch column and row. */
    function fcol(lv, px) { return Math.round((px - lv.px0) * lv.S); }
    function frow(lv, py) { return Math.round((py - lv.py0) * lv.S); }

    function wakeAt(lv, x, y) {
      const CW = lv.CW, nx = lv.next;
      const a = (x > 0 ? x - 1 : 0) >> 4, b = (x + 1 < lv.w ? x + 1 : x) >> 4;
      const c = (y > 0 ? y - 1 : 0) >> 4, d = (y + 1 < lv.h ? y + 1 : y) >> 4;
      nx[c * CW + a] = 1; nx[c * CW + b] = 1; nx[d * CW + a] = 1; nx[d * CW + b] = 1;
    }
    function wetAt(lv, x, y) {
      const CW = lv.CW, nx = lv.wetNext;
      const a = (x > 0 ? x - 1 : 0) >> 4, b = (x + 1 < lv.w ? x + 1 : x) >> 4;
      const c = (y > 0 ? y - 1 : 0) >> 4, d = (y + 1 < lv.h ? y + 1 : y) >> 4;
      nx[c * CW + a] = 1; nx[c * CW + b] = 1; nx[d * CW + a] = 1; nx[d * CW + b] = 1;
    }
    function keep(lv, x, y) { lv.next[(y >> 4) * lv.CW + (x >> 4)] = 1; }
    function staleAt(lv, i) {
      if (lv.stale[i]) return;
      lv.stale[i] = 1;
      if (lv.staleN < lv.staleList.length) lv.staleList[lv.staleN++] = i;
      else lv.allStale = true;
    }
    /* A grain changes: whatever is round it may move now, and it and the grain below it are coloured again. */
    function changed(lv, i) {
      const w = lv.w, x = i % w, y = (i - x) / w;
      wakeAt(lv, x, y);
      lv.colDirty[x] = 1;
      staleAt(lv, i);
      if (i + w < lv.n) staleAt(lv, i + w);
    }
    function put(lv, i, m) { lv.M[i] = m; changed(lv, i); return i; }
    function setFL(lv, i, f, k) {
      lv.FL[i] = f;
      if (k !== undefined) lv.SH[i] = (lv.SH[i] & 0xfc) | k;
      staleAt(lv, i);
    }
    /* Damp changes. The colour only follows it in steps, and only dry silt that gets damp enough stops sliding. */
    function moved(lv, i, was, now) {
      const w = lv.w, x = i % w, y = (i - x) / w;
      wetAt(lv, x, y);
      if ((was >> 3) !== (now >> 3)) staleAt(lv, i);
      if (was > 90 && now <= 90) wakeAt(lv, x, y);
    }
    function setMO(lv, i, v) { const was = lv.MO[i]; lv.MO[i] = v; moved(lv, i, was, v); }
    /* Wakes every square over a box of the patch. */
    function wakeBox(lv, px0, py0, px1, py1) {
      const a = Math.max(0, fcol(lv, px0) >> 4), b = Math.min(lv.CW - 1, fcol(lv, px1) >> 4);
      const c = Math.max(0, frow(lv, py0) >> 4), d = Math.min(lv.CH - 1, frow(lv, py1) >> 4);
      for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) lv.next[y * lv.CW + x] = 1;
    }

    /* The top of whatever is in a fine column, water included, and the top of the ground under any water. Drops
       falling through the air with air under them hold nothing up, so they don't count as the top. */
    function tops(lv, x) {
      if (!lv.colDirty[x]) return;
      const M = lv.M, w = lv.w, h = lv.h;
      let y = 0;
      for (;;) {
        while (y < h - 1 && M[y * w + x] === AIR) y++;
        if (M[y * w + x] !== WATER) break;
        let b = y;
        while (b < h - 1 && M[b * w + x] === WATER) b++;
        if (M[b * w + x] !== AIR || b >= h - 1) break;
        y = b;
      }
      lv.top[x] = y;
      while (y < h - 1 && (M[y * w + x] === AIR || M[y * w + x] === WATER)) y++;
      lv.ground[x] = y;
      lv.colDirty[x] = 0;
    }
    function topOf(lv, x) { x = clamp(x, 0, lv.w - 1); tops(lv, x); return lv.top[x]; }
    function soilOf(lv, x) { x = clamp(x, 0, lv.w - 1); tops(lv, x); return lv.ground[x]; }

    /* The squares marked in a set, row of squares by row, left to right or right to left, so an update only looks
       at the squares that are awake. */
    function awakeIn(lv, set, forward) {
      const CW = lv.CW, CH = lv.CH, ax = lv.ax, from = lv.rowFrom, to = lv.rowTo;
      let k = 0;
      for (let cy = 0; cy < CH; cy++) {
        const crow = cy * CW;
        from[cy] = k;
        if (forward) { for (let cx = 0; cx < CW; cx++) if (set[crow + cx]) ax[k++] = cx; }
        else for (let cx = CW - 1; cx >= 0; cx--) if (set[crow + cx]) ax[k++] = cx;
        to[cy] = k;
      }
      return ax;
    }

    /* One update of every grain that might move, bottom row first, x direction alternating. The list comes first: a
       grain that only starts moving during the update waits for the next one. A fine grain falls one fine row in an
       update, an S-th of a valley grain, so a box runs S updates for each of the film's 1/60 s to fall as fast as the
       valley's grains did; first is the first of them. */
    function step(lv, first) {
      const M = lv.M, MO = lv.MO, FL = lv.FL, SH = lv.SH, WET = lv.WET, w = lv.w, h = lv.h, list = lv.list, S = lv.S;
      const now = lv.next;
      lv.next = lv.awake;
      lv.awake = now;
      lv.next.fill(0);
      const forward = (lv.turn ^= 1), soak = SOAK_RATE, RUN = RUN_ALONG * S;
      const ax = awakeIn(lv, now, forward), from = lv.rowFrom, to = lv.rowTo;
      let count = 0;
      for (let y = h - 2; y >= 0; y--) {
        const row = y * w, cy = y >> 4, q1 = to[cy];
        if (forward) {
          for (let q = from[cy]; q < q1; q++) {
            const cx = ax[q], b = Math.min(w - 1, (cx + 1) << 4);
            for (let x = cx ? cx << 4 : 1; x < b; x++) if (ACTIVE[M[row + x]]) list[count++] = row + x;
          }
        } else {
          for (let q = from[cy]; q < q1; q++) {
            const cx = ax[q], a = cx ? cx << 4 : 1;
            for (let x = Math.min(w - 1, (cx + 1) << 4) - 1; x >= a; x--) if (ACTIVE[M[row + x]]) list[count++] = row + x;
          }
        }
      }
      for (let k = 0; k < count; k++) {
        const i = list[k], c = M[i];
        if (!ACTIVE[c]) continue;
        if (c === WATER) {
          const x = i % w;
          /* Off the edges of the box it runs on into ground that isn't simulated. */
          if (x <= 2 || x >= w - 3) { put(lv, i, AIR); continue; }
          const j = i + w, b = M[j];
          if (b === AIR) { M[i] = AIR; M[j] = WATER; changed(lv, i); changed(lv, j); continue; }
          const full = SOAK_FULL[b];
          /* Hemmed in on every side, it can't go anywhere this time: no need to roll for it. */
          if (MO[j] >= full && M[i - 1] !== AIR && M[i + 1] !== AIR && M[j - 1] !== AIR && M[j + 1] !== AIR) continue;
          if (MO[j] < full) {
            const dry = 1 - MO[j] / full;
            if (rnd() < soak * dry * dry * dry) {
              put(lv, i, AIR);
              setMO(lv, j, Math.min(255, MO[j] + SOAK_STEP));
              continue;
            }
          }
          const d = rnd() < 0.5 ? 1 : -1;
          if (M[j + d] === AIR && M[i + d] === AIR) { M[i] = AIR; M[j + d] = WATER; changed(lv, i); changed(lv, j + d); continue; }
          let run = 0;
          for (let s = 1; s <= RUN; s++) {
            const xs = x + d * s;
            if (xs < 1 || xs > w - 2 || M[i + d * s] !== AIR) break;
            run = s;
          }
          if (run) { M[i] = AIR; M[i + d * run] = WATER; changed(lv, i); changed(lv, i + d * run); continue; }
          /* Still, but it might go the other way, or soak in, next time. */
          if (M[i - d] === AIR || MO[j] < full) keep(lv, x, (i - x) / w);
          continue;
        }
        if (c === FINE && n >= CLAY_FROM) {
          /* Fine silt under standing water turns to clay, a valley grain deep: the grain under the water first, the
             ones under it a little later. */
          let a = i - w, deep = 0;
          while (deep < S - 1 && (M[a] === CLAY || M[a] === FINE)) { a -= w; deep++; }
          if (M[a] === WATER && M[a - w] === WATER) {
            if (first && (n & 1) && WET[i] < 255) WET[i]++;
            const x = i % w, y = (i - x) / w, after = CLAY_AFTER + deep * CLAY_DEEPER;
            if (WET[i] >= after && WET[i] >= after + Math.floor(hash(x, y, 9) * CLAY_SPREAD)) {
              put(lv, i, CLAY);
              if (firstClay < 0) firstClay = n / 60;
              continue;
            }
            keep(lv, x, y);
          } else WET[i] = 0;
        }
        const j = i + w, b = M[j];
        if (b === AIR || (b === WATER && rnd() < 0.5)) {
          /* A grain takes its damp and its shade with it. */
          M[i] = b; M[j] = c;
          const mo = MO[i]; MO[i] = MO[j]; MO[j] = mo;
          const sh = SH[i]; SH[i] = SH[j]; SH[j] = sh;
          if (FL[i] === ROOT) FL[i] = 0;
          if (FL[j] && FL[j] !== ROOT) FL[j] = 0;
          if (c === SEED) seedAt = j;
          changed(lv, i); changed(lv, j);
          if (mo) { const x = i % w; wetAt(lv, x, (i - x) / w); }
          continue;
        }
        if (b === WATER) { const x = i % w; keep(lv, x, (i - x) / w); continue; }
        /* Only dry silt slides. Damp silt holds its shape, and clay and seeds only fall. */
        if ((c !== SILT && c !== FINE) || MO[i] > 90 || (M[j - 1] !== AIR && M[j + 1] !== AIR)) continue;
        const d = rnd() < 0.5 ? 1 : -1;
        let q = -1;
        if (M[j + d] === AIR && M[i + d] === AIR) q = j + d;
        else if (M[j - d] === AIR && M[i - d] === AIR) q = j - d;
        if (q >= 0) {
          M[i] = AIR; M[q] = c;
          MO[q] = MO[i]; MO[i] = 0;
          const sh = SH[i]; SH[i] = SH[q]; SH[q] = sh;
          if (FL[i] === ROOT) FL[i] = 0;
          if (FL[q] && FL[q] !== ROOT) FL[q] = 0;
          changed(lv, i); changed(lv, q);
        }
      }
    }

    /* Damp spreads through soil: down most, sideways less, up a little. A fine grain is a quarter or an eighth as
       big, so it passes damp on a larger share at a time, and more often, to spread as far in a second. */
    function seep(lv, down, side, sideGap, upGap) {
      const M = lv.M, MO = lv.MO, w = lv.w, h = lv.h;
      const now = lv.wetNext;
      lv.wetNext = lv.wet;
      lv.wet = now;
      lv.wetNext.fill(0);
      const ax = awakeIn(lv, now, true), from = lv.rowFrom, to = lv.rowTo;
      for (let y = 0; y < h - 1; y++) {
        const row = y * w, cy = y >> 4, q1 = to[cy];
        for (let p = from[cy]; p < q1; p++) {
          const cx = ax[p], b = Math.min(w - 1, (cx + 1) << 4);
          for (let x = cx ? cx << 4 : 1; x < b; x++) {
            const i = row + x, m = M[i];
            if (!SOAKS[m] && m !== SEED) continue;
            let v = MO[i];
            if (v < 12) continue;
            const v0 = v;
            const j = i + w;
            if ((SOAKS[M[j]] || M[j] === SEED) && MO[j] < v) {
              const q = (v - MO[j]) >> down;
              if (q) { setMO(lv, j, MO[j] + q); v -= q; }
            }
            for (let d = -1; d <= 1; d += 2) {
              const s = i + d;
              if (SOAKS[M[s]] && MO[s] + sideGap < v) {
                const q = (v - MO[s]) >> side;
                if (q) { setMO(lv, s, MO[s] + q); v -= q; }
              }
            }
            const u = i - w;
            if (u >= 0 && (SOAKS[M[u]] || M[u] === SEED) && MO[u] + upGap < v) {
              const q = (v - MO[u]) >> side;
              if (q) { setMO(lv, u, MO[u] + q); v -= q; }
            }
            if (v !== v0) setMO(lv, i, v);
          }
        }
      }
    }

    /* The close-up becomes the window at the cut to 1:1: each square of four close-up grains becomes one window grain.
       The seed is kept; water where half the square is water; ground where half is ground, the most of it; otherwise
       air, so holes stay holes. Damp is the average; what grows is kept where any of it grew. */
    function bake() {
      baked = true;
      seedAt = -1;
      const a = close, b = win, r = a.S / b.S, bx0 = (a.px0 - b.px0) * b.S, by0 = (a.py0 - b.py0) * b.S;
      for (let y = 0; y < a.h / r; y++) bakeRow(a, b, y, bx0, by0);
      if (sown >= 0) sown = ((sown / r) | 0) + by0;
      roots = roots.map((q) => [bx0 + (q[0] / r | 0), by0 + (q[1] / r | 0), Math.ceil(q[2] / r), q[3], q[4] || 0]);
      if (plant) {
        const at = (i) => { const x = i % a.w, y = (i / a.w) | 0; return (by0 + (y / r | 0)) * b.w + bx0 + (x / r | 0); };
        plant.top = at(plant.top); plant.x = bx0 + (plant.x / r | 0); plant.h = Math.round(plant.h / r);
        plant.tips = plant.tips.map((q) => [bx0 + (q[0] / r | 0), by0 + (q[1] / r | 0), q[2], Math.ceil(q[3] / r)]);
      }
    }
    /* One row of the window from two rows of the close-up. */
    function bakeRow(a, b, y, bx0, by0) {
      const bw = a.w >> 1, aw = a.w, bwid = b.w;
      const AM = a.M, AF = a.FL, AMO = a.MO, ASH = a.SH, BMt = b.M, BFL = b.FL, BMO = b.MO, BSH = b.SH;
      {
        for (let x = 0; x < bw; x++) {
          const i0 = 2 * y * aw + 2 * x, i1 = i0 + 1, i2 = i0 + aw, i3 = i2 + 1;
          const m0 = AM[i0], m1 = AM[i1], m2 = AM[i2], m3 = AM[i3];
          let m;
          if (m0 === SEED || m1 === SEED || m2 === SEED || m3 === SEED) m = SEED;
          else {
            const water = (m0 === WATER) + (m1 === WATER) + (m2 === WATER) + (m3 === WATER);
            const g0 = m0 !== AIR && m0 !== WATER, g1 = m1 !== AIR && m1 !== WATER, g2 = m2 !== AIR && m2 !== WATER, g3 = m3 !== AIR && m3 !== WATER;
            if (water >= 2) m = WATER;
            else if (g0 + g1 + g2 + g3 >= 2) {
              /* The most of the ground in it; a tie goes to the lower grains. */
              m = g2 ? m2 : g3 ? m3 : g0 ? m0 : m1;
              if (m2 !== m3 || m0 !== m2 || m1 !== m2) {
                let bestN = 0;
                for (let k = 0; k < 4; k++) {
                  const q = k === 0 ? m2 : k === 1 ? m3 : k === 2 ? m0 : m1;
                  if (q === AIR || q === WATER) continue;
                  const c = (g0 && m0 === q) + (g1 && m1 === q) + (g2 && m2 === q) + (g3 && m3 === q);
                  if (c > bestN) { bestN = c; m = q; }
                }
              }
            } else m = AIR;
          }
          const f0 = AF[i0], f1 = AF[i1], f2 = AF[i2], f3 = AF[i3];
          const fl = f2 || f3 || f0 || f1;
          const moN = (AMO[i0] + AMO[i1] + AMO[i2] + AMO[i3] + 2) >> 2;
          const bxx = bx0 + x, byy = by0 + y, j = byy * bwid + bxx, was = BMt[j];
          if (m === SEED) seedAt = j;
          if (was === m && BFL[j] === fl && (BMO[j] >> 3) === (moN >> 3)) { BMO[j] = moN; continue; }
          staleAt(b, j);
          if (j + bwid < b.n) staleAt(b, j + bwid);
          if (was !== m) {
            wakeAt(b, bxx, byy); b.colDirty[bxx] = 1; BMt[j] = m;
            /* Ground that moved here keeps the shade of a grain it came from. */
            if (m !== AIR && m !== WATER) BSH[j] = ASH[m2 === m ? i2 : m3 === m ? i3 : m0 === m ? i0 : i1];
          }
          if (moN >= 12) wetAt(b, bxx, byy);
          BMO[j] = moN;
          if (BFL[j] !== fl) { BFL[j] = fl; BSH[j] = (BSH[j] & 0xfc) | (1 + (hash(x, y, 18) * 3 | 0)); }
        }
      }
    }

    /* After the window's last scene, its grains in valley grains, for the long views: a square of sixteen becomes one,
       brick where a quarter of it is brick, water where a third is water, ground where half is ground, the most of it. */
    const CNT_M = new Uint16Array(NMAT), CNT_F = new Uint16Array(NFLO);
    function poolWindow() {
      pooled = true;
      for (let vy = WY0; vy < WY1; vy++) poolRow(win, vy);
      repoolY = WY0;
    }
    function poolRow(lv, vy) {
      const S = lv.S, s2 = S * S, lw = lv.w, LM = lv.M, LF = lv.FL, LMO = lv.MO, cnt = CNT_M, fcnt = CNT_F;
      {
        const y0 = (vy - PY - lv.py0) * S;
        for (let vx = WX0; vx < WX1; vx++) {
          const x0 = (vx - PX - lv.px0) * S;
          let mo = 0, flAll = 0;
          for (let dy = 0; dy < S; dy++) {
            let i = (y0 + dy) * lw + x0;
            for (let dx = 0; dx < S; dx++, i++) {
              cnt[LM[i]]++;
              const f = LF[i];
              if (f) { fcnt[f]++; flAll++; }
              mo += LMO[i];
            }
          }
          let best = AIR, bestN = 0, ground = 0;
          for (let m = 1; m < NMAT; m++) {
            if (m === WATER) continue;
            ground += cnt[m];
            if (cnt[m] > bestN) { bestN = cnt[m]; best = m; }
          }
          let fl = 0, flN = 0;
          if (flAll) for (let f = 1; f < NFLO; f++) if (fcnt[f] > flN) { flN = fcnt[f]; fl = f; }
          const v = vy * W + vx;
          M[v] = cnt[BRICK] * 4 >= s2 ? BRICK : cnt[WATER] * 3 >= s2 ? WATER : ground * 2 >= s2 ? best : AIR;
          MO[v] = Math.round(mo / s2);
          const bloom = fcnt[FLOWER] + fcnt[BLOSSOM];
          FL[v] = bloom >= 2 ? (fcnt[FLOWER] >= fcnt[BLOSSOM] ? FLOWER : BLOSSOM) : flAll * 4 >= s2 ? fl : 0;
          cnt.fill(0);
          if (flAll) fcnt.fill(0);
        }
      }
    }

    /* ---- A play ---- */

    function reset(seed) {
      seed = (seed === undefined ? seed0 : seed) >>> 0;
      if (alive) {
        M.set(M0);
        MO.set(MO0);
        for (let y = WY0; y < WY1; y++) FL.fill(0, y * W + WX0, y * W + WX1);
        for (const lv of [close, win]) {
          lv.M.set(lv.M0); lv.MO.set(lv.MO0); lv.FL.fill(0); lv.WET.fill(0); lv.SH.set(lv.SH0);
          if (lv.col0) { lv.col.set(lv.col0); lv.kind.set(lv.kind0); lv.sun.set(lv.sun0); }
          lv.relight = true;
          lv.stale.fill(0); lv.staleN = 0; lv.allStale = false;
          lv.awake.fill(0); lv.next.fill(0); lv.wet.fill(0); lv.wetNext.fill(0);
          lv.colDirty.fill(1); lv.turn = 0;
        }
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
      seedAt = -1;
      baked = false;
      pooled = false;
      bees = [];
      fireflies = [];
      bird = null;
      repoolY = WY1;
      [1, 2].forEach((z) => {
        const g = grids[z];
        if (!g || !g.saved) return;
        [g.col, g.kind, g.glow, g.sun, g.code].forEach((a, k) => { a.set(g.saved[k]); });
        g.step = 0;
      });
      fallKey = '';
      farKey = '';
      preKey = '';
      winStep = -1;
      /* The word's grains fall in order from its floor up, a little out of turn, the last of them landing at T_LAST. */
      logos.forEach((l) => {
        const key = new Float64Array(l.n);
        for (let i = 0; i < l.n; i++) {
          key[i] = Math.floor((1024 - l.ys[i] - look() * 4 * Q) * 256) * 65536 + i;
          l.tint[i] = 0.86 + 0.28 * look();
          l.sway[i] = look() * 6.283;
        }
        key.sort();
        for (let i = 0; i < l.n; i++) l.order[i] = key[i] % 65536;
        for (let i = 0; i < l.n; i++) l.begin[l.order[i]] = i / l.n * (T_LAST - T_LOGO - LOGO_FALL - 0.1) + look() * 0.1;
      });
    }

    /* The box the film is in at this moment. */
    function levelAt(t) { return t < T_ONE ? close : win; }

    /* The creature on its path, in fine grains. Its feet are on whatever is highest under its middle, water
       included: it paddles. you.x and you.y are in valley grains of the patch, the row being the one its feet are in. */
    function place(lv, t) {
      let k = 0;
      while (k + 1 < PATH.length && t >= PATH[k + 1][0]) k++;
      const a = PATH[k], b = PATH[k + 1] || a, S = lv.S;
      let x = a[1];
      if (a[3] === 'walk') x = a[1] + (b[1] - a[1]) * clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
      x = Math.round(x * S) / S;
      you.x = x;
      you.face = a[2];
      you.pose = a[3];
      you.walk = a[3] === 'walk' ? Math.floor(t * 8) & 1 : 0;
      const f0 = fcol(lv, x + 1);
      let g = lv.h;
      for (let f = f0; f < f0 + 2 * S; f++) g = Math.min(g, topOf(lv, f));
      you.y = lv.py0 + g / S - 1;
    }

    /* Takes the nearest few grains of a material inside a box of the patch. */
    function takeNearest(lv, mat, x0, y0, x1, y1, cx, cy, count) {
      const S = lv.S, fx0 = fcol(lv, x0), fy0 = frow(lv, y0), fx1 = fcol(lv, x1), fy1 = frow(lv, y1);
      const ux = fcol(lv, cx) + S / 2, uy = frow(lv, cy) + S / 2, found = [];
      for (let y = Math.max(0, fy0); y < Math.min(lv.h, fy1); y++) {
        for (let x = Math.max(0, fx0); x < Math.min(lv.w, fx1); x++) {
          const i = y * lv.w + x;
          if (lv.M[i] === mat) found.push([(x - ux) * (x - ux) + (y - uy) * (y - uy), i]);
        }
      }
      found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const got = Math.min(count, found.length);
      for (let k = 0; k < got; k++) { const i = found[k][1]; put(lv, i, AIR); lv.FL[i] = 0; }
      return got;
    }
    /* A grain set down where there was none, shaded the way the ground is laid out at that place: the band it would
       be in, its clump, and its own grain. */
    function laid(lv, i, m) {
      const S = lv.S, x = i % lv.w, gx = lv.gx0 + x, gy = lv.gy0 + (i - x) / lv.w;
      const xv = (gx + 0.5) / S - 0.5, yv = (gy + 0.5) / S - 0.5, grain = hash(gx, gy, 6);
      const jit = 0.5 * grain + 0.5 * vnoise(xv * 1.3, yv * 1.3, 16);
      lv.SH[i] = Math.floor(clamp(vnoise(xv / 23, yv / 2.2, 5) * 2.6 + jit * 1.7 - 0.35, 0, 3.99)) | (Math.floor(grain * 64) << 2);
      return put(lv, i, m);
    }
    /* Grains thrown aside, a valley grain's worth, loosely, each column of them a little higher or lower than the
       next: they land where they land. */
    function toss(lv, px, py) {
      const S = lv.S, x0 = fcol(lv, px), y0 = frow(lv, py);
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const x = x0 + dx, lift = Math.floor(hash(lv.gx0 + x, n + dy, 35) * 1.5 * S);
          for (let k = 0; k < 4 * S; k++) {
            const y = y0 + dy * 2 - lift - k;
            if (y < 0) break;
            if (lv.M[y * lv.w + x] === AIR) { laid(lv, y * lv.w + x, SILT); break; }
          }
        }
      }
    }
    /* A valley grain's worth scratched out of the top of the ground at a patch column. */
    function scratch(lv, px) {
      const S = lv.S, x0 = fcol(lv, px);
      for (let x = x0; x < x0 + S; x++) for (let k = 0; k < S; k++) put(lv, soilOf(lv, x) * lv.w + x, AIR);
    }
    /* A valley grain's worth of one material at a patch column and row. A brick is one of three tones, a grain here
       and there a tone off, with a darker line of mortar along its foot and one side. */
    function block(lv, px, py, m) {
      const S = lv.S, x0 = fcol(lv, px), y0 = frow(lv, py), tone = 1 + Math.floor(hash(px, py, 31) * 3);
      for (let y = y0; y < y0 + S; y++) {
        for (let x = x0; x < x0 + S; x++) {
          const i = y * lv.w + x;
          put(lv, i, m);
          lv.FL[i] = 0;
          if (m !== BRICK) continue;
          const g = hash(lv.gx0 + x, lv.gy0 + y, 32), k = y === y0 + S - 1 || x === x0 ? 0 : clamp(tone + (g < 0.12 ? -1 : g > 0.88 ? 1 : 0), 1, 3);
          lv.SH[i] = k | (Math.floor(hash(lv.gx0 + x, lv.gy0 + y, 33) * 64) << 2);
        }
      }
    }

    /* Grass where the ground is damp, a blade to a fine column with gaps between; taller blades; flowers on some
       tips; roots under some of it. */
    function green(lv, t) {
      const M = lv.M, MO = lv.MO, FL = lv.FL, w = lv.w, S = lv.S;
      for (let x = 3; x < w - 3; x++) {
        if (rnd() >= GRASS_TRY) continue;
        const sy = soilOf(lv, x);
        if (sy >= lv.h - 1 || sy < 2) continue;
        /* It grows in a shallow stream, as long as the water is less than a valley grain deep. */
        const s = sy * w + x, c = s - w, gx = lv.gx0 + x;
        if (!SOAKS[M[s]] || MO[s] < 100 || sy < S + 1 || M[s - S * w] === WATER) continue;
        if (!FL[c]) {
          if (hash(gx, 1, 201) < 0.3) continue;
          const near = FL[c - 1] === GRASS || FL[c + 1] === GRASS || FL[c - 2] === GRASS || FL[c + 2] === GRASS ||
            FL[c - 1 - w] === GRASS || FL[c + 1 - w] === GRASS || FL[c - 1 + w] === GRASS || FL[c + 1 + w] === GRASS;
          if (rnd() < (near ? 0.5 : 0.012)) {
            setFL(lv, c, GRASS, 0);
            if (rnd() < 0.12 && roots.length < ROOTS_MOST) roots.push([x, sy + 1, (2 + Math.floor(rnd() * 7)) * S, 0, 0]);
          }
          continue;
        }
        /* Up the blade to its tip. */
        let top = c, h = 1;
        while (FL[top - w] === GRASS || FL[top - w] === FLOWER) { top -= w; h++; }
        if (FL[top] === FLOWER || top - 2 * w < 0) continue;
        const vx = Math.floor(gx / S), most = Math.max(2, Math.round(S * (1 + ((vx * 7) % 3)) * (0.55 + 0.5 * hash(gx, 2, 202))));
        if (h < most && (M[top - w] === AIR || M[top - w] === WATER) && rnd() < 0.7) {
          setFL(lv, top - w, GRASS, h + 1 >= most - 1 ? 2 : h + 1 > most >> 1 ? 1 : 0);
        } else if (t > 21.5 && h >= 2 * S - 1 && ((vx * 13) % 5) < 2 && M[top - w] === AIR && rnd() < 0.08 && !bloomNear(lv, top, S)) {
          /* A flower head about a valley grain across: a bright heart and petals round it. */
          const head = top - w, r = S * 0.45;
          for (let dy = -Math.ceil(r * 2); dy <= 0; dy++) {
            for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
              const q = head + dy * w + dx, cy = dy + r;
              if (dx * dx + cy * cy > r * r + 0.6 || x + dx < 1 || x + dx >= w - 1 || FL[q] || M[q] !== AIR) continue;
              setFL(lv, q, FLOWER, dx === 0 && Math.abs(cy) < 1 ? 2 : hash(lv.gx0 + x + dx, dy, 204) < 0.6 ? 0 : 1);
            }
          }
        }
      }
    }

    /* No two flowers within a valley grain of each other. */
    function bloomNear(lv, top, S) {
      const w = lv.w, x = top % w;
      for (let dy = 1; dy <= 2 * S; dy++) {
        const row = top - dy * w;
        if (row < 0) break;
        for (let dx = -S; dx <= S; dx++) if (x + dx > 0 && x + dx < w && lv.FL[row + dx] === FLOWER) return true;
      }
      return false;
    }

    /* Root tips: down through damp earth, a fine grain at a time, wandering a little. */
    function dig(lv) {
      const M = lv.M, MO = lv.MO, FL = lv.FL, w = lv.w, steps = Math.max(1, lv.S >> 2);
      for (let s = 0; s < steps; s++) {
        for (let k = roots.length - 1; k >= 0; k--) {
          const r = roots[k];
          if (r[2] <= 0 || r[1] >= lv.h - 1 || r[1] < 0) { roots.splice(k, 1); continue; }
          const x = r[0], y = r[1], i = y * w + x;
          if (EARTH[M[i]] && !FL[i]) setFL(lv, i, ROOT, 1 + (hash(x, y, 63) * 3 | 0));
          if (rnd() < 0.25) r[4] = rnd() < 0.5 ? -1 : 1;
          const dn = i + w, d = r[4] || (rnd() < 0.5 ? -1 : 1);
          let nx = x;
          if (rnd() < 0.2 && x + d > 0 && x + d < w - 1 && EARTH[M[dn + d]] && MO[dn + d] >= MO[dn]) nx = x + d;
          r[0] = nx; r[1] = y + 1; r[2]--;
          if (r[3] && rnd() < 0.08 / lv.S * 2 && roots.length < ROOTS_MOST) roots.push([nx, y + 1, r[2] >> 1, 0, -d]);
        }
      }
    }

    /* The plant from the seed: a stem that rises a fine grain at a time to a set height, two grains thick low down,
       branches, leaves round the tips in a crown lit from above, blossom late. */
    function growPlant(lv, t) {
      const p = plant, S = lv.S, w = lv.w, FL = lv.FL, M = lv.M;
      const want = Math.min(18 * S, Math.floor((t - p.at) * 0.95 * S));
      while (p.h < want) {
        let x = p.top % w;
        if (p.h >= 6 * S && rnd() < 0.18) x += rnd() < 0.5 ? -1 : 1;
        if (Math.abs(x - p.x) > 2 * S) x = p.x + (x > p.x ? 2 * S : -2 * S);
        const y = ((p.top / w) | 0) - 1, i = y * w + x;
        if (y < 1) break;
        p.top = i;
        setFL(lv, i, STEM, 2);
        if (p.h < 9 * S && M[i + 1] === AIR) setFL(lv, i + 1, STEM, 1);
        p.h++;
        if (p.h >= 5 * S && p.h % (3 * S) === 2 * S) p.tips.push([x, y, rnd() < 0.5 ? -1 : 1, (2 + Math.floor(rnd() * 3)) * S]);
      }
      for (let k = 0; k < p.tips.length; k++) {
        const b = p.tips[k];
        if (b[3] > 0 && rnd() < Math.min(1, 0.2 * S)) {
          b[0] += b[2]; b[1] -= rnd() < 0.6 ? 1 : 0; b[3]--;
          const i = b[1] * w + b[0];
          if (b[0] > 0 && b[0] < w - 1 && !FL[i] && (M[i] === AIR || M[i] === WATER)) setFL(lv, i, STEM, 1);
        }
      }
      if (p.h < 3 * S) return;
      const hv = p.h / S;
      for (let k = 0; k < 5 * S * S; k++) {
        const anchors = p.tips.length + 1, a = Math.floor(rnd() * anchors);
        let ax, ay, r;
        if (a === p.tips.length) { ax = p.top % w; ay = ((p.top / w) | 0) + Math.floor(hv / 8) * S; r = (2 + hv / 4.5) * S; }
        else { ax = p.tips[a][0]; ay = p.tips[a][1]; r = (1.5 + hv / 7) * S; }
        const dx = Math.round((rnd() * 2 - 1) * r), dy = Math.round((rnd() * 2 - 1) * r * 0.8);
        if (dx * dx + dy * dy > r * r + 0.5) continue;
        const x = ax + dx, y = ay + dy;
        if (x < 1 || x >= w - 1 || y < 1) continue;
        const i = y * w + x;
        if (FL[i] || M[i] !== AIR) continue;
        const light = 0.55 - 0.35 * dx / r - 0.45 * dy / r + (hash(lv.gx0 + x, lv.gy0 + y, 70) - 0.5) * 0.7;
        setFL(lv, i, t > 38 && rnd() < 0.25 ? BLOSSOM : LEAF, Math.floor(clamp(light * 2.2 - 0.45, 0, 3.99)));
      }
    }

    /* Reeds at the pond's shallow edges, once there is a pond: thin, a valley grain or so apart. */
    function sprout(lv) {
      const M = lv.M, w = lv.w, S = lv.S, x0 = fcol(lv, 104);
      for (let k = 0; k < 3 * S; k++) {
        const x = x0 + Math.floor(rnd() * 40 * S);
        const y = topOf(lv, x);
        let bed = y;
        while (bed < lv.h - 1 && M[bed * w + x] === WATER) bed++;
        const depth = bed - y;
        if (depth < (S >> 1) || depth > 3 * S || !EARTH[M[bed * w + x]] || reeds.some((r) => Math.abs(r[0] - x) < S)) continue;
        if (rnd() < 0.35) reeds.push([x, bed - 1, depth + (2 + Math.floor(rnd() * 4)) * S, 0]);
      }
    }
    function growReeds(lv) {
      const M = lv.M, w = lv.w, S = lv.S;
      for (let k = 0; k < reeds.length; k++) {
        const r = reeds[k];
        if (r[3] >= r[2] || rnd() > 0.22 * S) continue;
        const i = (r[1] - r[3]) * w + r[0];
        if (i >= 0 && (M[i] === AIR || M[i] === WATER)) setFL(lv, i, REED, r[3] >= r[2] - (S >> 1) ? 3 : 1 + ((r[3] / (S >> 1) | 0) & 1));
        r[3]++;
      }
    }

    /* Counted in window grains. In the close-up, each square of four grains that the cut will make one window grain
       counts once if anything grows in it, as it will after the cut, so the number runs on across the cut. Four
       grains are read at a time, and a run of nothing is passed over quickly. */
    function countGrowing(lv) {
      const F = lv.FL32 || (lv.FL32 = new Uint32Array(lv.FL.buffer, lv.FL.byteOffset, lv.n >> 2));
      let c = 0;
      if (lv.S === NEAR.S) {
        for (let k = 0; k < F.length; k++) {
          const v = F[k];
          if (v) c += ((v & 0xff) !== 0) + ((v & 0xff00) !== 0) + ((v & 0xff0000) !== 0) + ((v >>> 24) !== 0);
        }
      } else {
        /* Two rows at a time; a word of each row covers two squares. */
        const q = lv.w >> 2;
        for (let r = 0; r < F.length; r += 2 * q) {
          for (let k = r; k < r + q; k++) {
            const v = F[k] | F[k + q];
            if (v) c += ((v & 0xffff) !== 0) + ((v >>> 16) !== 0);
          }
        }
      }
      liveGrowing = c;
    }

    /* Scripted events, thirty times a second, in the box the film is in. */
    function script(f, t) {
      const lv = levelAt(t), S = lv.S, w = lv.w, M = lv.M, MO = lv.MO;
      /* The wind lifts dry grains off the slope, a few at a time, and they settle again. */
      if (t > T_LIGHT && t < T_ONE + 4 && f % 3 === 0) {
        const x0 = fcol(lv, 40 + Math.floor(rnd() * 64)) + Math.floor(rnd() * S);
        for (let k = 0; k < Math.max(1, S >> 1); k++) {
          const x = x0 + k, s = soilOf(lv, x), i = s * w + x;
          const tx = x + S + Math.floor(rnd() * S), ty = s - 2 * S + Math.floor(rnd() * S);
          if (ty < 1 || tx >= w - 1) continue;
          if (M[i] === SILT && MO[i] < 20 && M[ty * w + tx] === AIR && M[ty * w + tx + w] === AIR) { put(lv, i, AIR); laid(lv, ty * w + tx, SILT); }
        }
      }
      const mid = fcol(lv, SOW_X) + (S >> 1);
      if (t >= T_LAND && sown === -1 && t < T_PICK) {
        sown = -2;
        const x = fcol(lv, 49) + (S >> 1);
        seedAt = put(lv, (soilOf(lv, x) - 1) * w + x, SEED);
      }
      if (t >= T_PICK && sown === -2) {
        sown = -3;
        takeNearest(lv, SEED, 44, 0, 56, 40, 49, 26, 1);
        seedAt = -1;
        you.carry = 1;
      }
      if (t >= T_SCRATCH && sown === -3) {
        /* Its paws leave the ground round the hole damp, so the hole keeps its shape. The damp thins out over a valley
           grain or so at the sides and below, raggedly. */
        sown = -4;
        const s = soilOf(lv, mid), x0 = fcol(lv, SOW_X - 2), x1 = fcol(lv, SOW_X + 3), y1 = s + 4 * S;
        for (let y = s - S; y < y1 + S; y++) for (let x = x0 - S; x < x1 + S; x++) {
          const i = y * w + x, out = Math.max(x < x0 ? x0 - x : x >= x1 ? x - x1 + 1 : 0, y >= y1 ? y - y1 + 1 : 0);
          const v = out ? Math.round(96 * (1 - (out + hash(lv.gx0 + x, lv.gy0 + y, 34) * 0.8 * S) / (1.6 * S))) : 96;
          if (SOAKS[M[i]] && MO[i] < v) setMO(lv, i, v);
        }
        scratch(lv, SOW_X);
        toss(lv, SOW_X + 7, lv.py0 + s / S - 3);
      }
      if (t >= T_SCRATCH + BEAT / 2 && sown === -4) {
        sown = -5;
        const s = soilOf(lv, mid);
        scratch(lv, SOW_X);
        toss(lv, SOW_X + 8, lv.py0 + s / S - 3);
      }
      if (t >= T_SOW && sown === -5) { sown = -6; seedAt = put(lv, (soilOf(lv, mid) - 1) * w + mid, SEED); you.carry = 0; }
      if (t >= T_COVER && sown === -6) {
        /* It nudges the ground back over the seed, level with the ground either side. */
        sown = (seedAt / w) | 0;
        const x0 = fcol(lv, SOW_X), level = Math.round((soilOf(lv, x0 - 1) + soilOf(lv, x0 + S)) / 2);
        for (let x = x0; x < x0 + S; x++) {
          for (let y = soilOf(lv, x) - 1; y >= level; y--) { const i = y * w + x; if (M[i] === AIR) { laid(lv, i, SILT); setMO(lv, i, 96); } }
        }
      }
      for (let k = 0; k < 3; k++) {
        if (t >= T_DIG + k * BEAT && opened === k) {
          opened++;
          block(lv, PLUG[k][0], PLUG[k][1], AIR);
          block(lv, PLUG[k][0], PLUG[k][1] + 1, AIR);
          toss(lv, 41 + k, 20);
          toss(lv, 43 + k, 19);
        }
      }
      /* The spring keeps coming, at the rate of the vein behind it. */
      if (opened === 3) {
        const x0 = fcol(lv, SOURCE[0]), y0 = frow(lv, SOURCE[1]);
        for (let y = y0; y < y0 + S; y++) {
          for (let x = x0; x < x0 + 3 * S; x++) {
            const i = y * w + x;
            if (M[i] === AIR && rnd() < SPRING) put(lv, i, WATER);
          }
        }
      }
      /* The seed takes when the ground a valley grain round it, above and to the sides, has been damp a while. */
      if (sown >= 0 && !plant && seedAt >= 0) {
        const i = seedAt, u = S * w;
        if (M[i] === SEED && Math.max(MO[i - u], MO[i - S], MO[i + S], MO[i + u], MO[i - u - S], MO[i - u + S]) >= 110) {
          if (++damp >= SPROUT_AFTER) {
            put(lv, i, SOIL); setMO(lv, i, 200);
            const x = i % w, y = (i / w) | 0;
            /* The shoot comes up through the ground over the seed at once, and the stem grows on from the top of
               the ground, so it shows as soon as it would have over a seed a valley grain down. */
            let top = i - w;
            while (top - w >= 0 && EARTH[M[top - w]]) top -= w;
            plant = { x, at: t, h: 0, top, tips: [] };
            setFL(lv, i, ROOT, 2);
            roots.push([x, y + 1, 16 * S, 1, 0], [x - 1, y + 2, 11 * S, 1, -1], [x + 1, y + 2, 12 * S, 1, 1]);
            seedAt = -1;
          }
        }
      }
      if (plant) growPlant(lv, t);
      if (t >= T_SCOOP && carried === 0 && scooped === 0) {
        const got = takeNearest(lv, CLAY, 110, 34, 142, 46, 131, 41, WALL.length * S * S);
        scooped = Math.floor(got / (S * S));
        carried = scooped;
        you.carry = scooped ? 2 : 0;
      }
      while (built < carried && t >= T_BRICK + built * BEAT / 2) {
        const b = WALL[built++];
        block(lv, b[0], b[1], BRICK);
        if (built === carried) you.carry = 0;
      }
      if (t >= T_REEDS - 2.5) sprout(lv);
      growReeds(lv);
      green(lv, t);
      dig(lv);
      if (f % 6 === 0) countGrowing(lv);
    }

    function tick() {
      if (n >= T_END * 60) return;
      n++;
      const t = n / 60, onFrame = !(n & 1);
      if (t >= T_LOGO) return;
      if (!baked && t >= T_ONE) bake();
      /* The window is still from the cut to x2 on. Its grains go into the valley's a moment later, off the cut's frame. */
      if (!pooled && t >= T_X2 + 0.1) poolWindow();
      /* Days pass on the dated valley: both long views' copies of it are brought up to the day as it comes. The
         nearer one is only needed until the widest view. */
      const s = dayStepAt(t, reel.reduced);
      if (s > stepNo) {
        stepNo = s;
        advance(grids[2], s);
        if (t < T_X8) advance(grids[1], s);
      }
      if (repoolY < WY1) repool();
      const lv = levelAt(t);
      place(lv, t);
      if (t < T_X2) {
        if (onFrame) script(n >> 1, t);
        if (n === CLAY_FROM) wakeBox(lv, 104, 30, 143, 50);
        for (let k = 0; k < lv.S; k++) step(lv, k === 0);
        /* Damp spreads as far in a second as it did through valley grains: S x S times the share. */
        if (lv.S >= 8) { seep(lv, 3, 4, 1, 5); seep(lv, 3, 4, 1, 5); }
        else if (onFrame) seep(lv, 3, 4, 2, 10);
      }
    }

    /* ---- Words ---- */

    function focusAt(t, z) {
      if (z >= 2) return VW >> 1;
      let x = FOCUS[FOCUS.length - 1];
      for (let k = 0; k + 3 < FOCUS.length; k += 2) {
        if (t < FOCUS[k + 2]) { x = FOCUS[k + 1] + (FOCUS[k + 3] - FOCUS[k + 1]) * smooth(FOCUS[k], FOCUS[k + 2], t); break; }
      }
      return (x - (viewOf(z)[1] - PX)) * Q / z;
    }

    /* The frame being built, and how far the film's view is from the picture's corner, in cells. */
    let v = null, now = 0, ox = 0, oy = 0;

    /* Fits the camera to a picture of this size. Extra rows and columns show more of the world around the film's
       view, which stays centred. A narrow picture keeps the action in frame. cam.x and cam.y are the picture's corner
       in cells of its zoom, counted from the valley's corner. */
    function fit(cols, rows) {
      const t = now, cam = v.cam;
      if (v.mode === 'logo') {
        cam.z = 1;
        cam.x = (VW - cols) >> 1;
        cam.y = rows >= VH ? (VH - rows) >> 1 : clamp(27 * Q - (rows >> 1), 0, VH - rows);
        ox = -cam.x; oy = -cam.y;
        return;
      }
      const z = zoomAt(t);
      aim(t, z, cols, rows);
      cam.z = z;
      cam.x = AIM_X;
      cam.y = AIM_Y;
      ox = -AIM_PX; oy = -AIM_PY;
    }
    /* Where the camera's corner is at zoom z, for a picture of this size. */
    let AIM_X = 0, AIM_Y = 0, AIM_PX = 0, AIM_PY = 0;
    function aim(t, z, cols, rows) {
      const view = viewOf(z), s = Q / z;
      AIM_PX = cols >= VW ? -((cols - VW) >> 1) : clamp(Math.round(focusAt(t, z)) - (cols >> 1), 0, VW - cols);
      AIM_PY = rows >= VH ? -((rows - VH) >> 1) : clamp(MIDDLE[z] - (rows >> 1), 0, VH - rows);
      if (z === 1 && AIM_PY > BIRD_TOP) AIM_PY = Math.round(AIM_PY + (BIRD_TOP - AIM_PY) * smooth(BIRD_LOOK[0], BIRD_LOOK[1], t));
      AIM_X = view[1] * s + AIM_PX;
      AIM_Y = view[2] * s + AIM_PY;
    }

    function line(col, row, text, color, bold) {
      if (text) v.rows.push({ col, row, text, color, bold: !!bold });
    }
    /* On the picture, in cells of the film's view: the column it starts at, and the row its bottom sits on. */
    function placeText(x, y, text, color, back, bold, story) {
      if (!text) return;
      v.labels.push({ x: Math.max(0, Math.max(0, x) + ox), y: Math.max(0, Math.max(0, y) + oy), text, color, back, bold, story, center: 0 });
    }
    function label(x, y, text, color) { placeText(x, y, text, color, BACK, false, true); }

    function ticker(left, right) {
      v.ticker = { left, leftColor: FG, right: right || '', rightColor: DIM };
    }
    function pane(one, oneColor, key) {
      v.pane = { one: one || '', oneColor: oneColor || FG, two: '', twoColor: DIM, key: key || null };
    }

    /* Grains growing: counted in the fine ground, and dated outside it, where a valley grain stands for the window
       grains it would hold. Without a world, a number as wide as the biggest real one. */
    function growing(t) {
      if (!alive) {
        if (t < T_SOW) return 0;
        if (t < T_ONE) return 1;
        if (t < T_X2) return 88888;
        return 888888;
      }
      const s = reel.reduced ? dayStepAt(t, true) : dayStepAt(t, false);
      const live = t < T_SOW ? 0 : Math.max(liveGrowing, t >= T_SOW ? 1 : 0);
      return s ? live + floraOut[DAYS[s]] * NEAR.S * NEAR.S : live;
    }

    /* The creature's feet, in cells of the film's view at this zoom. */
    function youAt(t) {
      let x = you.x, y = you.y;
      if (!alive) {
        let k = 0;
        while (k + 1 < PATH.length && t >= PATH[k + 1][0]) k++;
        x = PATH[k][1];
        y = Math.floor(lerpAt(PATCH, x + 1, false)) - 1;
      }
      const z = zoomAt(t), view = viewOf(z), s = Q / z;
      return [(PX + x - view[1]) * s, (PY + y + 1 - view[2]) * s - 1];
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
        const p = youAt(t), sz = Q / z;
        if (z <= 1) label(Math.round(p[0]) - Q, Math.round(p[1] - 3.5 * sz), 'you', LANTERN);
        else label(Math.round(p[0]) + 2 * Q, Math.round(p[1]) - Q, 'you', LANTERN);
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
       Without a size, the picture is the film's own VW by VH. */
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

    /* Light from glowing things in the long views falls off over about twenty cells. That is smooth enough to work out
       on a coarse grid and spread back over the cells. */
    const LIGHT_K = 5 / 4, LIGHT_WIDTHS = boxWidths(2.5);
    let halfR = new Float32Array(0), halfG = halfR, halfB = halfR, halfTmp = halfR;

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
      if (halfTmp.length < w * h) halfTmp = new Float32Array(w * h);
      for (let p = 0; p < 3; p++) {
        boxPass(f, halfTmp, h, w, w, 1, LIGHT_WIDTHS[p]);
        boxPass(halfTmp, f, w, h, 1, w, LIGHT_WIDTHS[p]);
      }
    }

    /* ---- Painting ---- */

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

    /* The colour of a fine grain, or of a cell of them: what it is, what grows in it, its shade, how far under the
       ground as it was laid out it is (in valley grains), how damp, and whether it is water open to the sky. */
    function colourOf(m, f, s, dv, mo, open) {
      const k = s & 3, tint = 0.92 + 0.16 * ((s >> 2) / 63);
      const dk = 1 - 0.4 * clamp((dv - 8) / 260, 0, 1), sun = clamp(1 - dv / 18, 0, 1) * 255 | 0;
      CL = 0;
      CSU = sun;
      if (f && (m === AIR || m === WATER || (f === ROOT && EARTH[m]))) {
        const c = (f * 4 + k) * 3;
        let r = FPAL[c] * tint, g = FPAL[c + 1] * tint, b = FPAL[c + 2] * tint;
        CSU = 255;
        /* Under water it takes the water's colour, a stem less, so a shoot coming up through a pond can be seen. */
        if (m === WATER && f === STEM) { r = r * 0.82 + 11; g = g * 0.82 + 15; b = b * 0.82 + 19; }
        else if (m === WATER) { r = r * 0.6 + 26; g = g * 0.6 + 34; b = b * 0.6 + 44; }
        else if (f === ROOT) { r *= dk; g *= dk; b *= dk; CSU = sun; }
        CK = K_GREEN;
        return pack(r, g, b);
      }
      if (m === AIR) {
        /* Open air down to a valley grain under the ground as it was laid out reads as sky, as the top grain did. */
        if (dv < 1) { CK = K_SKY; CSU = 255; return 0; }
        CK = K_CAVE;
        CSU = 0;
        return pack(34 * dk * 0.6, 31 * dk * 0.6, 29 * dk * 0.6);
      }
      const c = (m * 4 + k) * 3;
      let r = PAL[c] * tint, g = PAL[c + 1] * tint, b = PAL[c + 2] * tint;
      if (m === WATER) { CK = open ? K_TOP : K_WATER; return pack(r, g, b); }
      if (SOAKS[m]) { const wet = 1 - 0.36 * ((mo >> 3) << 3) / 255; r *= wet; g *= wet; b *= wet * 1.04; }
      if (GLOWS[m]) { CK = K_LIT; CSU = 255; CL = m; return pack(r, g, b); }
      CK = K_GROUND;
      return pack(r * dk, g * dk, b * dk);
    }
    function toneFine(lv, i) {
      const w = lv.w, x = i % w, y = (i - x) / w, m = lv.M[i];
      /* A hole dug from the top, with nothing over it, is open to the sky. */
      const top = m === AIR && y > lv.surf[x] && y < topOf(lv, x) ? y : lv.surf[x];
      lv.col[i] = colourOf(m, lv.FL[i], lv.SH[i], (y - top) / lv.S, lv.MO[i], m === WATER && i >= w && lv.M[i - w] === AIR && y - 1 <= top);
      lv.kind[i] = CK;
      lv.sun[i] = CSU;
    }
    /* Colours again what changed since the last picture, and lights it. When the light moves, each row on screen is
       lit again as it is drawn. */
    function refresh(lv) {
      if (lv.allStale) {
        for (let i = 0; i < lv.n; i++) toneFine(lv, i);
        lv.stale.fill(0);
        lv.staleN = 0;
        lv.allStale = false;
        lv.relight = true;
      }
      const list = lv.staleList, st = lv.stale;
      for (let k = 0; k < lv.staleN; k++) { const i = list[k]; st[i] = 0; toneFine(lv, i); litOf(lv, i); }
      lv.staleN = 0;
      if (lv.relight) { lv.rowKey.fill(-1); lv.relight = false; }
    }

    /* The sky, worked out once a frame: a gradient by row, broken by a fine dither so it shows no bands, with far
       ridges in the haze by column and clouds over it. */
    const SKY_STEPS = 28;
    let skyRows = new Uint32Array(0), skyFar = skyRows, skyMid = skyRows, ridgeFar = new Float32Array(0), ridgeMid = ridgeFar;
    let ridgeKey = '';
    function packed(r, g, b) {
      r *= fade; g *= fade; b *= fade;
      return 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
    }
    function skyTables(cols, rows, z) {
      if (skyRows.length < rows * 4) { skyRows = new Uint32Array(rows * 4); skyFar = new Uint32Array(rows * 4); skyMid = new Uint32Array(rows * 4); }
      for (let vy = 0; vy < rows; vy++) {
        const f = clamp(vy / (rows * 0.48), 0, 1), steps = f * SKY_STEPS, b0 = Math.floor(steps);
        for (let q = 0; q < 4; q++) {
          const th = (BAYER[(vy & 3) * 4 + q] + 0.5) / 16;
          const u = Math.min(SKY_STEPS, steps - b0 > th ? b0 + 1 : b0) / SKY_STEPS;
          const r = skyTop[0] + (skyHor[0] - skyTop[0]) * u, g = skyTop[1] + (skyHor[1] - skyTop[1]) * u, b = skyTop[2] + (skyHor[2] - skyTop[2]) * u;
          skyRows[vy * 4 + q] = packed(r, g, b);
          skyFar[vy * 4 + q] = packed(r * 0.72 + 16, g * 0.72 + 24, b * 0.72 + 26);
          skyMid[vy * 4 + q] = packed(r * 0.46 + 30, g * 0.46 + 44, b * 0.46 + 40);
        }
      }
      const key = cols + ',' + rows + ',' + z;
      if (key === ridgeKey) return;
      ridgeKey = key;
      if (ridgeFar.length < cols) { ridgeFar = new Float32Array(cols); ridgeMid = new Float32Array(cols); }
      for (let vx = 0; vx < cols; vx++) {
        ridgeFar[vx] = rows * 0.36 + 16 * Q * (fbm(vx / (46 * Q) + z * 7, 1.5, 93) - 0.5);
        ridgeMid[vx] = rows * 0.46 + 20 * Q * (fbm(vx / (34 * Q) + z * 3, 2.5, 94) - 0.5);
      }
    }
    /* Clouds drift over the sky above the far ridges, each lit a little more on top. Whether a cell is open sky is
       asked of the fine ground lv, and of the cells round it, or with no lv, of the long view. */
    let puffs = new Float32Array(0);
    function clouds(P, cols, rows, t, lv, cam) {
      const drift = t * 0.6, oc = cols / Q;
      if (puffs.length < cols) puffs = new Float32Array(cols);
      for (let c = 0; c < 4; c++) {
        const w = 12 + c * 5, cx = ((c * 53 + 17 + drift * (0.6 + c * 0.15)) % (oc + w * 2)) - w, cy = 3 + c * 3 + (c & 1) * 2;
        const x0 = Math.max(0, Math.floor((cx - w) * Q)), x1 = Math.min(cols - 1, Math.ceil((cx + w) * Q));
        const y0 = Math.max(0, Math.floor((cy - 2.2 * 1.4) * Q)), y1 = Math.min(rows - 1, Math.ceil((cy + 2.2) * Q));
        const cr = skyHor[0] * 0.6 + 104, cg = skyHor[1] * 0.6 + 98, cb = skyHor[2] * 0.6 + 96;
        for (let vx = x0; vx <= x1; vx++) puffs[vx] = 0.75 + 0.35 * vnoise((vx + 0.5) / (3 * Q), c, 92);
        for (let vy = y0; vy <= y1; vy++) {
          const dy = ((vy + 0.5) / Q - cy) / 2.2;
          for (let vx = x0; vx <= x1; vx++) {
            const p = vy * cols + vx;
            if (vy >= ridgeFar[vx]) continue;
            if (lv) {
              const lx = cam.x + vx - lv.gx0, ly = cam.y + vy - lv.gy0;
              if ((lx >= 0 && ly >= 0 && lx < lv.w && ly < lv.h ? lv.kind[ly * lv.w + lx] : fallKind[p]) !== K_SKY) continue;
            } else if (farKind[p] !== K_SKY) continue;
            const dx = ((vx + 0.5) / Q - cx) / w;
            const puff = puffs[vx] - 0.25 * Math.abs(dx);
            if (dx * dx + (dy < 0 ? dy * dy * 0.6 : dy * dy * 2.2) >= puff) continue;
            const a = dy < 0 ? 0.55 : 0.32, o = P[p];
            const r = (o & 255), g = (o >> 8) & 255, b = (o >> 16) & 255;
            P[p] = 0xff000000 | ((b + (cb * fade - b) * a) << 16) | ((g + (cg * fade - g) * a) << 8) | (r + (cr * fade - r) * a);
          }
        }
      }
    }

    /* Where the picture runs past the fine ground: the valley's grain it is in, each cell with a grain of its own, so it
       never shows as blocks. Each cell looks a little to one side or the other for its valley grain, so the edge
       between two layers is ragged, as it is in the fine ground, rather than cut in steps. Kept until the camera
       moves. */
    let fallCol = new Uint32Array(0), fallKind = new Uint8Array(0), fallSun = fallKind, fallKey = '';
    function fallback(lv, cols, rows, cam) {
      const key = cols + ',' + rows + ',' + cam.x + ',' + cam.y + ',' + lv.S;
      if (key === fallKey) return;
      fallKey = key;
      const size = cols * rows;
      if (fallCol.length < size) { fallCol = new Uint32Array(size); fallKind = new Uint8Array(size); fallSun = new Uint8Array(size); }
      const S = lv.S;
      for (let vy = 0; vy < rows; vy++) {
        const gy = cam.y + vy, y = Math.floor(gy / S);
        span(lv, cols, cam, vy);
        for (let vx = 0; vx < cols; vx++) {
          if (vx === SPAN_A && SPAN_B > SPAN_A) vx = SPAN_B;
          if (vx >= cols) break;
          const p = vy * cols + vx, gx = cam.x + vx;
          if (y < 0) { fallKind[p] = K_SKY; continue; }
          const jy = Math.max(0, Math.floor((gy + (hash(gx, gy, 301) - 0.5) * S * 0.8) / S));
          const yy = jy >= H ? H - 40 + (jy - H) % 40 : jy, x = clamp(Math.floor((gx + (hash(gx, gy, 302) - 0.5) * S * 0.8) / S), 0, W - 1);
          const i = yy * W + x, m = M[i];
          if (m !== AIR && m !== WATER && !FL[i] && !GLOWS[m]) {
            /* Ground gets a shade of its own in every cell, made as the fine ground's grains are, so it goes on as the
               same ground past the edge of the fine grains rather than in blocks of a valley grain. */
            const xv = (gx + 0.5) / S - 0.5, yv = (gy + 0.5) / S - 0.5, grain = hash(gx, gy, 6);
            const jit = 0.5 * grain + 0.5 * vnoise(xv * 1.3, yv * 1.3, 16);
            const sh = Math.floor(clamp(vnoise(xv / 23, yv / 2.2, 5) * 2.6 + jit * 1.7 - 0.35, 0, 3.99)) | (Math.floor(grain * 64) << 2);
            fallCol[p] = colourOf(m, 0, sh, yv - surf[x], MO[i], false);
            fallKind[p] = CK;
            fallSun[p] = CSU;
            continue;
          }
          const c = tone(i, x, yy, m, FL[i]);
          if (CK === K_GROUND || CK === K_CAVE || CK === K_GREEN) {
            const j = 0.9 + 0.2 * hash(gx, gy, 99);
            fallCol[p] = pack((c & 255) * j, ((c >> 8) & 255) * j, ((c >> 16) & 255) * j);
          } else fallCol[p] = c;
          fallKind[p] = CK;
          fallSun[p] = CSU;
        }
      }
    }

    /* Sunlight, as a factor for each amount of sun a grain gets: on the surface the hour's light, underground only
       the dark of night reaches. */
    const lutR = new Float32Array(256), lutG = new Float32Array(256), lutB = new Float32Array(256);
    function lighting() {
      for (let s = 0; s < 256; s++) {
        const sn = s / 255;
        lutR[s] = amb[0] * sn + Math.min(amb[0], 0.9) * (1 - sn);
        lutG[s] = amb[1] * sn + Math.min(amb[1], 0.9) * (1 - sn);
        lutB[s] = amb[2] * sn + Math.min(amb[2], 0.9) * (1 - sn);
      }
    }

    let nearPic = null, nearCols = 0, nearRows = 0, camS = 1, camX = 0, camY = 0;

    /* The span of a picture row that lies in the fine ground: from a to b, and the grain at a. */
    let SPAN_A = 0, SPAN_B = 0, SPAN_I = 0;
    function span(lv, cols, cam, vy) {
      const ly = cam.y + vy - lv.gy0;
      if (ly < 0 || ly >= lv.h) { SPAN_A = SPAN_B = 0; return; }
      SPAN_A = clamp(lv.gx0 - cam.x, 0, cols);
      SPAN_B = clamp(lv.gx0 + lv.w - cam.x, SPAN_A, cols);
      SPAN_I = ly * lv.w + cam.x + SPAN_A - lv.gx0;
    }

    /* A grain's colour in the light of the hour, kept until the grain or the light changes. The light moves in
       steps of 1/128, too small to see. */
    function litOf(lv, i) {
      const k = lv.kind[i];
      if (k !== K_GROUND && k !== K_GREEN && k !== K_CAVE) return;
      const c = lv.col[i], su = lv.sun[i], fd = fade;
      const fr = lutR[su], fg = lutG[su], fb = lutB[su];
      const r = (c & 255) * (fr < 1.6 ? fr : 1.6) * fd, g = ((c >> 8) & 255) * (fg < 1.6 ? fg : 1.6) * fd, b = ((c >> 16) & 255) * (fb < 1.6 ? fb : 1.6) * fd;
      lv.lit[i] = 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
    }
    function hourKey() {
      amb[0] = Math.round(amb[0] * 128) / 128; amb[1] = Math.round(amb[1] * 128) / 128; amb[2] = Math.round(amb[2] * 128) / 128;
      fade = Math.round(fade * 256) / 256;
      return amb[0] * 1e9 + amb[1] * 1e6 + amb[2] * 1e3 + fade;
    }

    /* Any cell, the slow way: sky, water and glowing things. */
    function cellColour(k, c, su, gx, gy, vx, vy) {
      if (k === K_SKY) {
        const q = vy * 4 + (vx & 3);
        return vy >= ridgeMid[vx] ? skyMid[q] : vy >= ridgeFar[vx] ? skyFar[q] : skyRows[q];
      }
      let r, g, b;
      if (k === K_WATER || k === K_TOP) {
        const wc = WATER * 12 + ((hash(gx, gy, (n >> 4) + 97) < 0.5 ? 0 : 1) + (k === K_TOP ? 2 : 0)) * 3;
        r = PAL[wc]; g = PAL[wc + 1]; b = PAL[wc + 2];
        if (k === K_TOP) { r = r * 0.6 + skyHor[0] * 0.4; g = g * 0.6 + skyHor[1] * 0.4; b = b * 0.6 + skyHor[2] * 0.4; }
      } else { r = c & 255; g = (c >> 8) & 255; b = (c >> 16) & 255; }
      const fd = fade;
      if (k === K_LIT) {
        const fl = reel.reduced ? fd : fd * (0.92 + 0.08 * hash(gx, gy, (n >> 3) + 98));
        r *= fl; g *= fl; b *= fl;
      } else {
        const fr = lutR[su], fg = lutG[su], fb = lutB[su];
        r *= (fr < 1.6 ? fr : 1.6) * fd; g *= (fg < 1.6 ? fg : 1.6) * fd; b *= (fb < 1.6 ? fb : 1.6) * fd;
      }
      return 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
    }

    /* The picture at 1:1 or closer: one cell per fine grain, the sky, the light of the hour, then what lives. */
    function paintNear(rgba, cols, rows, cam, t) {
      const lv = cam.z < 1 ? close : win, S = lv.S, size = cols * rows;
      if (t >= T_X2 - 0.5 && alive) prebuild(cols, rows, T_X2);
      const P = new Uint32Array(rgba.buffer, rgba.byteOffset, size);
      hour(t);
      const key = hourKey();
      lighting();
      if (key !== lv.litKey) { lv.litKey = key; lv.relight = true; }
      refresh(lv);
      skyTables(cols, rows, cam.z);
      fallback(lv, cols, rows, cam);
      nearPic = rgba; nearCols = cols; nearRows = rows; camS = S; camX = cam.x; camY = cam.y;
      const kind = lv.kind, lit = lv.lit, col = lv.col, sun = lv.sun;
      for (let vy = 0, p = 0; vy < rows; vy++) {
        const gy = cam.y + vy;
        span(lv, cols, cam, vy);
        const a = SPAN_A, b = SPAN_B;
        if (b > a) {
          const ly = gy - lv.gy0, la = SPAN_I - ly * lv.w, lb = la + b - a;
          if (lv.rowKey[ly] !== key || la < lv.rowA[ly] || lb > lv.rowB[ly]) {
            for (let li = SPAN_I; li < SPAN_I + b - a; li++) litOf(lv, li);
            lv.rowKey[ly] = key; lv.rowA[ly] = la; lv.rowB[ly] = lb;
          }
        }
        for (let vx = 0; vx < a; vx++, p++) P[p] = cellColour(fallKind[p], fallCol[p], fallSun[p], cam.x + vx, gy, vx, vy);
        const q0 = vy * 4;
        for (let vx = a, li = SPAN_I; vx < b; vx++, p++, li++) {
          const k = kind[li];
          if (k >= K_GROUND || k === K_CAVE) P[p] = lit[li];
          else if (k === K_SKY) { const q = q0 + (vx & 3); P[p] = vy >= ridgeMid[vx] ? skyMid[q] : vy >= ridgeFar[vx] ? skyFar[q] : skyRows[q]; }
          else P[p] = cellColour(k, col[li], sun[li], cam.x + vx, gy, vx, vy);
        }
        for (let vx = b; vx < cols; vx++, p++) P[p] = cellColour(fallKind[p], fallCol[p], fallSun[p], cam.x + vx, gy, vx, vy);
      }
      clouds(P, cols, rows, t, lv, cam);
      if (!LITTLE) for (let p = 0; p < size; p++) { const o = P[p]; P[p] = ((o & 255) << 24) | (((o >> 8) & 255) << 16) | (((o >> 16) & 255) << 8) | 255; }
      paintLifeNear(t);
      paintMarks(t, cam.z);
      nearPic = null;
    }

    /* ---- What lives, drawn in cells ---- */

    /* A cell of the picture, blended toward a colour. */
    function plot(x, y, c, a) {
      if (x < 0 || y < 0 || x >= nearCols || y >= nearRows) return;
      const q = (y * nearCols + x) * 4, pic = nearPic, k = a === undefined ? 1 : a, f = fade * k;
      pic[q] = c[0] * f + pic[q] * (1 - k);
      pic[q + 1] = c[1] * f + pic[q + 1] * (1 - k);
      pic[q + 2] = c[2] * f + pic[q + 2] * (1 - k);
    }
    /* A shape at a point in valley grains: every cell whose middle lies in the box round it is asked what colour it is. */
    function shape(x, y, l, tp, r, bt, fn) {
      const s = camS, c0 = Math.floor((x + l) * s) - camX, c1 = Math.ceil((x + r) * s) - camX;
      const r0 = Math.floor((y + tp) * s) - camY, r1 = Math.ceil((y + bt) * s) - camY;
      for (let cy = Math.max(0, r0); cy <= Math.min(nearRows - 1, r1); cy++) {
        const v = (camY + cy + 0.5) / s - y;
        for (let cx = Math.max(0, c0); cx <= Math.min(nearCols - 1, c1); cx++) fn(cx, cy, (camX + cx + 0.5) / s - x, v);
      }
    }

    /* The creature: four valley grains wide and three tall, standing on its feet row. A loaf of a body with two ears,
       an eye, a pale belly and the shade of its back; standing, it is up on its feet; walking, its feet change over. */
    const MASKS = {};
    const CRE = [null, CRE_SHADOW, CRE_BODY, CRE_BELLY, CRE_EYE, CRE_BELLY];
    function creature(pose, step, s) {
      const id = pose + step + ',' + s;
      if (MASKS[id]) return MASKS[id];
      const w = Math.max(2, Math.round(4 * s)), h = Math.max(2, Math.round(3 * s)), m = new Uint8Array(w * h);
      const up = pose === 'sit' ? 0 : 0.2;
      const feet = pose === 'stand' ? [0.55, 3.45] : pose === 'walk' ? (step ? [1.5, 2.5] : [1.0, 3.0]) : null;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const u = (i + 0.5) / s, v = (j + 0.5) / s;
          let c = 0;
          const bx = (u - 2) / 1.98, by = (v - (2.06 - up)) / (0.94 - up * 0.45);
          if (sq((u - 1.45) / 0.34) + sq((v - 0.78) / 0.44) < 1 || sq((u - 3.3) / 0.34) + sq((v - 0.74) / 0.44) < 1) c = 1;
          if (bx * bx + by * by < 1) {
            c = 2;
            if (u < 1.05 && v < 2.15 - up) c = 1;
            if (sq((u - 2.0) / 1.1) + sq((v - (2.62 - up * 1.4)) / 0.44) < 1) c = 3;
            if (sq((u - 3.35) / 0.3) + sq((v - (1.5 - up)) / 0.3) < 1) c = 4;
            if (s >= 6 && sq((u - 3.27) / 0.1) + sq((v - (1.4 - up)) / 0.1) < 1.6) c = 5;
          }
          if (feet && v > 2.5 && (Math.abs(u - feet[0]) < 0.3 || Math.abs(u - feet[1]) < 0.3)) c = 4;
          m[j * w + i] = c;
        }
      }
      return (MASKS[id] = { w, h, m });
    }
    function paintYouNear() {
      const s = camS, mask = creature(you.walk && you.pose === 'walk' ? 'walk' : you.pose === 'walk' ? 'stand' : you.pose, you.walk, s);
      const x0 = Math.round((PX + you.x) * s) - camX, y1 = Math.round((PY + you.y + 1) * s) - 1 - camY, y0 = y1 - mask.h + 1;
      for (let j = 0; j < mask.h; j++) {
        for (let i = 0; i < mask.w; i++) {
          const c = mask.m[j * mask.w + (you.face > 0 ? i : mask.w - 1 - i)];
          if (c) plot(x0 + i, y0 + j, CRE[c]);
        }
      }
      const head = PY + you.y + 1 - 3.45;
      if (you.carry === 1) seedShape(PX + you.x + 1.5 + (you.face > 0 ? 1 : 0), head, false);
      if (you.carry === 2) {
        for (let k = 0; k < 2; k++) {
          shape(PX + you.x + 1.5 + k, head, -0.5, -0.4, 0.5, 0.4, (cx, cy, u, v) => {
            if (u * u / 0.2 + v * v / 0.14 < 1) plot(cx, cy, k ? CLAY_B : CLAY_A);
          });
        }
      }
    }
    /* The seed: an oval about a valley grain and a third across, as big on screen as the old one-grain seed, darker
       at the rim, lit at the top left, with a glint while it lies in the open (a steady one with reduced motion). In
       the ground it is the one seed grain, drawn the size it is on the wind so it can be followed. */
    function seedShape(x, y, glint) {
      shape(x, y, -0.75, -0.55, 0.75, 0.55, (cx, cy, u, v) => {
        const d = u * u / 0.45 + v * v / 0.25;
        if (d >= 1) return;
        plot(cx, cy, d > 0.68 ? SEED_RIM : u + 0.8 * v < -0.18 ? SEED_C : SEED_MID);
      });
      if (glint && (reel.reduced || ((n >> 4) & 3) !== 0)) {
        const gx = Math.floor((x - 0.3) * camS) - camX, gy = Math.floor((y - 0.24) * camS) - camY;
        plot(gx, gy, GLINT);
        if (camS >= 8) { plot(gx + 1, gy, GLINT, 0.7); plot(gx, gy + 1, GLINT, 0.5); }
      }
    }
    function flyAt(f, t) {
      return [f.x + 3 * Math.sin(t * 0.5 + f.ph), f.y - (t - T_GOLD) * f.sp * 1.2 % 14];
    }
    function paintLifeNear(t) {
      const lv = camS === close.S ? close : win;
      if (t >= T_DRIFT && t < T_LAND) {
        const u = (t - T_DRIFT) / (T_LAND - T_DRIFT), mid = fcol(lv, 49) + (lv.S >> 1);
        const sy = PY + lv.py0 + (soilOf(lv, mid) - 0.5) / lv.S - 0.5;
        seedShape(PX + 100.5 + (49 - 100) * u, PY + 2.5 + (sy - PY - 2.5) * Math.pow(u, 1.6) + 2 * Math.sin(u * 9) * (1 - u * u), true);
      }
      if (seedAt >= 0 && lv.M[seedAt] === SEED) {
        const x = seedAt % lv.w, y = (seedAt / lv.w) | 0;
        seedShape(PX + lv.px0 + (x + 0.5) / lv.S, PY + lv.py0 + (y + 0.5) / lv.S - 0.12, sown < 0 || sown === -6);
      }
      if (bird) {
        const u = clamp((t - bird.at) / 0.9, 0, 1);
        const hop = (t > T_BIRD + 0.4 && t < T_BIRD + 0.55) || (t > beat(47.5) && t < beat(47.5) + 0.15) ? 0.25 : 0;
        birdShape(bird.x + (1 - u) * 60, bird.y - (1 - u) * 24 * (1 - u) - hop, u >= 1, (n >> 2) & 1);
      }
      for (let k = 0; k < bees.length; k++) {
        const b = bees[k];
        beeShape(b.x, b.y + Math.sin(t * 9 + k) * 1.2, reel.reduced ? 0 : (n >> 1) & 1);
      }
      for (let k = 0; k < fireflies.length; k++) {
        const f = fireflies[k], on = reel.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2.2 * f.sp + f.ph);
        if (on <= 0.25) continue;
        /* A bright core about a valley grain across, as big on screen as the old film's, and the light it gives the
           grains round it, fading out over two valley grains. */
        const at = flyAt(f, t), a = Math.min(1, on);
        shape(at[0], at[1], -2, -2, 2, 2, (cx, cy, u, v) => {
          const d = u * u + v * v;
          if (d < 0.2) plot(cx, cy, FLY, a);
          else if (d < 0.36) plot(cx, cy, FLY, a * 0.75);
          else if (d < 4) plot(cx, cy, FLY, a * 0.35 * sq(1 - Math.sqrt(d) / 2));
        });
      }
      paintYouNear();
    }
    /* The bird, facing the way it flies in: body, head, beak, tail, a pale belly, and a wing that beats until it lands. */
    function birdShape(x, y, landed, flap) {
      shape(x, y, -1.8, -2.0, 2.0, 0.1, (cx, cy, u, v) => {
        let c = null;
        const body = sq((u - 0.1) / 1.15) + sq((v + 0.75) / 0.5) < 1, head = sq((u + 0.95) / 0.42) + sq((v + 1.15) / 0.42) < 1;
        if (u > 0.85 && u < 1.9 && Math.abs(v + 0.82) < 0.2 - (u - 0.85) * 0.08) c = BIRD_DARK;
        if (body || head) c = body && v > -0.72 && u < 0.7 ? BIRD_BELLY : BIRD_C;
        if (u < -1.3 && u > -1.68 && Math.abs(v + 1.1) < 0.06 + (u + 1.68) * 0.25) c = BIRD_DARK;
        if (sq((u + 1.08) / 0.11) + sq((v + 1.25) / 0.11) < 1.5) c = CRE_EYE;
        if (landed) {
          if (sq((u - 0.35) / 0.72) + sq((v + 0.86) / 0.26) < 1) c = BIRD_WING;
          if (v > -0.28 && (Math.abs(u + 0.15) < 0.09 || Math.abs(u - 0.3) < 0.09)) c = BIRD_DARK;
        } else if (sq((u - 0.25) / 0.8) + sq((v - (flap ? -1.5 : -0.2)) / 0.32) < 1) c = BIRD_WING;
        if (c) plot(cx, cy, c);
      });
    }
    /* A bee: amber, with a dark band and pale wings that blur. */
    function beeShape(x, y, beat2) {
      shape(x, y, -0.7, -0.95, 0.7, 0.5, (cx, cy, u, v) => {
        if (sq(u / 0.6) + sq(v / 0.42) < 1) plot(cx, cy, Math.abs(u - 0.04) < 0.11 ? BEE_BAND : BEE);
        else if (sq((u - 0.05) / 0.38) + sq((v - (beat2 ? -0.62 : -0.48)) / 0.22) < 1) plot(cx, cy, WING, 0.6);
      });
    }

    /* Where the last view was, for a moment after each cut: corner ticks, a cell thick. At the widest, every view,
       as rings. */
    function rect(x0, y0, x1, y1, c, k, corners) {
      const a = clamp(k, 0, 1), arm = 3 * Q;
      if (a <= 0) return;
      for (let x = x0; x <= x1; x++) {
        if (corners && x - x0 > arm && x1 - x > arm) continue;
        plot(x, y0, c, a); plot(x, y1, c, a);
      }
      for (let y = y0 + 1; y < y1; y++) {
        if (corners && y - y0 > arm && y1 - y > arm) continue;
        plot(x0, y, c, a); plot(x1, y, c, a);
      }
    }
    function viewRect(z0, c, k, corners) {
      const v0 = viewOf(z0), s = camS;
      rect(Math.floor(v0[1] * s) - camX, Math.floor(v0[2] * s) - camY, Math.floor((v0[1] + VW / Q * z0) * s) - camX - 1,
        Math.floor((v0[2] + VH / Q * z0) * s) - camY - 1, c, k, corners);
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

    /* ---- The long views ----
       From x2 out the picture comes from the valley's own grains. At x2 a cell is half a valley grain: in the window,
       a square of four of its grains; outside it, a quarter of a valley grain that takes after whichever neighbour
       shares its edge, so slopes and edges run smooth rather than in steps, each cell with a grain of its own. At x4
       a cell is a valley grain, and at x8 a square of four of them. */

    /* The window at x2, on the day the film has got to: what its grains came to, with what has been dated since. */
    const WIN2_W = (WX1 - WX0) * 2, WIN2_H = (WY1 - WY0) * 2;
    const WIN2 = alive ? WIN2_W * WIN2_H : 0;
    const win2Col = new Uint32Array(WIN2), win2Kind = new Uint8Array(WIN2), win2Glow = new Uint8Array(WIN2), win2Sun = new Uint8Array(WIN2);
    let winStep = -1;
    /* Grass and crops stand a cell wide, on one side or the other of their valley grain. */
    function thin(vx, sx) { return ((sx + (hash(vx, 0, 205) < 0.5 ? 1 : 0)) & 1) === 1; }
    function winPicture(step) {
      winStep = step;
      for (let cy = 0; cy < WIN2_H; cy++) winRow(cy, DAYS[step]);
    }
    /* One row of it. A row at a time, so that something met for the first time costs a row, not the whole picture. */
    function winRow(cy, d) {
      const lv = win, w = lv.w, LM = lv.M, LF = lv.FL, LMO = lv.MO, LSH = lv.SH, S = lv.S, top = lv.surf;
      const fy = cy * 2, vrow = (WY0 + (cy >> 1)) * W;
      for (let cx = 0, q = cy * WIN2_W; cx < WIN2_W; cx++, q++) {
        const fx = cx * 2, i0 = fy * w + fx, i1 = i0 + 1, i2 = i0 + w, i3 = i2 + 1;
        const m0 = LM[i0], m1 = LM[i1], m2 = LM[i2], m3 = LM[i3];
        const water = (m0 === WATER ? 1 : 0) + (m1 === WATER ? 1 : 0) + (m2 === WATER ? 1 : 0) + (m3 === WATER ? 1 : 0);
        const ground = (m0 > AIR && m0 !== WATER ? 1 : 0) + (m1 > AIR && m1 !== WATER ? 1 : 0) +
          (m2 > AIR && m2 !== WATER ? 1 : 0) + (m3 > AIR && m3 !== WATER ? 1 : 0);
        let m = AIR, rep = i2;
        if (water >= 2) { m = WATER; rep = m2 === WATER ? i2 : m3 === WATER ? i3 : m0 === WATER ? i0 : i1; }
        else if (ground >= 2) {
          /* The most of the ground in it; a tie goes to the lower grains. */
          let bestN = 0;
          for (let k = 0; k < 4; k++) {
            const j = k === 0 ? i2 : k === 1 ? i3 : k === 2 ? i0 : i1, mm = LM[j];
            if (mm === AIR || mm === WATER) continue;
            const c = (m0 === mm ? 1 : 0) + (m1 === mm ? 1 : 0) + (m2 === mm ? 1 : 0) + (m3 === mm ? 1 : 0);
            if (c > bestN) { bestN = c; m = mm; rep = j; }
          }
        }
        let fl = 0, s = LSH[rep];
        const f2 = LF[i2], f3 = LF[i3], f0 = LF[i0], f1 = LF[i1];
        if (f2 || f3 || f0 || f1) { const j = f2 ? i2 : f3 ? i3 : f0 ? i0 : i1; fl = LF[j]; s = LSH[j]; }
        if (m === SEED) m = SOIL;
        if (d > 1) {
          const vx = WX0 + (cx >> 1), v = vrow + vx;
          if (BM[v] <= d && (m === AIR || m === M0[v])) { m = FIN[v]; s = (SH[v] & 3) | (LSH[i0] & 0xfc); }
          if (!fl && BF[v] <= d) {
            const f = FLF[v];
            if ((f === ROOT ? EARTH[m] : m === AIR || m === WATER) && !((f === GRASS || f === CROP) && thin(vx, cx & 1))) {
              fl = f; s = (SH[v] & 3) | (LSH[i0] & 0xfc);
            }
          }
        }
        const dy = fy - top[fx], open = m === WATER && fy > 0 && LM[i0 - w] === AIR && dy <= 1;
        win2Col[q] = colourOf(m, fl, s, dy / S, (LMO[i0] + LMO[i1] + LMO[i2] + LMO[i3]) >> 2, open);
        win2Kind[q] = CK; win2Glow[q] = CL; win2Sun[q] = CSU;
      }
    }

    /* The long view as it stands on this day, before the light: a colour, a kind, a glow and the sun it gets, for
       each cell of the picture. Kept until the camera or the picture's size changes; a new day works out again only
       the rows with something dated on it. */
    let farCol = new Uint32Array(0), farLit = farCol, farKind = new Uint8Array(0), farGlow = farKind, farSun = farKind;
    let farR = new Float32Array(0), farG = farR, farB = farR, farRow = farKind, farDirty = farKind;
    let farHalo = farKind, farHaloCol = farCol;
    let farKey = '', farStep = -1, farLitKey = -1, preKey = '', preRow = 0;
    function farBase(cols, rows, cam, z, step, t) {
      const key = cols + ',' + rows + ',' + cam.x + ',' + cam.y + ',' + z;
      if (key === farKey && step === farStep && !preKey) return;
      farLitKey = -1;
      const g = grids[z === 8 ? 2 : 1];
      if (preKey) {
        /* The x2 picture was made ahead of the cut, all but the window; now the window's own picture goes in. */
        const done = preKey === key + ',' + step && preRow >= rows;
        preKey = '';
        if (done) {
          winPicture(step);
          for (let vy = 0; vy < rows; vy++) x2Window(cols, cam, vy);
          farKey = key;
          farStep = step;
          farLight(cols, rows, z, step, t);
          return;
        }
        farKey = '';
      }
      if (key === farKey && step > farStep && dirtyRows(g, rows, cam, z, step)) {
        if (z === 2) {
          for (let cy = 0; cy < WIN2_H; cy++) if (winDirty[cy]) winRow(cy, DAYS[step]);
          winStep = step;
        }
        for (let vy = 0; vy < rows; vy++) {
          if (!farDirty[vy]) continue;
          if (z === 2) x2Row(cols, cam, vy); else gridRow(g, cols, cam, vy);
        }
      } else {
        const size = cols * rows;
        if (farCol.length < size) {
          farCol = new Uint32Array(size); farLit = new Uint32Array(size);
          farKind = new Uint8Array(size); farGlow = new Uint8Array(size); farSun = new Uint8Array(size);
          farR = new Float32Array(size); farG = new Float32Array(size); farB = new Float32Array(size);
          farHalo = new Uint8Array(size); farHaloCol = new Uint32Array(size);
        }
        if (farRow.length < rows) { farRow = new Uint8Array(rows); farDirty = new Uint8Array(rows); }
        if (z === 2 && step !== winStep) winPicture(step);
        for (let vy = 0; vy < rows; vy++) { if (z === 2) x2Row(cols, cam, vy); else gridRow(g, cols, cam, vy); }
      }
      farKey = key;
      farStep = step;
      farLight(cols, rows, z, step, t);
    }
    /* The picture's rows that hold an entry dated between the last day drawn and this one, and the rows next to them,
       which take after them at x2; and at x2 the window picture's rows with one. False if the valley's last rows,
       drawn again below its floor, are among them. */
    const winDirty = new Uint8Array(WIN2_H);
    function dirtyRows(g, rows, cam, z, step) {
      farDirty.fill(0, 0, rows);
      winDirty.fill(0);
      const gw = g.gw, low = g.gh - Math.ceil(40 / g.z);
      for (let k = farStep + 1; k <= step; k++) {
        for (let q = g.at[k]; q < g.at[k + 1]; q++) {
          const Y = (g.list[q] / gw) | 0;
          if (Y >= low) return false;
          const a = z === 2 ? 2 * Y - 2 - cam.y : Y - cam.y, b = z === 2 ? a + 5 : a;
          for (let vy = Math.max(0, a); vy <= Math.min(rows - 1, b); vy++) farDirty[vy] = 1;
          if (z === 2 && Y >= WY0 && Y < WY1) { winDirty[2 * (Y - WY0)] = 1; winDirty[2 * (Y - WY0) + 1] = 1; }
        }
      }
      return true;
    }

    /* x2: the window's own picture, and outside it each valley grain as four cells. A cell whose two outer
       neighbours are alike, and unlike the other two, takes after them (the rule pixel artists scale sprites by),
       so a slope or the edge of a crown is cut on the half grain. */
    /* A picture about to need its x2 view gets it made a few rows at a time over the last half second before the cut,
       all but the window, which is still changing. The window's own picture is made over and over meanwhile, only so
       that the code for it is ready: a browser lets go of code it hasn't run for a while, and this was last run while
       loading. */
    let preWin = 0;
    function prebuild(cols, rows, t) {
      for (let k = 0; k < 12; k++, preWin = (preWin + 1) % WIN2_H) winRow(preWin, DAYS[0]);
      aim(t, 2, cols, rows);
      const cam = { x: AIM_X, y: AIM_Y }, key = cols + ',' + rows + ',' + AIM_X + ',' + AIM_Y + ',2,0';
      if (key !== preKey) {
        preKey = key;
        preRow = 0;
        farKey = '';
        const size = cols * rows;
        if (farCol.length < size) {
          farCol = new Uint32Array(size); farLit = new Uint32Array(size);
          farKind = new Uint8Array(size); farGlow = new Uint8Array(size); farSun = new Uint8Array(size);
          farR = new Float32Array(size); farG = new Float32Array(size); farB = new Float32Array(size);
          farHalo = new Uint8Array(size); farHaloCol = new Uint32Array(size);
        }
        if (farRow.length < rows) { farRow = new Uint8Array(rows); farDirty = new Uint8Array(rows); }
      }
      const end = Math.min(rows, preRow + Math.ceil(rows / 16));
      for (; preRow < end; preRow++) x2Row(cols, cam, preRow, true);
    }
    function x2Window(cols, cam, vy) {
      const wy = cam.y + vy - 2 * WY0;
      if (wy < 0 || wy >= WIN2_H) return;
      const a = Math.max(0, 2 * WX0 - cam.x), b = Math.min(cols, 2 * WX1 - cam.x);
      for (let vx = a, p = vy * cols + a, q = wy * WIN2_W + cam.x + a - 2 * WX0; vx < b; vx++, p++, q++) {
        farCol[p] = win2Col[q]; farKind[p] = win2Kind[q]; farGlow[p] = win2Glow[q]; farSun[p] = win2Sun[q];
      }
    }
    function x2Row(cols, cam, vy, outside) {
      const g = grids[1], code = g.code, gc = g.col, gk = g.kind, gg = g.glow, gs = g.sun;
      let p = vy * cols;
      const gy = cam.y + vy;
      if (gy < 0) { farKind.fill(K_SKY, p, p + cols); farGlow.fill(0, p, p + cols); return; }
      let Y = gy >> 1;
      if (Y >= H) Y = H - 40 + (Y - H) % 40;
      const sy = gy & 1, up = (Y > 0 ? Y - 1 : 0) * W, row = Y * W, dn = (Y < H - 1 ? Y + 1 : Y) * W;
      const wy = gy - 2 * WY0, inRows = wy >= 0 && wy < WIN2_H;
      /* Next to the window, its grains are not looked at: they are pooled again just after the cut, and the picture
         here must not depend on whether it was made before that or after. */
      const yIn = Y >= WY0 && Y < WY1, upIn = Y - 1 >= WY0 && Y - 1 < WY1, dnIn = Y + 1 >= WY0 && Y + 1 < WY1;
      for (let vx = 0; vx < cols; vx++, p++) {
        const gx = cam.x + vx, wx = gx - 2 * WX0;
        if (inRows && wx >= 0 && wx < WIN2_W) {
          if (outside) continue;
          const q = wy * WIN2_W + wx;
          farCol[p] = win2Col[q]; farKind[p] = win2Kind[q]; farGlow[p] = win2Glow[q]; farSun[p] = win2Sun[q];
          continue;
        }
        const X = gx < 0 ? 0 : gx >= 2 * W ? W - 1 : gx >> 1, sx = gx & 1;
        const xIn = X >= WX0 && X < WX1, c = code[row + X];
        const a = upIn && xIn ? c : code[up + X], d = dnIn && xIn ? c : code[dn + X];
        const l = yIn && X - 1 >= WX0 && X - 1 < WX1 ? c : code[row + (X > 0 ? X - 1 : X)];
        const r = yIn && X + 1 >= WX0 && X + 1 < WX1 ? c : code[row + (X < W - 1 ? X + 1 : X)];
        let src = row + X;
        if (c !== a || c !== d || c !== l || c !== r) {
          if (sy === 0) { if (!(upIn && xIn) && (sx === 0 ? l === a && l !== d && a !== r : a === r && a !== l && r !== d)) src = up + X; }
          else if (!(dnIn && xIn) && (sx === 0 ? d === l && d !== r && l !== a : r === d && r !== a && d !== l)) src = dn + X;
        }
        const sc = code[src];
        let k = gk[src], col = gc[src];
        if ((sc === C_GREEN + GRASS || sc === C_GREEN + CROP) && thin(X, sx)) k = K_SKY;
        else if (k === K_GROUND || k === K_CAVE || k === K_GREEN) {
          /* Half the cells take the colour of the grain beside them on their own side, where that is the same stuff,
             so a valley grain doesn't show as a block of four. */
          const h = hash(gx, gy, 98);
          if (h < 0.5 && src === row + X) {
            let nb = -1;
            if (h < 0.25) {
              const nx = sx ? X + 1 : X - 1;
              if (nx >= 0 && nx < W && !(yIn && nx >= WX0 && nx < WX1)) nb = row + nx;
            } else if (sy ? Y < H - 1 && !(dnIn && xIn) : Y > 0 && !(upIn && xIn)) nb = (sy ? dn : up) + X;
            if (nb >= 0 && code[nb] === c && gk[nb] === k) col = gc[nb];
          }
          const j = 0.9 + 0.2 * hash(gx, gy, 99), cr = (col & 255) * j, cg = ((col >> 8) & 255) * j, cb = ((col >> 16) & 255) * j;
          col = (cr > 255 ? 255 : cr | 0) | ((cg > 255 ? 255 : cg | 0) << 8) | ((cb > 255 ? 255 : cb | 0) << 16);
        }
        farCol[p] = col; farKind[p] = k; farGlow[p] = gg[src]; farSun[p] = gs[src];
      }
    }

    /* x4 and x8: a cell per entry. Below the valley's floor, its last rows again. */
    function gridRow(g, cols, cam, vy) {
      const gw = g.gw, gh = g.gh, wrap = Math.ceil(40 / g.z), gc = g.col, gk = g.kind, gg = g.glow, gs = g.sun;
      let by = cam.y + vy, p = vy * cols;
      if (by < 0) { farKind.fill(K_SKY, p, p + cols); farGlow.fill(0, p, p + cols); return; }
      if (by >= gh) by = gh - wrap + (by - gh) % wrap;
      const row = by * gw;
      for (let vx = 0; vx < cols; vx++, p++) {
        const bx = cam.x + vx, q = row + (bx < 0 ? 0 : bx >= gw ? gw - 1 : bx);
        farCol[p] = gc[q]; farKind[p] = gk[q]; farGlow[p] = gg[q]; farSun[p] = gs[q];
      }
    }

    /* Light from whatever glows, worked out on a grid of eight cells a side, the size it always was: each square of
       four cells a side gives the light of the brightest thing in it, and the valley's fireflies add a little. It
       only changes with the day, so it is worked out then, spread, and kept for each cell. The fireflies of the
       patch move, but the light they would add to the ground from this far is too faint to see; they carry their
       own glow. */
    let LW = 0, LH = 0;
    function farLight(cols, rows, z, step, t) {
      /* A lit window or a lamp is a cell or two across from here: the ground round it takes a little of its colour,
         so it reads as a light and not a speck. */
      farHalo.fill(0, 0, cols * rows);
      for (let vy = 1, p = cols; vy < rows - 1; vy++) {
        p++;
        for (let vx = 1; vx < cols - 1; vx++, p++) {
          if (farKind[p] !== K_LIT) continue;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const q = p + dy * cols + dx, k = farKind[q], a = dx && dy ? 40 : 80;
              if ((k >= K_GROUND || k === K_CAVE) && farHalo[q] < a) { farHalo[q] = a; farHaloCol[q] = farCol[p]; }
            }
          }
        }
        p++;
      }
      LW = ((cols + 7) >> 3) + 1; LH = ((rows + 7) >> 3) + 1;
      const nl = LW * LH, gain = z >= 4 ? 0.55 : 0.8;
      if (halfR.length < nl) { halfR = new Float32Array(nl); halfG = new Float32Array(nl); halfB = new Float32Array(nl); }
      halfR.fill(0, 0, nl); halfG.fill(0, 0, nl); halfB.fill(0, 0, nl);
      for (let by = 0; by < rows; by += 4) {
        for (let bx = 0; bx < cols; bx += 4) {
          let best = 0, bm = 0;
          for (let y = by; y < by + 4 && y < rows; y++) {
            for (let x = bx, p = y * cols + bx; x < bx + 4 && x < cols; x++, p++) {
              const m = farGlow[p];
              if (m && EMIT[m * 3] >= best) { best = EMIT[m * 3]; bm = m; }
            }
          }
          if (!bm) continue;
          const li = (by >> 3) * LW + (bx >> 3);
          halfR[li] += EMIT[bm * 3] * gain; halfG[li] += EMIT[bm * 3 + 1] * gain; halfB[li] += EMIT[bm * 3 + 2] * gain;
        }
      }
      if (z >= 4 && t >= T_X4) {
        const d = DAYS[step];
        for (let k = 0; k < flies.length; k += 4) {
          if (flies[k + 2] > d) continue;
          const cx = Math.floor(flies[k] * camS) - camX, cy = Math.floor(flies[k + 1] * camS) - camY;
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
          const i = (cy >> 3) * LW + (cx >> 3);
          halfR[i] += 0.2; halfG[i] += 0.165; halfB[i] += 0.075;
        }
      }
      spread(halfR, LW, LH);
      spread(halfG, LW, LH);
      spread(halfB, LW, LH);
      /* Back over the cells: each row from the two light rows either side of it, then each cell from the two light
         points either side of it in that row. */
      if (lineR.length < LW) { lineR = new Float32Array(LW); lineG = new Float32Array(LW); lineB = new Float32Array(LW); }
      const k = LIGHT_K;
      for (let vy = 0, p = 0; vy < rows; vy++) {
        const ly = (vy + 0.5) / 8 - 0.5, j0 = ly < 0 ? 0 : Math.min(LH - 2, ly | 0), fy = clamp(ly - j0, 0, 1), a0 = j0 * LW, b0 = a0 + LW;
        let most = 0;
        for (let x = 0; x < LW; x++) {
          const r = k * (halfR[a0 + x] + (halfR[b0 + x] - halfR[a0 + x]) * fy), g = k * (halfG[a0 + x] + (halfG[b0 + x] - halfG[a0 + x]) * fy);
          lineR[x] = r; lineG[x] = g; lineB[x] = k * (halfB[a0 + x] + (halfB[b0 + x] - halfB[a0 + x]) * fy);
          if (r > most) most = r;
          if (g > most) most = g;
        }
        farRow[vy] = most > 0.002 ? 1 : 0;
        if (!farRow[vy]) { farR.fill(0, p, p + cols); farG.fill(0, p, p + cols); farB.fill(0, p, p + cols); p += cols; continue; }
        /* The light hardly changes over two cells: it is worked out for every other one, on every other row. */
        if ((vy & 1) && farRow[vy - 1]) {
          farR.copyWithin(p, p - cols, p); farG.copyWithin(p, p - cols, p); farB.copyWithin(p, p - cols, p);
          p += cols;
          continue;
        }
        for (let vx = 0; vx < cols; vx += 2, p += 2) {
          const i = (vx - 4) >> 3, u = ((vx - 4) & 7) * 0.125 + 0.125, a = i < 0 ? 0 : i, b = i < 0 ? 0 : i + 1, w = i < 0 ? 0 : u;
          const r = lineR[a] + (lineR[b] - lineR[a]) * w, g = lineG[a] + (lineG[b] - lineG[a]) * w, bl = lineB[a] + (lineB[b] - lineB[a]) * w;
          farR[p] = r; farG[p] = g; farB[p] = bl;
          if (vx + 1 < cols) { farR[p + 1] = r; farG[p + 1] = g; farB[p + 1] = bl; }
        }
        p = (vy + 1) * cols;
      }
    }
    let lineR = new Float32Array(0), lineG = lineR, lineB = lineR;

    /* Stars, once the light has gone: a cell each, the brightest with a faint cross. Fixed to the picture. */
    let starList = new Int32Array(0), starKey = '';
    function stars(P, cols, rows, t) {
      const key = cols + ',' + rows;
      if (key !== starKey) {
        starKey = key;
        const list = [];
        for (let vy = 0; vy < rows * 0.6; vy++) for (let vx = 1; vx < cols - 1; vx++) if (hash(vx, vy, 95) < 0.0016) list.push(vy * cols + vx);
        starList = Int32Array.from(list);
      }
      const night = smooth(T_NIGHT, T_NIGHT + 1.2, t);
      for (let k = 0; k < starList.length; k++) {
        const p = starList[k], vx = p % cols, vy = (p - vx) / cols;
        if (farKind[p] !== K_SKY || vy >= ridgeFar[vx]) continue;
        const tw = reel.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * 3 + hash(vx, vy, 96) * 9), a = (0.35 + 0.5 * tw) * night;
        twinkle(P, p, a);
        if (hash(vx, vy, 97) < 0.25 && vy > 0) { twinkle(P, p - 1, a * 0.3); twinkle(P, p + 1, a * 0.3); twinkle(P, p - cols, a * 0.3); twinkle(P, p + cols, a * 0.3); }
      }
    }
    function twinkle(P, p, a) {
      if (p < 0 || p >= P.length || farKind[p] !== K_SKY) return;
      const o = P[p], r = o & 255, g = (o >> 8) & 255, b = (o >> 16) & 255, f = fade;
      P[p] = 0xff000000 | ((b + (214 * f - b) * a) << 16) | ((g + (226 * f - g) * a) << 8) | (r + (230 * f - r) * a);
    }

    /* The long view: the valley as it stands on the day, in the light of the hour and of whatever glows. Only water,
       lit windows and the sky change from one picture to the next; the rest is kept until the light moves. */
    function paintFar(rgba, cols, rows, cam, t) {
      const z = cam.z, size = cols * rows, P = new Uint32Array(rgba.buffer, rgba.byteOffset, size);
      hour(t);
      const key = hourKey();
      lighting();
      nearPic = rgba; nearCols = cols; nearRows = rows; camS = Q / z; camX = cam.x; camY = cam.y;
      /* The valleys are brought up to the day in tick(); a picture asked for out of turn catches up here. */
      const step = dayStepAt(t, reel.reduced);
      advance(grids[z === 8 ? 2 : 1], step);
      farBase(cols, rows, cam, z, step, t);
      skyTables(cols, rows, z);
      if (farLitKey !== key) {
        farLitKey = key;
        for (let p = 0; p < size; p++) {
          const k = farKind[p];
          if (k !== K_GROUND && k !== K_GREEN && k !== K_CAVE) continue;
          const c = farCol[p], su = farSun[p], fr = lutR[su] + farR[p], fg = lutG[su] + farG[p], fb = lutB[su] + farB[p];
          let r = (c & 255) * (fr < 1.6 ? fr : 1.6) * fade, g = ((c >> 8) & 255) * (fg < 1.6 ? fg : 1.6) * fade, b = ((c >> 16) & 255) * (fb < 1.6 ? fb : 1.6) * fade;
          if (farHalo[p]) {
            const a = farHalo[p] / 255, h = farHaloCol[p];
            r += ((h & 255) * fade - r) * a; g += (((h >> 8) & 255) * fade - g) * a; b += (((h >> 16) & 255) * fade - b) * a;
          }
          farLit[p] = 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
        }
      }
      const fd = fade, drift = (n >> 4) + 97, flick = (n >> 3) + 98;
      for (let vy = 0, p = 0; vy < rows; vy++) {
        const q0 = vy * 4, gy = cam.y + vy, lit = farRow[vy];
        for (let vx = 0; vx < cols; vx++, p++) {
          const k = farKind[p];
          if (k >= K_GROUND || k === K_CAVE) { P[p] = farLit[p]; continue; }
          if (k === K_SKY) {
            const q = q0 + (vx & 3), c = vy >= ridgeMid[vx] ? skyMid[q] : vy >= ridgeFar[vx] ? skyFar[q] : skyRows[q];
            if (lit && farR[p] > 0.002) {
              const r = (c & 255) + farR[p] * 60 * fd, g = ((c >> 8) & 255) + farG[p] * 50 * fd, b = ((c >> 16) & 255) + farB[p] * 30 * fd;
              P[p] = 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
            } else P[p] = c;
            continue;
          }
          const gx = cam.x + vx;
          let r, g, b;
          if (k === K_LIT) {
            const c = farCol[p], fl = reel.reduced ? fd : fd * (0.92 + 0.08 * hash(gx, gy, flick));
            r = (c & 255) * fl; g = ((c >> 8) & 255) * fl; b = ((c >> 16) & 255) * fl;
          } else {
            /* Water shimmers: each cell drifts between shades, and the top takes the sky. */
            const wc = WATER * 12 + ((hash(gx, gy, drift) < 0.5 ? 0 : 1) + (k === K_TOP ? 2 : 0)) * 3;
            r = PAL[wc]; g = PAL[wc + 1]; b = PAL[wc + 2];
            if (k === K_TOP) { r = r * 0.6 + skyHor[0] * 0.4; g = g * 0.6 + skyHor[1] * 0.4; b = b * 0.6 + skyHor[2] * 0.4; }
            const su = farSun[p], fr = lutR[su] + farR[p], fg = lutG[su] + farG[p], fb = lutB[su] + farB[p];
            r *= (fr < 1.6 ? fr : 1.6) * fd; g *= (fg < 1.6 ? fg : 1.6) * fd; b *= (fb < 1.6 ? fb : 1.6) * fd;
          }
          P[p] = 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
        }
      }
      if (t > T_NIGHT) stars(P, cols, rows, t);
      clouds(P, cols, rows, t, null, cam);
      if (!LITTLE) for (let p = 0; p < size; p++) { const o = P[p]; P[p] = ((o & 255) << 24) | (((o >> 8) & 255) << 16) | (((o >> 16) & 255) << 8) | 255; }
      paintLifeFar(t, z);
      paintMarks(t, z);
      nearPic = null;
    }

    /* A firefly seen from far off: a bright point r cells across each way in a soft halo two and a half times that.
       x and y in valley grains. */
    function glowDot(x, y, a, r) {
      const cx = x * camS - camX, cy = y * camS - camY, o = Math.ceil(r * 2.5), x0 = Math.floor(cx) - o, y0 = Math.floor(cy) - o;
      for (let j = y0; j <= y0 + 2 * o; j++) {
        for (let i = x0; i <= x0 + 2 * o; i++) {
          const d = Math.sqrt(sq(i + 0.5 - cx) + sq(j + 0.5 - cy));
          if (d < r) plot(i, j, FLY, a);
          else if (d < r + 0.5) plot(i, j, FLY, a * 0.7);
          else if (d < r * 2.5) plot(i, j, FLY, a * 0.32 * sq(1 - d / (r * 2.5)));
        }
      }
    }

    /* The bird, the bees and the fireflies come and go. None of them touches a grain. */
    function lifeAt(t) {
      if (bird === null && t >= T_BIRD - 0.9 && plant) {
        /* It lands on the top of the crown over the stem, not in among the leaves. */
        const lv = win, S = lv.S, x = plant.top % lv.w;
        let y = (plant.top / lv.w) | 0;
        for (let r = Math.max(1, y - 5 * S); r < y; r++) {
          const i = r * lv.w + x;
          if (lv.FL[i - 1] || lv.FL[i] || lv.FL[i + 1]) { y = r; break; }
        }
        bird = { x: PX + lv.px0 + (x + 0.5) / S, y: PY + lv.py0 + y / S, at: T_BIRD - 0.9 };
      }
      /* Three bees, coming in from the right about a second apart. */
      if (t >= T_REEDS - 0.5 + 1.1 * bees.length && bees.length < 3 && look() < 0.15) bees.push({ x: PX + 170 + look() * 10, y: PY + 10 + look() * 12, to: -1, at: t });
      if (t >= T_GOLD - 0.4 && fireflies.length < 10 && look() < 0.08) {
        const lv = win, x = 70 + Math.floor(look() * 76), f = fcol(lv, x) + (lv.S >> 1);
        fireflies.push({ x: PX + x + 0.5, y: PY + lv.py0 + topOf(lv, f) / lv.S - 2, ph: look() * 6.28, sp: 0.6 + look() * 0.8 });
      }
    }

    /* The bird, the bees and the fireflies at x2; the valley's fireflies further out; the creature. */
    function paintLifeFar(t, z) {
      if (z <= 2) {
        if (bird) {
          const u = clamp((t - bird.at) / 0.9, 0, 1);
          birdShape(bird.x + (1 - u) * 60, bird.y - (1 - u) * 24 * (1 - u), u >= 1, (n >> 2) & 1);
        }
        for (let k = 0; k < bees.length; k++) beeShape(bees[k].x, bees[k].y + Math.sin(t * 9 + k) * 1.2, reel.reduced ? 0 : (n >> 1) & 1);
        for (let k = 0; k < fireflies.length; k++) {
          const f = fireflies[k], on = reel.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2.2 * f.sp + f.ph), at = flyAt(f, t);
          if (on > 0.25) glowDot(at[0], at[1], Math.min(1, on), 1.9);
        }
      } else if (t >= T_X4) {
        const d = DAYS[dayStepAt(t, reel.reduced)];
        for (let k = 0; k < flies.length; k += 4) {
          if (flies[k + 2] > d) continue;
          const ph = flies[k + 3] / 159, on = reel.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 1.9 + ph);
          if (on > 0.35) glowDot(flies[k] + 6 * Math.sin(t * 0.4 + ph), flies[k + 1] + 4 * Math.sin(t * 0.3 + ph * 2), Math.min(0.85, on) * (z === 8 ? 0.7 : 1), z === 8 ? 1.3 : 1.6);
        }
      }
      if (z <= 4) { paintYouNear(); return; }
      /* At x8 the creature is two cells by two: its back, and its pale belly under it. */
      const x0 = Math.floor((PX + you.x + 1) * camS) - camX, y1 = Math.floor((PY + you.y + 1) * camS) - 1 - camY;
      plot(x0, y1 - 1, CRE_BODY); plot(x0 + 1, y1 - 1, CRE_BODY); plot(x0, y1, CRE_BELLY); plot(x0 + 1, y1, CRE_BELLY);
    }

    /* The grains of the word drift down through the dark, slowly, like silt through still water, and settle. Each is
       a cell. */
    function paintLogo(rgba, cols, rows, cam, t) {
      const P = new Uint32Array(rgba.buffer, rgba.byteOffset, cols * rows);
      P.fill(LITTLE ? 0xff0b0d10 : 0x100d0bff);
      const l = logos[cols >= LOGO_MIN_COLS ? 0 : 1], top = Math.min(cam.y, 0) - 2 * Q;
      const end = 1 - smooth(T_END - 0.5, T_END, t);
      for (let k = 0; k < l.n; k++) {
        const i = l.order[k], dt = t - T_LOGO - l.begin[i];
        if (dt <= 0) continue;
        const u = dt >= LOGO_FALL ? 1 : dt / LOGO_FALL, ease = 1 - (1 - u) * (1 - u);
        const vy = Math.round(top + (l.ys[i] - top) * ease) - cam.y;
        const vx = l.xs[i] + (u < 1 ? Math.round(1.6 * Q * (1 - u) * Math.sin(dt * 5 + l.sway[i])) : 0) - cam.x;
        if (vx < 0 || vx >= cols || vy < 0 || vy >= rows) continue;
        const tint = l.tint[i] * end * (u < 1 ? 0.75 : 1), q = (vy * cols + vx) * 4;
        rgba[q] = l.col[i * 3] * tint + 16 * (1 - end);
        rgba[q + 1] = l.col[i * 3 + 1] * tint + 13 * (1 - end);
        rgba[q + 2] = l.col[i * 3 + 2] * tint + 11 * (1 - end);
      }
    }

    /* One RGBA pixel per cell, for the film as it stands now. Nothing here changes the world. */
    function paint(rgba, cols, rows, cam) {
      const t = n / 60, mode = t < T_LOGO ? 'world' : 'logo';
      if (!cam || cam.mode !== mode) cam = frame(t, cols, rows).cam;
      if (mode === 'logo') paintLogo(rgba, cols, rows, cam, t);
      else if (cam.z <= 1) paintNear(rgba, cols, rows, cam, t);
      else paintFar(rgba, cols, rows, cam, t);
    }

    /* The bees go from flower to flower. */
    function fly(t) {
      const lv = win;
      for (let k = 0; k < bees.length; k++) {
        const b = bees[k];
        if (b.to < 0 || look() < 0.01) {
          let best = -1;
          for (let tries = 0; tries < 40; tries++) {
            const x = fcol(lv, 40) + Math.floor(look() * 110 * lv.S);
            for (let y = 0; y < lv.h; y++) {
              const f = lv.FL[y * lv.w + x];
              if (f === FLOWER || f === BLOSSOM) { best = y * lv.w + x; break; }
            }
            if (best >= 0) break;
          }
          b.to = best;
        }
        if (b.to >= 0) {
          const tx = PX + lv.px0 + (b.to % lv.w + 0.5) / lv.S, ty = PY + lv.py0 + ((b.to / lv.w) | 0) / lv.S - 1;
          b.x += clamp(tx - b.x, -0.6, 0.6); b.y += clamp(ty - b.y, -0.4, 0.4);
        } else { b.x -= 0.4; }
      }
    }

    /* The first frames of any code are its slowest. This takes them now, a little at a time, and not on the film's
       hardest cut: the spring is opened so that water runs, the cut to the window is made with it running, and each
       near scene is drawn at the film's own size and at one a little wider than the fine ground. */
    function* warming(judge, size) {
      const pc = size ? size[0] : VW, pr = size ? size[1] : VH;
      const cw = Math.max(close.w + 16, pc), rh = Math.max(win.h + 16, pr), buf = new Uint8ClampedArray(cw * rh * 4);
      const draw = (c, r) => paint(buf, c, r, frame(n / 60, c, r).cam);
      /* The opening at the size the page asked for, each picture painted again and the repeats timed: what painting
         costs this device with nothing new to colour, as for most of the film's pictures. Times are added up, so a
         coarse clock evens out. */
      function* opening() {
        let ms = 0;
        for (let k = 0; k < 6; k++) {
          n = Math.round((2.5 + 1.3 * k) * 60);
          const cam = frame(n / 60, pc, pr).cam;
          paint(buf, pc, pr, cam);
          if (k < 2) { yield; continue; }
          const a = clock(); paint(buf, pc, pr, cam); paint(buf, pc, pr, cam); ms += clock() - a;
          yield;
        }
        return ms / 8 / (pc * pr);
      }
      /* Small pictures first, so the drawing is made ready on something quick. */
      n = Math.round(T_DIG * 60);
      for (let k = 1; k <= 8; k++) { draw(Math.round(VW * k / 8), Math.round(VH * k / 8)); yield; }
      const early = yield* opening();
      /* A splash of water over the slope, so the water's rules are ready before the spring bursts. Then the same splash
         twice more, the second time with the code ready, and timed: how long this device takes to work out running
         water, a tick at a time. */
      n = Math.round(T_DIG * 60);
      const splash = () => {
        for (let y = frow(close, 18); y < frow(close, 20); y++) for (let x = fcol(close, 66); x < fcol(close, 86); x++) put(close, y * close.w + x, WATER);
      };
      splash();
      for (let k = 0; k < 40; k++) { tick(); yield; }
      const took = [];
      for (let k = 0; k < 64; k++) {
        if (k === 0 || k === 32) splash();
        const a = clock();
        tick();
        if (k >= 32 && k < 32 + PACE_TICKS) took.push(clock() - a);
        yield;
        if ((k & 7) === 7) { draw(VW, VH); yield; draw(cw, rh); yield; }
      }
      /* A tick held up by something else on the device counts as twice the middle one: these ticks differ by less
         than that among themselves. */
      const mid = took.slice().sort((p, q) => p - q)[PACE_TICKS >> 1];
      let ticks = 0;
      for (let k = 0; k < PACE_TICKS; k++) ticks += Math.min(took[k], 2 * mid);
      /* Milliseconds of ticks for the spring's busiest second, and to paint a cell of a picture. */
      reel.pace = { burst: ticks / PACE_TICKS * BURST, paint: early };
      /* A device too slow for that stops here. */
      if (judge && !judge(reel.pace)) { reel.slow = true; reset(); return; }
      n = Math.round(T_ONE * 60) - 1;
      for (let k = 0; k < 24; k++) { tick(); yield; if ((k & 3) === 3) { draw(VW, VH); yield; draw(cw, rh); yield; } }
      /* The cut and the long views' pooling happen once a play, so they are made a few more times here, with a little
         of everything they will meet scattered about first. */
      const scatter = (lv) => {
        for (let k = 0; k < 4000; k++) {
          const i = Math.floor(look() * lv.n), m = lv.M[i];
          if (m === AIR) lv.FL[i] = [GRASS, FLOWER, REED, LEAF, STEM, BLOSSOM][k % 6];
          else if (m !== WATER && k % 3 === 0) lv.M[i] = [BRICK, SEED, CLAY, WATER, BRICK, CLAY, FINE][k % 7];
          else if (m !== WATER && k % 5 === 1) lv.FL[i] = ROOT;
          lv.MO[i] = k & 255;
        }
      };
      scatter(close);
      for (let k = 0; k < 3; k++) { bake(); yield; }
      /* Out through the long views a tick at a time, as the film goes, so that each day's work comes in its own slice.
         Each long view is drawn small first, and the window's picture at x2 a few rows at a time. */
      scatter(win);
      for (let m = 0; m < NMAT; m++) for (let f = 0; f < NFLO; f++) { colourOf(m, f, m * 7 + f, f, m * 15, true); colourOf(m, f, f, m, 0, false); }
      /* The x2 picture is made ahead of the cut over the last half second, so that is done here too. */
      n = Math.round((T_X2 - 0.4) * 60);
      for (let k = 0; k < 18; k++) { draw(VW, VH); yield; }
      n = Math.round(T_X2 * 60) - 1;
      tick(); yield;
      draw(VW, VH); yield;
      for (const d of [DAYS[2], DAYS[6], DAYS[0]]) for (let cy = 0; cy < WIN2_H; cy++) { winRow(cy, d); if ((cy & 7) === 7) yield; }
      winStep = 0;
      for (let k = 0; n < (T_X8 + 0.5) * 60; k++) {
        if (n === Math.round(T_X2 * 60) || n === Math.round(T_X4 * 60) || n === Math.round(T_X8 * 60)) {
          for (let j = 1; j <= 8; j++) { draw(Math.round(VW * j / 8), Math.round(VH * j / 8)); yield; }
          draw(cw, rh); yield;
        }
        tick(); yield;
        if (k % 20 === 0) { draw(VW, VH); yield; }
      }
      /* Night, with its stars, and the fade to black, where the light changes every picture. */
      for (const t of [T_NIGHT + 0.6, T_DARK + 0.3, T_DARK + 0.4, T_DARK + 0.5]) { n = Math.round(t * 60); tick(); yield; draw(VW, VH); yield; }
      n = Math.round((T_LOGO + 1) * 60);
      draw(VW, VH); yield;
      for (let k = 0; k < 3; k++) { poolWindow(); yield; }
      reset();
    }
    function warmUp() { finish(warming()); }

    const reel = {
      get t() { return n / 60; },
      reduced: false,
      reset, frame, paint, warm: warmUp,
      tick() { tick(); if (!(n & 1)) { lifeAt(n / 60); fly(n / 60); } },
      /* For tests: the valley's live cells, the fine ground the film is in now, and how far the script has got. */
      world: { W, H, M, FL, MO, PX, PY },
      get level() { return levelAt(n / 60); },
      levels: { close, win },
      get you() { return you; },
      get plant() { return plant; },
      get built() { return built; },
      get scooped() { return scooped; },
      get firstClay() { return firstClay; },
      get growing() { return growing(n / 60); },
      get reeds() { return reeds.length; },
      get seedAt() { return seedAt; }
    };
    reel.prepare = prepare;
    reel.warming = warming;
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

  /* The world, then a run through the film so the browser has made its code quick before the first play. A device
     that was slow to make the world skips that: it would take longer than it saves. */
  function* everything(seed, slow, judge, size) {
    const world = yield* buildWorld();
    world.levels = [yield* buildLevel(CLOSE), yield* buildLevel(NEAR)];
    const reel = makeReel(world, seed);
    yield* reel.prepare();
    reel.reset(seed);
    reel.warmed = !(slow && slow());
    if (reel.warmed) yield* reel.warming(judge, size);
    reel.reset(seed);
    return reel;
  }

  const SiltReel = {
    /* Everything at once, for tests and tools. */
    create(options) {
      const o = options || {};
      return finish(everything(o.seed || 1));
    },

    /* The same, spread over tasks of about `slice` ms so the page keeps moving. The next task is asked for through
       a message where there is one, which comes round sooner than a timer. The work's own time, not counting the
       gaps, is kept on the reel: how long the world took (`buildMs`), and all of it (`loadMs`). `onBusy` is called
       if making the world, before the warm-up, takes more than `busy` ms. Once the warm-up has timed the device (painting
       pictures `size` cells, columns and rows), `keeps(pace)` is asked whether it can keep up; if not, the warm-up
       stops there and the reel is marked `slow`.
       Making it ends without a word as soon as `stop()` says so. */
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

    /* The film's words and timing with no world behind them, for laying out a page before the world exists.
       frame() works on it. tick() and paint() do not. */
    words() { return makeReel({ M0: null, SH: null, MO0: null, FIN: null, FLF: null, BM: null, BF: null, surf: null, flies: null, levels: null }, 1); },

    /* A seed that has been checked against the script. Each one plays differently. */
    pickSeed(x) {
      let s = 1 + Math.floor(x * SEEDS) % SEEDS;
      while (LEFT_OUT.indexOf(s) >= 0) s = s % SEEDS + 1;
      return s;
    },

    VW, VH, Q, COLORS, KEYS, SLOW_BUILD,
    T: {
      LAND: T_LAND, PICK: T_PICK, SOW: T_SOW, DIG: T_DIG, OPEN: T_OPEN, ONE: T_ONE, CLAY: T_CLAY, SCOOP: T_SCOOP,
      BRICK: T_BRICK, REEDS: T_REEDS, BIRD: T_BIRD, GOLD: T_GOLD, X2: T_X2, X4: T_X4, X8: T_X8, RINGS: T_RINGS,
      NIGHT: T_NIGHT, DARK: T_DARK, LOGO: T_LOGO, WORDS: T_WORDS, LAST: T_LAST, END: T_END
    },
    MAT: { AIR, STONE, SOIL, SILT, FINE, WATER, CLAY, BRICK, SEED, WOOD, LAMP, FUNGUS, SAND },
    FLORA: { STEM, LEAF, GRASS, FLOWER, REED, ROOT, BLOSSOM, BUSH, CROP },
    PATCH: { x: PX, y: PY, wall: WALL, sow: SOW_X },
    LEVELS: { CLOSE, NEAR }
  };

  if (typeof module === 'object' && module.exports) module.exports = SiltReel;
  else root.SiltReel = SiltReel;
})(typeof self !== 'undefined' ? self : this);
