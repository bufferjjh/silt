/* The gutter is 129 rows, in the stylesheet. This keeps the page that tall:
   the voids share out whatever rows the content leaves at this width, in whole rows, by weight.
   Without this file the last void takes all of it, so the count still ends on the last row. */
(function () {
  'use strict';

  const ROWS = 129;
  const root = document.documentElement;
  const page = document.getElementById('page');
  if (!page) return;
  const hasRound = window.CSS && CSS.supports && CSS.supports('width', 'round(down, 1px, 1px)');

  function read(el, name) { return parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0; }

  function layout() {
    /* 100vw counts a classic scrollbar; the page cannot use that width. */
    const pageW = root.clientWidth;
    root.style.setProperty('--page-w', pageW + 'px');
    const lh = read(root, '--lh');

    /* Browsers without CSS round(): snap the fluid frame and the film to the grid here. */
    if (!hasRound) {
      root.style.removeProperty('--fw');
      root.style.removeProperty('--film-h');
      if (getComputedStyle(root).getPropertyValue('--fluid').trim() === '1') {
        const cw = read(root, '--cw');
        const fw = Math.floor((pageW - read(root, '--left') - read(root, '--right')) / cw) * cw;
        root.style.setProperty('--fw', fw + 'px');
        root.style.setProperty('--film-h', Math.ceil(fw * 9 / 16 / lh) * lh + 'px');
      }
    }

    let used = 0, weight = 0;
    const voids = [];
    [...page.children].forEach((el) => {
      if (el.classList.contains('void')) {
        const v = { el, min: read(el, '--min'), w: read(el, '--w'), add: 0, frac: 0 };
        voids.push(v);
        used += v.min;
        weight += v.w;
      } else {
        used += Math.round(el.offsetHeight / lh);
      }
    });

    /* Largest remainder, so the shares always add up to whole rows. */
    const extra = Math.max(0, ROWS - used);
    let left = extra;
    voids.forEach((v) => {
      const share = extra * v.w / weight;
      v.add = Math.floor(share);
      v.frac = share - v.add;
      left -= v.add;
    });
    voids.slice().sort((a, b) => b.frac - a.frac).forEach((v) => {
      if (left > 0 && v.w > 0) { v.add++; left--; }
    });
    voids.forEach((v) => { v.el.style.setProperty('--n', v.min + v.add); });
  }

  /* The width and the size tier matter. A phone's collapsing address bar must not move anything. */
  function key() { return window.innerWidth + '/' + getComputedStyle(root).getPropertyValue('--cols'); }
  let last = '', queued = false;
  window.addEventListener('resize', () => {
    if (queued || key() === last) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      last = key();
      layout();
    });
  });

  last = key();
  layout();
  window.addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
})();
