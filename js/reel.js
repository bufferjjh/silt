/* Exhibit A, drawn live. reel-core.js decides what is on screen; this puts it there: a canvas with one pixel
   per grain, shown at a whole number of device pixels, and every word as real text on the page's own grid.
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

  const T = Core.T, VW = Core.VW, VH = Core.VH, COLORS = Core.COLORS, KEYS = Core.KEYS;
  const SOUND = 'assets/silt-film.m4a';
  const STILL_SRC = 'assets/film-still.png', STILL_T = 24.6;
  /* The still is this wide, and has this many rows of sky above the world's top. Its last rows are plain rock. */
  const STILL_W = 320, STILL_SKY = 30, STILL_DEEP = 12;
  const SOUL_X = 59, SOUL_Y = 36; /* Where the soul's label is in the still. */
  const KESH = 'Kesh, asleep';
  const NAME = 'Silt, a 59-second concept film with sound, drawn grain by grain: a planet seen from the side.';
  const NAME_SILENT = NAME.replace(' with sound', '');
  const HOLD = 58.4; /* The end card, before the film fades. It stays up after this. */
  const WAIT_FOR_SOUND = 2000;
  const WAIT_FOR_WORLD = 10000; /* After a press. Longer than this, the device won't keep up anyway. */
  const SOUND_LATE = 3000; /* Running this long with no sound yet, the button says so. */
  const NARROWEST = 96; /* Columns. Fewer would lose Kesh's white grain. */
  const TALLEST = 112; /* Rows. More than this is mostly dark rock. */
  const SMALLEST_GRAIN = 1.25; /* CSS pixels. Under this, the world is too small to read. */
  const STEP = 1 / 60;

  const motion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ---- The script, read once for its words ---- */

  /* All the words the film will ever show, so that rows can be reserved before any of them appear. */
  let words = null, script = null;

  function scan() {
    const s = { tag: '', left: '', rights: [], ones: [], twos: [], pairs: [], caps: [], rows: {}, end: null };
    const add = (list, text) => { if (text && list.indexOf(text) < 0) list.push(text); };
    words.reduced = true;
    for (let f = 0; f < T.END * 10; f++) {
      const v = words.frame(f / 10);
      s.tag = v.title.right;
      if (v.ticker) { s.left = v.ticker.left; add(s.rights, v.ticker.right); }
      if (v.pane) {
        add(s.ones, v.pane.one);
        add(s.twos, v.pane.two);
        if (!s.pairs.some((p) => p[0] === v.pane.one && p[1] === v.pane.two)) s.pairs.push([v.pane.one, v.pane.two]);
      }
      if (v.caption) add(s.caps, v.caption.text);
      if (v.end) s.end = v.end;
      for (let i = 0; i < v.rows.length; i++) {
        const r = v.rows[i];
        (s.rows[v.scene] = s.rows[v.scene] || {})[r.row] = r.text;
      }
    }
    words.reduced = false;
    /* What the closing scene says, for the caption's live region: all but the line about the connection. */
    const closing = s.rows.exit || {};
    s.closing = Object.keys(closing).map(Number).sort((a, b) => a - b).slice(1).map((r) => closing[r]).join(' ');
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
  /* Grey on the strips, a touch lighter than the film's so that it stays readable there. */
  function ink(color) { return color === '#787886' ? '#7c7c8a' : color; }

  const ctl = document.getElementById('film-ctl');
  const cue = document.getElementById('film-cue');
  const bPlay = document.getElementById('film-play');
  const bMute = document.getElementById('film-mute');
  const bFull = document.getElementById('film-full');
  const time = document.getElementById('film-time');

  let reelEl, bar, barLeft, barRight, tick, tickLeft, tickRight, tickMore, pic, still, labelsEl;
  let pane, keys, keyEls, cap, capLines, endOne, say, sheet, probe;

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
    say = make('span', 'reel-say', cap);
    sheet = make('div', 'reel-sheet', reelEl);
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
  let paneLines = [], capEls = [], sheetEls = [], sheetPlans = {}, moreEls = [];
  const heights = {};

  function cssNumber(name) { return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0; }

  function fullElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function isFull() { return box.classList.contains('full'); }

  /* A row's text can start with a word that the rest of it should hang under, where that leaves room. */
  function hangOf(text, width) {
    const m = /^(Day\s+\d+\s+|you > |agent > )/.exec(text);
    const longest = text.split(' ').reduce((n, w) => Math.max(n, w.length), 0);
    if (m && width - m[0].length >= 30 && width - m[0].length >= longest) return m[0].length;
    return 2;
  }

  /* Where the rows of a text-only scene go. The film's own rows if they fit, then closer together. The limits
     are tried in turn: the picture's rows, then the pane's strip, then the keys row. If it is still too long,
     every column and the least hanging indent. */
  function planSheet(scene, limits, cols, first) {
    const table = script.rows[scene];
    if (!table) return null;
    const setOut = (col, width, hang) => Object.keys(table).map(Number).sort((a, b) => a - b).map((row) => {
      const text = table[row];
      return { row, text, col, lines: wrap(text, width, hang || hangOf(text, width)) };
    });
    const col = cols < 66 ? 1 : (scene === 'history' ? 4 : 2);
    let items = setOut(col, cols - col - 1);
    function lay(maxGap, top) {
      let at = Math.min(items[0].row, top), last = items[0].row, end = at;
      items.forEach((it, i) => {
        if (i) at = end + Math.max(0, Math.min(it.row - last - 1, maxGap));
        it.at = at;
        end = at + it.lines.length;
        last = it.row + it.lines.length - 1;
      });
      return end;
    }
    let end = 0;
    const tries = [[2, 99], [1, 2], [0, first]];
    search:
    for (const limit of limits) {
      for (let i = 0; i < tries.length; i++) {
        end = lay(tries[i][0], tries[i][1]);
        if (end <= limit) break search;
      }
    }
    if (end > limits[limits.length - 1]) {
      items = setOut(1, cols - 1, 1);
      end = lay(0, first);
    }
    const byRow = {};
    items.forEach((it) => { byRow[it.row] = it; });
    return { byRow, end };
  }

  /* The rows of picture the text-only scenes can't do without, at their closest. */
  function rowsForSheets(cols, around) {
    const tightest = (scene, first) => { const p = planSheet(scene, [0], cols, first); return p ? p.end - around : 0; };
    return Math.max(tightest('history', 1), tightest('prompt', 0));
  }

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

    /* Grains: a whole number of device pixels, as many columns of the film as fit, and no smaller than three
       CSS pixels where that fits on a phone. */
    const wDev = fw * dpr;
    const rowsOf = (k, n) => Math.ceil(n * (k / dpr) / lh - 0.001);
    let K = Math.max(1, Math.floor(wDev / VW));
    const small = K / dpr < 3;
    if (small) K = Math.max(K, Math.min(Math.ceil(3 * dpr - 1e-6), Math.floor(wDev / NARROWEST)));
    let need = small ? 64 : VH;
    let picRows, picH;
    if (full) {
      if (canLift && filmH - chrome * lh < need * 3) { keysUp = true; keyRows = 0; chrome--; }
      if (filmH - (chrome + 1) * lh >= need * (K / dpr)) { air = 1; chrome++; }
      picH = Math.max(lh, filmH - chrome * lh);
      /* A tall screen: bigger grains, rather than a long way down through dark rock. */
      K = Math.max(K, Math.min(Math.ceil(picH * dpr / TALLEST), Math.floor(wDev / NARROWEST)));
      K = Math.max(1, Math.min(K, Math.floor(picH * dpr / need)));
      picRows = picH / lh;
    } else {
      /* Whole rows of the page, enough for the film's 66, and the rows the film box has always had if more. */
      const tier = cssNumber('--fluid') === 1 ? 0 : cssNumber('--film-rows') - chrome;
      /* The rows the window has, less the control row. */
      const fits = Math.floor(windowH / lh) - 1;
      picRows = Math.max(tier, rowsOf(K, need));
      if (chrome + picRows > fits && canLift) { keysUp = true; keyRows = 0; chrome--; }
      /* Text-only scenes need their rows, wherever they find them. */
      const forSheets = rowsForSheets(cols, tickRows + paneRows + keyRows);
      picRows = Math.max(picRows, forSheets);
      if (chrome + picRows > fits) {
        /* A short window: the rows that are left, or that the text-only scenes hold on to, and grains to suit.
           Very short, the picture keeps to the action rather than go on shrinking. If that would still be too
           small to read, the grains stay as they were: smaller would buy nothing. */
        const rows = Math.max(fits - chrome, forSheets);
        need = Math.floor(rows * lh / 64) >= 2 ? 64 : 48;
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
    /* The pane's strip and the keys are empty in the fall and at the edge. Where the picture is short of rows, the world uses them. */
    const spare = (!allKeys || need < VH) && !stillOn ? Math.ceil((paneRows + keyRows) * lh * dpr / K) : 0;

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

    const sheetRows = tickRows + Math.ceil(picH / lh) + paneRows + keyRows;
    while (sheetEls.length < sheetRows) sheetEls.push(make('span', 'ln', sheet));
    while (sheetEls.length > sheetRows) sheet.removeChild(sheetEls.pop());
    sheet.style.top = barRows * lh + 'px';
    geo.sheetRows = sheetRows;
    sheetPlans = {
      prompt: planSheet('prompt', [sheetRows], cols, 0),
      history: planSheet('history', [tickRows + Math.ceil(picH / lh), sheetRows - keyRows, sheetRows], cols, 1),
      exit: planSheet('exit', [sheetRows], cols, 0)
    };

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

    /* Kesh and the ledge stay clear. On a small picture another label would land on them. */
    for (let i = 0; i < v.labels.length; i++) {
      if (v.labels[i].text === KESH) taken.push((v.labels[i].x - 1) * g, (v.labels[i].y + 3) * g, 19 * g, 6 * g);
    }

    /* A label sits on the film's text row. The bottom of the backing is where the bottom of that row was, so that
       it stays above what it names. One low in the picture hangs from the row instead, below what it names. */
    let you = null;
    /* Kesh's label first, and then the others the story names. The rest go where they fit, or not at all. */
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < v.labels.length; i++) {
        const l = v.labels[i];
        if (l.text === 'you') { you = l; continue; }
        const kesh = l.text === KESH;
        if (pass === 0 ? !kesh : kesh || !l.story !== (pass === 2) || dropped[l.text]) continue;
        const w = Math.min(W, grainsUp(l.text.length * cw + 2 * pad));
        let x = Math.max(0, Math.min(l.x * g - pad, W - w));
        /* A line that types stays centred on where it will finish. */
        if (l.center) x = Math.round((W - l.center * cw) / 2 / g) * g - pad;
        /* Kesh's label stops at the room's wall, rather than running over it. */
        if (kesh) x = Math.max(0, Math.min(x, (Core.BURROW.x + 133 - v.cam.x) * g - w));
        const low = l.y > H / g * 0.82;
        const y = Math.max(0, Math.min(low ? l.y * g : (l.y + 2) * g - h, H - h));
        if (hits(x, y, w, h) && !l.story) { dropped[l.text] = true; continue; }
        freeSpot(x, y, w, h, W, H);
        putLabel(l.text, spotX, spotY, w, h, l.color, l.back);
        taken.push(spotX, spotY, w, h);
      }
    }

    /* The ghost's label touches nothing either. It sits just clear of the ring, on whichever side is free, or
       the nearest place that is. If there is none, only the ring is there until the pointer moves on. */
    if (you) {
      const w = grainsUp(you.text.length * cw + 2 * pad);
      const gx = v.cam.ghostX, gy = v.cam.ghostY;
      const y = Math.max(0, Math.min((you.y + 2) * g - h, H - h));
      const mid = Math.max(0, Math.min((gx + 0.5) * g - w / 2, W - w));
      const right = (gx + 3) * g, left = (gx - 2) * g - w, above = (gy - 2) * g - h, below = (gy + 3) * g;
      const free = (a, b) => a >= 0 && a + w <= W && b >= 0 && b + h <= H && !hits(a, b, w, h);
      if (free(right, y)) putLabel(you.text, right, y, w, h, you.color, you.back);
      else if (free(left, y)) putLabel(you.text, left, y, w, h, you.color, you.back);
      else if (free(mid, above)) putLabel(you.text, mid, above, w, h, you.color, you.back);
      else if (free(mid, below)) putLabel(you.text, mid, below, w, h, you.color, you.back);
      else if (freeSpot(Math.max(0, Math.min(right, W - w)), y, w, h, W, H)) putLabel(you.text, spotX, spotY, w, h, you.color, you.back);
    }

    for (let i = labelsUsed; i < labelPool.length; i++) if (!labelPool[i].hidden) labelPool[i].hidden = true;
  }

  /* ---- Everything else that is text ---- */

  let scene = '', hasTick = null, hasPane = null, spill = null, spillKeys = false, activeKey = undefined;
  let lastOne = null, lastTwo = null, oneFull = '', twoFull = '', lastCap = null, lastOp = -1, lastRight = null, lastLeft = null;

  function clearSheet() {
    for (let i = 0; i < sheetEls.length; i++) { if (sheetEls[i].$text) setText(sheetEls[i], ''); }
  }

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
        if (i < a.length) { setText(paneLines[i], shown(oneFull, a[i], one.length)); setColor(paneLines[i], ink(p.oneColor)); }
        else if (i - a.length < b.length) {
          setText(paneLines[i], shown(twoFull, b[i - a.length], two.length));
          setColor(paneLines[i], ink(p.twoColor));
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
      setColor(tickRight, ink(t.rightColor));
      setColor(tickMore, ink(t.rightColor));
    }
  }

  function drawCaption(v) {
    const c = v.caption, e = v.end;
    const text = e ? e.two : c ? c.text : '';
    if (text !== lastCap) {
      lastCap = text;
      const lines = text ? even(text, geo.chars) : [];
      for (let i = 0; i < capEls.length; i++) setText(capEls[i], i < lines.length ? text.slice(lines[i].at, lines[i].end) + ' ' : '');
      setColor(capLines, e ? e.twoColor : '#f0f0f0');
    }
    setText(endOne, e ? e.one : '');
    /* The closing lines are typed into rows that aren't live, or every letter would be read out. Once, here. */
    setText(say, v.scene === 'exit' ? script.closing : '');
    if (e) setColor(endOne, e.oneColor);
    const op = !c || motion.matches ? 1 : Math.round(c.fade * 8) / 8;
    if (op !== lastOp) { lastOp = op; capLines.style.opacity = op === 1 ? '' : op; }
  }

  function drawSheet(v) {
    const plan = sheetPlans[v.scene];
    let spills = false, overKeys = false;
    if (plan) {
      for (let i = 0; i < v.rows.length; i++) {
        const r = v.rows[i], it = plan.byRow[r.row];
        if (!it) continue;
        const pre = ' '.repeat(it.col);
        for (let k = 0; k < it.lines.length; k++) {
          const e = sheetEls[it.at + k];
          if (!e) continue;
          const s = shown(it.text, it.lines[k], r.text.length);
          /* The space after a finished line is for copying. It doesn't get a column of its own past the edge. */
          setText(e, s ? (pre + s).slice(0, geo.chars) : '');
          setColor(e, r.color);
        }
      }
      spills = plan.end > geo.tickRows + Math.ceil(geo.picH / geo.lh);
      overKeys = plan.end > geo.sheetRows - geo.keyRows;
    }
    if (spills !== spill) { spill = spills; reelEl.classList.toggle('spill', spills); }
    if (overKeys !== spillKeys) { spillKeys = overKeys; reelEl.classList.toggle('spill-keys', overKeys); }
  }

  function render(v) {
    if (v.scene !== scene) {
      scene = v.scene;
      clearSheet();
      Object.keys(dropped).forEach((k) => { delete dropped[k]; });
    }
    setText(barLeft, geo.barBoth ? v.title.left : '');
    setColor(barLeft, v.title.leftColor);
    setColor(barRight, v.title.rightColor);
    drawTicker(v.ticker);
    drawPane(v.pane);
    drawSheet(v);
    drawCaption(v);
    drawLabels(v);
  }

  /* Forget what was last written, because the rows have changed under it. */
  function retext() {
    lastOne = lastTwo = lastCap = lastRight = lastLeft = null;
    folded = {};
    lastOp = -1;
    clearSheet();
    Object.keys(dropped).forEach((k) => { delete dropped[k]; });
  }

  /* ---- The still, before anything has played ---- */

  let stillOn = true;

  /* A frame of the film kept as one pixel per grain, and shown the same way as the film. It has no ticker,
     so no day and no count, and the picture takes those rows as well. */
  function drawStill() {
    const v = words.frame(STILL_T, geo.cols, geo.rows);
    v.ticker = null;
    v.labels.push({ x: SOUL_X - v.cam.x, y: SOUL_Y - v.cam.y, text: 'your soul', color: '#fac860', back: '#0a0a0e', story: true });
    ctx.fillStyle = COLORS.term;
    ctx.fillRect(0, 0, geo.cols, geo.rows);
    const w = still.naturalWidth, h = still.naturalHeight;
    if (w) {
      /* It goes on upwards as sky and downwards as rock, for as many rows as a tall picture has. */
      const x = -v.cam.x, y = -v.cam.y - STILL_SKY;
      ctx.drawImage(still, x, y);
      for (let up = y; up > 0; up -= STILL_SKY) ctx.drawImage(still, 0, 0, w, STILL_SKY, x, up - STILL_SKY, w, STILL_SKY);
      for (let down = y + h; down < geo.rows; down += STILL_DEEP) ctx.drawImage(still, 0, h - STILL_DEEP, w, STILL_DEEP, x, down, w, STILL_DEEP);
    } else {
      /* No picture, so nothing to name. */
      v.labels.length = 0;
      v.banners.length = 0;
    }
    render(v);
  }

  /* ---- The clock and the sound ---- */

  let reel = null, loading = false;
  let wanted = false, started = false, playing = false, ended = false, alive = true;
  let base = 0, baseAt = 0, seenA = -1, seenAt = 0;
  let audio = null, audioLive = false, audioDead = false, soundSeen = false, soundLate = false, userMuted = false, heldForWorld = false;
  let pressAt = 0, pressTimer = 0, worldTimer = 0, begunAt = 0, raf = 0, lastRaf = 0, behindSince = 0, frameNo = 0;
  let onScreen = true, dirty = true, hiddenWhilePlaying = false, framed = false, overlay = false;
  let shownSecond = -1;

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
        } else { base += err; t += err; }
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

  function ensureWorld() {
    if (reel || loading) return;
    loading = true;
    const made = Core.load({ seed: Core.pickSeed(Math.random()), slice: 6 });
    made.then(safely((r) => {
      r.warm();
      reel = r;
      loading = false;
      tryBegin();
    }), safely((e) => { throw e; }));
  }

  /* The sound has this long to arrive before the picture goes without it. */
  function tryBegin() {
    if (!wanted || started || !reel) return;
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
    behindSince = 0;
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
      behindSince = 0;
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
    const t = reel.t, falling = t >= T.FALL && t < T.WORLD;
    const open = geo.spare > 0 && (falling || (t >= T.EDGE && t < T.HIST));
    const rows = open ? geo.rows + geo.spare : geo.rows;
    /* The fall has nothing to line up with, so it centres on all of that. At the edge the rock stays where it was. */
    const v = reel.frame(t, geo.cols, falling ? rows : geo.rows);
    /* The word sits in the middle of the columns that show, not of the last one, which is partly past the edge. */
    if (v.mode === 'logo') v.cam.x = Math.round((VW - geo.picW / geo.g) / 2);
    if (v.mode !== 'none' || v.mode !== geo.lastMode) {
      reel.paint(image.data, geo.cols, rows, v.cam);
      ctx.putImageData(image, 0, 0, 0, 0, geo.cols, rows);
      geo.lastMode = v.mode;
    }
    if (open !== geo.open) { geo.open = open; reelEl.classList.toggle('under', open); }
    render(v);
    const ghosting = reel.t >= T.GHOST && reel.t < T.EDGE;
    if (ghosting !== reelEl.$ghost) { reelEl.$ghost = ghosting; reelEl.classList.toggle('ghosting', ghosting); }
    dirty = false;
  }

  function loop(now) {
    raf = 0;
    if (!playing || !alive) return;
    raf = requestAnimationFrame(guardedLoop);
    frameNo++;
    reel.reduced = motion.matches;
    const gap = now - lastRaf;
    lastRaf = now;
    const t = clockNow(now);
    const target = Math.min(t, HOLD);
    const before = target - reel.t;
    const stop = performance.now() + (before > 0.1 ? 24 : 10);
    let ticked = 0;
    while (reel.t + STEP / 2 <= target) {
      reel.tick();
      ticked++;
      if ((ticked & 3) === 0 && performance.now() > stop) break;
    }
    drawTime(reel.t);

    /* Late with the sound, by more than a slow start. The button says so until it arrives. */
    if (!soundSeen && !soundLate && !audioDead && now - begunAt > SOUND_LATE) { soundLate = true; buttons(); }

    /* The device can't keep up: it hands over to the video rather than falling further behind. Only catching up
       stops the count. A long gap is the machine having slept, and that gets a fresh start. */
    const behind = target - reel.t;
    if (behind > 1 && gap < 5000) {
      if (!behindSince) behindSince = now;
      else if (now - behindSince > 3000) { hand(); return; }
    } else behindSince = 0;

    if (onScreen && (ticked || dirty) && !(behind > 0.25 && (frameNo & 1))) draw();

    if (t >= T.END || (audio && audio.ended)) {
      /* The end card always lands. Past the last of the world there is nothing left to work out, so the picture
         gets there at once. If the world is still running, the video has the end instead. */
      if (reel.t < T.EXIT) { hand(); return; }
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

  function hand() {
    if (!alive) return;
    alive = false;
    const was = playing || (wanted && started);
    const at = started ? (ended ? 57.6 : Math.min(playing ? clockNow(performance.now()) : base, 57.6)) : 0;
    const muted = !!(audio && userMuted);
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(pressTimer);
    clearTimeout(worldTimer);
    if (audio) {
      audio.pause();
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
        hand();
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

    /* The ghost follows the pointer over the picture, through rock, touching nothing. */
    function ghostAt(e) {
      if (!reel || e.pointerType === 'touch') return;
      const r = pic.getBoundingClientRect();
      /* Inside the columns and rows that show whole, so the ring is never cut off by the picture's edge. */
      reel.pointer(Math.min(Math.floor((e.clientX - r.left) / geo.g), Math.floor(geo.picW / geo.g) - 3),
        Math.min(Math.floor((e.clientY - r.top) / geo.g), Math.floor(geo.picH / geo.g) - 3));
      dirty = true;
      if (!playing && started && !ended) draw();
    }
    on(pic, 'pointermove', ghostAt);
    on(pic, 'pointerleave', () => {
      if (!reel) return;
      reel.pointer(null);
      dirty = true;
      if (!playing && started && !ended) draw();
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
