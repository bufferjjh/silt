/* Screenshots of the film box at film times, on the real page at any size, on a virtual clock.
   Usage, from the repo root: node tools/shots.mjs <outDir> <W> <H> <dpr> <seed> t1,t2,...
   Never ask for a time past 59.4: the film holds its end card there and the loop would never finish. */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve, virtualClock, launch } from './serve.mjs';
const [outArg, W, H, DPR, SEED, TIMES] = process.argv.slice(2);
const out = resolve(outArg); mkdirSync(out, { recursive: true });
const times = TIMES.split(',').map(Number);
if (times.some((t) => t > 59.4)) { console.error('times must be 59.4 or less'); process.exit(1); }
const site = await serve(process.cwd());
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, isMobile: +W < 600, hasTouch: +W < 600 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await virtualClock(page, +SEED);
await page.goto(site.url, { waitUntil: 'load' });
await page.evaluate(() => document.getElementById('exhibit-a').scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.waitForFunction(() => window.SiltStage && window.SiltStage.reel, null, { timeout: 60000, polling: 100 });
for (let k = 0; k < 20; k++) await page.evaluate(() => window.__step(16));
const el = await page.$('#film-box .film');
await el.screenshot({ path: join(out, 'cover.png') });
await page.click('#film-play');
await page.waitForFunction(() => window.SiltStage.playing, null, { timeout: 30000, polling: 100 });
for (const t of times) {
  await page.evaluate((t) => { while (window.SiltStage.reel.t < t) window.__step(1000 / 30); }, t);
  await el.screenshot({ path: join(out, `t${t.toFixed(1).padStart(4, '0')}.png`) });
}
/* Errors other than the 404s for the sound and video, which serve.mjs withholds on purpose. */
console.log('t', await page.evaluate(() => window.SiltStage.reel.t), 'errors', JSON.stringify(errors.filter((e) => !/404/.test(e))));
await browser.close(); site.close();
