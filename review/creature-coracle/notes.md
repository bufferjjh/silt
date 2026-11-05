# Coracle (concept: abstract automaton)


> Working files named here (the scripts, `v1/` and the other earlier versions) stay in the working folder and are not part of this review set. The draft as reviewed is shown in `sheet-as-reviewed.png` and `mock-b-as-reviewed.png`.

The reviewed first draft is kept unchanged in `v1/`. The states before the second and third rounds of fixes
(spec.json, s12.json, coracle.py, build.py and these notes) are kept unchanged in `v2-before/` and `v3-before/`.
This folder holds the current version, plus the rest of the deliverables: views, frame strips, the 12-cell set for the
cut, the environment and icon tests, and the short explanation.

## What it is
Coracle is a small bowl of fired clay that floats on the air the way a round boat floats on water. Below it hangs a short
line with a lit bead: a seed of its own light. The line is tied to one side of the keel's middle, so the bead hangs
off the bowl's axis, never plumb under it. It lets the bead down to feel the ground: to press a seed in, tap a grain
home, loosen a soft lip, or give a wheel its first turn. Nothing else in the world has its shape: a level lip over a
round hull, with a drop of light beneath and to one side. Its life comes from the two eyes under the lip and from the
way the bead lags behind it, swinging and catching up. It is made, not born; even so, it moves like something that is
paying attention.

## Third round of fixes (this version)
- **No stemmed-cup read at 12.** The 12 is 12 wide, so its axis falls between columns 5 and 6. The line used to be tied
  at column 6, one of the keel's two middle columns, so in solid black it read as a cup on a short stem with a block
  foot. It is now tied at column 7, a column right of the keel's right-middle column (coracle.py `KX12`): the line is
  1.5 cells and the 2x2 bead 2 cells right of the axis in every hanging frame. Rows, with s12 at its rest place:
  - s12, idle12[0], blink12, glance12[0] and [1], discover12[0]: row 8 `.......s....`, row 9 `.......hh...`, row 10
    `.......hg...` (blink12: `.......hg...` in both bead rows).
  - idle12[1] (lift): rows 7 and 8 `.......s....`, then the bead at x 7-8 in rows 9-10. idle12[2] (settle): row 8
    `.......s....`, the bead at x 7-8 in rows 9-10. discover12[1] (hop): row 7 `.......s....`, rows 8-9 `.......gg...`.
    discover12[2] (the swing): row 8 `.......s....`, the bead at x 8-9. construct12 and rest12 hang from the same tie,
    kinked out to x 8.
  - The 7x7's bead is now 2 wide (`....hg.`), 1.5 columns off the axis as at 16 and 9, so no stem shows in solid black.
- **The 24 brought into line (one size in the world).** It is one column wider and one full-width row deeper: 22 x 14
  hull (8 full-width rows), eyes 8 px apart (4 px each side of the axis), tied 2.5 px right of the axis with the 2-px
  kinked rest line, so the bead's centre hangs 3.5 px off the axis. Halved at the 2:1 crossfade it is 11 x 10 cells
  against s12's 12 x 10, and the eyes, the clay row under them, the shade band, the keel, the line and the bead fall on
  s12's rows and columns to within half a cell (see Sizes).
- **Clay round the eyes.** In every frame at 24 and 12 the eyes keep a row of clay between them and the lit lip, and,
  except in the wide-eyed discovery beat at 12, a row between them and the shade band. At 12 the wide eyes grow a row
  downward (they used to grow up into the lip and read as a brim); the settle keeps its clay row; inspect12 and
  construct12 narrow the eyes to their lower row (looking down at the thing) instead of dropping them onto the shade.
  b10 and the 7x7 have a clay row under the eyes. inspect12 is now its own pose: not lifted, leaning toward the thing,
  eyes narrowed on it, the bead hanging straight from its tie (lean12 is lifted, eyes open, the bead trailing).
- **Glow in the blinks.** blink12 and Exhibit B's blink keep two glow cells: the bead lights a second cell while the eyes
  are shut. Exhibit B's blink (spec.json `b10_blink`) now keeps the eyes' dark row as the closed lid and only the
  glints go, so it never becomes an eyeless cup. The 24's shut frame keeps 4.
