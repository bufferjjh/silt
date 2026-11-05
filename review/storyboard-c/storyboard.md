# Storyboard c: The Wheel Over the Crest

> The `work/` and `site/` folders named here (the scripts and the site copy that made these images) stay in the working folder and are not part of this review set.

**Logline.** A small creature plants a seed on a dry crest, then opens a spring on the far side of it; the water runs the other way, so the creature builds one wooden wheel that lifts some of it back over the crest. From that one handmade machine the damp spreads west and down, and Exhibit B's whole place grows out of it (terraces, cabin, well, the stream underground and the glowing cave) until the camera pulls back onto Exhibit B's own frame.

Lens of this draft: engineering first. There is one machine. The film follows what it causes, outward, beat by beat. Before the end there is one brief look at the valley beyond Exhibit B.

Files in this folder:
- `kf1-07.500.png`, `kf2-33.333.png`, `kf3-35.000.png`, `kf4-49.583.png`, `kf5-54.167.png`: the key frames, at true screen scale for 1440 x 900, dpr 1.
- `end-desktop.png`, `end-phone.png`: the two endings, each beside Exhibit B.
- `zoom.png`: today's views beside the proposed zoomed-out views.
- `work/`: the scripts that made the images, and Exhibit B's opening composed at the film's grain sizes. `site/` is a copy of the page, used only to capture those compositions.

All pictures are mockups, not renders. Where they show Exhibit B, the grains are real: B's opening composed by `js/sand.js` at the film's grain sizes, with today's creature painted out. Everything else is drawn at cell scale for the mockup: the bare opening ground, the land past B's edge, the wheel, the wildlife, and the placeholder creature (a soft round shape in #E2C29C with two #221917 eyes).

## The world

All positions are in Exhibit B's grains at 1440 (B's frame is x 0-575, y 0-323; its ground line is row 105). The film's world is Exhibit B's own geography, plus a strip of hillside just past B's east edge.

B's ground rises east over the terraces to the orchard (row ~74 at x 575). Just past B's frame it crests (x 580-598, row 72). On the crest's east flank is a low rock (x 597-644) with a spring held behind a soft lip in its face (x 642, row 93). Below the rock is a dip (x 642-702), which the creature digs into a basin. From there the slope falls east to a stream and a lake in the valley.

Water from the spring can only run east, away from B. The wheel lifts some of it back over the crest:
- The wheel is a wooden wheel 34 grains across with ten clay pots, standing in the basin's outflow.
- A split-log trough runs from the top of the wheel back west to a gravel soak on the crest at x 585-593, ten grains short of B's frame.
- From the soak the water seeps west and down through the silt and a porous band, into B's ground.

Everything that grows in B's frame grows after that water. None of the machine is inside B's frame.

## Scales and the creature ladder

A scale is the number of cells per Exhibit B grain, where Exhibit B at 1440 is 1. A cell is always 2 CSS px on desktop (1 on phones). Each scale is a level the film composes, never a scaled image.

| View | Cells per B grain | World across (577 cells) | Creature |
|---|---|---|---|
| Opening close-up (Act I); the cut-in at 62 | 2.4 | 240 B grains | the native 24 x 24 sprite |
| Transition steps only (beats 16 and 64, half a beat each) | 1.6 | 360 | the 16 x 16 version |
| 1:1 (Acts II-IV) | 1.2 | 481 | a 12 x 12 reduction (still to be drawn with the chosen design) |
| Final frame = Exhibit B | 1.0 | 576 | 10 x 9, pixel for pixel Exhibit B's new creature |
| Valley glimpse | 0.5 (0.8 for one transitional half-beat) | 1154 | a 4-cell mark with the `you` label |

## Beat list (72 bpm: beat n is at n x 5/6 s; 72 beats = 60.000 s)

Keys row throughout: `[p] plant   [d] dig   [b] build   [i] inspect   [z] zoom`. A key is lit while it is in use. The title bar always reads `silt` and `concept render · time sped up`.

