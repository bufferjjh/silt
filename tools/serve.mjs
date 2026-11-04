/* Serves the repo at /silt/ as GitHub Pages does, minus the sound and the video, so the film keeps its own clock
   and never hands over to the mp4. Shared by render.mjs and shots.mjs. */
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.vtt': 'text/vtt' };
export async function serve(siteDir) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!url.startsWith('/silt/')) { res.writeHead(404).end(); return; }
    let p = normalize(join(siteDir, url.slice(6)));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (/\.(m4a|mp4)$/.test(p) || !existsSync(p)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}/silt/`, close: () => server.close() };
}
/* A virtual clock: performance.now and requestAnimationFrame move only when __step(ms) is called, and
   Math.random is pinned so SiltReel.pickSeed lands on the given seed. Same as the published renders. */
export async function virtualClock(page, seed) {
  await page.addInitScript((s) => {
    Math.random = () => (s - 0.5) / 256;
    let vt = 1000;
    performance.now = () => vt;
    const cbs = [];
    window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
    window.cancelAnimationFrame = () => {};
    window.__step = (ms) => { vt += ms; const list = cbs.splice(0); list.forEach((cb) => cb(vt)); };
  }, seed);
}
/* PLAYWRIGHT can point at another build (a file:// URL to playwright-core's index.mjs); CHANNEL=chrome uses an
   installed Chrome instead of Playwright's own Chromium. */
export async function launch() {
  const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
  return chromium.launch({ headless: true, ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}) });
}
