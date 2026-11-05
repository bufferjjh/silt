# Film re-cut: the review set

This branch holds review images and notes for the film re-cut. It is never merged. Nothing here is on the live site.

There are two stops before anything is built: the **creature** and the **storyboard**. Below are the four creature concepts and the three storyboards, with three independent reviews of each, a recommendation, and the technical approach for the ending.

## What needs your pick

| Decision | Recommendation | Alternatives |
|---|---|---|
| **1. The creature** | **Coracle**: a small floating bowl of fired clay with a lit bead on a line. First with all three reviewers, then refined in three rounds of fixes. | Octant, Kern, Glim |
| **2. The storyboard** | **Storyboard A, "One Window", with the reviewers' grafts** ([recommended-cut.md](recommended-cut.md)). A narrowly first (5 points to C's 4). | C as drawn, B as drawn, or A as drawn |
| **3. The waterwheel** | **A small addition inside Exhibit B**: about 70 grains, drawn on top so nothing else in Exhibit B changes. This needs your yes. | Keep Exhibit B unchanged and put the wheel just past its right edge (storyboard C's geography) |
| **4. The phone ending** | A band of the same picture the phone has been watching, at 1 CSS px a grain: option (i) in [ending/end-phone-options.png](ending/end-phone-options.png) (a technical comparison, not a film frame) | (ii) Exhibit B's own phone picture |
| **5. The zoom-out** | 1.33× more world in both working views (close-up 24×24, 1:1 a 12-cell version) | A milder 1.2× |

The ending's approach: **Exhibit B's own code draws the film's last frame, so it is the frozen frame exactly, on every seed. Before that, the patch is Exhibit B's own composition, growing in part by part.** See [ending/approach.md](ending/approach.md).

## The creature

The judging is in [creature-reviews.md](creature-reviews.md). Each concept folder has the same set of files:

- `sheet.png`: the 24×24 at 1× and 8×, the 16×16, the Exhibit B size, black silhouettes, the three-frame idle, night, and the palette in hex;
- `mock-film.png`: today's film at real scale with the new creature in place of today's, beside today's at 7×;
- `mock-b.png`: Exhibit B's frozen frame with it, beside today's at 4×;
- `ladder.png`: its size in each view next to today's creature;
- `env.png`: it against the dusk sky, foliage, water, the fungus cave, cabin wood and stone, by day and by night;
- `notes.md`: the concept in words, its palette, movement, interaction and a self-check against the tests.

| Concept | Folder | In one line |
|---|---|---|
| **Coracle** (abstract automaton) | [creature-coracle/](creature-coracle/) | A bowl of fired clay riding the air like a round boat on water. A lit bead hangs on a line beneath it, and it does everything through the bead. |
| Octant (geometric lifeform) | [creature-octant/](creature-octant/) | A square grain turned onto its corner, the one thing that doesn't sit square or fall, with one level square of light at its shoulder. |
| Kern (living seed) | [creature-kern/](creature-kern/) | A gold seed that grew one rose wing and never came down. |
| Glim (organic spirit) | [creature-glim/](creature-glim/) | A small piece of dusk with glowing eyes and a tail that ends in a lantern. |

### Coracle, the recommended creature

The design shown is the one after three rounds of fixes; see [creature-reviews.md](creature-reviews.md) for what changed and why.

- [explanation.md](creature-coracle/explanation.md): what makes it recognisable and right for Silt, in a few sentences. [notes.md](creature-coracle/notes.md) has the full design notes.
- [sheet.png](creature-coracle/sheet.png): every size at 1× and 8×, black silhouettes, the idle bob, Exhibit B's bob and blink, night, and the palette.
- [views.png](creature-coracle/views.png): front, side and rear, at 8× and at true size.
- [strips.png](creature-coracle/strips.png): the 24×24's frame strips for hovering movement, inspection, construction, discovery, rest and the blink.
- [strips12.png](creature-coracle/strips12.png) and [s12-sheet.png](creature-coracle/s12-sheet.png): the 12-cell version the 1:1 view uses, with all its frames.
- [ladder-cut.png](creature-coracle/ladder-cut.png): its size in each view of the recommended cut, next to today's creature. That is 24 in the close-up, 12 at 1:1, and 9×9 in the last frame and on the phone.
- Coracle in the recommended cut's key frames, at true scale:
  - [cut-kf1.png](creature-coracle/cut-kf1.png): the close-up, digging;
  - [cut-kf2.png](creature-coracle/cut-kf2.png): the first wide moment, bare;
  - [cut-kf4.png](creature-coracle/cut-kf4.png): the same framing, full;
  - [cut-end.png](creature-coracle/cut-end.png): the last frame, beside Exhibit B.
- [env-cut.png](creature-coracle/env-cut.png) and [env.png](creature-coracle/env.png): it against a waterwheel, pond water, cabin wood, dusk sky, foliage, the fungus cave and stone, by day and by night. [icon.png](creature-coracle/icon.png) is the icon test.
- **Exhibit B, rendered by its own code with Coracle in it:**
  - [b-before-after-8x.png](creature-coracle/b-before-after-8x.png): today's creature beside Coracle, at 8×;
  - [b-diff.png](creature-coracle/b-diff.png): the frozen frame with every changed grain marked. All 91 are inside the creature's box and none are outside it;
  - [b-plate.png](creature-coracle/b-plate.png): the whole frozen frame;
  - [b-live-frames-8x.png](creature-coracle/b-live-frames-8x.png): its bob and blink, live;
  - [b-result.md](creature-coracle/b-result.md): the numbers.
- [mock-film.png](creature-coracle/mock-film.png), [mock-b.png](creature-coracle/mock-b.png) and [ladder.png](creature-coracle/ladder.png): the same views as the other concepts, for comparison. These use today's zoom, and the 16×16 at 1:1.
- [sheet-as-reviewed.png](creature-coracle/sheet-as-reviewed.png) and [mock-b-as-reviewed.png](creature-coracle/mock-b-as-reviewed.png): the draft as the reviewers saw it.
- [spec.json](creature-coracle/spec.json) and [s12.json](creature-coracle/s12.json): every sprite as rows of pixels, with the palette.

## The storyboards

The judging is in [storyboard-reviews.md](storyboard-reviews.md); the recommendation is in [recommended-cut.md](recommended-cut.md). Each storyboard folder has:

- `storyboard.md`: the full beat list (time, picture, words, sound) and its answers to the seven section 5 questions;
- 3–5 key frames (`kf*.png`) at true scale;
- `end-desktop.png` and `end-phone.png`: the last frame beside Exhibit B's frozen frame;
- `zoom.png`: the zoom-out, today against the proposal.

A placeholder creature stands in for the new one in these mockups.

| Storyboard | Folder | In one line |
|---|---|---|
| **A · One Window** | [storyboard-a/](storyboard-a/) | One patient camera. The same framing is seen bare at the first wide moment and full at the end; a hollow, a plank and a seed become the pond, the footbridge and the sapling. |
| B · Where the Water Goes | [storyboard-b/](storyboard-b/) | The film follows the rain down through the strata to water underground, where a handmade wheel lifts it back up to a garden. It has the strongest cause and effect, but it is the busiest. |
| C · The Wheel Over the Crest | [storyboard-c/](storyboard-c/) | A spring runs away from a dry crest, so the creature builds a wheel that lifts water back over it. Exhibit B stays untouched, and the wheel sits outside it. |

## The ending

- [ending/approach.md](ending/approach.md): the technical approach, what was proven, and the numbers.
- [ending/end-1440-285rows.png](ending/end-1440-285rows.png): the film box's last frame at 1440 × 900, drawn by Exhibit B's code (rows 0–283).
- [ending/end-1440-324rows.png](ending/end-1440-324rows.png): the alternative, with all of Exhibit B under the title bar.
- [ending/end-dpr2-compare.png](ending/end-dpr2-compare.png): at dpr 2, the last frame beside Exhibit B live.
- [ending/end-phone-options.png](ending/end-phone-options.png): three phone landings.
- [ending/view-U2.4.png](ending/view-U2.4.png), [view-U3.6.png](ending/view-U3.6.png) and [stages-U2.4.png](ending/stages-U2.4.png): Exhibit B's composition built finer, as the patch would look when grown, and growing part by part.
- [ending/newcre-before-after-8x.png](ending/newcre-before-after-8x.png): the first proof, with a placeholder, that a new creature changes nothing else in Exhibit B.