| Time (s) | Beat | Act | Picture and camera | Words on screen | Sound |
|---|---|---|---|---|---|
| 0.000 | 0 | I | Film box dark. The picture is terminal black; at its top left, a dim shell prompt and a steady cursor. | `$ ` | Silence, then a low warm pad (D2 + A2) swells over 2 beats |
| 0.417 | 0.5 | I | `silt` typed one key each half-beat (0.5, 1, 1.5, 2). No other output. | `$ silt` | Each key a muted kalimba tick, rising D5 E5 F#5 A5 |
| 2.083 | 2.5 | I | Enter. The prompt clears and the picture fades up over a beat and a half, in four steps of light, into the close-up (2.4) at dawn. Left: pale bare silt on the crest, inside B's frame. Centre: the low rock, a dark damp seam behind a soft lip in its face. Right: the shallow dip, the slope falling east, far hills. The creature (24 cells) hovers over the crest, bobbing a cell. | `day 1` (ticker, dim) | Kalimba B5 on the enter; soft wind; one far bird |
| 3.333 | 4 | I | A seed drifts in on the wind from the east and lands on the crest, on the beat. The creature's eyes follow it down. | — | Soft bell A5 on the landing |
| 4.167 | 5 | I | The creature glides to the seed: a slight tilt toward travel, a squash as it stops. It leans in and its eyes track the seed. | `[p]` lit | E-piano Dadd9, soft |
| 5.000 | 6 | I | Construction effect: a small pale appendage presses the seed in, and two grains of silt close over it. | `[p]` lit until 5.833 | Pluck D5, a brush tap |
| 5.833 | 7 | I | It hovers east over the rock and stops below the seam. It looks at the dark damp grains behind the lip. | — | Wind; the pad moves to B |
| 6.667 | 8 | I | It scoops the dip into a hollow, three grains a scoop, on 8, 8.5, 9 and 9.5. The grains land in a small heap on the east side (kf1 at 7.500). | `[d]` lit | Each scoop a soft brush swish and a dry grain patter |
| 8.333 | 10 | I | It sets three flat stones along the hollow's east lip, one each half-beat (10, 10.5, 11): a simple structure, a little dam. | `[b]` lit | Three low stone clicks |
| 9.583 | 11.5 | I | It rises to the seam and picks the soft lip, a grain on 11.5, 12 and 12.5. | `[d]` lit | Three tiny ticks |
| 10.833 | 13 | I | The lip gives. Simulated: the held water is released and runs down the rock face into the hollow. The creature backs off a cell with a small bounce, eyes wide: the first discovery reaction. | — | The trickle starts; bell D6; the pad swells |
| 11.667 | 14 | I | Simulated: the hollow fills, and the water darkens the silt it touches. The seed on the crest stays pale and dry, because the rock and the crest are higher than the water. | — | Trickle; kalimba A–F#–E |
| 12.500 | 15 | I | Hold. The water reaches the stone lip. | — | Trickle |
| 13.333 | 16 | II | The camera steps back in two eased steps, 2.4 → 1.6 on the beat and 1.6 → 1.2 on 16.5. Each step is a 4-frame crossfade, and the close-up's outline stays behind in lantern, fading over 0.8 s. The 1:1 view shows the whole crest: to the west, B's bare slope down to the flat where the cabin will be; to the east, the basin and the slope beyond. | — | Soft bells A4, then D4; brushes begin |
| 15.000 | 18 | II | Simulated: the basin fills to its stones and spills. A thin run of water goes east down the slope, darkening a band of silt as it soaks in. | — | The trickle fuller; e-piano |
| 16.667 | 20 | II | Grass rises along the damp band, east side only, by the existing rule that grass follows the damp. Moss appears on the wet foot of the rock. | — | Two bird calls; kalimba |
| 18.333 | 22 | II | A small bird drops to the basin's edge, drinks, and hops to the rock. This is choreographed, but it comes only once there is open water, and lands at the water's edge. | — | Bird chirps on 22 and 22.5 |
| 20.000 | 24 | II | By the existing rule, silt under standing water turns to clay: the basin's bed goes orange grain by grain, and the water level steadies as the bed seals. The creature leans in to look; a restrained discovery reaction (eyes widen, a brief brightening) replaces today's "new material" pane. | — | Low bell D3; e-piano G |
| 21.667 | 26 | II | Two small deer come in from the east edge to graze the new grass (kf2 shows them). | — | Insects come in, soft |
| 23.333 | 28 | II | The creature hovers back over the crest to its seed, still the only dry ground in view. Its eyes go from the seed to the water and back. | — | One held e-piano note |
| 24.167 | 29 | II | It settles beside the seed (rest), facing the water. | — | Pad |
| 25.000 | 30 | III | It builds in a short time-lapse, one piece per beat with the construction effect on each: two posts in the basin with the axle (30), the hub and six spokes (31), the rim (32), twelve boards (33), then ten clay pots lashed on, two or three each half-beat (34 to 35.5). Wood and clay; no metal. | `[b]` lit | A soft, low, hollow wooden knock for each piece, on the beats (new cue); clay tocks on the half-beats |
| 30.000 | 36 | III | Simulated: the current from the spring to the lip pushes the lowest boards, and the wheel begins to turn, east side rising. Its speed follows the water flowing under it, eased, and settles at one pot per beat. The pots dip, fill and rise. | — | One slow wooden creak (new cue); trickle |
| 30.833 | 37 | III | The first full pot reaches the top and tips, and the water falls straight back into the basin. The creature tilts, watching. | — | A short pour |
| 31.667 | 38 | III | It lays a split-log trough from the top of the wheel west over the rock to the crest: three lengths on 38, 38.5 and 39, on two short posts. | `[b]` lit | Three knocks, rising |
| 32.917 | 39.5 | III | At the trough's end, on the crest just outside B's frame, it digs a small pit and drops gravel in: a soak. | `[d]` lit | Gravel rattle |
| 33.333 | 40 | III | A pot tips into the trough on every beat. The water runs west and drops into the soak, which drinks it. Simulated: the pots carry grains of the basin's water up; water entering the soak becomes damp in the ground; nothing is made or lost (kf2). | — | From here to beat 48, a wooden tock and a small pour on every beat: the machine plays the pulse, and the brushes lock to it |
| 34.167 | 41 | III | The moisture inspection overlay. The picture dims to grey, and water and damp ground show in four steps of blue, read from each grain's damp. The soak's water spreads in the silt, sinks through the red band, and runs west along the porous band under B's slope toward the flat. The front advances on 41, 41.5, 42 and 42.5. The creature has hovered to its seed, which the damp is just reaching (kf3 at 35.000). | `[i]` lit; `moisture` (ticker right, amber) | Soft low bell and a sub-pad; the knock goes on, muffled |
| 35.000 | 42 | III | (Overlay continues.) | `Give a little. It gives back more.` (until 39.583) | E-piano Dmaj9 |
| 36.667 | 44 | III | The overlay goes off in one step. By the existing sprout rule (damp for long enough), the seed sprouts: a green shoot, and a root into the damp. The creature's discovery reaction: eyes widen, a small bounce, a brief brightening. | — | Kalimba A5 B5 D6; a bell |
| 37.500 | 45 | III | By rule, grass follows the damp down the west slope, a band at a time. This is the first green on B's side. | — | Birds; insects |
| 38.333 | 46 | III | The deer cross the crest to the new grass on the west side, and a bee finds the first flower. | — | A short, soft bee buzz |
| 39.167 | 47 | III | The camera pans west in whole cells, eased, following the green down the slope until B's east part fills the window (x 95-576): the bare flat, the greening slope, the crest at the right edge with the trough's end. The wheel leaves the frame, still knocking. | caption fades at 39.583 | The knock fades 3 dB a beat |
| 40.000 | 48 | IV | The time-lapse begins: one picture each afternoon at the same hour, so the day and night never flicker, one day step per beat. From this step on, the picture is the dated world. Every grain of Exhibit B's opening has a day it appears, set by when the damp reaches it (grass, crops, trees) or by the creature's hand (anything built). The growth follows the water. | `day 2` | The pad opens (D A E); brushes double; birds |
| 40.833 | 49 | IV | Where the seep comes nearest the surface, the creature cuts four terrace beds, top to bottom. Cabbages, carrots, beans and wheat come up in each as the damp reaches it. | `day 4`; `[d]` lit | Four plucks, descending with the beds |
| 41.667 | 50 | IV | The sprout on the crest is a young blossom tree, becoming B's orchard tree. Its seeds blow west; a bird carries one to the meadow. | `day 6` | Kalimba |
| 42.500 | 51 | IV | The cabin rises on the flat, in day steps: the cellar is dug first, then the stone footing, the walls plank by plank, the moss roof, and the chimney with its first smoke. The lamp post goes in. | `day 9`; `[b]` lit | Knocks, softer than the wheel's |
| 43.333 | 52 | IV | A rain shower crosses one day step. The low hollow west of the meadow fills where the rain gathers, and reeds follow. The creature lays the footbridge across it, and the staked sapling goes into the meadow. | `day 14`; `[b]` lit | Light rain, one beat; e-piano |
| 44.167 | 53 | IV | From the cabin's yard, the creature sinks the well straight down to where the overlay showed the water gathering. The camera tilts down in whole cells after the shaft: the damp has pooled above the dark rock, the pool under the well. | `day 20`; `[d]` lit | A descending kalimba run; a plink when the shaft meets the pool |
| 45.833 | 55 | IV | Underground, the pool spills at its low west end and the water finds a fault. The creature cuts steps after it, one each half-beat (55 to 57), and the water follows down each step. This is simulated where it shows, and stepped like B's own stream. | `day 34` (27 on 54) | Each step one descending pentatonic note: A4 F#4 E4 D4 B3 A3 |
| 47.500 | 57 | IV | The water reaches the dark cave. The fungi light one by one where its damp reaches, and small lights appear on the ceiling. The creature hovers in, eyes glowing softly, with a restrained discovery reaction. | `day 42` | One soft bell per cap; crickets begin |
| 48.333 | 58 | IV | The camera steps back, 1.2 → 0.8 → 0.5, on 58 and 58.5 (crossfades). The valley glimpse: B's place at half size in the middle. West, the grove's hill is becoming a wood. East, past B's frame, are the crest, the wheel still turning, the green slope down to a stream and a lake with deer at the shore, and a second small cave under the crest where the seep went on. Golden hour. Day steps come two per beat. | `day 48`, `56`; `[z]` lit | Bells A3, D3; wind; a far knock every other beat |
| 48.750 | 58.5 | IV | The creature is a 4-cell mark at the cabbages. | `you` (label, until 50.833) | — |
| 49.167 | 59 | IV | Rings: the outlines of the opening close-up and the 1:1 window, nested round the wheel, and corner marks on Exhibit B's frame. All fade over a beat and a half. A loose line of birds drifts west (kf4 at 49.583). | `day 64`, `72` | Soft ring ticks on the half-beats 59 to 60.5, as today's |
| 50.833 | 61 | IV | Dusk comes in two steps (61 and 62): the lake darkens, the window and the lamp light, fireflies come out over the meadow, and the cave glows. The days stop. | `day 108`, `120` | The pad drops to D; crickets fuller |
| 51.667 | 62 | IV | Cut in, on the beat, to the close-up scale (2.4) on the creature at the cabbage bed at dusk. It settles beside the cabbages with a sprout held in its small appendage, eyes softly lit: rest. | `day 120` | Kalimba D5 alone; one cricket |
| 52.500 | 63 | IV | Hold: an idle bob and one blink. | — | — |
| 53.333 | 64 | IV | The final pull-back, step 1: 2.4 → 1.6 (4-frame crossfade). The 2.4 frame's outline stays behind. | `[z]` lit | Bell A4 |
| 54.167 | 65 | IV | Step 2: 1.6 → 1.2. The two outlines ride along, nested on the creature and on B's east edge, fading (kf5). | `[z]` lit | Bell F#4 |
| 55.000 | 66 | IV | Step 3: 1.2 → 1.0, landing on Exhibit B's framing at one cell a grain. The pane and keys rows and the ticker clear, and the picture opens down to row 283. | — | Bell D4, the lowest; the pad resolves |
| 56.250 | 67.5 | IV | The outlines are gone. The frame is Exhibit B's frozen frame, rows 0-283, with its fireflies, and the creature (10 x 9) at the cabbages. | — | Crickets; wind |
| 56.667 | 68 | IV | The tagline fades in over the plain rock at the foot of the picture. | `Every afternoon leaves a layer.` | Kalimba D5, A5 |
| 57.500 | 69 | IV | The second line fades in, in the caption row. | `Concept render · in development · working title` | — |
| 58.333 | 70 | IV | Hold. | (both lines) | The last pluck D5 on 70; far off, one soft wooden knock on 71: the wheel, out of frame |
| 60.000 | 72 | — | End, on the last frame. | (both lines) | The pad and crickets have tailed out |

