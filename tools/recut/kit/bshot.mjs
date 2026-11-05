// Exhibit B's stage screenshot at a viewport (reduced motion, opening frame). Usage: node bshot.mjs out.png W H dpr
import { serve, launch } from '../tools/serve.mjs';
const [out, W, H, D] = process.argv.slice(2);
const site = await serve(process.cwd());
const browser = await launch();
const page = await (await browser.newContext({ viewport:{width:+W,height:+H}, deviceScaleFactor:+D, isMobile:+W<600, hasTouch:+W<600, reducedMotion:'reduce' })).newPage();
await page.goto(site.url, { waitUntil:'load' });
await page.evaluate(() => document.getElementById('exhibit-b').scrollIntoView({block:'start'}));
await page.waitForFunction(() => !document.getElementById('sand').hidden, null, {timeout:20000, polling:100});
await page.waitForTimeout(300);
await (await page.$('#sand-stage')).screenshot({ path: out });
console.log('wrote', out);
await browser.close(); site.close();
