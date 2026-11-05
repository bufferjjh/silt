# Coracle in Exhibit B, frozen frame otherwise unchanged

> Working files named here (the page copy, the scripts and the earlier spec versions) stay in the working folder and are not part of this review set. The images are `b-plate.png`, `b-before-after-8x.png`, `b-diff.png` and `b-live-frames-8x.png`.

This checks that Coracle can replace today's creature in Exhibit B while every other grain of the frozen frame stays
exactly as it is. It uses the hold-and-overlay method from the ending study (`review-local/scout/scout-notes.md`,
section 4):
- Today's creature and its sprout are still composed as grains and stay in place through the 180 settle updates, so the
  settle throws exactly the same dice. `begin()` clears them just before the first frame is drawn.
- Coracle is drawn in `render()` as an overlay. It uses no dice and isn't in the grain arrays. It is drawn after the
  grains, stars, clouds and fish, and before the light, so it is lit the same way as the grains.

This is the third run of the proof, with the current `b10`, `b10_lift`, `b10_settle` and `b10_blink` from
`spec.json` (third round of design fixes; `spec.json` matches a fresh `python3 -B build.py`). The first run used
the `b10` kept in `../v2-before/spec.json`, the second the `b10` and `b10_lift` kept in `../v3-before/spec.json`.

**Fourth run, after the last touch to `b10`:** its lip lost its two umber end grains (row 0 is now `lllllllls`), so
the 9 × 9 has no outline at all. The numbers below are unchanged: 91 grains differ, all inside the creature's box and
none outside it; the Node render equals the page plate; the phone stage is unchanged.

## Result (1440 × 900, dpr 1, U = 1.5)
| Check | Result |
|---|---|
| `tools/plate.mjs` run from this page copy (`b-plate.png`) vs `review-local/ref/cross-section.png` | **91 grains differ** (364 pixels at 2×) |
| Bounding box of the differences | **grains x 419–431, y 91–101** (pixels x 838–863, y 182–203 at 2×) |
| What the 91 grains are | 53 are Coracle's cells (all 53 of them). The other 38 are grains of today's creature (32, in its 4 colours) and sprout (6, in 2 crop greens) that now show what is behind them |
| Differences outside the creature's box (x 419–431, y 90–101: today's creature and sprout, plus Coracle including its bob and settle) | **0** |
| Coracle's cells in `b-plate.png` | exactly `b10`, colour for colour, at x 422–430, y 91–99 (checked by `work/compare.py`) |
| Node render (`node/node-plate.png`, the same change on the DOM-free core) vs the page plate | **0 pixels differ** (0 grains) |
| Phone stage, 390 × 844 dpr 3 (`node/phone-390x844@3.png`) vs `review-local/ref/b-phone-390x844@3.png` | **0 pixels differ** (1056 × 1944) |

The numbers match the first and second runs'. The new `b10` has the same 53 cells; only its row 4 (grain row 95, the
row under the eyes) changed, from clay shade to body clay with a shade end (`.pppppps.`). Against the second run's
plate, 6 grains differ, all in that row (x 423–428, y 95). Today's creature and sprout give back the same 38 grains.

The same comparison under Node, Coracle's core vs today's, at other sizes (`node/node-checks.json`):
- 1600 dpr 1: 91 grains differ, all in x 531–543, y 118–128.
- 1100 dpr 1: 93 grains differ, all in x 378–390, y 86–96.
- 1440 dpr 2 (U 2): 0 grains differ.
- Phone (U 1.8): 0 grains differ.