The rows add up to 60.000 s, and every time is on a beat or a half-beat. The acts:
- Act I: 0.000-13.333 (beats 0-16)
- Act II: 13.333-25.000 (beats 16-30)
- Act III: 25.000-40.000 (beats 30-48)
- Act IV: 40.000-60.000 (beats 48-72)

**What causes what, and what is choreographed.**
- Simulated in Acts I-III, with the existing rules plus three new ones:
  - existing: water running and filling, soaking and darkening, grass and roots following the damp, clay under standing water, the sprout;
  - new: pots carrying grains of water, a soak turning water into damp, and damp travelling through a porous band.
- The wheel's speed comes from the flow under it. The only choreography is a clamp, once the flow is steady, so a pot tips on every beat.
- The bird, the deer and the bee are scripted. Each comes only where water or new green already is, and each grazes, drinks or drifts. Nothing hunts, fights or dies.
- Act IV is a deterministic replay. Its order comes from causes:
  - each grain's day comes from a seep field computed at load from the soak through the porous ground, so plants appear in the order the damp reaches them;
  - the pool fills before the well, the steps before the cave lights, the cave before its fungi;
  - built things appear where the creature hovers, part by part.

## The questions in brief section 5

### 1. The ending on Exhibit B

**Desktop (1440 x 900, dpr 1): B's rows 0-283 of 324, grain for grain.**

