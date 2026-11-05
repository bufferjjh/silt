# The ending on Exhibit B: what is feasible, measured

A technical scout for the new ending: the patch grows into Exhibit B's scene and the film's last pull-back lands on
Exhibit B's framing. Everything below was measured or prototyped in copies inside `review-local/scout/` (no tracked
file was touched). Machine: this 4-CPU box, Node 22, the Chrome at `CHROME_PATH`.

## The short answer

- **Exhibit B can be built and drawn without the DOM.** Five small changes to a copy of `js/sand.js` make `boot()`
  reachable from Node. Under Node, `boot(576, 324, 1.5, 384, 216)`, 180 settle updates and one render give
  `cross-section.png` (downscaled 2× with nearest) **pixel for pixel: 0 of 186,624 grains differ**. The same core also
  matches the page's own stage at dpr 2 (768 × 432 grains) and on a 390 phone (213 × 390 grains), pixel for pixel. With
  the copied core in the real page, `tools/plate.mjs` gives the identical plate.
- **Recommended: (a) for the last shot, with (b)'s shared composition for the views that show B's scene.** Exhibit B's
  own renderer draws the final frame, which makes it exact at 1440 and the same for every seed. The film's world is
  laid out from B's plan, and its 1:1 view can be B's own composition built finer, part by part (prototyped with tags).
  The film's own engine keeps the creature's actions, the water and everything outside B's frame.
- **The dice shift is fully explained, and a new creature can go in without it.** Two readers of today's creature
  grains run during the settle: `damp()` throws dice for the two bed grains under its feet, and the moss-site list
  gains two terrace-wall grains beside its right edge. Holding today's creature in the arrays through the settle,
  clearing it in `begin()` and drawing the new creature as an overlay leaves `cross-section.png` unchanged except **63
  grains, all inside x 419–431, y 90–101**. Verified under Node and in the page.
- **End rows at 1440 dpr 1:** 283½ rows of picture with today's freed strip (pane and keys). If the ticker and caption
  rows are freed as well, the film box below the title bar is exactly **648 CSS px = 324 cells = all of Exhibit B**.
- **Seeds:** under (a) the final frame takes nothing from the film's dice. The prototype gate showed seeds 1–24 and
  250–256 all byte-for-byte equal to seed 10. Today's end card fails the same gate for every seed, so the gate catches
  a real difference.

## 1. Exhibit B without the DOM

**What in `sand.js` touches the page:**
- The top of the file: ten `document.getElementById`, `canvas.getContext`, an early `return` if anything is missing,
  and `window.indexedDB`.
- Inside `boot()`, only `ctx.createImageData` (line 187).
- In `render()`, only `ctx.putImageData` (line 2314).
- In `begin()`, `window.crypto.getRandomValues`, inside a try that falls back to `Math.random`.
- The page block after line 2364: `measure()`, `place()`, `settle()`, `start()` and the observers, using
  `devicePixelRatio`, `getBoundingClientRect`, `requestAnimationFrame`, timers and `IntersectionObserver`.

`layout()`, the whole composition, `update()` and the rest of `render()` are plain typed-array and `Math` work.

**The change** (`proto/make-core.cjs` applies it to a copy and asserts each edit lands exactly once; the result is
`proto/sand-core.js`):
1. Element lookups only where a document exists. The page block runs only if it found its elements (`PAGE`).
2. `boot(GW, GH, U, PW, PH, opts)` draws into `{ width, height, data: Uint8ClampedArray }` when there is no 2D
   context, or when `opts.bare` is set.
3. `render()` calls `putImageData` only when it has a canvas.
4. The world exposes `out`/`image`, and `begin(seed)` takes an optional seed for the run dice.
5. `{ boot, layout, OPENING, PLAN, GRAIN }` is exported (`module.exports` under Node, `window.SiltSand` in a page).

**Verification:**

