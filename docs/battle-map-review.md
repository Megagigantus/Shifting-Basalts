# Battle map review: art vs data (2026-11-11)

What I checked, from the files you sent (`basalts-stats.json`, `basalts-arenas.json`) and the
new art in `src/art/`. Each item says who fixes it: **me** (a data change, nothing for you to
make), **you** (art or a decision), or **your call** (either works; pick one).

## All good

- **Art files:** all 82 are present, correctly named and the right size, including both optional phase 2 arenas. All 16 objects have transparent backgrounds.
- **Creature stats and sizes:** they match the app. That's 17 Medium, 13 Large, 2 Huge and 1 Tiny (the Stride Wisp, 4 to a square).
- **Trick placement (`trickTerrain`):** every trick, shape and terrain id exists, and floors match. Nothing is missing.
- **Arena coordinates:** everything sits inside the 14 × 14 grid, nothing overlaps, and nothing covers the south entrance, on paper.
- **No conflict:** the Stride Core, Tessellated Warden, Blind Architect and Ophaniel arenas. Their columns, shards and pillars are separate tokens, which matches how the art leaves them out.

## Must fix

1. **"Sonder" in a portal name (you decide the new name).** The Gatewright's phase 2 portal is called "Portal to Sonder's negative space". Sonder must never appear in the app (bible: Content safety). Suggestion: "Portal to negative space", or just "Void portal". Also check whether "Portal to the Archive" gives anything away; if so, call it "West portal" or similar.
2. **The Gatewright phase 1 arena (you, repaint).** It's painted as a 4 × 4 grid of walled cells full of furniture, but the boss is designed around open floor (Builder's Strike walls, Grand Reconstruction). The boss's start square and the south entrance both sit on partition walls. It needs an open-floor repaint.

## Art doesn't match the layout

My suggestion: **treat the painting as the truth for walls and fixed features, and I move the layout data to fit**, except where the painting fights the boss's rules.

| Arena | Mismatch | Fix |
| --- | --- | --- |
| Gatewright phase 2 | 3 large portals painted in the floor (N-centre, SW, SE); the data has edge portals at W, E and S, and the S one covers the entrance | **me**: move the portals to match the painting |
| Sun-Eater's Husk | A painted horseshoe of standing stones, boulders and 6 antler-trees aren't in the data; all 4 braziers fall inside wall or void. Phase 2 is a crater with a different layout | **me**: use the stone ring as Blinding Zenith cover, move braziers and columns onto floor, and give phase 2 its own object list |
| Halvard Quill | 4 north-south statue tracks painted; the data has 2 east-west | **me**: 4 north-south tracks, one statue on each |
| Gilded Excavation Herd | 2 north-south rail tracks painted, not in the data, with 2 tether pillars sitting on them | **me**: make the rails the Conveyor Shift strips (nice fit) and move the pillars off them |
| General Vane | A dais (rows 1–3), inner side walls and a south wall are painted; the 4 low posts sit at row 9, not where the data puts columns | **me**: columns move to the painted posts, and Marching Columns start below the dais |
| Chorus of Unseen Angles | The south edge is a wall strip; the central 2 × 2 column isn't painted | **me**: the entrance moves up a row; the column stays an object (needs `tall-column` art, below) |
| Inverted Reliquary | Plinths painted about 2.5 × 2.5 squares; the data has 1 × 1 | **me**: plinths become 2 × 2 in the data and use the painting (no plinth art needed) |
| Glass Hydra | Floor tiles don't line up with 5 ft squares; no distinct mirror panels painted | **me**: nothing to change, the mirror panels are objects already |
| Kaelen and Vyr | One raised ledge with stairs painted in the NW corner; the data has ledges in both back corners | **your call**: repaint a second ledge NE, or I change the data to the one painted ledge |
| Lattice Spinner | 8 columns painted into the floor; the data has 6 column objects, and Loom Rotation has to move them, which painted columns can't do | **your call**: repaint without columns (recommended, then they're movable objects), or I use the 8 painted columns and the DM narrates the rotation |
| Choir of the Hollow Column | A big organ on a central dais is painted in the middle; the data calls the centre open and safest | **your call**: repaint without it, or keep it as a big central obstacle and I update the notes |

**Entrances vary per arena** (e.g. the Chorus and the Gatewright phase 1). I'll give each arena its own entrance in the data instead of one shared one.

## Art you still need to make

Object types the layout uses that have no art. Same spec as before: 256 × 256, top-down, transparent background.

- [ ] `tall-column`: a tall basalt column, full cover (Warden, Spinner, Chorus centre at 2 × 2, Husk)
- [ ] `low-column`: a waist-high column stump, half cover (Kaelen and Vyr, General Vane)
- [ ] `floating-shard`: a floating basalt shard, half cover (Blind Architect)
- [ ] `glass-pillar`: a golden glass pillar, full cover (Ophaniel)
- [ ] `brazier`: a lit brazier, a light source (Sun-Eater's Husk)
- [ ] `gate-core`: the gate core, blocks movement, 2 × 1 (Gatewright), unless you'd rather paint it into the repainted phase 1 arena

No art needed:
- `victim-statue`: reuse the existing `statue`
- `ledge`, `statue-track`, islands and halves: the app shades the area
- `plinth`: use the painted ones

## Room maps: doorways

Rooms roll 1 to 4 exits, plus the way the party came in. Only **hex-hall** and **ring**
have painted doorways (4 each). Column-forest, honeycomb, split-chamber,
switchback and twisted-vault have none, and **tiered-stair** has no north or south wall.

**Suggested default (me):** the party always enters from the south edge, and the app draws
doorway markers on the edges using the existing exit icons, placed on open floor. Nothing
to repaint. On hex-hall and ring, the markers sit in the painted openings.

**Your call:**
- In tiered-stair, can creatures climb between tiers freely, or only at the middle recesses?
- In split-chamber, is the chasm a jump (and how far) or impassable away from the bridge?

## Data decisions

1. **Boss part names (your call).** Your file renames parts: "Pipe Cluster", "Survey Golem", "Basalt Hound" (the Herd's hounds) and "Unseen Angle" (the Chorus members). Fine by me, except **"Basalt Hound" clashes with the roster creature of the same name**, which will confuse the DM screen. Suggest "Survey Hound", or keep "Hound". The art file names stay as they are either way.
2. **Kaelen and Vyr as one token (me).** Your file makes them one token that swaps art with the active form. That works with the art you already have (`kaelen-and-vyr-kaelen`, `kaelen-and-vyr-vyr`). I'll add a "swap form" button for the DM. Each form keeps its own AC and ability profile.
3. **Walls don't block movement (default).** The app won't stop tokens at walls. Walls are only what's painted, and the DM judges. That keeps the very different wall thicknesses across the art from mattering.

## Optional, low priority

- **Perspective:** some art leans outward instead of being straight top-down: Inverted Reliquary, Ophaniel, column-forest and twisted-vault, plus milder cases (the Husk, ring, Vane's banners, the Choir's organ). It's playable as is; repaint only if it bothers you at the table.
- **Arena file size:** the arenas are about 0.9 MB each (15.7 MB together). They only load when their room opens, but saving them at WebP quality around 75–80 would roughly halve that with little visible change.
