# Kern, the winged seed

*Living Seed concept. Kern is short for kernel: a seed with one wing.*

## What it is

Kern is a seed that grew one papery wing and never came down. It is a plump gold husk with a soft point underneath, where a root would one day come out. A single rose-coloured wing grows from its upper back, and it has two slit eyes lit like a lamp.

What makes it recognisable is the wing. It is one wing, swept up and back from the shoulder, with a stiff gold edge and one vein. A seed is the part of a plant that travels, and this one kept travelling. It drifts and looks, and now and then it tends something.

It suits Silt because it is made of the world's own colours. The husk uses the gold of the film's seed, the wing uses the blossom rose, and the eyes use lantern light. It looks like it belongs to the place it cares for. It is small and calm and doesn't need to be the hero. It reads as a living thing more than a character in costume.

## Palette (5 colours and 1 glow, all taken from the P2 tables)

| key | hex | role |
|---|---|---|
| d | `#6A4934` | deep rim under the husk, the shadowed point, closed eyes (wood) |
| m | `#9C7A3C` | husk shade, and the wing's stiff edge and vein (seed, dark) |
| b | `#B8914A` | the husk (seed) |
| l | `#D2AC60` | the lit crown of the husk, and the base of the wing where it grows out of the seed (seed, light) |
| w | `#E6A17A` | the wing (blossom) |
| e | `#FFF6DC` | the eyes. This is the glow colour, and the only one that stays lit at night (lamp) |

## Distinctive feature

The one feature is the wing: a single samara-like blade, rose with a gold edge, growing from the upper back at about 45 degrees. Its stiff edge runs straight down into the husk, so the wing looks grown, not attached. The top of the husk stays a clean dome, and a small notch separates it from the wing. The point under the husk is a quiet second accent in the outline and is where the root comes out. It has no other appendages and no mouth.

## Sizes (one size in the world)

- `s24`: 23×22 cells. The opening close-up, after the zoom-out.
- `s16`: 15×14 cells, 116 filled. The 1:1 view. The body is 11×9; the rest is the wing above it. That is no more mass than today's 16×11.
- `b10`: 10×9 grains. Exhibit B and the film's final frame (about 20×18 CSS px at 1440), a reduction of the 16.
- `s8`: 8×7. The ×2 view.
- `mark`: 3×3. A rose cell over a gold pair with one lit eye, for wide shots, under the "you" label.

## How it hovers

- **Bob.** It never touches down. The point under the husk hangs over the ground like a plumb line, with at least a cell of air below it.
  - Idle frame 2: it rises a cell and stretches (the top goes up two, the bottom one, one cell narrower).
  - Idle frame 3: it sinks a cell and squashes (one cell wider).
  - The wing lags each move, flattening on the way up and lifting on the way down, so even a three-frame bob has a second beat.
  - A blink (the slits shut to short dark lines) drops into the squash frame now and then, not every cycle.
- **Tilt.** When travelling, the husk leans a cell toward the direction of travel. The wing trails back toward about 30 degrees, like a key in the wind.
- **Squash and stretch.** It stretches as it starts and squashes as it stops. Before changing direction, the wing dips once.
- **Inspection.** The husk leans toward the thing, the slits slide to that side of the face, and the wing lifts a little behind as a counterweight. It holds still for a beat.

## How it constructs and interacts

When it works, a short **rootlet** grows from the point under the husk. It is one to two cells wide and up to five long, drawn in the husk's light gold. Where its tip touches, one grain catches a brief glint of the eye colour, so every action reads the same way: it reaches down with its root, and a little light marks the spot.

- **Planting:** the rootlet presses the seed into the soil and draws a grain over it.
- **Digging:** the rootlet loosens a grain at its tip, and the world's own physics carries the grain away.
- **Building:** the rootlet curls around a grain, lifts it, and sets it down with a glint.
- **Machinery:** the rootlet hooks a peg, a paddle or a lever and gives it one nudge, or taps the wheel to start it. Then it pulls back and watches.

The rootlet withdraws as soon as the work is done, so at rest the one feature is only the wing.

## Discovery reaction

Its eyes widen from narrow slits to two-cell slits for a moment. The wing lifts nearly upright and gives one small flutter, the husk bounces a cell, and the eye glow brightens for a beat before it settles.

## Rest pose

The wing lowers along the back, and the husk sinks to hover a cell lower than usual. The bob slows to half speed and the eyes half close to two-cell slits. It rests beside things, facing them: a pond, a lit window, a seedling it planted.

## At night

Everything dims except the eyes. The gold becomes a dark husk, the wing a dusky rose, and two small warm slits of light float above the ground. In the fungus cave and at the dark edges of the film, that pair of lights is all you need to find it.

## Self-check against Appendix B section 7

- **Silhouette:** in solid black it is a round body, one blade swept up from the back and a small point beneath: its own outline. Seen very large, a blade on a ball can suggest a spoon.
- **Scale:** the 16 keeps every part of the 24 (husk, point, wing with its edge and vein, two slits). The 10×9 keeps the husk, the wing and both eyes.
- **Environment:** in env.png the gold reads on dusk sky, foliage, pond water, the fungus cave, cabin wood and stone. At night the two lit slits carry it.
- **Animation:** three frames are enough (rise and stretch, sink and squash with a blink), and the lagging wing adds a second beat to every move.
- **Icon:** a gold disc, a rose flick and two lit slits. It is still itself as a 3×3 mark.
- **Originality:** a single-winged seed with lamp-lit slit eyes, built from the film's own seed, blossom and lantern colours. It is not based on any existing mascot or character.
- **Longevity:** five quiet colours, one feature, no mouth and a calm face. There is little to tire of.

## Risks

- In solid black at large sizes, a blade on a round body can read as a spoon or ladle. At real scale, the colour split and the wing's vein carry it.
- A warm, round gold body seen large and still can suggest a fruit or a bun. The eyes, the hover and the moving wing are what make it read as a creature.
- It shares the film's seed colours. In the opening, where it handles a seed, the seed should stay smaller and brighter (its glint) so the two are never confused.
- Lit slits on gold have less daytime contrast than dark eyes. They read at 16 and 10, but each eye is a single column of light.
- The squash frame reaches the right edge of the 24 canvas, so placement needs a cell of margin.
- The rootlet is a second drawn part. It should appear only while working, or the outline loses its single feature.
