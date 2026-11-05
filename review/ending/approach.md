# The ending on Exhibit B: the technical approach

This page explains how the film's last frame can be exactly Exhibit B's frozen frame on every seed, and how the new creature can go into Exhibit B without changing anything else in it. Everything here was prototyped on copies of the site and measured. No tracked file was changed.

## The approach, in one line

**Exhibit B's own code draws the film's last frame, so that frame is the frozen frame exactly, on every seed. Before that, the patch the creature tends is Exhibit B's own composition, growing in part by part.**

In more detail:

1. **`js/sand.js` becomes usable outside the page** without changing how Exhibit B looks or runs. That takes five small edits:
   - a guard around the page lookups;
   - an image buffer when there is no canvas;
   - exports;
   - an optional seed for `begin()`;
   - access to the world's pixels.

   Under Node, the copy builds Exhibit B's opening and settles it, and its render matches `assets/cross-section.png` **pixel for pixel (0 of 186,624 grains differ)**. It also matches the page's own stage at dpr 2 and on a phone. With the copy dropped into the page, `tools/plate.mjs` makes the identical plate.
2. **The film's last shot is a band of that picture**, one cell per grain. At 1440 × 900 dpr 1 the film's picture and Exhibit B are the same width (576 grains of 2 CSS px). Nothing from the film's seed reaches this frame.
3. **The 1:1 views of the patch are Exhibit B's composition built at a finer grain:** U 1.8 or 2 grains a plan step, against Exhibit B's 1.5.
   - Each grain is tagged with the part that placed it: land, underground, pond, trees, home, terraces, grass, flowers and so on.
   - The film starts from the bare land and lets each part grow in on its day.
   - In Act IV each grain has a date, so by the last 1:1 frame the picture is the same for every seed whatever the physics did earlier.
4. **The film's own engine keeps the live action:** the creature, the digging, the rain and water, the damp, and anything outside Exhibit B's frame.
5. **The pull-back from the 1:1 to the last frame is gentle** (1.2×). It is a dithered per-cell dissolve over about 0.8 s: every cell is always exactly one picture's colour, so nothing blurs or shimmers. A hard cut on a bell is the alternative.

## What it looks like

| Image | What it shows |
|---|---|
| [end-1440-285rows.png](end-1440-285rows.png) | The film box's last frame at 1440 × 900 drawn by Exhibit B's code. It is rows 0–283 of Exhibit B (283½ rows show) over the freed pane and keys strip, which today's end card already uses. The box's rows don't change. |
| [end-1440-324rows.png](end-1440-324rows.png) | The alternative: free the ticker and caption rows too, and all 324 of Exhibit B's rows fit under the title bar. |
| [end-dpr2-compare.png](end-dpr2-compare.png) | At dpr 2, the film's last frame (left, Exhibit B's 1.5-grain composition at 2 CSS px a cell, which is the frozen frame) beside Exhibit B live at dpr 2 (right, the same plan at finer grains). Same places, finer texture. |
| [end-phone-options.png](end-phone-options.png) | A technical comparison of Exhibit B's pictures, not a film frame. It shows three phone landings, at device pixels: (i) a 353-column crop of the 1440 composition, 1 CSS px a grain (cabin, well, cabbages); (ii) Exhibit B's own phone composition built at 1 CSS px grains, a 265-row band from the cabin's roof to the water under the well; (iii) Exhibit B's phone stage itself, for reference. |
| [view-U2.4.png](view-U2.4.png), [view-U3.6.png](view-U3.6.png) | Exhibit B's composition built at finer grains, framed as the film's picture around the creature. This is what the patch looks like when grown, at a 1:1-like and a close-up-like scale. |
| [stages-U2.4.png](stages-U2.4.png) | The same view growing part by part from the tags. The last stage is identical to the frozen frame. |
| [newcre-before-after-8x.png](newcre-before-after-8x.png) | Exhibit B's frozen frame at 8×: today's creature (left), and a placeholder new creature hovering over the bed (right). Nothing else in the frame changed. |

## The new creature in Exhibit B, with the frozen frame otherwise unchanged

Removing today's creature from Exhibit B changes grass and other grains all over the frame. The cause is now pinned down:
- Its feet cover two grains of the cabbage bed. Without them, a soil-damp rule rolls extra dice on every update, and every later roll shifts.
- Its right edge covers two grains of a terrace wall. Without them, those grains become moss sites.

**The fix:**
- Today's creature is still composed exactly as now, held through the settling updates, and cleared just before the first frame.
- The new creature is drawn on top at render time. It is not grains, so it uses no dice.

Result: the frozen frame differs from today's **only inside the creature's own box (63 grains)**, and the live scene runs exactly as before. The creature's bob and blink are timed from the scene's start, so the frozen frame is always the same pose. Render speed is unchanged.

## Every seed ends the same

A new check in `tools/story.cjs` runs every seed from 1 to 256 to the end. It paints the last frame at the desktop and phone sizes, and fails any seed that differs from seed 10. Once, it also compares the desktop frame with the band of `assets/cross-section.png`.
- With the prototype, seeds 1–24 and 250–256 were byte-for-byte equal to seed 10.
- Today's film fails this check on every seed, because its sand end card uses the film's dice. So the check catches a real difference.
- It adds about 3 minutes to the 256-seed run.

## Cost

Building Exhibit B's opening for the film adds about 0.4–0.5 s in Chrome. That happens after the film's slow-machine check, in slices during loading or play, well before the last shot. The last shot itself is a copy, cheaper to paint than today's far views. Each finer build for the 1:1 adds about 0.35–0.6 s and is made before the cut that first shows it.

## The waterwheel and Exhibit B's frame

Exhibit B can't simply be extended to the side: its composition and dice depend on the row width, so a wider build changes thousands of grains. Two ways keep Exhibit B intact:
- **Inside its frame, as a small render-time overlay** with no dice: a wooden wheel at the top of the underground stair, the well's rope as a loop of clay pots, and a short trough. This needs the owner's yes, because Exhibit B would show it.
- **Outside its frame, in the film's own world:** just past Exhibit B's right edge (storyboard C), or below it, where extra rows of stone change nothing in Exhibit B.
