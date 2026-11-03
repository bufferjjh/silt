/* Exhibit C. One seed, at actual size: one grain is --grain CSS px, a whole number of device pixels.
   When the plinth comes into view it grows, by a few simple rules thrown with fresh dice on every visit:
   a root goes down and branches, a stem goes up with a little sway, leaves open at its nodes, and a flower
   opens at the top. The seed's light goes into the flower. About ten seconds, once, and then it stays.
   Without JavaScript the single grain stays where it is. */
(function () {
  'use strict';

  const plinth = document.getElementById('seed-plinth');
  const grain = document.getElementById('seed-grain');
  const tag = document.getElementById('seed-tag');
  if (!plinth || !grain || !tag) return;
  const canvas = document.createElement('canvas');
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { /* No canvas. The seed stays a seed. */ }
  if (!ctx) return;

  const GRAIN = 3; /* CSS px, before snapping to device pixels. */
  const HALF = 20; /* Grains either side of the seed the drawing may use. */
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Clay, dusk and lantern: the same grains as the cross-section. */
  const C = {
    lamp: '#FFD49A', glow: ['#F2A24A', '#FBC66A', '#FFE09A', '#FFF6DC'],
    stem: ['#58673A', '#6C7C43', '#83924F'], leaf: ['#2D4C37', '#3B5F42', '#527651', '#668458'],
    root: ['#3D2A20', '#52382A', '#6A4934', '#845D42'], tip: '#A4876A', coat: '#845D42'
  };

  /* ---- The plant, as grains placed at moments. y is up from the seed, so the stem has negative y. ---- */

  function plant(rand) {
    const ri = (n) => Math.floor(rand() * n);
    const cells = []; /* [x, y, colour, seconds] */
    const at = new Map();
    function put(x, y, c, t) {
      const k = x + ',' + y;
      if (at.has(k) || Math.abs(x) > HALF - 1) return;
      at.set(k, 1);
      cells.push([x, y, c, t]);
    }

    /* A root down, wandering a little and coming back, with a branch or two. */
    const rootLen = 15 + ri(6);
    let rx = 0, t = 0.65;
    const branchAt = [];
    for (let n = 0; n < 1 + ri(2); n++) branchAt.push(4 + ri(rootLen - 8));
    for (let k = 1; k <= rootLen; k++) {
      if (k > 2 && rand() < 0.32) rx += rx > 1 ? -1 : rx < -1 ? 1 : (rand() < 0.5 ? -1 : 1);
      put(rx, k, k === rootLen ? C.tip : C.root[k < rootLen * 0.45 ? 2 : 1], t);
      if (branchAt.indexOf(k) >= 0) {
        const s = rand() < 0.5 ? -1 : 1, len = 3 + ri(5);
        let bx = rx, by = k, bt = t + 0.3;
        for (let j = 1; j <= len; j++) {
          if (rand() < 0.75) bx += s;
          if (j > 1 || rand() < 0.5) by += 1;
          put(bx, by, j === len ? C.tip : C.root[1], bt);
          bt += 0.24;
        }
      }
      t += 0.19;
    }

    /* A stem up, with a slow sway; leaves at its nodes, on alternating sides. */
    const height = 21 + ri(7);
    const sway = 0.8 + rand() * 1.4, phase = rand() * Math.PI * 2, turns = 0.6 + rand() * 0.7;
    let sx = 0, side = rand() < 0.5 ? -1 : 1, nextNode = 5 + ri(2);
    t = 1.35;
    const stem = [];
    for (let k = 1; k <= height; k++) {
      const want = Math.round(sway * (Math.sin(phase + k / height * Math.PI * turns) - Math.sin(phase)));
      if (want > sx) sx++;
      else if (want < sx) sx--;
      stem.push([sx, -k, t]);
      put(sx, -k, C.stem[k < height * 0.3 ? 0 : k < height * 0.75 ? 1 : 2], t);
      if (k === 2) {
        /* The first pair of leaves, small and pale, that came folded in the seed. */
        put(sx - 1, -3, C.leaf[3], t + 0.3); put(sx - 2, -3, C.leaf[3], t + 0.45);
        put(sx + 1, -3, C.leaf[3], t + 0.3); put(sx + 2, -3, C.leaf[3], t + 0.45);
      }
      if (k === nextNode && k < height - 4) {
        const L = k < height * 0.5 ? 5 + ri(3) : 4 + ri(2);
        let lt = t + 0.4;
        for (let j = 1; j <= L; j++) {
          const lift = Math.floor(j * 0.45);
          put(sx + side * j, -k - lift, j === L ? C.leaf[3] : C.leaf[2], lt);
          if (j > 1 && j < L - 1) put(sx + side * j, -k - lift + 1, C.leaf[1], lt + 0.12);
          lt += 0.16;
        }
        side = -side;
        nextNode += 4 + ri(3);
      }
      t += 0.235;
    }

    /* A bud, then one flower: the warm light the seed held. */
    const top = stem[stem.length - 1];
    const fx = top[0], fy = top[1] - 3;
    put(fx, fy + 2, C.stem[2], t + 0.1);
    put(fx, fy + 1, C.stem[2], t + 0.35);
    const open = t + 1.1;
    /* Three kinds of flower: open and round, a cup, a star. Inner petals in lamp light, outer ones deeper. */
    const shapes = [
      [[0, -1, 2], [-1, 0, 2], [1, 0, 2], [0, 1, 2], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1], [-2, 0, 1], [2, 0, 1], [0, -2, 1], [-2, -1, 0], [2, -1, 0]],
      [[-1, 0, 2], [1, 0, 2], [0, 1, 2], [-1, -1, 2], [1, -1, 2], [-2, -1, 1], [2, -1, 1], [-2, -2, 1], [0, -2, 1], [2, -2, 1], [-1, 1, 1], [1, 1, 1]],
      [[0, -1, 2], [-1, 0, 2], [1, 0, 2], [0, 1, 2], [-2, -2, 1], [2, -2, 1], [-2, 2, 1], [2, 2, 1], [0, -2, 1], [-2, 0, 1], [2, 0, 1], [-1, -1, 1], [1, -1, 1]]
    ];
    const petals = shapes[ri(shapes.length)];
    petals.forEach((p, n) => {
      put(fx + p[0], fy + p[1], p[2] === 2 ? C.lamp : C.glow[p[2] === 1 ? 1 : 0], open + (2 - p[2]) * 0.45 + n * 0.03);
    });
    put(fx, fy, C.glow[3], open + 1.2);
    return { cells, done: open + 1.6 };
  }

  /* ---- Drawing ---- */

  let shape = null, elapsed = 0, state = 'seed', inView = false, raf = 0, last = 0, geo = null;

  /* Whole device pixels per grain, and the seed's own device pixel, so the drawing lands on the grain. */
  function measure() {
    const dpr = window.devicePixelRatio || 1;
    const K = Math.max(1, Math.round(GRAIN * dpr));
    const box = plinth.getBoundingClientRect(), g = grain.getBoundingClientRect();
    const sx = Math.round((g.left + window.scrollX) * dpr), sy = Math.round((g.top + window.scrollY) * dpr);
    const px = (box.left + window.scrollX) * dpr, py = (box.top + window.scrollY) * dpr;
    const left = sx - HALF * K, cols = HALF * 2 + 1;
    const up = Math.floor((sy - py) / K), down = Math.floor((py + box.height * dpr - sy) / K) - 1;
    return { dpr, K, cols, up, down, left, top: sy - up * K, px, py };
  }

  function place() {
    geo = measure();
    const s = canvas.style;
    canvas.width = geo.cols * geo.K;
    canvas.height = (geo.up + geo.down + 1) * geo.K;
    s.left = (geo.left - geo.px) / geo.dpr + 'px';
    s.top = (geo.top - geo.py) / geo.dpr + 'px';
    s.width = canvas.width / geo.dpr + 'px';
    s.height = canvas.height / geo.dpr + 'px';
  }

  function draw() {
    if (!geo) return;
    const K = geo.K, ox = HALF, oy = geo.up;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cell = (x, y, c) => {
      if (y + oy < 0 || y + oy > geo.up + geo.down) return;
      ctx.fillStyle = c;
      ctx.fillRect((x + ox) * K, (y + oy) * K, K, K);
    };
    if (!shape) { cell(0, 0, C.lamp); return; }
    cell(0, 0, elapsed < 0.5 ? C.lamp : C.coat);
    const cs = shape.cells;
    for (let n = 0; n < cs.length; n++) if (cs[n][3] <= elapsed) cell(cs[n][0], cs[n][1], cs[n][2]);
  }

  function label(text) { canvas.setAttribute('aria-label', text); }

  function finish() {
    state = 'grown';
    elapsed = shape.done;
    tag.textContent = 'Grown in your browser';
    label('A small plant grown from one seed, at actual size: a root, a stem, leaves and one flower.');
    draw();
  }

  function frame(now) {
    raf = 0;
    if (state !== 'growing' || !inView || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    if (elapsed >= shape.done) { finish(); return; }
    draw();
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (state === 'growing' && inView && !document.hidden && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function begin() {
    if (state !== 'seed') return;
    shape = plant(Math.random);
    canvas.setAttribute('role', 'img');
    plinth.appendChild(canvas);
    place();
    grain.style.visibility = 'hidden';
    grain.setAttribute('aria-hidden', 'true');
    if (reduced) { finish(); return; }
    state = 'growing';
    tag.textContent = 'Grows in your browser';
    label('One seed, at actual size, growing into a small plant.');
    draw();
    kick();
  }

  if (reduced || !('IntersectionObserver' in window)) {
    inView = true;
    begin();
  } else {
    new IntersectionObserver((es) => {
      inView = es[es.length - 1].isIntersecting;
      if (inView) begin();
      kick();
    }, { threshold: 0.6 }).observe(plinth);
  }
  document.addEventListener('visibilitychange', kick);
  let queued = 0;
  window.addEventListener('resize', () => {
    if (queued || !canvas.parentNode) return;
    queued = requestAnimationFrame(() => { queued = 0; place(); draw(); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (canvas.parentNode) { place(); draw(); } });
})();