| Check | Result |
|---|---|
| Node, 576×324 U 1.5, 180 updates, `begin`, render vs `ref/cross-section.png` ↓2× nearest | 0 grains differ |
| `tools/plate.mjs` run from `scout/site/` (the page with the copied core as `js/sand.js`) vs ref | 0 differ |
| Node 768×432 U 2, ×3, vs the page's stage at 1440×900 dpr 2 (`proto/page-b-1440@2.png`) | 0 px differ |
| Node 213×390 U 1.8, ×5 and cropped, vs `ref/b-phone-390x844@3.png` | 0 px differ |

No difference showed up between Node (V8 12.4) and Chrome 153, even though the composition uses `Math.sin`/`pow`/`hypot`.
In another browser engine, B's composition may differ from the plate by a last-ulp grain, exactly as the live B
already would there; the film drawing with B's own code would agree with B on that browser.

**Timings, boot + 180 settle updates** (ms; Node in a fresh process; Chrome measured synchronously in a blank page,
cold run then warm; `proto/plate-node.cjs`, `proto/time-chrome.mjs`):

| Size | Node boot | Node settle | Chrome boot | Chrome settle | Chrome render / update (warm) |
|---|---|---|---|---|---|
| 576×324, U 1.5 (1440 dpr 1) | 205–225 | 116–165 | 228 cold, 85 warm | 157–175 (253 once) | 1.1–1.5 / 0.9–1.15 |
| 768×432, U 2 (dpr 2) | 320–356 | 190–300 | 120–180 | 367–403 | 1.8–3.0 / 1.9–2.1 |
| 213×390, U 1.8 (phone) | 115–137 | 99–100 | 35–55 | 92–100 | 0.6–0.75 / 0.5 |
| 922×519, U 2.4 | 468 | 380 | – | – | – |
| 1152×648, U 3 | 470–608 | 518–731 | 230–300 | 1025–1197 | 4.1–5.6 / 6.1 |
| 1383×778, U 3.6 | 568 | 1278 | – | – | – |

Inside the film's page, right after the film loaded (real clock), B at 576×324 took 191–257 ms to boot and 213–273 ms
to settle. Under Node, warm: render 0.8 ms, live update 0.33–0.5 ms.

## 2. Three approaches to "grows into B, lands on B's framing"