I measured the page (`work/measure-end.mjs`):
- The film's canvas during play and at the end is 577 x 285 cells at 2 CSS px.
- During play, 244 rows show above the pane strip, which starts at y 540.
- At the end, reel.js clears the pane and keys strip (`spare`), as it does for today's end card. The picture then shows from y 54 to 621: 283.5 cells.
- The 577 x 257 in the brief is the canvas while the cover still is up. Then it includes the ticker row and leaves out the strip.

So the last frame is B's frozen frame from its top edge down to row 283. The film's 577th column is cut by the box, so its 576 columns are B's 576 grains.

Why this band:
- It keeps B's whole sky: the moon, the clouds and the tree tops.
- B's top edge is the film's top edge, so the reader who scrolls on meets the same top again.
- Everything else B has is in it: the cabin and cellar, the pond and bridge, the terraces with the creature at the cabbages, the well, the pool, the stream steps, the fungus cave down to its floor (row 280), and the crystal (row 268).
- Only the spiral fossil (row ~294) and 40 rows of plain rock are left below. They are the next layer, found by scrolling.

The end words (`end-desktop.png`):
- `Every afternoon leaves a layer.` sits over the frame in the keys row's place (y 594-621). That is B's rows 270-283 at x 218-357: plain rock between the cave and the crystal, above the fossil.
- `Concept render · in development · working title` sits in the caption row (y 648-675), below the picture.
- If the owner wants the picture untouched by text, line one can move to the air row under the picture.
- If the keys row has to stay visible at the end, only 244 rows show, the best band is rows 37-280, and the moon and tree crowns are cut. I don't recommend that.

