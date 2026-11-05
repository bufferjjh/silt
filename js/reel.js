/* Exhibit A, drawn live. reel-core.js decides what is on screen; this puts it there: a canvas with one pixel
   per grain, shown at a whole number of device pixels, about two CSS pixels, and every word as real text on the
   page's own grid. The picture's grain has nothing to do with the type's: words keep to the grid, grains to the pixels.
   The soundtrack is the clock while it plays. If any of this stops working, film.js carries on with the
   video from the same moment. */
(function () {
  'use strict';

  const Core = window.SiltReel;
  const root = document.documentElement;
  const box = document.getElementById('film-box');
  const video = document.getElementById('film');
  const film = box && box.querySelector('.film');
  if (!Core || !film || !video) return;

  const canvas = document.createElement('canvas');
  let ctx = null;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch (e) { /* No canvas, no stage. */ }
  if (!ctx) return;

  const T = Core.T, VW = Core.VW, VH = Core.VH, Q = Core.Q, COLORS = Core.COLORS, KEYS = Core.KEYS;
  const SOUND = 'assets/silt-film.m4a';
  /* The still is the film's whole world near the end of its last working view, the place grown at dusk, one pixel per
     cell: this many cells across. It is drawn where that view's picture sits. */
  const STILL_SRC = 'assets/film-still.png', STILL_T = 51.5;
  const STILL_W = 691;
  const NAME = 'Silt, a 60-second concept film with sound, drawn grain by grain: a small floating creature tends one bare ' +
    'patch of ground, the water finds its way down to a wheel it builds, and the place grows into the cross-section below.';
  const NAME_SILENT = NAME.replace(' with sound', '');
  const HOLD = 59.4; /* The end card, before the film fades. It stays up after this. */
  const END_CARD = 59.0; /* Where the video picks up an ended film. */
  const WAIT_FOR_SOUND = 2000;
  const WAIT_FOR_WORLD = 10000; /* After a press. Longer than this, the device won't keep up anyway. */
  /* Milliseconds of work the world took to make, past which the device is far too slow for the film (a fast desktop
     takes about 300). It gets the video from the start rather than a picture that falls behind the sound. */
  const TOO_SLOW = Core.SLOW_BUILD;
  /* Under that, the warm-up times the device on the film's own work. Its busiest second, where the spring bursts, has
     to fit in this share of a second, drawing at least this many pictures in it. The timing is set for the worst
     seed and errs on the slow side, so a device that only just fits still keeps up. */
  const KEEP_UP = 1, BURST_DRAWS = 15;
  /* The picture on screen this many seconds behind the sound for LATE_FOR ms, or twice as far at all: the device
     can't keep up, and the video takes over. */
  const LATE = 0.15, LATE_FOR = 400;
  /* Taking over in the middle, the video is asked for its frame this far ahead of the sound, and is started this
     much before the sound gets there, for the time it takes to get going. Ready only after the sound has passed,
     it runs up to CATCH_UP times as fast until it is level. Past HAND_WAIT ms it takes over anyway. */
  const HAND_LEAD = 0.8, START_LAG = 0.04, CATCH_UP = 3, HAND_WAIT = 6000;
  const SOUND_LATE = 3000; /* Running this long with no sound yet, the button says so. */
  const NARROWEST = 96 * Q; /* Columns. Fewer would crowd the patch. */
  const TALLEST = 112 * Q; /* Rows. More than this is mostly dark rock. */
  const SMALLEST_GRAIN = 1, BIGGEST_GRAIN = 3; /* CSS pixels. Under one the world is too small to read; over three, too coarse. */
  const MOUSE_GRAIN = 1.5; /* CSS pixels. With a mouse, the screen is far enough off that smaller is only taken if nothing else fits. */
  const WIDE_FROM = 0.8, WIDE_TO = 1.4; /* The share of the film's width a grain should show. */
  const STEP = 1 / 60;

  const motion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---- The script, read once for its words ---- */

  /* All the words the film will ever show, so that rows can be reserved before any of them appear. */
  let words = null, script = null;

  function scan() {
    const s = { tag: '', left: '', rights: [], ones: [], twos: [], pairs: [], caps: [], end: null };
    const add = (list, text) => { if (text && list.indexOf(text) < 0) list.push(text); };
    words.reduced = true;
    for (let f = 0; f < T.END * 10; f++) {
      const v = words.frame(f / 10);
      s.tag = v.title.right;
      if (v.ticker) {
        if (v.ticker.left.length > s.left.length) s.left = v.ticker.left;
        add(s.rights, v.ticker.right);
      }
      if (v.pane) {
        add(s.ones, v.pane.one);
        add(s.twos, v.pane.two);
        if (!s.pairs.some((p) => p[0] === v.pane.one && p[1] === v.pane.two)) s.pairs.push([v.pane.one, v.pane.two]);
      }
      if (v.caption) add(s.caps, v.caption.text);
      if (v.end) s.end = v.end;
    }
    words.reduced = false;
    return s;
  }

  /* Rows of text, with the breaks worked out here rather than by the browser, so that a word being typed at
     the end of a row is already on the row it finishes on. A word longer than the row gets cut. */
  function wrap(text, width, hang) {
    const lines = [];
    hang = hang || 0;
    width = Math.max(4, width);
    let at = 0, w = width;
    while (at < text.length) {
      const end = at + w, pad = lines.length ? hang : 0;
      if (end >= text.length) { lines.push({ at, end: text.length, pad }); break; }
      let cut = text.lastIndexOf(' ', end);
      if (cut <= at) cut = end;
      lines.push({ at, end: cut, pad });
      at = cut;
      while (text[at] === ' ') at++;
      w = Math.max(4, width - hang);
    }
    return lines;
  }

  /* As few rows as the width allows, then as even as they will go. For centred lines. */
  function even(text, width) {
    const n = wrap(text, width).length;
    if (n === 1) return wrap(text, width);
    let w = width;
    while (w > 8 && wrap(text, w - 1).length === n) w--;
    return wrap(text, w);
  }

  function shown(text, line, typed) {
    const n = Math.min(line.end, typed) - line.at;
    if (n <= 0) return '';
    return ' '.repeat(line.pad) + text.slice(line.at, line.at + n) + (typed > line.end ? ' ' : '');
  }

  /* The whole string a typed one is on its way to. */
  function goal(list, typed, was) {
    if (!typed) return '';
    if (was && was.startsWith(typed)) return was;
    for (let i = 0; i < list.length; i++) if (list[i].startsWith(typed)) return list[i];
    return typed;
  }

  /* ---- The page ---- */

  function make(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function setText(e, text) {
    if (e.$text !== text) { e.$text = text; e.textContent = text; }
  }
  function setColor(e, color) {
    if (e.$color !== color) { e.$color = color; e.style.color = color; }
  }
  function setRows(e, n) {
    if (e.$rows !== n) { e.$rows = n; e.style.setProperty('--r', n); }
  }

  const ctl = document.getElementById('film-ctl');
  const cue = document.getElementById('film-cue');
  const bPlay = document.getElementById('film-play');
  const bMute = document.getElementById('film-mute');
  const bFull = document.getElementById('film-full');
  const time = document.getElementById('film-time');

  let reelEl, bar, barLeft, barRight, tick, tickLeft, tickRight, tickMore, pic, still, labelsEl;
  let pane, keys, keyEls, cap, capLines, endOne, probe;

  function build() {
    reelEl = make('div', 'reel still-on');
    bar = make('div', 'reel-bar', reelEl);
    barLeft = make('span', 'l', bar);
    barRight = make('span', 'r', bar);
    tick = make('div', 'reel-tick', reelEl);
    const tickRow = make('span', 'ln row', tick);
    tickLeft = make('span', 'l', tickRow);
    tickRight = make('span', 'r', tickRow);
    tickMore = make('span', 'more', tick);
    pic = make('div', 'reel-pic', reelEl);
    pic.setAttribute('role', 'img');
    pic.setAttribute('aria-label', NAME);
    still = new Image();
    still.addEventListener('load', safely(() => { if (stillOn) drawStill(); }));
    still.src = STILL_SRC;
    pic.appendChild(canvas);
    labelsEl = make('div', 'reel-labels', pic);
    pane = make('div', 'reel-pane', reelEl);
    keys = make('div', 'reel-keys', reelEl);
    keys.setAttribute('aria-hidden', 'true');
    keyEls = {};
    KEYS.forEach((k) => { keyEls[k[0]] = make('span', '', keys); keyEls[k[0]].textContent = '[' + k[0] + '] ' + k[1]; });
    cap = make('div', 'reel-cap', reelEl);
    cap.setAttribute('aria-atomic', 'true');
    cap.setAttribute('aria-live', 'off');
    endOne = make('span', 'reel-end', cap);
    capLines = make('span', 'lines', cap);
    probe = make('span', 'probe', reelEl);
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = '0000000000';
    film.appendChild(reelEl);
    video.pause();
    video.hidden = true;
    ctl.hidden = false;
    cue.classList.add('on');
  }

  /* ---- Fitting the picture and the type to the box ---- */

  /* Everything that follows from the box's size. */
  let geo = { key: '', g: 1, K: 1, cols: 0, rows: 0, dpr: 1, cw: 9, lh: 27, inner: 0 };
  let image = null;
  let paneLines = [], capEls = [], moreEls = [];
  const heights = {};

  function cssNumber(name) { return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0; }

  function fullElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function isFull() { return box.classList.contains('full'); }

  /* How many rows the text needs at this width, the most it will ever need. */
  function textRows(cols, inner) {
    const tag = script.tag;
    const barBoth = inner >= 16 + 2 + tag.length;
    const barLines = barBoth ? null : wrap(tag, inner);
    const leftRows = wrap(script.left, inner).length;
    let tickRows = leftRows;
    script.rights.forEach((r) => {
      if (leftRows > 1 || script.left.length + 2 + r.length > inner) tickRows = Math.max(tickRows, leftRows + wrap(r, inner).length);
    });
    let paneRows = 2;
    script.pairs.forEach((p) => {
      const n = (p[0] ? wrap(p[0], inner, 2).length : 0) + (p[1] ? wrap(p[1], inner, 2).length : 0);
      paneRows = Math.max(paneRows, n);
    });
    let capRows = 1;
    script.caps.forEach((c) => { capRows = Math.max(capRows, even(c, cols).length); });
    if (script.end) capRows = Math.max(capRows, even(script.end.two, cols).length);
    return { tag, barBoth, barLines, barRows: barBoth ? 1 : barLines.length, tickRows, paneRows, capRows };
  }

  function coarse() { return !!window.matchMedia && matchMedia('(pointer: coarse)').matches; }

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const pageLh = cssNumber('--lh') || 27, pageCw = cssNumber('--cw') || 9;
    const cw = (probe.getBoundingClientRect().width / 10) || pageCw;
    /* Text-only zoom: the type has outgrown the page's cell, so the rows grow with it. */
    const zoomed = cw > pageCw * 1.2;
    const lh = zoomed ? Math.ceil(pageLh * cw / pageCw) : pageLh;
    const fw = film.clientWidth;
    const full = isFull();
    /* A phone's address bar coming and going must not resize anything: a touch screen keeps the first height it had. */
    if (!full && (!heights[fw] || !coarse())) heights[fw] = window.innerHeight;
    const windowH = heights[fw] || window.innerHeight;
    const filmH = full ? film.clientHeight : 0;
    const off = (v) => Math.round(v * dpr) / dpr - v;
    const spot = pic.getBoundingClientRect();
    const key = [fw, lh, cw, dpr, full, filmH, windowH, cssNumber('--film-rows'), stillOn,
      off(spot.left + window.scrollX).toFixed(3), off(spot.top + window.scrollY).toFixed(3)].join();
    if (key === geo.key || !fw) return false;

    const cols = Math.max(12, Math.floor(fw / cw + 0.01));
    const inner = cols - 2;
    const { tag, barBoth, barLines, barRows, tickRows, paneRows, capRows } = textRows(cols, inner);
    const allKeys = inner >= 62;
    /* Very short of height, the keys row gives up its row: the active key goes up on the ticker's. */
    const canLift = inner >= 62 && (tickRows > 1 || inner >= 106);
    let keysUp = false, keyRows = 1, air = 0;
    let chrome = barRows + tickRows + paneRows + keyRows + capRows;

    /* Grains: a whole number of device pixels, from one to three CSS pixels, showing as near the film's own width as
       will go, the smaller grain on a tie. A grain that shows between WIDE_FROM and WIDE_TO of the film's width comes
       before one that doesn't, and with a mouse, one of MOUSE_GRAIN or more before either. A screen too narrow for
       that keeps to the action, at one CSS pixel. */
    const wDev = fw * dpr, mouse = !coarse();
    const rowsOf = (k, n) => Math.ceil(n * (k / dpr) / lh - 0.001);
    const most = Math.max(1, Math.floor(BIGGEST_GRAIN * dpr + 1e-6));
    let K = 0, best = Infinity;
    for (let k = 1; k <= most; k++) {
      const g = k / dpr, across = wDev / k;
      if (g < SMALLEST_GRAIN - 1e-6 || across < NARROWEST) continue;
      const off = Math.abs(Math.log(across / VW)) + (across >= VW * WIDE_FROM && across <= VW * WIDE_TO ? 0 : 10) +
        (mouse && g < MOUSE_GRAIN - 1e-6 ? 20 : 0);
      if (off < best - 1e-9) { best = off; K = k; }
    }
    if (!K) K = Math.min(most, Math.max(1, Math.ceil(SMALLEST_GRAIN * dpr - 1e-6)));
    /* The picture takes the rows the film box has always had, as long as that leaves it this many cells. */
    let need = 48 * Q;
    let picRows, picH;
    if (full) {
      if (canLift && filmH - chrome * lh < need * SMALLEST_GRAIN) { keysUp = true; keyRows = 0; chrome--; }
      if (filmH - (chrome + 1) * lh >= need * (K / dpr)) { air = 1; chrome++; }
      picH = Math.max(lh, filmH - chrome * lh);
      /* A tall screen: bigger grains, rather than a long way down through dark rock, but never over three CSS pixels. */
      K = Math.max(K, Math.min(Math.ceil(picH * dpr / TALLEST), Math.floor(wDev / NARROWEST), most));
      K = Math.max(1, Math.min(K, Math.floor(picH * dpr / need)));
      picRows = picH / lh;
    } else {
      /* The rows the film box has always had, or whole rows of the page enough for `need` cells if that is more. */
      const tier = cssNumber('--fluid') === 1 ? 0 : cssNumber('--film-rows') - chrome;
      /* The rows the window has, less the control row. */
      const fits = Math.floor(windowH / lh) - 1;
      picRows = Math.max(tier, rowsOf(K, need));
      if (chrome + picRows > fits && canLift) { keysUp = true; keyRows = 0; chrome--; }
      if (chrome + picRows > fits) {
        /* A short window: the rows that are left, or that the text-only scenes hold on to, and grains to suit.
           Very short, the picture keeps to the action rather than go on shrinking. If that would still be too
           small to read, the grains stay as they were: smaller would buy nothing. */
        const rows = Math.max(1, fits - chrome);
        need = rows * lh / (64 * Q) >= SMALLEST_GRAIN ? 64 * Q : 48 * Q;
        const k = Math.min(K, Math.floor(rows * lh * dpr / need));
        if (k / dpr >= SMALLEST_GRAIN) {
          K = k;
          picRows = rows;
        }
      }
      /* A row of air between the terminal and the caption, where there is one to spare. */
      if (chrome + picRows < fits) { air = 1; chrome++; }
      picH = picRows * lh;
    }
    /* The still is one fixed size. A picture wider than that takes bigger grains until the film starts. */
    if (stillOn) K = Math.max(K, Math.ceil((wDev + 1) / STILL_W));

    const g = K / dpr;
    const gridCols = Math.ceil((wDev + 1) / K);
    const gridRows = Math.ceil(((picH + (stillOn ? tickRows * lh : 0)) * dpr + 1) / K);
    /* The pane's strip and the keys are empty at the end. Where the picture is short of rows, the word uses them. */
    const spare = (!allKeys || gridRows < VH) && !stillOn ? Math.ceil((paneRows + keyRows) * lh * dpr / K) : 0;

    /* A label is a whole number of grains tall and wide, so it sits in the picture like a cut in the rock. */
    const labelPad = Math.ceil(3 / g) * g;
    const labelH = Math.ceil(lh * 0.66 / g) * g;

    const rowsChanged = !full && geo.boxRows !== chrome + picRows;
    geo = {
      key, dpr, lh, cw, fw, g, K, cols: gridCols, rows: gridRows, spare, chars: cols, inner, picW: fw, picH, labelPad, labelH,
      barBoth, barRows, tickRows, paneRows, capRows, allKeys, keysUp, keyRows, boxRows: chrome + picRows, picRows
    };

    /* A browser's text zoom can scale line heights given in pixels as well, so these ones go by the type's own size. */
    if (zoomed) {
      film.style.setProperty('--lh', lh + 'px');
      root.style.setProperty('--label-lh', labelH / (cw * cssNumber('--fs') / pageCw));
    } else film.style.removeProperty('--lh');
    reelEl.classList.toggle('zoomed', zoomed);
    ctl.classList.toggle('wrap', zoomed);

    /* The rows. */
    setRows(bar, barRows);
    setRows(tick, tickRows);
    setRows(pane, paneRows);
    setRows(cap, capRows + air);
    cap.classList.toggle('air', !!air);
    setText(barLeft, '');
    setText(barRight, barBoth ? tag : barLines.map((l) => tag.slice(l.at, l.end)).join('\n'));
    keys.classList.toggle('only', !allKeys || keysUp);
    reelEl.classList.toggle('keys-up', keysUp);
    keys.style.top = keysUp ? barRows * lh + 'px' : '';
    while (paneLines.length < paneRows) paneLines.push(make('span', 'ln', pane));
    while (paneLines.length > paneRows) pane.removeChild(paneLines.pop());
    while (capEls.length < capRows) capEls.push(make('span', 'ln', capLines));
    while (capEls.length > capRows) capLines.removeChild(capEls.pop());
    while (moreEls.length < tickRows - 1) moreEls.push(make('span', 'ln', tickMore));
    while (moreEls.length > tickRows - 1) tickMore.removeChild(moreEls.pop());


    /* The canvas: one pixel per grain, shown at a whole number of device pixels, from a device pixel. */
    const canvasRows = gridRows + spare;
    if (canvas.width !== gridCols || canvas.height !== canvasRows) {
      canvas.width = gridCols;
      canvas.height = canvasRows;
      image = ctx.createImageData(gridCols, canvasRows);
    }
    const r = pic.getBoundingClientRect();
    geo.dx = off(r.left + window.scrollX);
    geo.dy = off(r.top + window.scrollY);
    canvas.style.width = gridCols * g + 'px';
    canvas.style.height = canvasRows * g + 'px';
    canvas.style.left = geo.dx + 'px';
    canvas.style.top = geo.dy + 'px';
    root.style.setProperty('--label-h', labelH + 'px');
    root.style.setProperty('--label-pad', labelPad + 'px');

    if (rowsChanged) {
      root.style.setProperty('--reel-rows', geo.boxRows);
      document.dispatchEvent(new Event('silt-rows'));
    }
    return true;
  }

  /* ---- Words on the picture ---- */

  const labelPool = [];
  let labelsUsed = 0, folded = {};
  const dropped = {};
  const taken = [];

  function hits(x, y, w, h) {
    for (let i = 0; i < taken.length; i += 4) {
      if (x < taken[i] + taken[i + 2] && x + w > taken[i] && y < taken[i + 1] + taken[i + 3] && y + h > taken[i + 1]) return true;
    }
    return false;
  }

  function putLabel(text, x, y, w, h, color, back) {
    let l = labelPool[labelsUsed];
    if (!l) {
      l = make('span', 'reel-label', labelsEl);
      labelPool[labelsUsed] = l;
    }
    labelsUsed++;
    if (l.hidden) l.hidden = false;
    setText(l, text);
    setColor(l, color);
    if (l.$back !== back) { l.$back = back; l.style.backgroundColor = back || 'transparent'; }
    const left = x + geo.dx, top = y + geo.dy;
    if (l.$x !== left) { l.$x = left; l.style.left = left + 'px'; }
    if (l.$y !== top) { l.$y = top; l.style.top = top + 'px'; }
    if (l.$w !== w) { l.$w = w; l.style.width = w + 'px'; }
    if (l.$h !== h) { l.$h = h; l.style.height = h + 'px'; }
  }

  function grainsUp(px) { return Math.ceil(px / geo.g - 1e-6) * geo.g; }

  /* Somewhere free for a label near where it wants to be: above or below, then along the row, then both. */
  let spotX = 0, spotY = 0;
  function freeSpot(x, y, w, h, W, H) {
    spotX = x; spotY = y;
    if (!hits(x, y, w, h)) return true;
    const at = (a, b) => { if (hits(a, b, w, h)) return false; spotX = a; spotY = b; return true; };
    for (let n = 1; n <= 3; n++) {
      if (at(x, Math.max(0, y - n * h)) || at(x, Math.min(H - h, y + n * h))) return true;
    }
    const step = grainsUp(w / 2);
    for (let n = 1; n <= 8; n++) {
      for (let d = -1; d <= 1; d += 2) {
        const a = x + d * n * step;
        if (a < 0 || a + w > W) continue;
        for (let m = 0; m <= 3; m++) {
          if (at(a, Math.max(0, y - m * h)) || at(a, Math.min(H - h, y + m * h))) return true;
        }
      }
    }
    return false;
  }

  let tickSpare = 0, raised = false;

  function drawLabels(v) {
    const g = geo.g, W = geo.picW, cw = geo.cw, h = geo.labelH, pad = geo.labelPad;
    const H = geo.picH + (stillOn ? geo.tickRows * geo.lh : 0);
    labelsUsed = 0;
    taken.length = 0;

    /* Banners first. They are the moment, and they wrap if they have to. */
    let up = false;
    for (let i = 0; i < v.banners.length; i++) {
      const b = v.banners[i];
      const room = Math.floor((W - 2 * pad) / cw);
      let fold = folded[b.text];
      if (!fold) {
        fold = { text: b.text, longest: b.text.length, rows: 1 };
        if (fold.longest > room) {
          const t = b.text.trim(), lines = even(t, room);
          fold.text = lines.map((l) => t.slice(l.at, l.end)).join('\n');
          fold.rows = lines.length;
          fold.longest = lines.reduce((m, l) => Math.max(m, l.end - l.at), 0);
        }
        folded[b.text] = fold;
      }
      const text = fold.text;
      const w = Math.min(W, grainsUp(fold.longest * cw + 2 * pad)), bh = fold.rows * h;
      const x = Math.max(0, Math.min(b.x * g, W - w));
      let y = Math.max(0, Math.min(b.y * g, H - bh));
      /* A banner takes the ticker's empty row before it takes more of the picture. */
      if (tickSpare > 0 && !stillOn) { y -= tickSpare * geo.lh; up = true; }
      putLabel(text, x, y, w, bh, b.color, b.back);
      taken.push(x, y, w, bh);
    }
    if (up !== raised) { raised = up; reelEl.classList.toggle('banner-up', up); }

    /* A label's backing sits with its bottom on the cell row it is given, so that it stays above what it names. One
       low in the picture hangs from that row instead, below what it names.
       The labels the story names go first. The rest go where they fit, or not at all. */
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < v.labels.length; i++) {
        const l = v.labels[i];
        if (!l.story !== (pass === 1) || dropped[l.text]) continue;
        const w = Math.min(W, grainsUp(l.text.length * cw + 2 * pad));
        let x = Math.max(0, Math.min(l.x * g - pad, W - w));
        /* A line that types stays centred on where it will finish. */
        if (l.center) x = Math.round((W - l.center * cw) / 2 / g) * g - pad;
        const low = l.y > H / g * 0.82;
        const y = Math.max(0, Math.min(low ? l.y * g : l.y * g - h, H - h));
        if (hits(x, y, w, h) && !l.story) { dropped[l.text] = true; continue; }
        freeSpot(x, y, w, h, W, H);
        putLabel(l.text, spotX, spotY, w, h, l.color, l.back);
        taken.push(spotX, spotY, w, h);
      }
    }

    for (let i = labelsUsed; i < labelPool.length; i++) if (!labelPool[i].hidden) labelPool[i].hidden = true;
  }

  /* ---- Everything else that is text ---- */

  let scene = '', hasTick = null, hasPane = null, activeKey = undefined;
  let lastOne = null, lastTwo = null, oneFull = '', twoFull = '', lastCap = null, lastOp = -1, lastRight = null, lastLeft = null;

  function drawPane(p) {
    const on = !!p;
    if (on !== hasPane) { hasPane = on; reelEl.classList.toggle('on-pane', on); }
    const one = p ? p.one : '', two = p ? p.two : '';
    if (one !== lastOne || two !== lastTwo) {
      lastOne = one; lastTwo = two;
      oneFull = goal(script.ones, one, oneFull);
      twoFull = goal(script.twos, two, twoFull);
      const a = wrap(oneFull, geo.inner, 2), b = wrap(twoFull, geo.inner, 2);
      for (let i = 0; i < paneLines.length; i++) {
        if (i < a.length) { setText(paneLines[i], shown(oneFull, a[i], one.length)); setColor(paneLines[i], p.oneColor); }
        else if (i - a.length < b.length) {
          setText(paneLines[i], shown(twoFull, b[i - a.length], two.length));
          setColor(paneLines[i], p.twoColor);
        } else setText(paneLines[i], '');
      }
    }
    const key = p ? p.key : null;
    if (key !== activeKey) {
      if (activeKey && keyEls[activeKey]) keyEls[activeKey].classList.remove('on');
      if (key && keyEls[key]) keyEls[key].classList.add('on');
      activeKey = key;
    }
  }

  function drawTicker(t) {
    const on = !!t;
    if (on !== hasTick) { hasTick = on; reelEl.classList.toggle('on-tick', on); }
    const left = t ? t.left : '', right = t ? t.right : '';
    /* Only text zoom makes the left side too long for its row. The rest of it takes the rows below, ahead of the right side. */
    const turned = left.length > geo.inner ? wrap(left, geo.inner) : null;
    setText(tickLeft, turned ? left.slice(0, turned[0].end) : left);
    if (right !== lastRight || left !== lastLeft) {
      lastRight = right;
      lastLeft = left;
      const fits = !turned && right.length + script.left.length + 2 + (geo.keysUp ? 12 : 0) <= geo.inner;
      setText(tickRight, fits ? right : '');
      const lines = fits ? [] : wrap(right, geo.inner);
      const over = turned ? turned.length - 1 : 0;
      tickSpare = geo.tickRows - 1 - over - lines.length;
      for (let i = 0; i < moreEls.length; i++) {
        const l = i < over ? turned[i + 1] : lines[i - over];
        setText(moreEls[i], l ? (i < over ? left : right).slice(l.at, l.end) + ' ' : '');
        setColor(moreEls[i], i < over ? t.leftColor : '');
      }
    }
    if (t) {
      setColor(tickLeft, t.leftColor);
      setColor(tickRight, t.rightColor);
      setColor(tickMore, t.rightColor);
    }
  }

  function drawCaption(v) {
    const c = v.caption, e = v.end;
    const text = e ? e.two : c ? c.text : '';
    if (text !== lastCap) {
      lastCap = text;
      const lines = text ? even(text, geo.chars) : [];
      for (let i = 0; i < capEls.length; i++) setText(capEls[i], i < lines.length ? text.slice(lines[i].at, lines[i].end) + ' ' : '');
      setColor(capLines, e ? e.twoColor : COLORS.cap);
    }
    setText(endOne, e ? e.one : '');
    if (e) setColor(endOne, e.oneColor);
    const op = !c || motion.matches ? 1 : Math.round(c.fade * 8) / 8;
    if (op !== lastOp) { lastOp = op; capLines.style.opacity = op === 1 ? '' : op; }
  }

  function render(v) {
    if (v.scene !== scene) {
      scene = v.scene;
      Object.keys(dropped).forEach((k) => { delete dropped[k]; });
    }
    setText(barLeft, geo.barBoth ? v.title.left : '');
    setColor(barLeft, v.title.leftColor);
    setColor(barRight, v.title.rightColor);
    drawTicker(v.ticker);
    drawPane(v.pane);
    drawCaption(v);
    drawLabels(v);
  }

  /* Forget what was last written, because the rows have changed under it. */
  function retext() {
    lastOne = lastTwo = lastCap = lastRight = lastLeft = null;
    folded = {};
    lastOp = -1;
    Object.keys(dropped).forEach((k) => { delete dropped[k]; });
  }

  /* ---- The still, before anything has played ---- */

  let stillOn = true;

  /* The widest view of the film, kept as one pixel per cell and shown the same way as the film. It has no ticker
     and no caption, and the picture takes the ticker's rows as well. */
  function drawStill() {
    const v = words.frame(STILL_T, geo.cols, geo.rows);
    v.ticker = null;
    v.caption = null;
    ctx.fillStyle = COLORS.term;
    ctx.fillRect(0, 0, geo.cols, geo.rows);
    const w = still.naturalWidth, h = still.naturalHeight;
    if (w) {
      /* Where the picture runs past the world's edge, its edge row or column carries on. */
      const x = -v.cam.x, y = -v.cam.y;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(still, x, y);
      if (y > 0) ctx.drawImage(still, 0, 0, w, 1, x, 0, w, y);
      if (y + h < geo.rows) ctx.drawImage(still, 0, h - 1, w, 1, x, y + h, w, geo.rows - y - h);
      if (x > 0) ctx.drawImage(canvas, x, 0, 1, geo.rows, 0, 0, x, geo.rows);
      if (x + w < geo.cols) ctx.drawImage(canvas, x + w - 1, 0, 1, geo.rows, x + w, 0, geo.cols - x - w, geo.rows);
    } else {
      /* No picture, so nothing to name. */
      v.labels.length = 0;
      v.banners.length = 0;
    }
    render(v);
  }

  /* ---- The clock and the sound ---- */

  let reel = null, loading = false, slowWorld = false;
  let wanted = false, started = false, playing = false, ended = false, alive = true;
  let base = 0, baseAt = 0, seenA = -1, seenAt = 0;
  let audio = null, audioLive = false, audioDead = false, soundSeen = false, soundLate = false, userMuted = false, heldForWorld = false;
  let pressAt = 0, pressTimer = 0, worldTimer = 0, begunAt = 0, raf = 0, lastRaf = 0, lateSince = 0, graceUntil = 0, sinceDraw = 0;
  /* The film time of the picture last drawn. */
  let drawnT = 0;
  /* What a tick and a picture have been costing lately, in ms, and the time between frames. */
  let tickCost = 0, drawCost = 0, frameGap = STEP * 1000;
  let onScreen = true, dirty = true, hiddenWhilePlaying = false, framed = false, overlay = false;
  let shownSecond = -1;
  /* Handing over to the video, while it gets ready; and whether there turned out to be no video to hand over to. */
  let bridging = null, noVideo = false;

  function ensureSound() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'auto';
    audio.muted = userMuted;
    audio.addEventListener('playing', safely(onSoundPlaying));
    /* Media keys, a headset coming out, a phone call: the sound was paused or started from outside. The picture follows. */
    audio.addEventListener('pause', safely(() => { if (playing && audio.paused && !audio.ended) pause(); }));
    audio.addEventListener('play', safely(() => { if (!wanted && !audio.paused) press(); }));
    audio.addEventListener('waiting', () => { if (audio.readyState < 3) audioLive = false; });
    audio.addEventListener('stalled', () => { if (audio.readyState < 3) audioLive = false; });
    audio.addEventListener('seeked', () => { seenA = -1; });
    audio.addEventListener('ended', () => { audioLive = false; });
    audio.addEventListener('error', safely(onSoundFailed));
    audio.src = SOUND;
    audio.load();
  }

  function onSoundFailed() {
    audioDead = true;
    audioLive = false;
    buttons();
    tryBegin();
  }

  function onSoundPlaying() {
    if (!audio || !playing && started) return;
    if (started) {
      /* It has caught up with a film that didn't wait. Join at the right time. */
      const t = clockNow(performance.now());
      if (Math.abs(audio.currentTime - t) > 0.15) audio.currentTime = t + 0.03;
    }
    seenA = -1;
    audioLive = true;
    soundSeen = true;
    if (soundLate) { soundLate = false; buttons(); }
    if (!started) tryBegin();
  }

  function sound() {
    ensureSound();
    if (audioDead) return;
    const p = audio.play();
    if (p && p.catch) {
      p.catch(safely((e) => {
        if (e.name === 'AbortError') return;
        if (e.name === 'NotAllowedError') {
          /* A browser rule on sound blocked it. Carry on silently; the button says so. */
          userMuted = true;
          audio.muted = true;
          buttons();
          if (!wanted) return;
          audio.play().catch(() => {});
          tryBegin();
          return;
        }
        onSoundFailed();
      }));
    }
  }

  /* Seconds of film. The sound leads while it plays, and the free clock smooths between its updates. */
  function clockNow(now) {
    let t = base + (now - baseAt) / 1000;
    if (audioLive && audio) {
      const a = audio.currentTime;
      if (a !== seenA) { seenA = a; seenAt = now; }
      const err = seenA + (now - seenAt) / 1000 - t;
      if (Math.abs(err) > 0.25) {
        if (reel && seenA < reel.t - 0.25) {
          /* The sound has fallen behind, and grains can't go backwards. Bring the sound here. */
          audio.currentTime = reel.t + 0.03;
          seenA = -1;
        } else {
          /* A jump in the sound: the picture jumps with it, and gets a moment to catch up. */
          base += err; t += err;
          graceUntil = now + 1000;
        }
      } else { base += err * 0.08; t += err * 0.08; }
    }
    return t;
  }

  function freezeClock() {
    const now = performance.now();
    base = clockNow(now);
    baseAt = now;
  }

  function pad2(n) { n = Math.floor(n); return (n < 10 ? '0' : '') + n; }
  function fmt(s) { return pad2(s / 60) + ':' + pad2(s % 60); }
  function drawTime(t) {
    const s = Math.floor(t);
    if (s !== shownSecond) { shownSecond = s; time.textContent = fmt(s) + ' / ' + fmt(T.END); }
  }

  function buttons() {
    const on = wanted && !ended;
    bPlay.textContent = on ? '[Pause]' : '[Play]';
    bPlay.setAttribute('aria-label', on ? 'Pause film' : 'Play film');
    const silent = audioDead || soundLate;
    box.classList.toggle('silent', silent);
    if (silent) {
      /* Nothing to press, so no brackets. */
      bMute.textContent = 'Silent';
      bMute.setAttribute('aria-label', 'Silent, no sound is available');
      bMute.setAttribute('aria-disabled', 'true');
    } else {
      bMute.textContent = userMuted ? '[Muted]' : '[Mute]';
      bMute.setAttribute('aria-label', userMuted ? 'Muted film, turn sound on' : 'Mute film');
      bMute.removeAttribute('aria-disabled');
    }
    const full = !!fullElement() || overlay;
    bFull.textContent = full ? '[Exit]' : '[Full]';
    bFull.setAttribute('aria-label', full ? 'Exit full screen' : 'Full screen');
    pic.setAttribute('aria-label', silent ? NAME_SILENT : NAME);
    cue.setAttribute('aria-label', silent ? 'Play film' : 'Play the film with sound');
  }

  /* The first press from above the fold brings the picture and its controls on screen. */
  function frameIt() {
    if (framed || fullElement() || overlay) return;
    framed = true;
    const by = Math.min(ctl.getBoundingClientRect().bottom - window.innerHeight, film.getBoundingClientRect().top);
    if (by > 0) window.scrollBy({ top: by, behavior: motion.matches ? 'auto' : 'smooth' });
  }

  /* Whether the spring's burst fits in KEEP_UP of a second at the pace the warm-up timed, at this picture's size. */
  function keepsUp(pace) {
    return pace.burst + pace.paint * geo.cols * geo.rows * BURST_DRAWS <= KEEP_UP * 1000;
  }

  function tooSlow() { slowWorld = true; if (wanted && !started) hand(); }

  function ensureWorld() {
    if (reel || loading) return;
    loading = true;
    /* Once making the world has taken TOO_SLOW, or the warm-up has timed a device that can't keep up, it is known to
       be too slow: a press waiting for it goes to the video now, a later press goes straight to it, and the world
       stops being made. */
    const made = Core.load({
      seed: Core.pickSeed(Math.random()), slice: 6,
      busy: TOO_SLOW, onBusy: safely(tooSlow), size: [geo.cols, geo.rows],
      keeps: safely((pace) => { if (keepsUp(pace)) return true; tooSlow(); return false; }),
      stop: () => !alive || slowWorld
    });
    /* Loading takes the slowest frames as well, so the film's first run is as quick as the rest. */
    made.then(safely((r) => {
      reel = r;
      loading = false;
      tryBegin();
    }), safely((e) => { throw e; }));
  }

  /* The sound has this long to arrive before the picture goes without it. */
  function tryBegin() {
    if (!wanted || started) return;
    if (slowWorld || (reel && (reel.buildMs > TOO_SLOW || reel.slow))) { hand(); return; }
    if (!reel) return;
    const waited = performance.now() - pressAt;
    const soundReady = audioLive || audioDead || (audio && audio.muted && audio.readyState >= 2);
    if (soundReady || waited >= WAIT_FOR_SOUND) begin();
  }

  function endStill() {
    stillOn = false;
    still = null;
    words = null;
    reelEl.classList.remove('still-on');
    geo.key = '';
    fit();
  }

  function begin() {
    started = true;
    clearTimeout(pressTimer);
    clearTimeout(worldTimer);
    begunAt = performance.now();
    shownSecond = -1;
    reel.reduced = motion.matches;
    if (heldForWorld) {
      /* The world took longer than the sound. It waited silently from the top. */
      heldForWorld = false;
      if (audio) { audio.currentTime = 0; audio.muted = userMuted; }
      seenA = -1;
    }
    base = audioLive && audio ? audio.currentTime : 0;
    baseAt = performance.now();
    playing = true;
    lateSince = 0;
    graceUntil = baseAt + 1000;
    if (stillOn) endStill();
    retext();
    draw();
    drawTime(0);
    cap.setAttribute('aria-live', 'polite');
    /* Once it is really running the cue is spent. The words beside it stay exactly where they are. */
    if (document.activeElement === cue) bPlay.focus({ preventScroll: true });
    cue.classList.remove('on');
    run();
  }

  function press() {
    if (!alive) return;
    if (playing || (wanted && !ended)) { pause(); return; }
    if (ended) rewind();
    wanted = true;
    buttons();
    frameIt();
    if (!reel) {
      /* play() has to start inside the press. If the world isn't there yet, it starts muted and waits. */
      heldForWorld = true;
      ensureSound();
      if (!audioDead) audio.muted = true;
    }
    sound();
    ensureWorld();
    if (started) {
      /* Back from a pause. */
      baseAt = begunAt = performance.now();
      playing = true;
      lateSince = 0;
      graceUntil = baseAt + 1000;
      cap.setAttribute('aria-live', 'polite');
      run();
    } else {
      pressAt = performance.now();
      clearTimeout(pressTimer);
      pressTimer = setTimeout(safely(tryBegin), WAIT_FOR_SOUND);
      clearTimeout(worldTimer);
      if (!reel) worldTimer = setTimeout(safely(() => { if (!reel && wanted) hand(); }), WAIT_FOR_WORLD);
      /* Waiting says so, the way the video's clock does. */
      time.textContent = '--:-- / ' + fmt(T.END);
      shownSecond = -1;
      tryBegin();
    }
  }

  function pause() {
    wanted = false;
    if (started && playing) freezeClock();
    playing = false;
    audioLive = false;
    if (audio) audio.pause();
    clearTimeout(pressTimer);
    clearTimeout(worldTimer);
    if (!started) drawTime(0);
    cap.setAttribute('aria-live', 'off');
    buttons();
  }

  function rewind() {
    ended = false;
    started = false;
    audioLive = false;
    base = 0;
    seenA = -1;
    shownSecond = -1;
    reel.reset(Core.pickSeed(Math.random()));
    if (audio && !audioDead) audio.currentTime = 0;
    drawTime(0);
    /* The end card goes as soon as it is asked to, whatever the sound is doing. */
    retext();
    draw();
  }

  function finish() {
    playing = false;
    ended = true;
    wanted = false;
    audioLive = false;
    if (audio) audio.pause();
    cap.setAttribute('aria-live', 'off');
    drawTime(T.END);
    draw();
    buttons();
  }

  function draw() {
    const t = reel.t, open = geo.spare > 0 && t >= T.LOGO;
    const rows = open ? geo.rows + geo.spare : geo.rows;
    const v = reel.frame(t, geo.cols, rows);
    /* The word sits in the middle of the columns that show, not of the last one, which is partly past the edge. */
    if (v.mode === 'logo') v.cam.x = Math.round((VW - geo.picW / geo.g) / 2);
    reel.paint(image.data, geo.cols, rows, v.cam);
    drawnT = t;
    ctx.putImageData(image, 0, 0, 0, 0, geo.cols, rows);
    if (open !== geo.open) { geo.open = open; reelEl.classList.toggle('under', open); }
    render(v);
    dirty = false;
  }

  function loop(now) {
    raf = 0;
    if (!playing || !alive) return;
    raf = requestAnimationFrame(guardedLoop);
    sinceDraw++;
    reel.reduced = motion.matches;
    const gap = now - lastRaf;
    lastRaf = now;
    if (gap > 0 && gap < 100) frameGap += (gap - frameGap) * 0.1;
    const t = clockNow(now);
    const target = Math.min(t, HOLD);
    const before = target - reel.t;
    /* A tick can take a few milliseconds, so the clock is looked at after every one. Handing over, the picture
       moves on as it can and leaves the video most of the time to get ready in. */
    const until = performance.now() + (bridging ? 8 : before > 0.1 ? 24 : 10);
    let ticked = 0;
    const from = performance.now();
    while (reel.t + STEP / 2 <= target) {
      reel.tick();
      ticked++;
      if (performance.now() > until) break;
    }
    if (ticked) tickCost += ((performance.now() - from) / ticked - tickCost) * 0.1;
    drawTime(reel.t);

    /* Late with the sound, by more than a slow start. The button says so until it arrives. */
    if (!soundSeen && !soundLate && !audioDead && now - begunAt > SOUND_LATE) { soundLate = true; buttons(); }

    const behind = target - reel.t;
    /* Where working out the grains takes most of each frame, as where the spring bursts on a slow device, it draws
       only every second, third or fourth frame, so that it keeps up with the sound rather than falling behind.
       Behind anyway, it draws every second frame, or every third if well behind, and spends the time catching up. */
    const left = frameGap * (0.85 - tickCost * 60 / 1000);
    const paced = left > 0 ? Math.min(4, Math.max(1, Math.ceil(drawCost / left))) : 4;
    const every = Math.max(paced, behind > 0.25 ? 3 : behind > 0.05 ? 2 : 1);
    if (onScreen && (ticked || dirty) && sinceDraw >= every) {
      const at = performance.now();
      draw();
      drawCost += (performance.now() - at - drawCost) * 0.2;
      sinceDraw = 0;
    }

    /* The device can't keep up: the picture on screen is behind the sound, and it hands over to the video rather than
       fall further behind. A long gap is the machine having slept or been busy with something else: that gets a
       second to catch up first. */
    if (gap > 250) graceUntil = now + 1000;
    const late = target - (onScreen ? drawnT : reel.t);
    if (late > LATE && now > graceUntil && !bridging && !noVideo) {
      if (!lateSince) lateSince = now;
      if (now - lateSince > LATE_FOR || late > 2 * LATE) { hand(); return; }
    } else lateSince = 0;

    if (t >= T.END || (audio && audio.ended)) {
      /* The end card always lands. Past the last of the world there is nothing left to work out, so the picture
         gets there at once. If the world is still running, the video has the end instead. */
      if (reel.t < T.LOGO) { hand(); return; }
      while (reel.t + STEP / 2 <= HOLD) reel.tick();
      finish();
    }
  }

  function run() {
    lastRaf = performance.now();
    if (!raf) raf = requestAnimationFrame(guardedLoop);
    buttons();
  }

  /* ---- When it can't run ---- */

  function hand(broke) {
    if (!alive) return;
    if (bridging) {
      /* On its way already. If the live film stops meanwhile, its last picture stays up. */
      if (broke) bridging.broke();
      return;
    }
    const was = playing || (wanted && started);
    const at = started ? (ended ? END_CARD : Math.min(playing ? clockNow(performance.now()) : base, END_CARD)) : 0;
    if (playing && !ended && !noVideo && at < END_CARD - HAND_LEAD && window.SiltFilm) {
      bridge(broke);
      return;
    }
    stop();
    swap(at, was, !!(audio && userMuted));
  }

  function stop() {
    alive = false;
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(pressTimer);
    clearTimeout(worldTimer);
  }

  /* In the middle of the film the video makes its frame a moment ahead ready out of sight, starts from it silently
     when the sound gets there, and then takes over. Until then the live film plays on with its sound, late as it may
     be, and every control works as before. If the live film itself has stopped, its last picture stays up with the
     sound, and a press hands over at once and then does what it says. */
  function bridge(broke) {
    const began = performance.now(), now = () => clockNow(performance.now()), to = now() + HAND_LEAD;
    const sources = Array.prototype.slice.call(video.querySelectorAll('source'));
    const off = [];
    let ready = false, starting = false, catching = false, broken = false, done = false, timer = 0;
    const poll = setInterval(check, 20);
    function listen(target, type, fn, capture) {
      target.addEventListener(type, fn, capture);
      off.push(() => { target.removeEventListener(type, fn, capture); });
    }
    function end() {
      done = true;
      bridging = null;
      clearTimeout(timer);
      clearInterval(poll);
      off.forEach((f) => { f(); });
    }
    function go(play) {
      if (done) return;
      end();
      const at = starting && !video.paused ? video.currentTime : Math.min(now(), END_CARD);
      const muted = !!(audio && userMuted);
      video.playbackRate = 1;
      if (!play) video.pause();
      stop();
      swap(at, play, muted);
    }
    function check() {
      if (done) return;
      const t = now();
      /* Paused, or the page hidden: the video waits at the same moment. */
      if (!broken && !playing) { go(false); return; }
      if (t > END_CARD || performance.now() - began > HAND_WAIT) { go(!audio || audioDead || !audio.paused); return; }
      if (ready && !starting && t >= to - START_LAG) start();
      /* Started late, it runs quicker out of sight until it is level with the sound, easing off as it gets there,
         and takes over once it has plenty of what comes next in hand. */
      if (catching && !video.paused) {
        const gap = t - video.currentTime;
        const rate = Math.round((gap > 0 ? Math.min(CATCH_UP, 1.5 + 5 * gap) : Math.max(0.5, 1 + 5 * gap)) * 20) / 20;
        if (video.playbackRate !== rate) video.playbackRate = rate;
        if (Math.abs(gap) < 0.05 && video.readyState >= 4) go(true);
      }
    }
    function start() {
      if (done || starting) return;
      starting = true;
      catching = now() > to + 0.15;
      const p = video.play();
      if (p && p.catch) p.catch(() => { go(true); });
    }
    /* With nothing to take over with, the live film plays on to the end as well as it can. */
    function failed(e) {
      if (e.target !== video && e.target !== sources[sources.length - 1]) return;
      if (broken) { go(true); return; }
      noVideo = true;
      end();
      video.playbackRate = 1;
      video.pause();
      video.hidden = true;
    }
    /* A press on the picture pauses, as it did. One on a control goes on to the video's own. */
    function pressed(e) { go(!(reelEl && reelEl.contains(e.target))); }
    bridging = {
      broke() {
        if (broken) return;
        broken = true;
        stop();
        listen(box, 'click', pressed, true);
        listen(document, 'visibilitychange', () => { if (document.hidden) go(false); });
      }
    };
    listen(video, 'seeked', () => {
      if (done || video.seeking || Math.abs(video.currentTime - to) > 0.05) return;
      ready = true;
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(0, (to - START_LAG - now()) * 1000));
    });
    listen(video, 'playing', () => { if (starting && !catching) go(true); });
    listen(video, 'error', failed);
    sources.forEach((s) => { listen(s, 'error', failed); });
    if (broke) bridging.broke();
    /* Under the stage the video can't be seen yet, and it is silent until it takes over. */
    video.hidden = false;
    video.muted = true;
    video.preload = 'auto';
    video.currentTime = to;
  }

  function swap(at, was, muted) {
    /* The one sound gives way to the other at once, before the stage is taken down. */
    if (audio) audio.pause();
    video.muted = muted;
    if (audio) {
      audio.removeAttribute('src');
      try { audio.load(); } catch (e) { /* Gone either way. */ }
    }
    undo.forEach((off) => { off(); });
    if (reelEl) reelEl.remove();
    if (overlay) {
      overlay = false;
      box.classList.remove('overlay', 'full');
      lockPage(false);
    }
    box.classList.remove('silent');
    bMute.removeAttribute('aria-disabled');
    cue.setAttribute('aria-label', 'Play the film with sound');
    film.style.removeProperty('--lh');
    ctl.classList.remove('wrap');
    root.classList.remove('live', 'reel-lock');
    root.style.removeProperty('--reel-rows');
    video.hidden = false;
    window.SiltStage = null;
    document.dispatchEvent(new Event('silt-rows'));
    if (window.SiltFilm) window.SiltFilm.begin(at, was || (wanted && !started), muted);
    else {
      video.poster = 'assets/poster.jpg';
      video.controls = true;
      cue.classList.remove('on');
      ctl.hidden = true;
      if (at) video.currentTime = at;
      if (was) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    }
  }

  function safely(fn) {
    return function () {
      if (!alive) return undefined;
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        /* Quiet for the viewer, who gets the video. Not for anyone looking. */
        if (window.console && console.warn) console.warn('Silt: the live film stopped, so the video takes over.', e);
        hand(true);
        return undefined;
      }
    };
  }
  const guardedLoop = safely(loop);

  /* ---- Wiring ---- */

  const undo = [];
  function on(target, type, fn, options) {
    const f = safely(fn);
    target.addEventListener(type, f, options);
    undo.push(() => { target.removeEventListener(type, f, options); });
  }

  /* Under the overlay nothing can be seen, so nothing can be reached by keyboard either. */
  function lockPage(state) {
    document.querySelectorAll('#page > :not(#exhibit-a)').forEach((e) => { e.inert = state; });
  }

  /* Full screen, or the whole window where a page can't have that. */
  function setOverlay(state) {
    overlay = state;
    box.classList.toggle('overlay', state);
    box.classList.toggle('full', state);
    root.classList.toggle('reel-lock', state);
    lockPage(state);
    buttons();
    refit();
  }
  function toggleFull() {
    if (fullElement()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (overlay) setOverlay(false);
    else if (box.requestFullscreen) box.requestFullscreen().catch(safely(() => { setOverlay(true); }));
    else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    else setOverlay(true);
  }

  let queued = 0;
  function refit() {
    if (!fit()) return;
    retext();
    if (stillOn) drawStill();
    else if (reel) draw();
  }
  function refitSoon() {
    if (queued) return;
    queued = requestAnimationFrame(safely(() => { queued = 0; refit(); }));
  }

  function wire() {
    on(bPlay, 'click', press);
    /* The cue starts the film. Once it has been pressed it only waits to go. */
    on(cue, 'click', () => { if (!wanted || started) press(); });
    /* A drag or a double click selects words. A plain click lets go of them and still plays or pauses. */
    let downX = 0, downY = 0;
    on(reelEl, 'pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    on(reelEl, 'click', (e) => {
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) {
        if (e.detail > 1 || Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) return;
        sel.removeAllRanges();
      }
      press();
    });
    on(bMute, 'click', () => {
      if (audioDead || soundLate) return;
      userMuted = !userMuted;
      if (audio && !heldForWorld) audio.muted = userMuted;
      if (playing && audio && !userMuted && audio.paused) sound();
      buttons();
    });
    on(bFull, 'click', toggleFull);
    on(document, 'keydown', (e) => { if (overlay && e.key === 'Escape') setOverlay(false); });

    ['fullscreenchange', 'webkitfullscreenchange'].forEach((name) => {
      on(document, name, () => {
        box.classList.toggle('full', fullElement() === box);
        buttons();
        refit();
      });
    });
    let lastWidth = window.innerWidth;
    on(window, 'resize', () => {
      refitSoon();
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      /* A phone turned during the film keeps the picture and its controls on screen. */
      if (playing && onScreen && coarse()) {
        framed = false;
        requestAnimationFrame(safely(() => { requestAnimationFrame(safely(frameIt)); }));
      }
    });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(safely(refitSoon));
      ro.observe(film);
      /* Text zoom changes the type and sends no other word of it. */
      ro.observe(probe);
      undo.push(() => { ro.disconnect(); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(safely(refit));

    /* Hidden: picture and sound stop, and come back. Scrolled off: it plays on with sound, and stops painting. */
    on(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (wanted && !ended) { hiddenWhilePlaying = true; pause(); }
      } else if (hiddenWhilePlaying) {
        hiddenWhilePlaying = false;
        if (!wanted) press();
      }
    });
    if ('IntersectionObserver' in window) {
      const seen = new IntersectionObserver(safely((es) => {
        const was = onScreen;
        onScreen = es[es.length - 1].isIntersecting;
        if (onScreen && !was) dirty = true;
        if (onScreen && !was && !playing && reel && !stillOn) draw();
      }));
      seen.observe(film);
      undo.push(() => { seen.disconnect(); });
      /* The world gets built when the film is coming up. */
      const near = new IntersectionObserver(safely((es) => {
        if (es[es.length - 1].isIntersecting) { idle(ensureWorld); near.disconnect(); }
      }), { rootMargin: '100% 0px' });
      near.observe(film);
      undo.push(() => { near.disconnect(); });
    } else idle(ensureWorld);

    /* The sound is fetched once someone is here and the film is coming up, or on the press. */
    function person() {
      window.removeEventListener('pointermove', person);
      window.removeEventListener('pointerdown', person);
      window.removeEventListener('keydown', person);
      window.removeEventListener('scroll', person);
      const c = navigator.connection;
      if (c && c.saveData) return;
      const r = film.getBoundingClientRect();
      if (r.top < window.innerHeight * 2 && r.bottom > -window.innerHeight) safely(ensureSound)();
      else {
        window.addEventListener('scroll', person, { passive: true });
      }
    }
    window.addEventListener('pointermove', person, { passive: true });
    window.addEventListener('pointerdown', person, { passive: true });
    window.addEventListener('keydown', person, { passive: true });
    window.addEventListener('scroll', person, { passive: true });
    undo.push(() => {
      window.removeEventListener('pointermove', person);
      window.removeEventListener('pointerdown', person);
      window.removeEventListener('keydown', person);
      window.removeEventListener('scroll', person);
    });
  }

  function idle(fn) {
    const f = safely(fn);
    if (window.requestIdleCallback) requestIdleCallback(f, { timeout: 600 });
    else setTimeout(f, 60);
  }

  /* ---- Claiming the film box ---- */

  try {
    root.classList.add('live');
    words = Core.words();
    script = scan();
    build();
    fit();
    drawStill();
    buttons();
    wire();
    time.textContent = fmt(0) + ' / ' + fmt(T.END);
  } catch (e) {
    /* Nothing set up here may run from now on. film.js, next on the page, has the film. */
    alive = false;
    stillOn = false;
    undo.forEach((off) => { off(); });
    if (reelEl) reelEl.remove();
    video.hidden = false;
    ctl.hidden = true;
    cue.classList.remove('on');
    root.classList.remove('live');
    root.style.removeProperty('--reel-rows');
    return;
  }

  /* film.js looks for this to know the stage has the film. The rest is for tests. */
  window.SiltStage = {
    get reel() { return reel; },
    get playing() { return playing; },
    get ended() { return ended; },
    get audio() { return audio; },
    get geometry() { return geo; },
    words(t) { render((reel || words).frame(t, geo.cols, geo.rows)); },
    jump(t) {
      base = t;
      baseAt = performance.now();
      if (audio) audio.currentTime = t;
    },
    playingLayout() {
      if (stillOn) endStill();
      retext();
    }
  };
})();
