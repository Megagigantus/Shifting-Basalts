# Battle map art checklist

Every new picture the battle map plan needs (`docs/battle-map-plan.md`),
with a short description to build prompts from. Save each file as
`src/art/<folder>/<file name>` with a `.webp`, `.png`, `.jpg` or `.svg`
extension (e.g. `src/art/maps/hex-hall.webp`). The file name must match
exactly. Tick items off as you go.

Descriptions come from the room tables and the boss mechanics and Shift
Actions in the bible. Boss arenas describe the room the fight happens in,
not the boss.

**Core set: 75 pictures.** 8 room maps, 15 boss arenas, 16 arena objects,
8 summon tokens, 24 portraits, and 9 post-boss and Reprieve pictures. Section 8
lists optional extras.

Already done and reused: creature and boss portraits become round tokens,
and terrain and trick icons become map markers.

## Style notes

- **Same world as the first set:** dark hex-basalt stone, hexagonal seams, faint rune or seam light, gold veins.
- **Maps and arenas are viewed straight down (top-down), like a printed battle map.** No perspective, no characters, no creatures, and no grid drawn in, because the app draws the grid. Use neutral, even light, since the app adds its own lighting effects.
- **Walls sit at the edge of the image:** a room's playable floor fills the square.
- **Leave movable things out of maps and arenas.** Pillars, portals, statues and pools are separate objects (section 3) so the DM can move them.
- **Objects are seen from directly above on a transparent background (PNG or WebP with alpha),** readable at 48 px.
- **Portraits and summons are shown as circles:** keep the head or body centred with margin around it.

---

## 1. Room maps, `maps/` (8)
2048 × 2048, top-down. The app scales each map to 6 × 6 squares (small,
30 ft), 10 × 10 (medium, 50 ft) or 14 × 14 (large, 70 ft), so keep the details
readable when shrunk. If you later want a better fit, make one per size as
`<id>-small`, `<id>-medium` and `<id>-large`.

- [ ] `hex-hall`: **Hex hall.** One large hexagonal room with columns lining the walls. Open centre.
- [ ] `column-forest`: **Column forest.** An open floor crowded with basalt columns of uneven heights, seen as hex tops from above, with paths between them.
- [ ] `split-chamber`: **Split chamber.** Two halves joined by a narrow bridge, or a gap to jump. A drop or void runs between them.
- [ ] `ring`: **Ring.** A circular walkway around a central pit, pillar or dais.
- [ ] `switchback`: **Switchback.** A zigzag room that doubles back on itself, like a small maze, with walls forming 2 or 3 lanes.
- [ ] `tiered-stair`: **Tiered stair.** Three or four levels of stepped column tops, with each tier clearly a different height (shading and edges).
- [ ] `honeycomb`: **Honeycomb.** A cluster of small hex cells joined by gaps or doorways.
- [ ] `twisted-vault`: **Twisted vault.** A floor scattered with the shadows and bases of features hanging from the ceiling, plus columns rising from the floor.

## 2. Boss arenas, `arenas/` (15)
2800 × 2800, top-down, 14 × 14 squares (70 ft; boss rooms are always large).
Paint the room's permanent floor and walls only. Anything that moves or
appears mid-fight is an object in section 3.

**Floor 1**
- [ ] `tessellated-warden`: **The Tessellated Warden's arena.** A hex-tiled floor with three marked 10 ft hex sections that can rise into pillars or drop into pits (Piston Floor). Open space for pillars to be raised.
- [ ] `choir-hollow-column`: **Choir of the Hollow Column's arena.** A round or many-sided hall built around the boss, which can't move, with room for 4 pipe clusters. Outer walls with visible seams where they slide into new chambers (Acoustic Shift).
- [ ] `gilded-excavation-herd`: **Gilded Excavation Herd's arena.** A dig site with several basalt pillars that creatures get tethered to, and two marked 15 ft floor strips that slide in opposite directions (Conveyor Shift).