**dpr 2:**
- The film's cells stay 2 CSS px, and its last frame is B's 1440 composition at 1.5 grains a step: the frozen frame's own grains.
- B underneath runs the same plan at 2 grains a step (1.5 CSS px). Same layout, same light, the same things at the same places on screen; only the grain is finer. It reads as the same picture.

**Other desktop widths:**
- The film's world is built on Exhibit B's `layout()` for the viewer's stage width, so its last frame is B's composition for that width: 720 grains at 1600, 504 at 1100.
- Every beat is anchored to parts that every desktop layout keeps: B's east edge and the crest beyond it, the first terrace bed, the cabin and the well.

**Phone (390 x 844, dpr 3): the picture at the end is 352 x 264 CSS px**, the 192 rows of play plus the freed pane rows (measured canvas 353 x 265, 1 CSS px a cell). See `end-phone.png`.
- It lands on Exhibit B's phone composition grain for grain: the 211 grains B shows across a phone, at 1.8 grains a step. That happens to be the film's 1:1 grain.
- They are drawn at 1 CSS px instead of B's 1.67 and centred.
- It shows B's rows 16-279: the moon, the bridge and the pond, the lamp, the cabin, the well head and the cellar, down to the pool at the foot of the well.
- On either side the world goes on: a tree on the west hill; to the east the crest, with the trough coming in to its soak. The wheel itself is just past the picture's edge.
- There is no creature in the last phone frame, because B has none on phones. In the last pull-back step it drifts east out of the picture, toward its wheel.
- The phone's pull-back is 2.4 → 1.6 → 1.2, and the last step is B's phone grain.
- The tagline sits in the caption band under the picture; the second line wraps to two rows as today.
- On phones the world is B's phone layout (pond, meadow, home), so the cut-in at beat 62 is at the well, not the cabbages.

