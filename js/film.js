/* Exhibit A. Typed controls over a native video. Without this file the native controls remain. */
(function () {
  'use strict';

  const v = document.getElementById('film');
  if (!v) return;

  const box = document.getElementById('film-box');
  const ctl = document.getElementById('film-ctl');
  const cue = document.getElementById('film-cue');
  const bPlay = document.getElementById('film-play');
  const bMute = document.getElementById('film-mute');
  const bFull = document.getElementById('film-full');
  const time = document.getElementById('film-time');
  const bar = document.getElementById('film-bar');
  const seek = document.getElementById('film-seek');
  const slot = bar.parentNode;

  const FILM = 59;
  /* Frames from 57.2 s to 58.4 s are one still: the logo and "Silt isn't built yet".
     After that the film fades to black, so it holds here instead. */
  const END_CARD = 57.6;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let done = false, waiting = false, framed = false;

  v.removeAttribute('controls');
  ctl.hidden = false;
  cue.classList.add('on');

  const fill = document.createElement('span');
  const head = document.createElement('span');
  const rest = document.createElement('span');
  head.className = 'head';
  bar.appendChild(document.createTextNode('['));
  bar.appendChild(fill);
  bar.appendChild(head);
  bar.appendChild(rest);
  bar.appendChild(document.createTextNode(']'));

  /* The bar is typed, so it counts in whatever character actually arrived. */
  const probe = document.createElement('span');
  probe.className = 'probe';
  probe.textContent = '0000000000';
  slot.appendChild(probe);
  function cellWidth() { return probe.getBoundingClientRect().width / 10 || 9; }

  function pad(n) { n = Math.floor(n); return (n < 10 ? '0' : '') + n; }
  function fmt(s) { return pad(s / 60) + ':' + pad(s % 60); }
  function dur() { return isFinite(v.duration) && v.duration > 0 ? v.duration : FILM; }
  function now() { return done ? dur() : v.currentTime; }
  function fullElement() { return document.fullscreenElement || document.webkitFullscreenElement; }

  function drawBar() {
    const inner = Math.floor(slot.clientWidth / cellWidth() + 0.01) - 2;
    if (inner < 1) return;
    const k = Math.round(Math.min(1, now() / dur()) * (inner - 1));
    fill.textContent = '='.repeat(k);
    head.textContent = '>';
    rest.textContent = '.'.repeat(inner - k - 1);
  }

  function update() {
    const t = now();
    time.textContent = (waiting ? '--:--' : fmt(t)) + ' / ' + fmt(dur());
    seek.value = Math.round(t / dur() * 590);
    seek.setAttribute('aria-valuetext', fmt(t));
    drawBar();
  }

  function buttons() {
    bPlay.textContent = v.paused ? '[Play]' : '[Pause]';
    bPlay.setAttribute('aria-label', v.paused ? 'Play film' : 'Pause film');
    bMute.textContent = v.muted ? '[Muted]' : '[Mute]';
    bMute.setAttribute('aria-label', v.muted ? 'Muted film, turn sound on' : 'Mute film');
    bFull.textContent = fullElement() ? '[Exit]' : '[Full]';
    bFull.setAttribute('aria-label', fullElement() ? 'Exit full screen' : 'Full screen');
  }

  /* There is no film to play. The poster stays as a still, and nothing offers to play it. */
  function fail() {
    box.classList.add('dead');
    cue.classList.remove('on');
    v.pause();
  }

  function start() {
    if (box.classList.contains('dead')) return;
    if (done) { done = false; v.currentTime = 0; }
    const p = v.play();
    if (p && p.catch) p.catch((e) => {
      if (e.name === 'NotSupportedError') { fail(); return; }
      /* A browser rule on sound blocked it. Play silently; the button says so. */
      if (e.name !== 'NotAllowedError') return;
      v.muted = true;
      v.play().catch(() => {});
    });
  }
  function toggle() { if (v.paused) start(); else v.pause(); }

  /* The first press from above the fold brings the picture and its controls on screen. */
  function frameIt() {
    if (framed || fullElement()) return;
    framed = true;
    const by = Math.min(ctl.getBoundingClientRect().bottom - window.innerHeight, v.getBoundingClientRect().top);
    if (by > 0) window.scrollBy({ top: by, behavior: reduced ? 'auto' : 'smooth' });
  }

  v.addEventListener('play', frameIt);

  /* Once it is really running the cue is spent. The words beside it stay exactly where they are. */
  v.addEventListener('playing', () => {
    if (document.activeElement === cue) bPlay.focus({ preventScroll: true });
    cue.classList.remove('on');
  });

  function setWaiting(state) {
    if (waiting === state) return;
    waiting = state;
    update();
  }
  v.addEventListener('waiting', () => { setWaiting(!v.paused); });
  v.addEventListener('stalled', () => { setWaiting(!v.paused && v.readyState < 3); });
  ['playing', 'pause', 'canplay'].forEach((e) => { v.addEventListener(e, () => { setWaiting(false); }); });

  v.addEventListener('ended', () => {
    done = true;
    if (dur() > END_CARD) v.currentTime = END_CARD;
    buttons();
    update();
  });

  v.addEventListener('error', fail);
  v.querySelectorAll('source').forEach((s) => { s.addEventListener('error', fail); });

  cue.addEventListener('click', start);
  bPlay.addEventListener('click', toggle);
  v.addEventListener('click', toggle);
  bMute.addEventListener('click', () => { v.muted = !v.muted; });
  bFull.addEventListener('click', () => {
    if (fullElement()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
    else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch (e) { /* Not before the film has loaded. */ } }
  });

  seek.addEventListener('input', () => {
    /* Nothing is fetched until someone asks. Scrubbing is asking. */
    if (v.readyState === 0) v.preload = 'metadata';
    const at = seek.value / 590 * dur();
    if (at >= dur() && v.paused) {
      /* The card, rather than the black frame after it. */
      done = true;
      v.currentTime = END_CARD;
    } else {
      done = false;
      v.currentTime = at;
    }
    update();
  });
  seek.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    toggle();
  });

  ['play', 'pause', 'volumechange', 'seeked'].forEach((e) => {
    v.addEventListener(e, () => { buttons(); update(); });
  });
  ['timeupdate', 'loadedmetadata'].forEach((e) => { v.addEventListener(e, update); });

  ['fullscreenchange', 'webkitfullscreenchange'].forEach((e) => {
    document.addEventListener(e, () => {
      box.classList.toggle('full', fullElement() === box);
      buttons();
      drawBar();
    });
  });

  if (window.ResizeObserver) new ResizeObserver(drawBar).observe(slot);
  else window.addEventListener('resize', () => { requestAnimationFrame(drawBar); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawBar);

  buttons();
  update();
})();
