# Creature reviews

Four concepts were drawn independently, one for each of Appendix B §9's directions. Three independent reviewers then judged each one against Appendix B §7's tests, plus two more: how it reads at real size (in the true-size film frames and the whole Exhibit B frame, not only enlarged) and how well it fits Silt.

- **Pixel artist:** clusters, stray pixels, outline weight and value contrast, measured against real backgrounds.
- **Brand and icon designer:** the black silhouette, the small avatar and app icon, originality against existing characters, and whether it lasts.
- **Silt's art director:** whether it belongs in the calm, earthy dusk world and reads as a curious observer-engineer rather than a pet, hero or robot.

Scores are 1–5.

| | Silhouette | 16×16 | Environment | Animation | Icon | Originality | Longevity | Real size | Fits Silt | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| **Coracle** (abstract automaton) | 4 · 4 · 4 | 4 · 4 · 4 | 4 · 4 · 4 | 3 · 4 · 4 | 4 · 4 · 4 | 4 · 4 · 4 | 4 · 4 · 4 | 4 · 4 · 4 | 4 · 4 · 4 | **35 · 36 · 36 = 107** |
| **Octant** (geometric lifeform) | 4 · 5 · 4 | 4 · 4 · 3 | 5 · 4 · 4 | 3 · 3 · 3 | 5 · 5 · 4 | 3 · 3 · 3 | 4 · 4 · 3 | 5 · 4 · 4 | 2 · 3 · 2 | **35 · 35 · 30 = 100** |
| **Kern** (living seed) | 4 · 3 · 4 | 4 · 4 · 4 | 3 · 3 · 3 | 4 · 4 · 4 | 4 · 3 · 3 | 3 · 2 · 4 | 4 · 4 · 4 | 4 · 3 · 3 | 4 · 4 · 4 | **34 · 30 · 33 = 97** |
| **Glim** (organic spirit) | 3 · 2 · 3 | 3 · 3 · 3 | 2 · 2 · 3 | 4 · 4 · 4 | 3 · 2 · 3 | 3 · 3 · 2 | 3 · 3 · 3 | 2 · 2 · 2 | 4 · 4 · 3 | **27 · 25 · 26 = 78** |

In each cell the three scores are the pixel artist's, the brand designer's and the art director's, in that order.

**Ranking.**

| Reviewer | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| Pixel artist | Coracle | Kern | Octant | Glim |
| Brand designer | Coracle | Octant | Kern | Glim |
| Art director | Coracle | Kern | Octant | Glim |

Counting 3, 2, 1 and 0 points by place: **Coracle 9, Kern 5, Octant 4, Glim 0.** Coracle is first with all three reviewers.

## Each concept, in short

**Coracle: first with all three.**
- **For:**
  - It has the most ownable shape: a level lip over a round hull, with a bead hanging below. It stays one clear shape in solid black at 24, 16 and 9.
  - It has the best contrast of the four in every film frame and in Exhibit B.
  - The bead's lag gives a second rhythm without extra frames. Its work (tap, press, plumb a wall, give the wheel its first turn) is the clearest observer-engineer language of the four.
  - Handmade fired clay is the same register as the film's machinery (wood, clay, stone), and "found still warm in an old layer" suits the tagline.
- **Against, as first drawn:**
  - A solid dark top rim read as a cap or fringe over a face at Exhibit B's size.
  - The hull, stem and cross-shaped bead read as a goblet in black.
  - The night read rested on two or three single pixels, and the one-pixel line vanished on dark soil.
  - The idle squash was too rubbery for clay, and the blink fell on every bob.
  - It reads as an object before a creature.
- **Resemblance:** no specific character. The archetypes it could be taken for are a cup or bowl with a face, a pendant lamp, and the floating clay figure.

**Octant: second with the brand designer, third with the other two.**
- **For:** it has the purest black silhouette, the best icon (the mark could even be set as text glyphs in a terminal) and the best raw readability.
- **Against:**
  - Its full ink outline and paper-white body make it look like a cursor or sticker laid over an outline-free world.
  - It can read as a gem or a map pin.
  - Its detached square of light passes for a firefly at Exhibit B's size.
  - It is the coolest and least endearing of the four, and a two-tone diamond carries an unwelcome logo association.