## Placement and motion
- **Sprites**, all from `spec.json`, with `.` transparent and the spec's own palette:
  - `b10`, 9 × 9 grains: the rest pose.
  - `b10_lift`, 9 wide × 10 tall: the bob.
  - `b10_settle`, 9 × 9: the beat after it lands.
  - `b10_blink`, 9 × 9: the eyes shut.

  `work/make-coracle.cjs` checks each one against `b10` before it writes anything:
  - `b10` is 9 × 9 with its line row at row 6.
  - `b10_lift` is `b10`'s bowl (rows 0–5), then `b10`'s line twice, then `b10`'s bead.
  - `b10_settle` has an empty row 0, and its line and bead are `b10`'s.
  - `b10_blink` differs from `b10` only where a glint over an eye turns to clay or a bead grain lights, and it keeps
    at least two glow grains.
- **Place.** x 422–430, centred on today's creature (x 422–431). The bowl's axis is x 426. The line is tied one grain
  right of it (x 427) and the bead hangs at x 427–428, off the axis. At rest it fills rows 91–99. Rows 100–101 are clear
  above the cabbage bed's top row, 102.
- **Phase.** Bob and blink count ticks from the scene start (`T − T0`, 40 ticks a second). The frozen frame is always
  the rest pose, and with reduced motion Exhibit B stays at rest.
- **Bob.** The cycle is 120 ticks (3 s), and every frame is drawn with its bottom row on `b10`'s:
  - Ticks 0–39: rest, `b10`.
  - Ticks 40–99: `b10_lift` at rows 90–99. The bowl is a grain higher and the line is 2 grains instead of 1. The bead
    is held where it was.
  - Ticks 100–107: `b10_settle` at rows 91–99. Row 91 is empty, so the lip is a grain lower, at row 92. The bowl is one
    row shallower, and its keel row is 7 grains wide instead of 5. The line and bead are where they were.
  - Ticks 108–119: rest again.

  So the bob goes rest, lift, settle, rest, like the three-frame idle at 24 and at 12: the bowl moves rigidly, the line
  carries the bob, and it lands rather than snapping back. The bead's top row stays 98 throughout, so nothing below
  row 99 is ever drawn.