| | (a) B's renderer draws the last shot | (b) B's composition is the film's near world | (c) the film's world laid out by hand |
|---|---|---|---|
| How | `sand.js` exports a DOM-free builder (§1). The film builds B's opening (576×324, U 1.5, settled, `begin(OPENING)`) and from the last cut copies a band of B's pixels, one cell a grain. | B's plan is shared. Its composition is built at a finer U for the 1:1 (and optionally the close-up). Each grain is tagged with the part that placed it (`proto/make-tags.cjs`), so the film shows the bare land first and lets parts grow in on their days. The last frame is still (a). | `reel-core.js` gets new LAND/PATCH/HOUSES-style data copied from B's layout, and draws B's cabin, well, terraces and cave again in its own materials. |
| `sand.js` changes | §1's changes plus the creature (§4). About 20 lines; B unchanged (verified). | (a)'s, plus `opts.tags`: about 40 lines, inert unless asked (plate unchanged, verified). Optional crop window for cheaper near builds: a larger refactor (§8). | Only the creature. |
| `reel-core.js` / `reel.js` | `everything()` builds B after the slow-build check. `frame()` gets a `'b'` camera mode `{ x, y: band }`. `paint()` copies the band, plus a dissolve from the film's last picture. The hold can run B live (rebuilt on `reset`). `reel.js` frees the end rows and places the end words, and the logo goes. | All of (a). The near levels are built from B's tagged composition: B's materials map to the film's for physics, a per-grain colour layer keeps composed grains B's colour, and parts get dates. The pull-back 1:1 → final is between two densities of the same composition. | The world data and drawings are rewritten. The film's painter draws the end. |
| 1440 dpr 1 end | Pixel for pixel with the band of `cross-section.png` (verified: rows 0–284). | Same as (a). | Not pixel for pixel: different grain noise, dither, light and water drawing. The same seed-to-seed issue as today (≈135–160 cells of the patch differ between seeds at t 51–55). |
| dpr 2 end | The film keeps 2 CSS px cells, so it shows the U 1.5 picture, which is exactly B's frozen still (the page shows that same PNG at every dpr). Live B below is U 2 at 1.5 CSS px: same plan, same places, finer texture (`proto/end-dpr2-compare.png`). For an exact match, switch the canvas to 3 device px a cell at the cut and draw B at U 2 (+≈550 ms build). | Same as (a). | Approximate. |
| 390 phone end | Film canvas 353×265 cells of 1 CSS px. (i) A 353-column crop of the 1440 composition: cabin, well, cabbages and creature, water under the beds. (ii) The phone layout (pond, meadow, cabin, well, stream, cave) built at U 3, a 265-row band of B's own phone picture at 1 px grains. (iii) The phone stage exactly: the phone layout at U 1.8, the canvas at 5 device px a cell, 213 columns. See `proto/end-phone-options.png`. | Same as (a). | Approximate. |
| Build cost | +≈370 ms Node / +400–530 ms Chrome, if all up front. | (a) plus B at U 2 (≈350 ms Node, no settle needed) and optionally U 3 (≈470–600 ms), or lazily before each is first seen. | Like today's build. |
| Frame pace | The end-shot paint is a copy (cheaper than today's far paint, 0.7–3.6 ms). A live hold costs ≈2–2.6 ms a B tick in Chrome (≈80–105 ms a second at 40 ticks/s) while the film's physics is idle. `keepsUp` is unaffected. | The near physics stays as it runs today. Painting adds a colour-layer lookup. | Like today. |
| Risk | Low. The B side is proven identical. The visible risk is the join: a dissolve between the film's last picture and B's. | Medium–high: a deep rework of the near levels and painter. Low risk to B (tags are inert). | High for "matches": two copies of the drawing that drift. No route to an exact end without (a). |

The dissolve: a per-cell Bayer threshold over 4×4 cells, 16 steps across about 0.8 s, keeps every cell exactly one
picture's colour (no blended colours, nothing shimmers). It also works between two scales, which makes it the
"crossfade between levels" option. A hard cut on the bell is the alternative.

`proto/views-b.cjs` renders B's composition at U 2, 2.4, 3 and 3.6, cropped to the film's 577×244 picture around the
creature (`proto/view-U2.4.png`, `proto/view-U3.6.png`): what (b)'s 1:1 and close-up would look like when grown.
`proto/stages-U2.4.png` shows the same 1:1 view growing part by part from tags: land, underground, pond furniture,
trees, home, terraces and creature, grass, wildflowers, all. Its last stage is identical to the frozen frame.
Prototype limit: the pond's water and bed and the terraces' tilled tops are laid in the ground pass, so they are
already there in the bare stage. Phase 2 would tag those branches too. The lights of parts not yet grown are left out.

## 3. Seeds

The film's dice change with the seed; B's opening never does. Under (a) the final frame is composed with the fixed
dice `OPENING`, settled with the xorshift seeded from `OPENING`, and (for a live hold) continued after
`begin(OPENING)`. Nothing from the film's seed reaches it. Any dissolve frames before it can differ by seed; the last
frame cannot. Under (b) and (c), the near physics (water, grass by dice) has to be replaced by the composed state at a
cut before the last shot ("settle deterministically"). Today, between seeds 3 and 10, 160 cells differ at t 51 and
135 at t 55: all of them the patch's live grains.

**The gate** (`proto/story-end.cjs`, written to drop into `tools/story.cjs`):
1. After the existing loop to 45 s, tick on to the hold (59.4 s).
2. Paint the final frame at the end sizes, 577×285 (1440 dpr 1 with the strip freed) and 353×265 (390 phone), and
   hash the RGBA.
3. Fail any seed whose hashes are not seed 10's.
4. `--plate` also checks once that the 1440 frame's first 576 columns equal the shown band of
   `assets/cross-section.png`, decoded by `proto/png-read.cjs`.

Results:
- With the prototype of (a): seeds 1–24 and 250–256 all match seed 10, and the 1440 frame equals `cross-section.png`
  rows 0–284 pixel for pixel. With the new-creature core it differs by exactly the creature's 63 grains; that clears
  once the plate is regenerated.
- Run on today's film (`--today`), every seed fails: the end card's grain order uses the film's dice, and 27,415 of
  140,788 cells differ.
- Cost: about 0.7 s more of film per seed, so about +3 min on the 10-minute 256-seed run.

## 4. The dice shift, and a new creature with the frozen frame unchanged

**Why removing today's creature changed grass elsewhere** (`proto/dice-trace.cjs` traces the run dice after every
phase of `update()` with and without it):
- The composition is identical apart from the creature's own 64 grains (x 419–431, y 93–101). The creature uses no
  dice, and both dice streams are equal after composition.