- **Exhibit B's bob lands.** spec.json `b10_settle`: for 8 ticks after it lands the lip is a grain lower and the bowl a
  row shallower, keel, line and bead where they were, so the hold is rest, lift, settle, rest like the 3-frame idle at 24
  and 12. in-b/work/make-coracle.cjs now draws `b10_settle` and `b10_blink` (and checks them against b10);
  node-checks.cjs and live.mjs know the new frames. Under Node, from the rebuilt core: the frozen frame is the rest
  pose, still 91 grains different from today's, all in x 419-431, rows 91-101 (0 at dpr 2 and on the phone); in 600
  ticks, lift at 40, settle at 100-107, rest at 108, blink at 228-233 on the rest frame with the lid kept. The page copy
  and the proof's images are re-made by the next render step.
- **The 24's strips.** Travelling left is drawn, not mirrored (the glaze stays on the left wall, the tie right of the
  keel's middle). Leans rise a pixel, as at 12. The construction course is the ground on the frame's bottom two rows.
- **Environment test with machinery** (in-cut/env_cut.py: env-cut.png). A small wooden wheel (mk.py `wheel()`) in a
  stone-lined channel, by day and at night, at true size and 2x:
  - at 2.4 cells a grain, the 24 in 'lets down' with its bead resting on an upper paddle's tip on a 3-px kinked line,
    3.5 px off the axis, then the first turn with its weight on the bead (2-px kinked line);
  - at 1.2 cells a grain, construct12[0] and [1] at the same wheel, half the cells, at the pond's outflow;
  - s12 and b10 over pond water and over the cabin wall.
  Result: at the wheel the bowl hovers against the sky behind it, the bead the only thing on the wood, and no umber
  outline cell touches the wheel. Over the cabin wall the umber outline sits on wood (12 cells at 12, 2 at 9) and only
  the pale clay carries the edge there, but at least 2 cells of clay always separate an eye from the wood, and at night
  the glints and the bead stay lit. Rule for the cut: at machinery, hover against water or sky, never against a spoke.
- **Icon test** (icon.png): the 16 on the terminal-dark tile #100D0B at 1x to 8x, where the lit lip, both eyes
  and the bead read. On the site's paper or on white the lit lip fades and the umber lip ends read as points, so the
  icon is always shown on the dark tile (an umber top row would bring back the dark cap).
- **The pull-back (kf4).** s12 now hovers three rows over the cabbage bed instead of two, so its bowl sits where b10's
  does in the last frame (the hull's middle 7.9 grains over the bed against b10's 8, the lip 10.8 against 11); the bead
  comes down half a grain to b10's two grains of air as the shot dissolves.
