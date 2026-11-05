# Octant (geometric lifeform concept)

Everything in Silt is built from square grains that sit on the grid and fall. Octant is one of those squares
turned an eighth of a turn onto its corner. It is the only thing in the world that does not sit square, and
it is the only thing that does not fall.

It keeps one grain of its own upright beside its front shoulder: a small square of honey light. The grain is
how it touches the world. It sends the grain down to press a seed in, to loosen soil, to set a block, or to
nudge a wheel, and then the grain comes back.

It is drawn in the page's own colours: paper above, dusk below, an ink line and a lamp. That ties it to the
site, and it still reads against sky, leaves, water, wood and stone. The idea is simple and a little
mathematical (a square on its point, a square on the level), and it leaves open where it came from.

## Palette

| key | hex | role |
|---|---|---|
| o | `#1F1714` | ink: outline, eyes, the grain's rim (the site's `--ink`) |
| p | `#ECE2D2` | paper: the upper half of the body (the site's `--paper`) |
| d | `#B4A2A2` | dusk: the lower half and the shaded right edge, a pale mauve between the paper and Exhibit B's dusk cloud `#86707A` |
| f | `#E3A85C` | honey: the grain's lower corner (the site's `--floor`) |
| l | `#FFD49A` | lamp, the one glow colour: the eye glints and the grain's light. These stay lit at night (the site's `--lamp`) |

That is four body colours and one glow colour, all flat, with no gradients.

## The one distinctive feature

The lit grain. It is a small upright square that floats at its front shoulder, two cells clear of the body
(4×4 with a 2×2 light at 24, 3×3 at 16, 2×2 in Exhibit B). The body sits on its corner. The grain sits
level. Together they make the silhouette: ◆ with ▪ at one o'clock. Nothing else in Silt is drawn at 45°.

## Sizes (one size in the world)

- **s24** (opening close-up): body 17×17 and about 19×19 with the grain. It is smaller than today's 32×22.
- **s16** (1:1): body 11×11 and 13×12 with the grain. It covers less area than today's 16×11 and reads as lighter in the frame.
- **b10** (Exhibit B and the film's final frame): body 9×9 and 11×10 with the grain, which is about 22×20 CSS px. It reduces the 16 shape for shape: the same flat top, two widest rows, eyes on the girdle and dusk below it, with the grain at one o'clock.
- **s8** (wider view): 7×5. **mark**: 3×3, a small diamond with one lit corner.

The ink outline is kept at 24, 16 and in Exhibit B so that the shape stays crisp. It is dropped only at s8 and the mark.

## How it hovers

Its lowest point is a single tip with air under it, so it never looks as if it is standing.

- **Idle:** a 1-cell bob about every two beats (1.67 s at 72 bpm).
  - Rising, it stretches: the flat top narrows to a point.
  - At the bottom it squashes: the top flattens, the girdle widens by two cells and the tip goes blunt.
  - The grain moves against the body by a cell, so the pair seems to breathe.
  - Every few bobs a blink replaces the middle frame.
- **Moving:**
  - It dips one cell away from the direction it is about to travel, then leans toward it. The lean shifts the upper half one cell ahead of the tip, a clean shear rather than a rotated, jagged shape.
  - The grain trails two or three cells behind and catches up.
  - When it stops it gives one squash frame and then settles back to its resting shape.
- **Collisions:** the diamond's own outline is its body. It slides along slopes and ceilings and never passes through them.

## Construction and interaction

The grain is its hand. There are no limbs and no beams.

- **Planting:** the grain carries the seed down, presses it into the soil, sits on it for a beat and floats back.
- **Digging:** the grain taps the soil two or three times. Loosened grains come free and roll aside under their own weight.
- **Building:** the grain sets material one grain at a time, the way a mason lays courses. Each new grain warms to lamp colour for one frame.
- **Machinery:** the grain slots into a notch in the waterwheel's hub, or between two teeth of a wooden gear, and stays lit while the mechanism turns. Then it lifts out and returns.

The only effect is that one-frame warm square on the cell it touches. That keyed square is what the `[p]`, `[d]` and `[b]` beats can show.

## Inspection

It leans toward the thing and its eyes slide one cell toward it. The grain drifts over and hangs above the
thing like a small lamp held close. Then it pauses.

## Discovery reaction

Its eyes grow one row taller, from 2×3 to 2×4, and it hops two cells and settles. For one beat the grain
brightens all through, as its honey corner turns to lamp light. This can stand in for the "new material" and
"new life" panes.

## Rest pose

It sinks until its tip is about one grain above the ground and its eyes close halfway. The grain sets itself
down on the ground just in front of it and glows softly, like a lamp put down for the night.

## At night

Everything dims except the lamp pixels. Octant becomes a dim diamond with two warm pinpoint eyes and a small
square light at its shoulder. In the cave and at dusk the grain could give off a soft light, much weaker than
the cabin's lamp. The light is warm and low, never neon.

## Self-check (Appendix B §7)

- **Silhouette:** in solid black it is still a diamond with a small square at its shoulder. That shape appears nowhere else in the scene.
- **Scale:** at 16×16 the diamond, both eyes and the grain all survive, and Exhibit B's 11×10 and the 7×5 wide view still read.
- **Environment:** the paper body inside an ink line reads on dusk sky, foliage, pond water, the fungus cave, cabin wood, stone and the film's pale silt, and the warm grain marks it in the dark.
- **Animation:** three frames are enough to bring it alive: a stretch, a squash and a blink, with the grain bobbing against the body. The lean and the trailing grain carry its movement.
- **Icon:** a pale diamond, two eyes and one honey square on a dark tile work at avatar size.
- **Originality:** it is angular and not a blob, with no ears, limbs, hood, mask or wheels. The turned square and its lit grain are its own.
- **Longevity:** it uses four flat colours and one light, with no ornament, so it should stay restful to watch for hours.

## Notes for building it

- In Exhibit B, draw it as an overlay at render time so that the dice stream, and with it the frozen frame, stay unchanged apart from the creature. The kit's mock places it hovering one grain above the cabbage bed.
- The b10 body is 9 cells against the 16's 11, which puts Exhibit B's framing at about 1.2× the 1:1 view's world width. If a storyboard wants a bigger final pull-back, a 7-cell body (9×8 overall, same layout) is the matching reduction.