### 2. The same end for every seed 1-256

- Until beat 48, the seed's physics dice drive only the live patch around the crest, basin and wheel (Acts I-III).
- At beat 48 (40.000 s), the first day step of the time-lapse, the picture hands over to the dated world, which is built from:
  - Exhibit B's opening, composed by sand.js's own composition with its fixed dice (`OPENING`), every grain given a day;
  - the film's land past B's edge (crest, rock, basin, wheel, valley), composed once with the film's fixed `WORLD_SEED`.
- From then on nothing on screen reads the physics dice, and the creature's path is scripted. So frames from 40.000 s on are the same for every seed, and the last frame is B's frozen frame by construction.
- The hand-over is hidden in a day step, which shows the next afternoon anyway. A seed's small differences in the patch (a grass blade here or there) read as a day's growth.

Gates for `tools/story.cjs`:
- For seeds 1-256, the frame at 59.0 s equals seed 10's, pixel for pixel. So does the frame at 40.0 s.
- The basin is full by 15.0 s.
- The wheel turns by 30.8 s.
- The first pot empties into the trough by 33.4 s.
- The damp reaches the seed's column by 36.0 s.
- The sprout is up by 36.7 s.
- Grass is on the west slope by 37.5 s.
- A seed that misses a gate goes in `LEFT_OUT`.

### 3. The tree-ring outlines