- **`damp()`** throws `r32()` for every soaking grain (SOIL/TURF/TILL) with air, a blade, litter or a seed above it,
  and again if it holds water. Today's feet stand on the cabbage bed. Without them the bed grains **(423,102) and
  (429,102)** are open, so every update throws extra dice. The first divergence is in **update 1, in `damp()`**. From
  there every later die moves: blades grow and shrink (`blades()` inside `damp()`), drying, water, plants, worms,
  flies, fish, drips and moss.
- **The moss sites `mossC`** are listed once after composing: stone and masonry with an open face. Today's creature's
  right edge (x 431, rows 97–98) covers the face of the second terrace's retaining wall. Without it, **(432,97) and
  (432,98)** become moss sites (912 → 914), and `mossPass()`'s picks change. Holding only the feet, the first
  divergence is in update 4, in `director()`.
- After the 180 updates, 262 grains' materials differ and about 2,950 grains of the frame differ.

**The prototype** (`proto/make-newcre.cjs`, variant `hold`):
- Today's creature and its sprout are composed exactly as now, but held: their indices are kept in `stand`.
- `begin()` clears them just before the first frame is drawn.
- The new creature is a 10×9 placeholder sprite, hovering two grains above the bed. It is drawn in `render()` after
  the grains, sky, clouds and fish, and before the light.

Results:
- Exhibit B's frozen frame vs `cross-section.png`: 63 grains differ, all inside x 419–431, y 90–101: the old
  creature's grains and the new one's.
- `tools/plate.mjs` run from `scout/site-newcre/` equals the Node render exactly (`proto/newcre-before-after-8x.png`
  shows both, 8×).
- Variant `feet`, which holds only the four grains the dice read ((423,101), (429,101), (431,97), (431,98)), gives the
  identical frame. That proves the cause.
- Variant `none` (no hold) shifts about 2,980 grains.
- The living counter goes from 7,485 to 7,479, because the sprout's grains leave (unless the new creature keeps a
  sprout as grains).

**A hovering, animated creature in B:**
- Phase comes from `T − T0`, so the frozen frame is always phase 0 and stays identical.
- Bob: one grain up for 60 of every 120 ticks (a 3 s cycle). Blink: eyes shut 5 of every 230 ticks.
- Checked live in the page (`proto/live-probe.mjs`): the bob steps rows 96 ↔ 95, and a blink came at 5.7 s.
- With reduced motion B doesn't run, so it stays at phase 0.
- Speed: render 0.77–0.85 ms with or without the overlay (`proto/render-bench.cjs`); update unchanged. The overlay is
  not in the arrays, so rain and seeds pass behind it. If it should block them, add blocker grains in `begin()`, never
  before.
- Each U needs its own sprite or a rasterised definition: 10×9 at U 1.5; about 13×12 at U 2 (dpr 2); U 1.875, 2.25 and
  1.8 for dpr 1.25, 1.5 and 3. Desktop only, since the phone layout has no terraces. The hold works at every U,
  because it is today's code.

## 5. Zoom-out numbers