- **Notes for the storyboard stop.** kf2 puts the "you" label over the 12-cell sprite at the first wide moment, while the
  brief ties "you" to the 2-4-cell mark in wider shots: a storyboard choice, to be stated at the stop. The shared kit's
  mock-film.png and ladder.png show s16 at 1:1 (the kit's own rule) and mock-b-full.png places b10 a grain lower than
  the proof; the cut's own ladder is ladder-cut.png, and the pinned placement is the one in in-b and kf.py. In
  cave shots, keep the bead clear of the glowing caps' height: its gold is in the same family as theirs.
- **Exhibit B at other U.** The proof covers U = 1.5 (every dpr 1 desktop). At dpr 2 (U = 2) s12 is already the right
  size: 12 grains of 1.5 CSS px is 18 CSS px, as b10 is at dpr 1; that is the Phase 2 plan.

Kept as it was: the palette, the level lit lip (no pouring lip), the silhouette family and the identity: level lit
lip, round pale fired-clay hull, two eyes, a lit bead on a line.

## Third round (final touch)
- No ear nubs at Exhibit B's size: at 9x9 (and at 7x7) the lip has no umber ends at all. Its left end is lit like the
  glaze and its right end is clay shade like the right wall (b10 row 0 `lllllllls`), so the 9x9 has no outline anywhere,
  like Exhibit B's own grains, and nothing sits at the top corners where today's creature has its ears.
- The machinery, pond-water and cabin-wood test is drawn in env-cut.png, and the icon test in icon.png.

## Second round of fixes (still in place)
- No stemmed-glass read at 24: the line is kinked out at rest; whenever the bead touches anything (ground, a grain, a
  wall, a paddle) the line is 3 px or less and kinked and the bead 2 px or more off the axis. The 24's bead has no umber
  foot, plain or bright. The opening's digging frame (in-cut/kf.py kf1) uses the construction pose: the bead swings out
  on a 3-px line with one kink and taps the hollow's wall with its wall-side cells, its centre 4.5 px right of the axis.
- No mouth or jaw under the eyes: at 16, 12, 9 and 7 the keel is clay shade, umber only at each row's two ends, where
  the outline turns (coracle.py `bowl(soft=True)`). The 24 keeps its umber keel: 12 px wide, wider than its 10-px eye
  span, it gives the edge against the close-up's sky. Dark share (umber and eyes): 24 16%, s16 21%, s12 26%, b10 8%.
- Motion at 12 (s12.json): idle12, blink12, lean12, glance12, inspect12, discover12, construct12, rest12; and
  spec.json `b10_lift` for the final hold's bob.
- Leans without a stub: where a lean's step would leave a short piece of the keel hanging a pixel below its neighbours,
  it is lifted, so the keel steps cleanly.
- Placement in Exhibit B, pinned: b10 at grains x 422-430, rows 91-99, two grains of air over the cabbage bed (row
  102), in in-b (make-coracle.cjs) and in-cut/kf.py alike. In kf4, s12's centre sits over the same spot of the bed as
  b10's (B x 426.5), mapped through the open bed between the right-most cabbage and the terrace wall, measured in both
  pictures; it tends the right-most cabbage (inspect12) with [i] inspect lit, and adds nothing Exhibit B lacks.

## Earlier refinements (first review, still in place)
- No ink cap: the top row is the lit lip, umber only at its two ends (and, from the third round, none at all at 9 and 7).
- The hull is outlined in umber #6A4934 (P2 wood) instead of near-black; near-black is kept for the eyes alone.
- The bead has no ink ring and a glow core; the line is drawn in clay shade #B49A78, lighter than soil and caves.
- At Exhibit B's size the clay itself makes the shape, as B's grains have no outlines.
- Idle: the bowl never squashes more than one row and two pixels; the bead's lag carries the bob. The blink is its own
  frame, every 4-6 bobs.
- Leans cut the lip into three runs, two pixels end to end (7/8/7 at 24, 4/4/4 at 12), never one odd step.

## Palette (all values from the P2 tables)
| key | hex | role |
|---|---|---|
| o | #6A4934 | umber outline (wood); at 16 and smaller only where the outline turns |
| k | #281C17 | the eyes only (darkest topsoil) |
| l | #F7E6C4 | the lit lip and the glaze down the left wall |
| p | #DAC29C | the clay body (pale root) |
| s | #B49A78 | clay shade: the underside, the right wall, the keel at 16 and smaller, and the line |
| h | #D2AC60 | the bead (seed gold) |
| g | #FFE09A | glow: the eye glints and the bead's core; stays lit at night (lamp) |

Four colour families (clay in three values, umber, the eyes, the seed-gold bead) and one glow.

**About the body colour.** It is unchanged and still very close to today's creature's cream #E2C29C (difference about
3 in CIELAB), so in Exhibit B the change comes from the shape, the lit bead and the eyes, not the colour. If the owner
wants the colour to say "new" as well, the proposed alternative (not applied) is a pale fired terracotta from Exhibit B's
own tables: body #D9A288 with shade #C48A72 (the lightest two of the worm table), lip, bead and glow unchanged. That is
about 14.5 from today's cream, still far lighter than the dusk hills, but it shares its colour with the worms
underground.

## Distinctive feature
The line and its lit bead, hung a little to one side. It is the one appendage, and it is also the tool, the lantern and
the anchor. In silhouette it joins the level lip, so the creature reads as "the bowl with the bead" at every size, and
the off-axis hang keeps it from reading as a stemmed cup.

## Sizes (one size in the world)
The recommended cut's ladder: the close-up at 2.4 cells per Exhibit B grain, 1:1 at 1.2, the final frame Exhibit B
itself at 1.0, and the phone end at 1 CSS px a grain.