**Floor 2**
- [ ] `kaelen-and-vyr`: **Kaelen and Vyr's arena.** A square room with raised ledges or high ground for Vyr to teleport onto, and walls that look like they rotate (Echo Swap).
- [ ] `halvard-quill`: **Senior Tracker Halvard Quill's arena.** A hunting-lodge gallery with four floor tracks that statues slide along (Trophy Gallery). Leave the statues out; they're objects.
- [ ] `lattice-spinner`: **The Lattice Spinner's arena.** A hall of columns arranged in a ring, so they can rotate clockwise (Loom Rotation), with walls and ceiling the Spinner climbs.

**Floor 3**
- [ ] `stride-core`: **The Stride Core's arena.** A gate chamber around a central crackling core, with a slight slope or tilt lines that suggest the room can tip (Tilt the Gate).
- [ ] `general-vane`: **General Vane's arena.** A long parade hall or barracks floor with a clear "front" and "back". Stone walls rise at one end and march forward (Marching Columns).
- [ ] `glass-hydra`: **The Glass Hydra's arena.** A glassy, crystalline floor made of panels that can flip into polished mirrors (Refraction Shift).

**Floor 4**
- [ ] `blind-architect`: **The Blind Architect's arena.** A precise, symmetrical drafting room with a visible fold line across the middle, because the room folds in half or swaps halves (Fold Space).
- [ ] `chorus-unseen-angles`: **The Chorus of Unseen Angles' arena.** A square room with four distinct corners for the trio to stand in, where every wall could become the floor (Perspective Collapse).
- [ ] `inverted-reliquary`: **The Inverted Reliquary's arena.** A temple vault that's been turned inside out. The floor can break into 4 islands over 15 ft chasms of void (Slot Scramble), so show the future crack lines.

**Floor 5**
- [ ] `ophaniel`: **Ophaniel's arena.** A cathedral-scale floor split into two halves: one lush golden meadow, one airless shattered stone. The halves swap every round (Paradise Bleed).
- [ ] `sun-eaters-husk`: **The Sun-Eater's Husk's arena.** A vast cavern around a Gargantuan boss, with cover pieces to hide behind during Blinding Zenith and a dark outer ring for Total Umbra (Eclipse Cycle).
- [ ] `gatewright`: **The Gatewright's arena.** A gate-builder's workshop floor with modular sections that look like they reassemble into the geometry of floors 1 to 4 (Grand Reconstruction).

Optional second states, for arenas that change for good mid-fight:
- [ ] `sun-eaters-husk-phase-2`: the cavern after the shell shatters (Supernova Core), with debris and the light pulled toward the centre.
- [ ] `gatewright-phase-2`: the workshop with three tears open in the air (The Fractured Horizon).

## 3. Arena and room objects, `objects/` (16)
256 × 256, top-down, transparent background. The DM places and moves these on
the map. Each one covers one square unless noted.

