# Film tools

These tools render and check the film on the Silt page (Exhibit A), its fallback assets, and Exhibit B's frozen frame. They aren't part of the site.

Run every command from the repo root.

## Setup

```bash
npm install --no-save playwright @axe-core/playwright   # one command: a later install without the others removes them
npx playwright install --with-deps chromium              # or only install-deps if the browser can't be downloaded; see below
apt-get install -y ffmpeg                                 # with sudo if you aren't root
pip install numpy scipy matplotlib                        # for the soundtrack
```

The tools pick a browser in this order:
1. `CHANNEL`, such as `chrome`, for an installed Chrome.
2. Otherwise, the Chrome at `CHROME_PATH` if that is set. Cloud machines set it. Chrome plays the mp4's H.264 and AAC, which Playwright's Chromium may not.
3. Otherwise, Playwright's own Chromium.

`PLAYWRIGHT` can point at another Playwright build: a module name, or a `file://` URL to `playwright-core`'s `index.mjs`.

Write renders, screenshots and other intermediate files under an uncommitted folder such as `review-local/`. Only finished, optimised files go into `assets/`.

## Tools

| Command | What it does |
|---|---|
| `node tools/story.cjs 1 256` | Plays every seed's script under Node and checks each beat the picture and the words rely on. A failing seed goes in `LEFT_OUT` in `js/reel-core.js`. 256 seeds take about 10 minutes. The checks are written for the film as cut on 2026-11-03, so re-cut them with the film. |
| `node tools/view.cjs out.png <seed> <time> <zoom> <cols> <rows> <x> <y> [scale]` | One view of the film's world, picture only, straight from `js/reel-core.js`. |
| `node tools/shots.mjs out/ <W> <H> <dpr> <seed> t1,t2,...` | Screenshots of the film box on the real page at film times. Never ask for a time past the end card's hold, 59.4 s. |
| `node tools/render.mjs review-local/film.mkv --seed=10 --poster=review-local/poster.png@52.6` | The film as a lossless 1920 × 1080, 30 fps master (far over 100 MB, so never commit it), driven on a virtual clock. It's slow and can't resume, so time `--frames=150` first and run the full render detached. `--late=0.002` samples each frame a hair after its time. |
| `node tools/still.cjs assets/film-still.png 10` | The paused cover: the ×8 view at 52.6 s, 800 × 344, one pixel per cell. |
| `node tools/og.mjs assets/og.jpg 10` | The share card, 1200 × 630. |
| `node tools/plate.mjs review-local/cross-section.png` | Exhibit B's frozen frame: the opening at 1440 × 900, dpr 1, scaled 2×. Optimise it losslessly before committing; PIL's `optimize=True` gives the published file. |
| `python3 tools/sound/make_sound.py` | Synthesises the soundtrack from oscillators, noise and filters, with no samples. It writes `tools/sound/silt-film.wav`, encodes `assets/silt-film.m4a` from it, and checks each cue's onset, the loudness and the true peak. `--no-encode` writes the wav only. |

`serve.mjs` serves the repo at `/silt/` the way GitHub Pages does, but without the sound and the video, so the film keeps its own clock. `png.cjs` writes PNGs.

## The published mp4

Encode it from the master, with the soundtrack copied in:

```bash
ffmpeg -y -i review-local/film.mkv -i assets/silt-film.m4a -map 0:v -map 1:a -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 24 -tune animation -g 60 -keyint_min 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -t 60 -movflags +faststart assets/silt-film.mp4
```

For `assets/poster.jpg`, save the poster frame as JPEG at quality 90, progressive.

## Checked against `a906f25`

- `still.cjs` and `plate.mjs` reproduce the published images pixel for pixel.
- `og.mjs` reproduces the published card once both are decoded.
- `make_sound.py` reproduces the soundtrack's wav byte for byte.
- A frame of `render.mjs` matches the published mp4 to within compression noise.