**Kern: second with two reviewers, third with the brand designer.**
- **For:** it is the warmest and most alive, and the only one painted like the world (no outline). It ties directly to planting, and its 16×16 reduction is the cleanest.
- **Against:**
  - At real size its one wing reads as a single ear or a cocked bird's tail, the same animal read the owner wants gone.
  - Its gold sits at the lightness of the golden-hour sky and is the film's own seed colour.
  - In black it can read as a bomb with a fuse.
  - It carries the biggest originality risk: a gold seed with eyes and a leaf-like growth is close to a well-known seed-shaped character, and its name is too.

**Glim: last with all three.**
- **For:** it has the best mood and by far the best night read. The lantern on its tail swings for free.
- **Against:**
  - By day its mauve body has almost the same lightness as the opening's silt and hills, and the dusk sky (1.03:1 in the close-up).
  - At Exhibit B's size its lantern breaks into stray pixels and a firefly-like square, which is the "only good enlarged" failure the spec warns against.
  - In silhouette a round body with a thin tail off the back returns towards the mouse it replaces.

## What was changed in Coracle after the review

The draft as reviewed is shown in `creature-coracle/sheet-as-reviewed.png` and `creature-coracle/mock-b-as-reviewed.png`. It then went through three rounds of fixes.

**Round 1: the fixes the three reviewers agreed on.**
- The solid dark top row is gone. The lip is lit clay, which ends the cap-over-a-face read.
- The outline is umber wood (#6A4934), not near-black, so the eyes are the darkest thing on it.
- The bead has no dark ring. It is a lit bead with a glow core, and the line is drawn in light clay so it shows over soil and in caves.
- There is a row of clear clay under the eyes.
- The idle squashes at most one row, and the bob comes from the bead's lag. The blink is its own rare frame.

**Rounds 2 and 3: after two further independent checks at real size.** The checks looked at the design inside the recommended cut and in Exhibit B.
- **No stemmed-glass read.** At rest the bead hangs off the bowl's middle at every size, on a short kinked line, and the 24's bead has no foot. Whenever the bead touches something (soil, a grain, a wall, a paddle), the line is short and kinked.
- **No mouth or beard read.** At 16, 12 and 9 the keel under the eyes is shade clay, not umber.
- **No ear nubs.** At Exhibit B's 9×9 the lip has no dark end pixels, so nothing sits where today's creature has its ears. The 9×9 has no outline at all, like Exhibit B's own grains.
- **One size in the world.** The 24 is one row deeper and one column wider, so it lines up with the 12 at the close-up-to-1:1 dissolve (eyes and bead land in the same place). In Exhibit B grains:

  | Version | Width | Height |
  |---|---|---|
  | 24 | 9.2 | 8.3 |
  | 12 | 10.0 | 8.3 |
  | 9 | 9.0 | 9.0 |

- **New frames.**
  - A full set at 12, the size seen through most of the film: idle, blink, lean, glance, inspect, discover, construct and rest.
  - A bob, a settle and a blink for Exhibit B's 9×9.
- **Glow.** At least two lit cells at every size, so it stays findable at night.
- **New test images.** It is now tested against a waterwheel, pond water and cabin wood, by day and by night (`creature-coracle/env-cut.png`), and as an icon (`creature-coracle/icon.png`).

Kept unchanged, because each would change the concept rather than refine it:
- the level rim (a raised pouring lip was suggested);
- the clay colour (a terracotta body was suggested).

**One thing to know.** Coracle's clay is almost exactly today's creature's cream, a colour difference of about 3 on a scale where 1 is barely visible. So in Exhibit B the change shows in the shape, not the colour. This keeps Exhibit B's colours as they are. If you'd rather it read as new by colour too, a warmer fired-clay body (#D9A288, shade #C48A72, taken from Exhibit B's own palette) is ready to try.
