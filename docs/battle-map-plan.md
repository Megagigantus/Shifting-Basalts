# Battle map plan

The next big move: put each room on a shared top-down battle map. Terrain,
tricks, enemies and players sit on the map as tokens. Players move their own
token and the DM moves everything else. Boss rooms get their own arenas, and
post-boss and Reprieve rooms get art of their own.

Status: **plan, not built**. Each phase below is its own branch and PR.

## Decisions so far (2026-11-11)

| Question | Decision |
| --- | --- |
| Boss rooms | A custom top-down arena per boss (15), with that boss's own placeable objects |
| Map drawing | New top-down map art, with the app drawing a 5 ft grid on top |
| Terrain and trick placement | The app places each one on a free square when the room is generated; the DM can drag any of them |
| Player portraits | A preset gallery that ships with the app; each player picks one for their character |

## Defaults I'll use unless you say otherwise

- **Movement:** free movement, with no speed limits enforced. Players move only their own token. The DM can move any token, players included.
- **Hidden things stay hidden:** unrevealed enemies, unsprung tricks and the false wall appear only on the DM's map. Once revealed, they appear for players where the DM placed them.
- **HP stays private:** players see Bloodied and Down markers on tokens, never numbers, the same as today.
- **Saving moves:** the app saves when a token is dropped, not while it's being dragged, to keep database writes low.
- **Grid:** one square is 5 ft. Small rooms are 6 × 6 squares, medium 10 × 10, large 14 × 14. Boss rooms are always large.
- **Summons and companions:** characters marked "has a summon" get one extra token they control.
- **Token size:** Medium takes 1 square, Large 2 × 2, Huge 3 × 3, Gargantuan 4 × 4.

## Phases

1. **Map foundation (DM only).**
   - Room shape map art with a grid on top, drawn in plain React and SVG, so no new library.
   - Terrain and trick markers are placed automatically, and the DM can drag them.
   - Enemy tokens use the creature portraits as round tokens, sized by creature size.
   - Positions are saved in the DM-only room data.
2. **Shared map and player movement.**
   - Players see the map live, built only from what they're allowed to see.
   - A new `runs/{id}/tokens/{characterId}` record that only the owning player (and the DM) can write, so players can move their own token.
   - This needs a Firestore security rules change, with new rules tests, and a rules deploy.
3. **Portrait gallery.** Each character picks a portrait, stored on the character, and it becomes their map token and appears in the party sidebar.
4. **Boss arenas.**
   - One arena map per boss, plus arena objects defined in data: the Herd's tether pillars, the Choir's pipe clusters, Halvard's Snare Shards, the Gatewright's portals and wall segments, and so on.
   - Boss tokens, with one token per part for multi-part bosses.
   - The DM can drop dynamic objects, such as a raised pillar or a stride-energy pool, from a palette.
5. **Post-boss and Reprieve rooms.** Illustrated scenes, not battle maps: the post-boss room shows the Forge, the Healing Font and the descend or extract choice, and the Reprieve shows Rest and Reflect. Thils's Vault gets a scene for a full clear.
6. **Optional polish:** icons for boons, loot, Pressures and upgrades across the rest of the app.

## Data I'll need from you

- **Creature sizes:** the 2024 Monster Manual size (Medium, Large, Huge…) for each of the 33 creatures, and for each boss and boss part. This decides how many squares each token covers.
- **Boss arena layouts:** for each boss, which objects start on its arena and roughly where, e.g. "4 pipe clusters in a diamond around the centre". I can draft these from the bible's boss templates for you to check.
- **Optional:** which terrain each trick prefers, if you want the scatter to follow the bible's "tricks go where the terrain fits them" more closely.

---

# Art needed

Same format as `docs/art-list.md`: save as `src/art/<folder>/<file name>`.
"Reuse" means existing art does the job and nothing new is needed.

## A. Room maps, `maps/` (8, or 24)
Top-down, square, no grid drawn in (the app draws it). Use one consistent
scale: the walls should sit at the edge of the image.

- **Minimum:** one map per shape (8), drawn so it still reads when the app scales it to 6, 10 or 14 squares. File: `<shape-id>.webp`, e.g. `hex-hall.webp`. 2048 × 2048.
- **Better fit:** one map per shape per size (24). File: `<shape-id>-<size>.webp`, e.g. `hex-hall-small.webp`. Small 1200, medium 2000, large 2800 px square, which is 200 px per square.
- The 8 shapes: Hex hall, Column forest, Split chamber, Ring, Switchback, Tiered stair, Honeycomb, Twisted vault.

## B. Boss arenas, `arenas/` (15)
Top-down, 14 × 14 squares (70 ft), 2800 × 2800 px. Leave movable objects out
of the painting, because they're separate tokens (section E). File: the boss id, e.g. `tessellated-warden.webp`.

