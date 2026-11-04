/* assets/og.jpg, the share card: the whole valley at x8 at 52.6 s (800 x 420 cells, from 89 rows above the world's
   top), scaled to 1200 x 630 (each cell 1.5 px: drawn 3 x 3, then averaged 2 x 2), with the words on top in Plex Mono.
   Usage, from the repo root: node tools/og.mjs <out.jpg> [seed=10] */
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { launch } from './serve.mjs';
const require = createRequire(import.meta.url);
const R = require(resolve('js/reel-core.js'));
const { png } = require('./png.cjs');
const [outArg, seedArg] = process.argv.slice(2);
const C = 800, ROWS = 420, OW = 1200, OH = 630;
const reel = R.create({ seed: +(seedArg || 10) });
while (reel.t < 52.6) reel.tick();
const cells = new Uint8ClampedArray(C * ROWS * 4);
reel.paint(cells, C, ROWS, { mode: 'world', z: 8, x: 0, y: -89 });
const bg = new Uint8ClampedArray(OW * OH * 4);
for (let Y = 0; Y < OH; Y++) for (let X = 0; X < OW; X++) for (let ch = 0; ch < 3; ch++) {
  let s = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s += cells[(((2 * Y + j) / 3 | 0) * C + ((2 * X + i) / 3 | 0)) * 4 + ch];
  bg[(Y * OW + X) * 4 + ch] = (s + 2) >> 2;
}
/* The font goes in as data: a page made with setContent can't load file:// fonts. */
const font = 'data:font/woff2;base64,' + readFileSync(resolve('assets/ibm-plex-mono-latin-400-normal.woff2')).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "IBM Plex Mono"; src: url("${font}") format("woff2"); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #100D0B; }
img { position: absolute; left: 0; top: 0; width: 1200px; height: 630px; image-rendering: pixelated; }
.t { position: absolute; font: 400 30px/48px "IBM Plex Mono"; text-transform: uppercase; color: #ECE2D2; background: #1F1714; padding: 0 18px; white-space: pre; }
.small { font-size: 20px; line-height: 36px; padding: 0 12px; }
</style></head><body>
<img src="data:image/png;base64,${png(OW, OH, bg).toString('base64')}" alt="">
<div class="t small" style="left: 36px; top: 30px">Silt</div>
<div class="t small" style="right: 36px; top: 30px">In development</div>
<div class="t" style="left: 36px; bottom: 36px">Every afternoon leaves a layer.</div>
</body></html>`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: OW, height: OH }, deviceScaleFactor: 1 });
await page.goto('about:blank');
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(resolve(outArg), await page.screenshot({ type: 'jpeg', quality: 90 }));
console.log('wrote', outArg);
await browser.close();