**From boss arenas**
- [ ] `pillar`: **Raised pillar.** A 5 ft basalt hex pillar seen from above (Tessellated Warden's Columnar Slam, Piston Floor).
- [ ] `pit`: **Pit.** A 10 ft hex section dropped into darkness (Piston Floor). Covers 2 × 2 squares.
- [ ] `tether-pillar`: **Tether pillar.** A pillar with a glowing tether anchor (Gilded Excavation Herd).
- [ ] `afterimage`: **Crystal afterimage.** A crystal echo of a figure that's about to explode (Kaelen and Vyr's Echo Swap).
- [ ] `snare-shard`: **Snare Shard.** An armed trap shard set into the floor (Halvard Quill).
- [ ] `statue`: **Trophy statue.** A statue of a fallen adventurer on a sliding base (Halvard's Trophy Gallery). Used 4 times.
- [ ] `transit-cable`: **Transit Cable anchor.** A crackling cable anchor point on a column (Lattice Spinner). The app draws the line between two anchors.
- [ ] `stride-pool`: **Stride-energy pool.** A glowing pool of raw stride energy (Stride Core's Rift Barrage, and the Gate-Born family's drop).
- [ ] `marching-wall`: **Marching stone wall.** A 5 ft section of a stone wall phalanx (General Vane). Placed in a row.
- [ ] `mirror-panel`: **Mirror panel.** A floor panel flipped into a polished mirror (Glass Hydra's Refraction Shift).
- [ ] `residue`: **Elemental Residue puddle.** A puddle left by a severed head, in fire, lightning or cold colours (Glass Hydra).
- [ ] `portal`: **Portal.** An open tear in the air (the Gatewright).
- [ ] `wall-segment`: **Raised wall segment.** A 10 ft wall raised mid-fight (the Gatewright). Covers 2 × 1 squares.

**From rooms, boons and loot**
- [ ] `darkness`: **Magical darkness.** A patch of magical darkness (Patches of magical darkness lighting, Total Umbra).
- [ ] `battle-standard`: **Battle Standard.** A planted war banner (the Battle Standard boon).
- [ ] `armed-trick`: **Re-armed trick.** A disarmed room trick set to spring again (Snap-pillar charge loot).

## 4. Summon and companion tokens, `summons/` (8)
512 × 512, shown as circles. Generic tokens for a player's summon, companion
or familiar.

- [ ] `beast`: an animal companion
- [ ] `spirit`: a summoned spirit
- [ ] `construct`: a construct or animated object
- [ ] `undead`: a raised undead servant
- [ ] `fey`: a fey creature
- [ ] `elemental`: an elemental
- [ ] `familiar`: a small familiar (owl, cat, raven or similar)
- [ ] `other`: a neutral catch-all token

## 5. Player portrait gallery, `portraits/` (24)
512 × 512, head and shoulders, centred, shown as circles. Players pick one
for their character. Two per class, mixing ancestries, ages and looks, so
everyone finds a fit. Names are just slots; add `portrait-25` and beyond whenever you like.

- [ ] `portrait-01`: Barbarian
- [ ] `portrait-02`: Barbarian
- [ ] `portrait-03`: Bard
- [ ] `portrait-04`: Bard
- [ ] `portrait-05`: Cleric
- [ ] `portrait-06`: Cleric
- [ ] `portrait-07`: Druid
- [ ] `portrait-08`: Druid
- [ ] `portrait-09`: Fighter
- [ ] `portrait-10`: Fighter
- [ ] `portrait-11`: Monk
- [ ] `portrait-12`: Monk
- [ ] `portrait-13`: Paladin
- [ ] `portrait-14`: Paladin
- [ ] `portrait-15`: Ranger
- [ ] `portrait-16`: Ranger
- [ ] `portrait-17`: Rogue
- [ ] `portrait-18`: Rogue
- [ ] `portrait-19`: Sorcerer
- [ ] `portrait-20`: Sorcerer
- [ ] `portrait-21`: Warlock
- [ ] `portrait-22`: Warlock
- [ ] `portrait-23`: Wizard
- [ ] `portrait-24`: Wizard

## 6. Post-boss room, `rooms/` (6)
Scene art, not battle maps. Same style as the room banners.

- [ ] `post-boss`: **Post-boss room.** 1600 × 900. A calm chamber after the boss fight, where the party gathers before choosing to go deeper or leave.
- [ ] `forge`: **The Forge.** 1600 × 900. A basalt forge where boons are levelled up, evolved or combined. Also shown as a card.
- [ ] `healing-font`: **The Healing Font.** 1600 × 900. A spring or basin that restores the party between floors.
- [ ] `descend`: **Descend.** 512 × 512 card. The way down to the next floor: a stair or shaft going deeper.
- [ ] `extract`: **Extract.** 512 × 512 card. The way out of the Basalts: a path up toward daylight.
- [ ] `thils-vault`: **Thils's Vault.** 1600 × 900. Thils's private collection of what legendary striders lost in the labyrinth, opened after a full clear, where each player drafts a relic.

## 7. Reprieve room, `rooms/` (3)
- [ ] `reprieve`: **Reprieve.** 1600 × 900. A safe room mid-floor, quiet and sheltered, where no fight happens.
- [ ] `rest`: **Rest.** 512 × 512 card. Taking a Short Rest's benefits: catching breath, binding wounds.
- [ ] `reflect`: **Reflect.** 512 × 512 card. Levelling up one boon: quiet focus, a technique sharpening.

---

## 8. Optional: the rest of the app
Nothing above depends on these. Counts come from the data files. If you
make any, tell me and I'll give you the exact file names.

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