- **Blink.** Every 240 ticks (6 s), for 6 ticks (228–233), `b10_blink` is drawn in `b10`'s place. The glints over the
  eyes go to clay, and the eyes' dark row stays as the closed lid. The bead's second grain lights, so two grains still
  glow (three at rest: the two glints and the bead's one).
  - The blink uses 240 ticks rather than 230 so that it always falls while Coracle is resting. At 230 it would drift
    against the 120-tick bob and land on a lift every other time.
  - Ticks 228–233 are ticks 108–113 of the bob, so the blink starts on the first rest tick after the settle. It reads
    as: it lands, then blinks.
- **Tick trace under Node** (`work/node-checks.cjs`, 600 ticks after the frozen frame). Each tick it reads the lip row,
  the bead's top row, the line's length and the eye and glow grains, and it finds which of the spec's frames is on the
  canvas, cell for cell:
  - Lift at ticks 40, 160, 280, 400 and 520 (lip row 90, line 2).
  - Settle at 100, 220, 340, 460 and 580, for 8 ticks each (lip row 92, line 1).
  - Rest again at 108, 348 and 588, and after each blink.
  - Blink at ticks 228–233 and 468–473, both on the rest frame (eye grains 2, glow grains 2).
  - Of 601 ticks: 249 rest, 300 lift, 40 settle, 12 blink. Every tick matched one of them; no tick showed anything
    else.
- **Live in the page** (`work/live.mjs`, reduced motion off, virtual clock, 0 to 8 s in 60 fps frames, times from the
  first live frame; each frame it also finds which of the spec's frames is on the canvas):
  - Rest at 0 s: lip row 91, line 1 grain, bead top row 98.
  - The bowl lifts at 1.00 s (lip row 90, line 2 grains, bead top row still 98).
  - It lands at 2.52 s, one 60 fps frame after tick 100: the settle, with the lip at row 92. It is at rest from 2.72 s.
  - It lifts again at 4.00 s and lands at 5.50 s.
  - The blink runs from 5.70 to 5.85 s, right after that settle, then repeats every 6 s. The bob repeats every 3 s
    (the next lift at 7.00 s).
  - Of 481 frames: 206 rest, 242 lift, 24 settle, 9 blink. Every frame matched one of them.
  - These times match the tick trace under Node.
- **Screenshot.** `live.png` is the stage at 2.00 s, mid-lift. Coracle's cells there are exactly `b10_lift` at rows
  90–99, checked from the PNG (lip row 90, line 2 grains, bead top row 98). `b-live-frames-8x.png` shows five live moments:
  - rest, at 0.00 s;
  - the lift with the bead held, at 1.00 s;
  - the settle, at 2.52 s;
  - settled again, at 2.80 s;
  - the blink, at 5.70 s.

## Limits, for Phase 2
- **Desktop U = 1.5 only.** That covers every dpr 1 desktop width; 1100, 1440 and 1600 were checked. At any other U,
  such as dpr 2 (U 2) or dpr 1.25 and 1.5, the page stays exactly as today, old creature included. **dpr 2 and the other
  U values each need their own Coracle sprite in Phase 2**, for example about 12 × 12 at U 2. The hold itself already
  works at every U, because it is today's code.
- **Phone.** The phone layout has no terraces, so it has no creature. Its stage is unchanged.
- **Overlay only.** Coracle is not in the arrays, so rain and seeds pass behind it. If it should block them, add
  blocker grains in `begin()`, after the settle and never before.
- **Living counter.** The counter under the stage goes from 7,485 to 7,479 (checked again under Node), because the
  sprout's 6 grains leave in `begin()`. That is page text, not part of the picture.
- **The published still.** `assets/cross-section.png` is shown for a moment before the canvas appears. It would be
  replaced by `b-plate.png`, which is now saved optimised losslessly (121,422 bytes, pixel for pixel the same as
  `tools/plate.mjs` wrote it). This page copy still links the old one.
- **Live frames aren't compared.** From `begin()` on, each visit throws its own dice, so the live frames are not
  compared with today's. Only the frozen frame is.

## Files (in this folder)
- **Page copy:** `index.html`, `css/`, `js/` are copies of the repo's (checked identical again), except `js/sand.js`,
  which is generated. `assets` is a symlink.
- **`work/make-coracle.cjs`:** builds `js/sand.js` from the repo's `js/sand.js` and `spec.json`. It uses `b10`, and
  `b10_lift`, `b10_settle` and `b10_blink` when the spec has them. Without `b10_lift`, it falls back to the first run's
  bob; without `b10_blink`, to the first run's blink. With `--core` it also builds `node/sand-core.js`.
- **`work/compare.py`:** gives the numbers above (`node/compare.json`) and writes `b-before-after-8x.png` and `b-diff.png`.
- **`work/node-checks.cjs`:** runs the other sizes and the tick trace (`node/node-checks.json`).
- **`work/live.mjs` and `work/frames.py`:** make `live.png`, `b-live-frames-8x.png` and `node/live-trace.json`.
- **Images:**
  - `b-plate.png`: the frozen frame, 1152 × 648.
  - `b-before-after-8x.png`: 8× crop of the cabbage bed, today vs with Coracle.
  - `b-diff.png`: the full frame with the differing grains marked.
  - `live.png`, `b-live-frames-8x.png`: Coracle live in the page.

To rerun everything from this folder:
```
node work/make-coracle.cjs --core
node ../../../../tools/plate.mjs plate-coracle.png
python3 -B -c "from PIL import Image; im = Image.open('plate-coracle.png'); im.load(); im.save('plate-coracle.png', optimize=True)"
node ../../../scout/proto/plate-node.cjs node/node-plate.png 2 node/sand-core.js
python3 -B work/compare.py
node work/node-checks.cjs
node work/live.mjs 8 && python3 -B work/frames.py
node ../../../bshot.mjs node/phone-390x844@3.png 390 844 3
```