Kept, twice, and gone by the last frame. One change in form is flagged below.
- **At the valley glimpse (49.167-50.417 s):** the outlines of the opening close-up and the 1:1 window, nested round the wheel and the crest, plus corner marks (today's cut-mark style) on Exhibit B's frame, where the film is about to land.
- **In the final pull-back (53.333-56.250 s):** each step leaves the outline of the frame before it. The 2.4 frame sits inside the 1.6, the 1.6 inside the 1.2, and the 1.2 inside B, nested on the creature and sharing B's east edge. They fade over a beat and a half each.
- All outlines are gone at beat 67.5 (56.250 s), before the words at 56.667.
- **The change to the owner's pick:** at the glimpse, the rings are nested round the wheel rather than round the centre of the place, because the film starts just outside B's east edge. B's frame is marked with corners, not drawn as a ring.

### 4. The waterwheel and machinery

**Outside Exhibit B's frame. No addition to B is proposed.**

Where it all sits, in B grains (B's frame ends at x 575):
- crest: x 580-598
- rock and spring: x 597-644
- basin: x 642-702
- wheel: centre x 672
- trough: from the top of the wheel to a soak at x 585-593
- In the last frame none of it shows. It is heard once, a knock on beat 71.

The machine is modest and handmade:
- A wooden wheel 34 grains across, with ten clay pots lashed to its rim and twelve boards for the current to push, on an A-frame of two posts in the basin.
- A split-log trough on two posts.
- A gravel soak.
- Wood, clay and stone only: no gears, metal or smoke.
- On screen the wheel is 82 cells across in the close-up, 41 at 1:1 and 17 in the glimpse.

Its immediate job is to lift water over a crest the water could not cross. Its secondary effects ripple outward:
- the west slope greens;
- the terrace crops come up;
- the pool forms under the cabin, and the well is sunk to it;
- the stream steps run down to the cave;
- the fungi light;
- a second cave forms beyond B;
- downstream, a green slope, a lake and deer.

In Exhibit B, all of that is already there as what B has. The wheel is the unseen cause of B's water.

### 5. The slight zoom-out (see `zoom.png`)

Both working views show 1.33x more world across than today, and the close-up stays at 2x the 1:1 scale, as today.

The comparison is measured by the creature. Today's creature is 4 valley grains wide, and B's (the same character) is 10 grains. So on B's scene, today's proportions put:
- today's 1:1 at 1.6 cells a B grain (360 grains across);
- today's close-up at 3.2 (180 across).

| View | Today | Proposed | Creature on screen |
|---|---|---|---|
| Close-up | 3.2 cells a B grain, 180 B grains across | 2.4, 240 across | 32 → 24 cells |
| 1:1 | 1.6, 360 across | 1.2, 481 across | 16 x 11 → 12 x 12 cells |
| Final frame | — | 1.0: Exhibit B, 576 across | 10 x 9 grains |

- Exhibit B's whole width is 1.2x the 1:1 view, and the last pull-back covers 2.4x.
- `zoom.png` shows today's film painted 1.33x wider and box-filtered. That is an approximation and is labelled so.
- It also shows real grains: B's own scene at today's 1:1 scale against the proposed one.
- If 1.33x is too far for the 1:1, 1.2x keeps the same structure: 1:1 at 1.33 cells a grain (B's own dpr-2 grain), creature 13 cells, and the close-up at 2.67.

### 6. Camera language

- **Cell size never changes.** A cell is always a whole number of device pixels: 2 CSS px on desktop, 1 on phones. A zoom changes only how much world a cell holds. No picture is ever scaled, so nothing shimmers.
- **Five scales only:** 2.4, 1.6, 1.2, 1.0 and 0.5, plus 0.8 for one half-beat. Each is a level the film composes:
  - the close-up and 1:1 levels are simulated;
  - B's composition is built at 3.6, 2.4, 1.8 and 1.5 grains a step;
  - the glimpse takes two grains to a cell, by majority, as today's long views do.
- **Gentle zooms are stepped zooms.**
  - Two or three steps on beats and half-beats, eased by shrinking ratios (1.5, then 1.33, then 1.2).
  - Each step is a 4-frame crossfade between two whole-cell pictures.
  - The previous frame's outline stays behind in lantern, as today's cut marks do.
- **Pans move in whole cells.** At a fixed scale the camera moves in whole cells, eased, at most a cell a frame, so it scrolls like a terminal. There is one pan west (beats 47-48) and one tilt down (beats 53-55).
- **Time-lapses hold the camera still.** One picture per day, at the same afternoon hour, with day steps on the beat. The light changes at most once a beat, and never strobes.
- **One hard cut,** in to the creature on beat 62.
- **Reduced motion:**
  - steps become hard cuts with no crossfade;
  - the pan and the tilt each become a single cut;
  - days pass in four hard steps (day 2, 20, 56, 120);
  - the outlines appear and go without fading;
  - fireflies, the lamp and the fungi don't twinkle;
  - the wheel moves a pot's turn per beat instead of spinning;
  - the creature's bob and blink are off;
  - the prompt appears whole instead of typed.

### 7. Counters and panes

- **What goes:** `N grains growing` and the two panes (`new material: clay`, `new life: reeds`).
- **What replaces them:**
  - The creature's restrained discovery reaction, at the spring, the clay, the wheel's first lift, the sprout and the cave.
  - One inspection overlay, `[i] inspect`, for three beats in Act III (beats 41-44): moisture. Each cell's blue step comes from that grain's damp in the arrays. While it is on, its name, `moisture`, shows in the ticker's right.
- **No numbers on screen except `day N`.** It stays as a gentle sense of time, dim in the ticker's left, and it is the film's own clock for the dated world:
  - `day 1` through Acts I-III, which are one morning to one afternoon;
  - then 2, 4, 6, 9, 14, 20, 27, 34, 38, 42, 48, 56, 64, 72, 84, 96, 108 and 120, one step per beat from beat 48 and two per beat from beat 58;
  - the ticker clears at the landing.
- **The keys row** is `[p] plant  [d] dig  [b] build  [i] inspect  [z] zoom`. The only new key is `[i] inspect`, and the row is 56 characters, which fits at 1440. The lit key follows the table. Phones keep today's arrangement.

## The launch and the words

- The launch is `$ silt` typed at a dim prompt in the picture's top left, cleared on Enter. There is no install command, package manager, URL or version.
- Every word on screen:
  - the title bar: `silt`, `concept render · time sped up`;
  - `$ silt`;
  - `day 1` to `day 120`;
  - the keys row;
  - `moisture`;
  - one caption, `Give a little. It gives back more.`;
  - `you`, by the mark in the glimpse;
  - the two end lines.
- `All of this, from one seed.` is dropped. In this cut the cause is the wheel and the water, not the seed.
- **Not presented as decided:**
  - The valley beyond B is shown going on, but with no edge and no walls: the world's shape stays open.
  - There are no goals, markers or scores.
  - One creature, the placeholder, is shown. Nothing says it was chosen or customised.
  - No one else appears.
  - The tagline is the picked one, and the name stays marked "working title".

## Exhibit B changes

None beyond the new creature. B's code changes for the ending would not change how B looks or runs:
- export `layout()` and the opening's composition from sand.js as code the film can call without the page, so the film composes B's opening at its four grain sizes and dates each grain;
- the film's last frame is painted by B's renderer at 1.5 grains a step.

B's own call, sizes, speed and frozen frame stay as they are. The one exception is the new creature, drawn as an overlay at render time so B's dice stream is unchanged (removing today's creature grains is known to shift the grass). A check compares `assets/cross-section.png` with the rebuilt plate, pixel for pixel outside the creature's box.

## Risks and what would be hard to build

1. **Sharing B's composition is the core of this draft.** `boot()` uses the canvas context and the page today, so it has to become a page-free module that also runs under Node for `story.cjs`, without moving a single grain of B. Building it at 3.6, 2.4, 1.8 and 1.5 grains a step costs load time; the 3.6 build is about 1.1 M grains, so it is needed only for the window round the creature.
2. **The film's world depends on the stage width, as B's does.** So the beat gates have to run per layout (1440, 1600, 1100, 1000, phone), not just per seed.
3. **The hand-over at beat 48** from the live patch to the dated world must not jump. That needs a check that the dated day-2 picture matches the canonical seed's live state closely, plus the gate at 40.0 s.
4. **New rules:** a wheel whose turn comes from grain flow, pots that move water grains, a soak, and damp travelling along a porous band. In sand.js, B's rock bands are solid rock, so the porous band has to be film-only.
5. **The wheel's beat-lock is choreography.** If the flow varies by seed, the clamp could show as the wheel speeding up or slowing down. Gate its speed by 33.4 s.
6. **The 12-cell creature is a fifth sprite size** not in the kit spec, and it has to stay readable in a busy Act IV at 1:1. The 16 x 16 appears only on the two transition half-beats.
7. **The sound gains new cues:** a wooden knock, a creak, a pour, stone clicks and gravel. A knock on every beat for eight beats could get busy, so keep it low and filtered, and duck it under the caption.
8. **Narrow desktop windows (947-1279 px)** crop the 1:1 to 68-79%. In Act III the seed (x 556) and the wheel (x 672) are 116 grains apart, which is 140 cells at 1:1, so `FOCUS` must hold both while the trough is laid.
9. **The mockups are composites.** The bare opening ground, the land past B's edge, the overlay's plume and the glimpse's surroundings are drawn for the mockups and only show the idea. B's grains at the film's grain sizes are real.