Today: close-up 8 cells a valley grain (`CLOSE.S` 8), 72 valley grains across the 577-cell picture; 1:1 4 cells a
valley grain (`NEAR.S = Q = 4`), 144 across. The creature is 4 valley grains wide: 32 / 16 cells. The final frame
fixes the creature at B's 10 grains (U 1.5), so the 1:1 size sets the B-to-1:1 ratio: B's width ÷ 1:1 width = (1:1
creature cells) ÷ 10.

| Ladder | Close / 1:1 / final creature (cells) | (b): U (grains a plan step) close / 1:1 / final | 1:1 shows | Close shows | B's width ÷ 1:1 view | More world than today, in creature widths across (close / 1:1) |
|---|---|---|---|---|---|---|
| L1 (as asked: 24 / 16) | 24 / 16 / 10 | 3.6 / 2.4 / 1.5 (5 steps = 18 / 12 / 7.5 cells) | 240 steps, 62.5 % of B | 160 steps, 41.7 % | **1.6×** | 1.33× / 1.0× |
| L2 (2× kept) | 24 / 12 / 10 | 3.6 / 1.8 / 1.5 | 320 steps, 83 % | 160 steps, 41.7 % | **1.2×** | 1.33× / 1.33× |
| L3 (integer U) | 20 / 13⅓ / 10 | 3 / 2 / 1.5 | 288 steps, 75 % | 192 steps, 50 % | **1.33×** | 1.6× / 1.2× |

For (a), the film keeps its own engine and B's plan is placed on its valley grid. Integer fine levels in each ladder:
- **L1:** a valley grain = 5/3 plan steps (2.5 B grains). `Q = NEAR.S = 4` as today, `CLOSE.S` 8 → 6. The creature is
  4 valley grains, today's exact world size. B's frame = 2.5 cells a valley grain.
- **L2:** a valley grain = 20/9 steps. `Q`, `NEAR.S`, `CLOSE.S` all stay as today. B's frame = 1.8 cells a valley
  grain. Not plan-friendly: 9 valley grains = 20 steps.
- **L3:** a valley grain = 2 plan steps (3 B grains). `Q = NEAR.S = 4`, `CLOSE.S` 6. B's frame = 3 cells a valley
  grain (192 valley grains across). Every plan step is a whole number of cells in every view: 3, 2 and 1.5.

The conflict to show the owner: with B's creature fixed at 10×9, a 16-cell creature at 1:1 (L1) means the 1:1 shows
as many creature widths as today's 1:1. The zoom-out then only reaches the close-up. A real 1:1 zoom-out of
1.2–1.4× needs about 11½–13⅓ cells (L2/L3). The pull-back from 1:1 to the final frame is gentle in every ladder
(1.2–1.6×): a dissolve, or one or two intermediate B builds (for example U 1.75 for L3, about 280 ms each), stepped on
beats.

## 6. End rows

Measured on the page (`proto/geo-probe.mjs`). This corrects CONTEXT's 577×257: that is the canvas while the cover
still is up, when the picture includes the ticker row.

| | 1440×900 dpr 1 (box 675 px, 25 rows of 27) | 390×844 dpr 3 (box 384 px, 16 rows of 24) |
|---|---|---|
| Rows | bar 0–27, ticker 27–54, picture 54–540, pane 540–594, keys 594–621, caption 621–675 (air row and line) | bar 0–24, ticker 24–48, picture 48–240, pane 240–288, keys 288–312, caption 312–384 (air row and 2 lines) |
| Canvas | 577 × 285 cells (244 + `spare` 41) | 353 × 265 cells (193 + `spare` 72), 1 CSS px a cell |
| Picture during play | 243 whole rows | 192 rows |
| End, today's freed strip | 283½ rows (54–621). Line one in the pane's second row, line two in the caption row. | 264 rows (48–312). Tagline in the pane's second row, line two over the caption's two rows. |
| Ticker freed too | 297 rows (27–621) | 288 rows (24–312) |
| Everything under the bar | **324 rows = all of B** (27–675). Tagline over B's sky (box row 2, B rows 13–27, between the clouds); line two over the deepest stone (B rows 310–323). | 360 rows (24–384) |