| view | cells per B grain | sprite | drawn (cells) | in B grains (w x h) | before this round |
|---|---|---|---|---|---|
| opening close-up (and Act III's push-in) | 2.4 | s24 | 22 x 20 | 9.17 x 8.33 | 21 x 18: 8.75 x 7.50 |
| 1:1, Acts II-IV | 1.2 | s12 | 12 x 10 | 10.00 x 8.33 | the same |
| final frame, Exhibit B at 1440 x 900 | 1.0 | b10 | 9 x 9 | 9.00 x 9.00 (18 x 18 CSS px) | the same |
| phone end | 1.0 (1 CSS px a grain) | b10 | 9 x 9 | 9.00 x 9.00 (9 x 9 CSS px) | the same |

In B grains, at 24 / 12 / 9: hull 9.17 x 5.83 / 10.00 x 5.83 / 9.00 x 6.00; eyes 3.33 / 3.33 / 4.00 apart; the bead's
centre 1.46 / 1.67 / 1.50 off the axis. The heights now span 8.33 to 9 grains (7.5 to 9 before) and the widths 9.0 to
10.0 (8.75 to 10.0). At the 2:1 crossfade the 24 halved is 11 x 10 cells against s12's 12 x 10: the same height, the
eyes on the same columns (2 cells each side of the axis), the bead within a quarter of a cell, half a cell of hull more
each side at 12. At the pull-back s12 (10 x 8.3 grains) dissolves into b10 (9 x 9) with the bowl's middle on the same
row (kf4). The 12 stays 12 wide, the brief's "about 12 cells": at 11 the eyes would be either 3 cells apart, almost
touching, or 5 apart (4.2 grains, wider than at 24 or 9), and the tie at column 7 already takes the line and the bead
off the axis. Not in the cut: s16, 15 x 10 (the brief's simplified 16, inside today's 16 x 11 box), s8, 7 x 7, for
about x2, and the 3 x 3 mark for wide shots, which can keep the "you" label.

## Views (views.png, views.json)
Front, side and rear, 24x24 each. The hull is round, so the outline is the same from every side; only the eyes say
which way it faces. In profile one eye shows, toward the front of the bowl; from behind there are none, and the line's
tie and kink are on the other side. Light comes from the upper left in every view.

## Animation (strips.png, strips.json; key poses in poses.png; at 12 in s12.json and s12-sheet.png)
- Idle (spec.json; idle12 at 12; b10_lift and b10_settle at 9): rest; the bowl lifts a pixel, rigid, while the bead
  lags (a pixel more line shows); it settles onto the air, one row shallower (at 24 two pixels wider, at 12 and 9 the
  lower hull fuller), keel and bead where they were. The blink is its own frame (blink12, b10_blink, the 24's 'blink,
  shut'), every 4-6 bobs, never on a bob: the lids shut, the glints go, the bead stays lit.
- Hovering movement: start (eyes go ahead first), accelerating (rises a pixel and leans into travel, the bead trails:
  the stretch is in the line), cruising, decelerating (levels, settles a row, the bead swings on), settled, and the
  anticipation before a turn (it dips a pixel, looks, and the bead swings first). Both directions are drawn, so the
  light stays upper left. At 12: lean12 and glance12.
- Inspection: it notices a shoot, rises a pixel and leans in, its eyes follow the tip as it lifts and opens, then it
  holds there, sounding it, the bead hanging straight from its tie. At 12: inspect12, not lifted, the eyes narrowed on
  the thing.
- Construction: a grain rides under the bead, is let down on the line over a gap, and tapped home with one puff of silt
  and one brief light, on a 3-px kinked line with the bead off the axis; then the line reels in. Planting is the same
  motion with a seed; digging is a tap on a soft lip that loosens a grain or two; machinery is the bead let down onto a
  paddle tip on a short kinked line, its weight settled on it for the first turn, then it lets go and watches
  (env-cut.png). At 12: construct12.
- Discovery: the eyes widen a row (at 12 downward, so the lip stays clear), a two-pixel hop (one at 12) with the bead
  flicking up and brightening, then it settles with the bead swinging once. At 12: discover12.
- Rest: it lets the bead down to the ground on a short kinked line and rides at anchor, eyes half closed, then settles a
  pixel onto it and the line goes slack. At night the clay dims; the eye glints and the bead stay lit. At 12: rest12.

## Night
The clay dims with everything else. The two eye glints and the bead's core stay lit, so at night it shows as two small
warm points with a third, lower light a little to one side, like a lantern let down on a string. When it lowers the bead
into the well shaft or the fungus cave, its light goes down with it.

## Self-check against the seven tests
- Silhouette: a level lip over a round hull with a bead hanging off to one side. In solid black it reads at 24, 16, 12,
  9 and 7 as a bowl with a hanging drop off to one side, not a stemmed cup: at no size do the line or the bead sit on
  the axis (sheet.png, s12-sheet.png).
- Scale: the 16 and the 12 keep the lip, both eyes, the line and the bead; the 9x9 reads in Exhibit B's frame as a pale
  bowl with a small light below (mock-b-full.png, cut-end.png).
- Environment: pale clay reads on dusk sky, foliage, water, wood and stone; on dark soil and in caves the lit lip, the
  body and the bead carry it, and at night the glints and bead do (env.png, s12-sheet.png, strips12.png).
- Machinery: at a small wooden wheel the bead rests on a paddle tip on a short kinked line while the bowl hovers
  against the sky behind the wheel, at 24 and at 12, day and night; no umber outline cell touches the wheel's wood. On
  the cabin wall the outline meets wood, and 2 cells of pale clay or more separate the eyes from it at 12 and 9
  (env-cut.png). At machinery it hovers against water or sky, never against a spoke.
- Animation: idle, movement, inspection, construction, discovery and rest are drawn at 24 and at 12; the lagging bead
  adds motion without adding body frames.
- Icon: the 16 on the terminal-dark tile #100D0B reads at 16 px and up (icon.png). On paper or white the lit lip
  fades and the umber lip ends read as points, so the icon is shown on the dark tile; an umber top row is not used (it
  brings back the dark cap).
- Originality: a clay bowl and a lit bead on a line. No limbs, ears, antenna, screen face, hood or mask.
- Longevity: one shape, two eyes, one bead, few colours.

## Risks
- Without the bead the bowl alone can read as a cup or a lampshade, so no view hides the bead.
- At 12 and 9 the bowl is still a deep cup with eyes; the off-axis bead and the lit lip carry the identity there. On
  light tiles (the sheets, an icon on paper) the lit lip fades into the background; the icon reads best on the
  terminal's dark tile (icon.png).
- Over cabin wood the umber outline disappears into the wood and the pale clay alone makes the edge.
- The line is one or two pixels. In clay shade it shows on soil and in caves but is faint against the brightest sky; the
  bead stays visible either way.
- The body is still close to today's creature's cream (see the palette note).
- The line should pay out short and purposeful, never like fishing, and never plumb under the keel.

## Files
- coracle.py: the sprite builder; everything is drawn from it (the 24 with its poses, s16, s12 and its frames, b10,
  b10_lift, b10_settle and b10_blink, s8, the mark).
- build.py: `python3 -B build.py .` writes spec.json (24, idle, 16, b10, b10_lift, b10_settle, b10_blink, 8, mark) and
  s12.json. Kit
  images (kit.py): sheet.png, mock-film.png, mock-b.png, mock-b-full.png, ladder.png, env.png, and s24/s16/b10 at 1x
  and 8x. sheet.py, run after kit.py, redraws sheet.png in the same look with every size (the 12 and b10_lift
  included, with Exhibit B's rest, lift, settle and blink), the silhouettes and the night versions, each label in its
  own column.
- views.py: views.json and views.png. strips.py: strips.json and strips.png. poses.py: poses.png.
- in-cut/: the 12-cell set (s12.json; sheet12.py: s12-sheet.png; strips12.py: strips12.png, every 12-cell frame at 8x
  and at 1x and 2x on Exhibit B's hill, sky and cave), the cut's ladder (ladder_cut.py), key frames (kf.py), and the
  environment and icon tests (env_cut.py: env-cut.png, icon.png).
- in-b/: the Exhibit B proof (b10 drawn as an overlay, the frozen frame otherwise unchanged; see b-result.md).
- explanation.md: what makes it recognisable and right for Silt.
- v1/: the reviewed first draft. v2-before/ and v3-before/: the states before the second and third rounds of fixes.
