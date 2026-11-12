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

1. **Spoilers in the Gatewright's portal names (decided: rename all three).** "Portal to Sonder's negative space" names Sonder, and "Portal to paradise" names the DM-only truth that the Basalts is a fractured stridegate to paradise. *This review first caught only the Sonder one; the DM caught the paradise one.* New names: **Gilded portal**, **Void portal** and **Archive portal**. "Archive" already ships in a loot item ("a destination the Archive has no record of"), so it gives nothing new away. For the record, the lore checker (`scripts/check-data.ts`) bans "sonder" everywhere and "paradise" outside approved names, so it would have stopped both at build time once the data moved into the app.
2. **The Gatewright phase 1 arena (repainted 2026-11-11).** It was a 4 × 4 grid of walled cells; it's been repainted as open floor. Re-checking the art against the layout.

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
| Kaelen and Vyr | One raised ledge with stairs painted in the NW corner; the data has ledges in both back corners | **repainted 2026-11-11**, re-checking |
| Lattice Spinner | 8 columns painted into the floor; the data has 6 column objects, and Loom Rotation has to move them | **repainted 2026-11-11** without columns, re-checking |
| Choir of the Hollow Column | A big organ on a central dais is painted in the middle; the data calls the centre open and safest | **repainted 2026-11-11**, re-checking |

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

**Decided:** the party enters from the south edge, **except in the split chamber, where it
enters from the east** (the chasm runs north to south). The app draws doorway markers on
the edges using the existing exit icons, placed on open floor. Nothing to repaint. On
hex-hall and ring, the markers sit in the painted openings.

**Decided, and added to the bible (Size, elevation, exits and lighting):**
- **Tiered stair:** tiers are 10 ft apart. Climbing up a tier costs extra movement (5 ft of climbing costs 10 ft of movement); the middle recesses work as stairs at normal cost. Climbing down is free.
- **Split chamber:** the chasm is 10 ft across. A running long jump clears it with Strength 10 or more; anyone who falls short falls in. The bridge stays worth fighting over.

## Data decisions

1. **Boss part names (decided).** "Pipe Cluster", "Survey Golem", **"Survey Hound"** (not "Basalt Hound", which clashes with the roster creature) and "Unseen Angle". The art file names stay as they are.
2. **Kaelen and Vyr as one token (me).** Your file makes them one token that swaps art with the active form. That works with the art you already have (`kaelen-and-vyr-kaelen`, `kaelen-and-vyr-vyr`). I'll add a "swap form" button for the DM. Each form keeps its own AC and ability profile.
3. **Walls don't block movement (default).** The app won't stop tokens at walls. Walls are only what's painted, and the DM judges. That keeps the very different wall thicknesses across the art from mattering.

## Optional, low priority

- **Perspective:** some art leans outward instead of being straight top-down: Inverted Reliquary, Ophaniel, column-forest and twisted-vault, plus milder cases (the Husk, ring, Vane's banners, the Choir's organ). It's playable as is; repaint only if it bothers you at the table.
- **Arena file size:** the arenas are about 0.9 MB each (15.7 MB together). They only load when their room opens, but saving them at WebP quality around 75–80 would roughly halve that with little visible change.