At 1440 with 285 rows, B's band can be rows 0–284 (moon, clouds and cave kept; the fossil at y≈294 and the bottom
stone dropped) or rows 39–323 (the moon cut). Mockups: `proto/end-1440-285rows.png` and
`proto/end-1440-324rows.png`. The 324-row option needs the canvas to start a row higher at the end, the ticker
emptied, and the caption strip's background cleared like `.reel.under` does for the pane. The box's rows don't change.

## 7. Today's film, for reference (seed 10)

| | Node (`proto/film-cost.cjs`) | Chrome, page, real clock (`proto/film-chrome.mjs`) |
|---|---|---|
| `buildMs` (world and levels) | 683–687 | 681–708 |
| `loadMs` (with warm-up) | 1,987–2,054 (`create()` 1.88–1.93 s) | 1,867–1,981 |
| `pace.burst` | 238–284 ms | 208–240 ms |
| `pace.paint` | 1.13 × 10⁻⁵ ms a cell | 1.15–1.30 × 10⁻⁵ ms a cell |
| Ticking the whole film | 2.6–2.7 s | – |

`keepsUp` at 1440 comes to about 220 + 1.2×10⁻⁵ × 577 × 244 × 15 ≈ 245 ms, against 1,000 ms.

Approach (a) adds about 370 ms (Node, in the film's own process) or 400–530 ms (Chrome) to build B. Counted inside
`buildMs`, that would bring a fast desktop to about 1.05–1.2 s, against `SLOW_BUILD` 1,400. So build it after that
check: the 57-yield generator plus 180 updates fit in `load()`'s slices or during play, well before the last shot.
Approach (b) adds U 2 (about 350 ms) and optionally U 3 (about 470–600 ms). Up front, that is too much; lazily, each
must be ready by the first cut that shows it, or boot needs a crop window.

## 8. Beyond B's frame

Measured with `proto/wider.cjs`: B's 576×324 region compared against the frozen frame.
- **Below B:** `boot(576, 450, 1.5, 384, 216)` keeps B's region **identical**, composed and after the settle (0
  grains differ), for about 5 ms more. The extra rows are stone beds.
- **To the right:** the grains past the plan carry on the ground and sky (720×324 with the 384-step plan). Composition
  already moves 37 grains, because the cave moss is keyed by array index (`hash(i, 1, 151)`, `mossCol` with
  `hash(i, 3, 150)`) and the index changes with the row width. After the settle 2,922 grains differ: the extension's
  turf adds `damp()` dice interleaved row by row, and the fireflies' bounds change.
- **A wider plan:** 480 steps re-runs `layout()` (wider meadow, edge strips), and 115,783 of 186,624 grains differ.
  That is not B.
- **To the left:** the plan starts at grain 0. An extension there needs an origin offset through every loop and hash
  in `boot()`: a refactor of almost every placing line, with high risk to B.

So the waterwheel and machinery belong in the film's own world, outside B's frame:
- **Below** is free and cheap. For example, the cave pool (x≈62–190, y≈242–280) overflowing down to a small wooden
  wheel under the stone.
