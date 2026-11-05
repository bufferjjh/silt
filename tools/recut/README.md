# Film re-cut: working files for Phase 2 (the build)

The review set for the owner's picks is on branch `film-review`, under `review/` (start at `review/README.md`). This folder holds the scripts and notes the build reuses. They were made in a scratch folder called `review-local/`, which is not in git, so some comments and usage lines still name that path. Read `review-local/scout/...` as `tools/recut/ending/...`, `review-local/kit/...` as `tools/recut/kit/...`, and `review-local/ref/cross-section.png` as `assets/cross-section.png` at a906f25.

## Status

- **Phase 1 is done.** The project is waiting on the owner's picks:
  1. the creature (recommended: Coracle);
  2. the storyboard (recommended: A with the reviewers' grafts, in `review/recommended-cut.md`);
  3. the wheel inside Exhibit B (needs a yes) or just past its right edge;
  4. the phone ending (recommended: option (i));
  5. the zoom-out (recommended: 1.33×).
- Nothing has been built yet. The working branch for the build is still at a906f25.

## What is here

| Path | What it is |
|---|---|
| `ending/notes.md` | The ending study in full: Exhibit B without the DOM, the three approaches, seeds, the dice shift, zoom numbers, end rows, timings, what lies beyond Exhibit B's frame, and the steps. |
| `ending/make-core.cjs` | Five asserted edits that make `js/sand.js` usable under Node and export `{ boot, layout, OPENING, PLAN, GRAIN }`. It exports `transform(src)`. |
| `ending/plate-node.cjs`, `ending/cmp.py`, `ending/png-read.cjs` | Exhibit B's frozen frame under Node, a pixel diff, and a PNG reader for the gate. |
| `ending/story-end.cjs` | The every-seed end gate, to fold into `tools/story.cjs`. Every seed's final frame at 577×285 and 353×265 must equal seed 10's; with `--plate`, it is also checked once against `assets/cross-section.png`. |
| `ending/make-tags.cjs`, `ending/stages.cjs`, `ending/views-b.cjs` | Exhibit B's composition tagged by part, so it can grow in part by part, and views of it at finer grain sizes. |
| `ending/dice-trace.cjs`, `ending/wider.cjs`, `ending/reel-a.cjs` | Tracing the dice shift, building beyond Exhibit B's frame, and a stand-in for the reel-core change. |
| `coracle/spec.json`, `coracle/s12.json` | Coracle's final sprites as pixel rows, with the palette: s24 (and idle), s16, the 12-cell set (idle, blink, lean, glance, inspect, discover, construct, rest), b10 (9×9) with b10_lift, b10_settle and b10_blink, s8 and the mark. |
| `coracle/coracle.py`, `coracle/build.py` | The builder. `python3 -B build.py <dir>` writes `spec.json` and `<dir>/in-cut/s12.json`. |
| `coracle/make-coracle.cjs` | Builds a `sand.js` with Coracle in Exhibit B: today's creature is held through the settle and cleared in `begin()`, and Coracle is drawn as a render-time overlay with no dice. Run it from the repo root with `OUT=<dir> node tools/recut/coracle/make-coracle.cjs [--core]`. |
| `coracle/compare.py`, `coracle/node-checks.cjs` | The proof's comparisons. Fix their in/out paths to taste. |
| `coracle/notes.md` | Coracle's design notes: sizes, placement, motion and the reasons for each fix. |
| `kit/` | The mockup kit (`kit.py`), today's-film frames (`frames.cjs`), and Exhibit B stage screenshots and measurements (`bshot.mjs`, `measure.mjs`). |

## Numbers the build relies on

- **Exhibit B, 1440 × 900 dpr 1:** 576×324 grains at U 1.5 (plan 384×216 steps). Coracle's b10 sits at grains x 422–430, rows 91–99, two grains clear of the cabbage bed (top row 102).
  - With Coracle in, the frozen frame differs from today's in exactly 91 grains, all in x 419–431, y 91–101. The phone stage and dpr 2 are unchanged.
  - Other grain sizes (dpr 2 = U 2, and dpr 1.25 / 1.5 / 3) each need their own sprite.
- **The film's last frame:** at 1440 the canvas is 577×285 cells once the pane and keys strip is freed (`spare` in `reel.js` `fit()`), and 283½ rows show. The end band is Exhibit B's rows 0–283, drawn by Exhibit B's own code.
  - The tagline goes over the frame on plain rock (B rows about 256–283, between the cave and the crystal).
  - The second line goes in the caption row.
  - The phone canvas at the end is 353×265.
- **Zoom ladder (recommended):** in cells per Exhibit B grain.

  | View | Cells per B grain | Exhibit B built at | Coracle |
  |---|---|---|---|
  | Close-up | 2.4 | U 3.6 | the 24×24 |
  | 1:1 | 1.2 | U 1.8 | the 12-cell set |
  | Last frame | 1.0 | U 1.5 | b10 |

  The pull-back from 1:1 to the last frame is 1.2×, done as a per-cell dithered dissolve.
- **Cost:** building Exhibit B adds about 0.4–0.5 s in Chrome. Do it after the `SLOW_BUILD` check, in slices. Today's `buildMs` is about 685 ms and `keepsUp` about 245 ms.

## The build, in order

The steps are from `ending/notes.md` section 9 and the brief's Phase 2.

1. `js/sand.js`: apply `make-core.cjs`'s edits and the Coracle overlay (`make-coracle.cjs`), with a sprite for each U. Then the tags. Gates:
   - `tools/plate.mjs` equals `assets/cross-section.png` except the creature box;
   - the dpr 2 and phone stages are unchanged;
   - then regenerate `assets/cross-section.png`.
2. `js/reel-core.js`:
   - lay the world on Exhibit B's plan, with the 1:1 built from Exhibit B's composition at U 1.8 and dated part by part;
   - the new beats of the chosen storyboard;
   - Coracle's hover paths and poses;
   - camera mode `'b'` with a band copy and the dissolve;
   - the rings.
3. `js/reel.js`: free the end rows, put the end words on the grid over the picture, drop the logo; add the `[i] inspect` key and the pane labels.
4. The soundtrack (`tools/sound/make_sound.py`, on the new beats), captions (`assets/silt-film.vtt`), and `tools/story.cjs` (the beat gates plus `ending/story-end.cjs`; failing seeds go in `LEFT_OUT`).
5. Re-render every film asset. Then Phase 3: all checks, independent reviews, before/after images on `film-review`, and a PR into main without merging (check `git diff --name-only origin/main...HEAD` lists no `review/`, `tools/` or `review-local/`). The owner tests on desktop and phone before any yes to publish.
