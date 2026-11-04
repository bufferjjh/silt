/* Renders the live film to a lossless 1920x1080, 30 fps master (ffv1 in .mkv, picture only) by driving the real
   page on a virtual clock: 1280x720 CSS at device scale 1.5, in [Full]. The published mp4 is encoded from the
   master with the soundtrack copied in. 1800 frames take a long while; run it in the background.
   Usage, from the repo root: node tools/render.mjs <master.mkv> [--seed=10] [--frames=1800] [--poster=poster.png@52.6]
   [--late=0] (seconds to sample every frame after its time; a hair, such as 0.002, puts the x4 cut on its own frame) */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { serve, virtualClock, launch } from './serve.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [out] = args.filter((a) => !a.startsWith('--')).map((p) => resolve(p));
const FPS = 30, FRAMES = +(flags.frames || 1800), VWID = 1280, VHGT = 720, SCALE = 1.5, LATE = +(flags.late || 0);
const site = await serve(process.cwd());
const browser = await launch();
const page = await browser.newPage({ viewport: { width: VWID, height: VHGT + 27 }, deviceScaleFactor: SCALE });
await virtualClock(page, +(flags.seed || 10));
await page.goto(site.url, { waitUntil: 'load' });
await page.evaluate(() => document.getElementById('exhibit-a').scrollIntoView({ block: 'start', behavior: 'instant' }));
await page.waitForFunction(() => window.SiltStage && window.SiltStage.reel, null, { timeout: 60000, polling: 100 });
/* Full screen, or the overlay where the page can't have that. */
await page.click('#film-full');
for (let k = 0; k < 10; k++) await page.evaluate(() => window.__step(16));
await page.waitForTimeout(500);
for (let k = 0; k < 10; k++) await page.evaluate(() => window.__step(16));
const box = await page.evaluate(() => { const r = document.querySelector('#film-box .film').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
console.log('film box', JSON.stringify(box));
await page.click('#film-play');
/* The press waits for the sound; there isn't any, so it starts after a moment. */
await page.waitForFunction(() => window.SiltStage.playing, null, { timeout: 15000, polling: 100 });
console.log('started at', await page.evaluate(() => window.SiltStage.reel.t));
const crop = `crop=${Math.round(VWID * SCALE)}:${Math.round(VHGT * SCALE)}:0:0`;
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-vf', crop,
  '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const [posterPath, posterT] = flags.poster ? String(flags.poster).split('@') : [null, 0];
let posterDone = false;
if (LATE) await page.evaluate((ms) => window.__step(ms), LATE * 1000);
for (let f = 0; f < FRAMES; f++) {
  if (f) await page.evaluate((ms) => window.__step(ms), 1000 / FPS);
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: VWID, height: VHGT } });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (posterPath && !posterDone && f / FPS >= +posterT) { writeFileSync(posterPath, buf); posterDone = true; }
  if (f % 150 === 0) console.log('frame', f, await page.evaluate(() => window.SiltStage.reel.t.toFixed(2)));
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log('wrote', out);
await browser.close();
site.close();