- **Right** at the depth of the water under the beds (x≈360–495, y≈210–235, about 80 grains from B's right edge) is an
  option, or past the orchard, where the ground rises.
- **Left** past the grove's high ground.

To use B's own drawing for that world, either compose a second B-style world beside it (its own `boot()` with its own
dice, the seam matched; about 200–350 ms, no water crossing the seam), or add composition below B after the settle
(nothing moving there during the settle, or B's dice shift).

## 9. Recommendation and implementation steps

**Approach: (a) for the last shot, with (b) for the 1:1 views of B's scene, and the film's own engine for the creature's
work, the water, and the world outside B.** Name it at the storyboard stop as: "the film's last frame is drawn by
Exhibit B's own code, so it is the frozen frame exactly, on every seed; before that, the patch is B's own composition,
growing part by part".

1. **`sand.js`, B unchanged:**
   - Apply `proto/make-core.cjs`'s five changes (DOM guard, bare image, exports, `begin(seed)`, world pixels).
   - Add the new creature with the hold and the overlay (`proto/make-newcre.cjs`, `hold`), with one sprite per U.
   - Add `opts.tags` (`proto/make-tags.cjs`), with the pond and terrace branches of the ground pass tagged too.
   - Checks: `tools/plate.mjs` equals `cross-section.png` except the creature box; the page stage at dpr 2 and on a
     phone equals the Node renders; render and update speed unchanged.
   - Then regenerate `assets/cross-section.png`.
2. **Loading:** `reel-core.js` looks B up lazily (`root.SiltSand` in the page, `require('./sand.js')` under Node), so
   the script order can stay.
3. **`reel-core.js`:**
   - Lay the world on B's plan: export `layout()` and the landmark numbers from `sand.js`, and use L3's 2 steps a
     valley grain (or L1's 5/3).
   - Build the 1:1 levels from B's tagged composition, with parts dated.
   - Build B at U 1.5 after the slow-build check, in slices.
   - Add a `'b'` camera mode and a band paint for the last shot, with the dithered dissolve from the 1:1.
   - Hold with B live after `begin(OPENING)`, rebuilt on `reset` (or a still hold).
   - Keep the waterwheel below or beside B in the film's own world.
4. **`reel.js`:** free the end rows (285, or the full 324 at 1440), put the two end lines on the grid over the
   picture, and drop the logo.
5. **`tools/story.cjs`:** add `proto/story-end.cjs`'s gate (every seed's final frame at 577×285 and 353×265 equals
   seed 10's; once against the plate's band).
6. **Phones:** choose (i), (ii) or (iii) of §2. (ii) is B's own phone picture at 1 px grains for the cost of one
   351×648 build (about 290 ms boot and 195 ms settle in Node).

## Files (all in `review-local/scout/`)

- **The DOM-free core:** `proto/make-core.cjs` builds `proto/sand-core.js`.
- **Frozen frame under Node:** `proto/plate-node.cjs out.png [scale] [core] [GW GH U PW PH]`.
- **Pixel diff:** `proto/cmp.py a.png b.png [diff.png]`.
- **Timing in Chrome:** `proto/time.html`, `proto/time-chrome.mjs`; the film in Chrome: `proto/film-chrome.mjs`
  (run from `site/`).
- **The dice shift:** `proto/dice-trace.cjs [a.js b.js]`.
- **The new creature:** `proto/make-newcre.cjs hold|feet|none out.js [--core]`; `proto/live-probe.mjs` and
  `proto/render-bench.cjs` for its animation and speed.
- **Approach (a) and the end gate:** `proto/reel-a.cjs` (a wrapper standing in for the reel-core change),
  `proto/story-end.cjs <first> <count> [--plate] [--today] [--core x.js]`, `proto/png-read.cjs`.
- **Approach (b):** `proto/views-b.cjs` (near views at finer U), `proto/make-tags.cjs` and `proto/stages.cjs`
  (growth by part).
- **Beyond B:** `proto/wider.cjs`.
- **Film geometry and cost:** `proto/geo-probe.mjs W H dpr` (run from `site/`), `proto/film-cost.cjs`.
- **Page copies:** `site/` (today's page with the DOM-free core), `site-newcre/` (today's `sand.js` with the new
  creature), with `assets` symlinked as in `nocre/`.
- **Images:**
  - Verification renders: `proto/node-plate.png`, `proto/page-plate-core.png`, `proto/page-b-1440@2.png`,
    `proto/b-*.png`.
  - The new creature: `proto/newcre-*.png`, `proto/page-newcre-hold.png`, `proto/newcre-before-after-8x.png`.
  - Approach (b): `proto/view-U*.png`, `proto/stages-*.png`.
  - The end frame: `proto/end-1440-285rows.png`, `proto/end-1440-324rows.png`, `proto/end-dpr2-compare.png`,
    `proto/end-phone-options.png`, and `proto/geo-*.png` (the film box at 1440 and on a phone).
