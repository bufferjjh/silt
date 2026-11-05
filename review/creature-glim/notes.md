# Glim, the lantern-tail

Concept for the Organic Spirit variation: a soft, naturally floating creature with an unusual silhouette and subtle
luminous features.

## What it is

Glim is a small, soft piece of dusk. Its round body has the colours of the evening sky near the horizon: mauve below,
the last apricot light along its crown. Its eyes glow like two lit windows. Its one long tail curls down behind it and
ends in a small lantern of its own light, a papery husk with a warm glow inside, like a ground-cherry.

It floats the way warm light floats. Nothing pushes it: no wings, no jets, no feet. It drifts low over the ground it
tends, and the lantern swings a little behind it like something carried with care.

What makes it recognisable is the pairing of a quiet round body with that one hanging light. At any size, even as a few
grains, it is "the small dusk-coloured thing with a lantern at its back". At night the body fades with everything else
and you still see it: two warm eyes and the lantern, moving slowly through the garden, slower and more curious than the
fireflies around it.

It fits Silt because it is made of the page's own evening: clay, dusk and lantern. Every colour is taken unchanged from
the world's palette (the dusk clouds, the horizon, the lamps), so it belongs to the scene rather than sitting on top of
it. Its light echoes the cabin windows and the glowing fungi, which suggests a kinship without explaining it. It stays
calm, gentle and a little mysterious: it carries a light, and nobody says where the light came from.

## Palette

All six are exact colours from the P2 tables (PAL in js/sand.js and js/reel-core.js). Five body colours and one glow.

| key | hex | role |
|---|---|---|
| a | #EDB58A | apricot: the last light on its crown, and the lantern's husk |
| r | #C48D79 | dusty rose: the band where the crown light turns into the body, and the top of the tail |
| m | #977B78 | mauve: the body |
| s | #86707A | mauve shade: the lower body and the tail |
| d | #4E4D61 | dusk violet: the underside edge and the tail's lower edge, which keep it clear of pale silt |
| g | #FFE09A | lantern glow: eyes and lantern. The only colour that stays lit at night |

## Distinctive feature

The lantern-tail: one soft tail that leaves the middle of its back, curls down, and holds a small glowing husk at its
tip. It is the only appendage. It hangs lower than the body, so the creature never seems to stand on anything; the
lowest point is always a light, not a foot.

Sizes (one creature, one size in the world): 24x24 grid, drawn 23x18, in the opening close-up; 16x16 grid, drawn 15x12
(the body alone about 12x9), at 1:1, which sits inside today's 16x11 footprint; 10x8 grains in Exhibit B and the film's
final frame, a straight reduction of the 16; 8x5 in the wider view; a 3x2 mark (crown, body and one lantern grain) for
wide shots.

## How it hovers

- Idle bob, three frames: the crown rises a cell while the body stretches a cell taller and the lantern lags behind, so
  the tail lengthens. Then the body sinks a cell into a slight squash and the lantern rises, so the tail shortens. The
  squash frame closes the eyes to a thin line, a slow blink. About two beats per bob (1.7 s at 72 bpm).
- Moving: the body tilts a cell toward the direction of travel, and the lantern trails behind like a pendulum. It
  stretches slightly as it speeds up and squashes slightly as it stops. On stopping, the lantern swings past once and
  settles, which shows that it stopped without any extra frames.
- Changing direction: a one-cell lean the other way first (the anticipation), then the turn. The tail always streams
  from the side it is leaving.
- It respects solid ground: it slides along surfaces and never passes through them. The lantern hangs within its own
  collision box.

## Inspection

It leans in and its eyes slide toward the thing. The lantern swings forward under the body to light what it is looking
at, then it holds still for a beat.

## Construction and interaction

The tail is the small appendage, and the lantern at its end is the tool tip. It curls forward under the body to reach
the work, and the light makes clear what is being touched. Every effect stays physical: grains move only where the tail
touches them.

- Planting: it lowers the lantern to the soil, tucks the seed in with the tip, and pats the ground twice. The seed is
  lit for a moment, then the light lifts away.
- Digging: the tip loosens a few grains at a time and flicks them aside, the way water carries silt off a lip.
- Building: it carries a grain or a brick in the curl of the tail, sets it down, and presses it into place.
- Machinery: it hooks the curl over a paddle or a lever and pulls gently. When the waterwheel takes up the motion, it
  lets go and the lantern brightens once, as if pleased.

## Discovery

A restrained reaction: the eyes open a row taller, the body gives a single one-cell hop, and the lantern brightens for
one beat and swings up. Then everything settles. This can stand in for the old "new material" panes.

## Rest

It sinks low beside whatever it is keeping company with (the pond, a sapling, the well) and sets the lantern down just
above the ground, like a lamp put down for the evening. The tail curls loosely around it, the eyes go half-lidded, and
the bob slows to half speed.

## At night

Everything dims except what gives light. The mauve body and the apricot crown dim with the scene. The eyes and the
lantern keep their glow (#FFE09A, warm and soft, never neon), so at night it reads as a lit window moving through the
garden. The lantern casts a small warm pool on the soil below it. In the fungus cave the light matches the cave's own
glow without disappearing, because its eyes and husk keep their shape.

## Self-check against Appendix B section 7

- Silhouette: in solid black it is a round body with a tail curling down to a bulb. That is clear at 24 and 16. At 10
  grains the tail shrinks to a hook, and the hanging lantern is what still identifies it.
- Scale: it reads at 16x16 and at 1:1 in the film frames, where the glowing eyes and lantern carry it. It is no bigger
  than today's creature.
- Environment: it reads against dusk sky, foliage, pond water, the dark cave, cabin wood and strata (env.png). The dark
  underside separates it from pale silt, the crown light from dark ground, and the glow from caves and night.
- Animation: very few frames do a lot of work, because the lantern swings as secondary motion. The bob, tilt, stop,
  blink and discovery all come from moving one cell.
- Icon: a round shape, two warm eyes and one hanging light. It holds up as a small avatar and as a 3x2 mark.
- Originality: a round dusk-coloured body that tends the ground by the light it grows at the end of its own tail. It has
  no ears, horns, leaves, wings, visor, mask, hood or cape. It is not orange, pink, white, blue, black or fuzzy, and its
  lantern hangs behind and below, not in front of its face.
- Longevity: it is simple and calm, built from six colours and a few clear shapes. It would still be pleasant to watch
  for hours, because the light is gentle and the motion slow.

## Risks and open points

- The mauve body is close to the dusk horizon in Exhibit B, so it relies on its apricot crown and its glow to separate
  from the sky. Against the hills and the beds, where it works, it separates well.
- In solid black at Exhibit B size, the tail and lantern make a short hook beside the body that could be read as a
  stalk.
- The lantern is part of the body, not something it carries. Mockups of it at work should keep the lantern attached to
  the tail, so it never reads as equipment.
- Three small lights at night (two eyes and the lantern) need restraint in the film: no flicker, and no bloom beyond
  the cells themselves.
