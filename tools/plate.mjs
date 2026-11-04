/* assets/cross-section.png, Exhibit B's frozen frame: what a visitor sees before the live cross-section starts. The
   page at 1440 x 900, dpr 1, reduced motion: the stage is 1152 x 648 CSS px, 576 x 324 grains of 2 CSS px. Its canvas
   is scaled 2x with no smoothing, so the PNG at its own size has the live grains. The opening is composed and the same
   on every visit, so this is deterministic.
   Usage, from the repo root: node tools/plate.mjs <out.png> */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve, launch } from './serve.mjs';
const out = resolve(process.argv[2] || 'cross-section.png');
const site = await serve(process.cwd());
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })).newPage();
await page.goto(site.url, { waitUntil: 'load' });
await page.evaluate(() => document.getElementById('exhibit-b').scrollIntoView({ block: 'start' }));
await page.waitForFunction(() => !document.getElementById('sand').hidden, null, { timeout: 20000, polling: 100 });
await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const c = document.getElementById('sand');
  const big = document.createElement('canvas');
  big.width = c.width * 2; big.height = c.height * 2;
  const x = big.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, big.width, big.height);
  return { w: c.width, h: c.height, data: big.toDataURL('image/png') };
});
if (r.w !== 576 || r.h !== 324) throw new Error('unexpected stage size ' + r.w + 'x' + r.h);
writeFileSync(out, Buffer.from(r.data.split(',')[1], 'base64'));
console.log('wrote', out, '(optimise it losslessly, e.g. with PIL optimize=True, before committing)');
await browser.close(); site.close();