- Floor 1: `tessellated-warden`, `choir-hollow-column`, `gilded-excavation-herd`
- Floor 2: `kaelen-and-vyr`, `halvard-quill`, `lattice-spinner`
- Floor 3: `stride-core`, `general-vane`, `glass-hydra`
- Floor 4: `blind-architect`, `chorus-unseen-angles`, `inverted-reliquary`
- Floor 5: `ophaniel`, `sun-eaters-husk`, `gatewright`

Optional: a second arena state for bosses whose room changes, such as the
Husk's Supernova Core or the Gatewright's Fractured Horizon (`<boss-id>-phase-2.webp`).

## C. Map markers for terrain and tricks: reuse
The existing terrain and trick icons work as map markers. Optional later:
top-down terrain pieces that cover several squares, like a fissure running
across the room or a narrow catwalk (`terrain-map/<terrain-id>.webp`).

## D. Tokens
- **Creatures (reuse):** the 33 creature portraits become round tokens.
- **Bosses and parts (reuse):** the boss portraits and the 6 boss part tokens.
- **Summons and companions, `summons/` (8):** `beast`, `spirit`, `construct`, `undead`, `fey`, `elemental`, `familiar`, `other`. 512 px square, shown as circles.
- **Token rings:** the app draws these in CSS (gold for players, red for enemies, purple for bosses, dashed for "hidden, DM only"), so no art is needed.

## E. Arena and room objects, `objects/` (about 12)
Placeable map objects from the boss templates, families and boons. 256 px square, top-down, on a transparent background (PNG or WebP).

- [ ] `pillar`: a raised 5 ft basalt pillar (Tessellated Warden, Piston Floor)
- [ ] `pit`: a dropped floor section (Piston Floor)
- [ ] `tether-pillar`: the pillar a creature is tethered to (Gilded Excavation Herd)
- [ ] `pipe-cluster`: reuse the boss part token (Choir)
- [ ] `snare-shard`: an armed trap shard (Halvard Quill)
- [ ] `transit-cable`: a cable anchor point (Lattice Spinner)
- [ ] `stride-pool`: a pool of raw stride energy (Gate-Born drop, Stride Core)
- [ ] `portal`: an open portal (the Gatewright)
- [ ] `wall-segment`: a raised 10 ft wall section (the Gatewright)
- [ ] `battle-standard`: the planted standard (the Battle Standard boon)
- [ ] `darkness`: a patch of magical darkness (lighting, Eclipse Cycle)
- [ ] `armed-trick`: a disarmed trick re-armed by a player (Snap-pillar charge loot)

## F. Player portrait gallery, `portraits/` (24 to 40)
512 × 512, centred head and shoulders (shown as circles). Aim for variety across
the 12 classes, ancestries and looks, so every player finds a fit. File:
anything short and unique, e.g. `portrait-01.webp`. You can add more at any time.

## G. Post-boss room, `rooms/` (6)
1600 × 900 landscape scenes, like the room banners.

- [ ] `post-boss`: the post-boss room, calm after the fight
- [ ] `forge`: the Forge (also shown as a card when it's unlocked)
- [ ] `healing-font`: the Healing Font
- [ ] `descend`: the way down to the next floor
- [ ] `extract`: the way out of the Basalts
- [ ] `thils-vault`: Thils's Vault, opened after a full clear

## H. Reprieve room, `rooms/` (3)
- [ ] `reprieve`: the safe room, 1600 × 900
- [ ] `rest`: the Rest choice (a card, 512 × 512)
- [ ] `reflect`: the Reflect choice (a card, 512 × 512)

## I. Optional: the rest of the app
This is lower priority and nothing above depends on it. Counts come from the data files.

| What | Count | Suggested |
| --- | --- | --- |
| Boon tag icons (Core, Echo, Reaper…) | 15 | 128 px icons, the cheapest way to make the draft screen visual |
| Boons | 69 | 256 px, or skip and use tag icons |
| Evolutions / Combinations / Hidden boons | 49 / 21 / 20 | 256 px |
| Loot: trinkets, consumables, gear, wondrous | 20 / 12 / 12 / 14 | 256 px |
| Boss trophies | 15 | 256 px |
| Thils's Vault relics | 15 | 256 px |
| Pressures | 10 | 128 px icons |
| Quantum Basalt upgrades | 13 | 128 px icons |
| Currency: Quantum Basalt, Devotion | 2 | 128 px icons |
| Floor banners | 5 | 1600 × 400 |
| App logo and sign-in background | 2 | logo as SVG, background 1920 × 1080 |

## Totals

| | Pictures |
| --- | --- |
| Needed for the map (A min, B, D summons, E, F min) | 8 + 15 + 8 + 11 + 24 = **66** |
| Post-boss and Reprieve (G, H) | **9** |
| Better-fit room maps (A per size, instead of 8) | +16 |
| Optional rest of the app (I) | up to about 300, or about 47 with tag icons in place of boon art |
