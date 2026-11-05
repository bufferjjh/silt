import { serve, virtualClock, launch } from '../tools/serve.mjs';
const site = await serve(process.cwd());
const browser = await launch();
const out = [];
for (const [W,H,D] of [[1440,900,1],[1440,900,2],[1100,800,1],[1000,800,1],[1600,900,1],[390,844,3]]) {
  const page = await browser.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:D, isMobile:W<600, hasTouch:W<600 });
  await virtualClock(page, 10);
  await page.goto(site.url, { waitUntil:'load' });
  await page.evaluate(() => document.getElementById('exhibit-a').scrollIntoView({block:'start'}));
  await page.waitForFunction(() => window.SiltStage && window.SiltStage.reel, null, {timeout:60000, polling:100});
  for (let k=0;k<20;k++) await page.evaluate(() => window.__step(16));
  const r = await page.evaluate(() => {
    const c = document.querySelector('#film-box canvas'); const s = document.getElementById('sand-stage');
    const cb = c ? c.getBoundingClientRect() : null; const sb = s.getBoundingClientRect();
    return { canvas: c ? [c.width, c.height, +cb.width.toFixed(2), +cb.height.toFixed(2)] : null, stage:[sb.width, sb.height], rows: Math.round(document.getElementById('page').getBoundingClientRect().height) };
  });
  // wake exhibit B
  await page.evaluate(() => document.getElementById('exhibit-b').scrollIntoView({block:'start'}));
  for (let k=0;k<200;k++) { await page.evaluate(() => window.__step(16)); const ok = await page.evaluate(() => !document.getElementById('sand').hidden); if (ok) break; await page.waitForTimeout(50); }
  const b = await page.evaluate(() => { const c = document.getElementById('sand'); const bb=c.getBoundingClientRect(); return [c.width, c.height, +bb.width.toFixed(2), +bb.height.toFixed(2), c.hidden]; });
  out.push({ W, H, D, ...r, sand: b });
  await page.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close(); site.close();
