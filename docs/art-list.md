# Art checklist

Every picture the app can show, with a short description to work from.
Save each file as `src/art/<folder>/<file name>` with a `.webp`, `.png`, `.jpg` or `.svg` extension
(for example `src/art/shapes/hex-hall.webp`). The file name must match exactly. Tick items off as you go.

Descriptions come from the data files. "Based on" names the Monster Manual creature a monster
borrows its stat block from. Use it as a hint for size and silhouette only. Don't copy WotC art.

**Total: 90 pictures the app shows now** (8 shapes, 20 terrain, 12 tricks, 2 exits, 33 creatures, 15 bosses),
**plus 15 extras** for later (section 7).
Start with the shapes and terrain: those 28 alone give you a picture of every room.

## Style notes

- The dungeon is built from hex-shaped basalt columns. Dark stone, hexagonal seams, faint rune or seam light.
- **Shapes** are wide scene banners. Seen from above or at an angle, no creatures, fairly dark. The app adds its own lighting effect over the top, so paint them in neutral light.
- **Terrain, tricks and exits** are small icons, so use one bold shape, readable at 48px. Keep the same style and background across the whole set.
- **Creatures** are shown as circles, so keep the head or body centred with some margin around it.
- **Bosses** are shown as larger squares.

---

## 1. Room shapes, `shapes/` (8)
1600×900 landscape. Everyone sees these.

- [ ] `hex-hall`: **Hex hall.** One large hexagonal room with columns lining the walls.
- [ ] `column-forest`: **Column forest.** An open floor crowded with basalt columns of uneven heights.
- [ ] `split-chamber`: **Split chamber.** Two halves joined by a narrow bridge, or a gap to jump.
- [ ] `ring`: **Ring.** A circular path around a central pit, pillar or dais.
- [ ] `switchback`: **Switchback.** A zigzag room that doubles back on itself, like a small maze.
- [ ] `tiered-stair`: **Tiered stair.** Three or four levels of stepped column tops.
- [ ] `honeycomb`: **Honeycomb.** A cluster of small hex cells joined by gaps.
- [ ] `twisted-vault`: **Twisted vault.** Columns and features hang from the ceiling as often as they rise from the floor.

## 2. Terrain icons, `terrain/` (20)
128px square. Everyone sees these, except the false wall, which players only see once it's found.

- [ ] `low-columns`: **Low columns.** Waist-high column stumps (half cover).
- [ ] `tall-columns`: **Tall columns.** Tall climbable columns (full cover).
- [ ] `broken-column-field`: **Broken column field.** Rubble and toppled column pieces (difficult terrain).
- [ ] `fissure`: **Fissure.** A 5 ft wide, 15 ft deep crack across the floor.
- [ ] `hex-dais`: **Hex dais.** A raised hexagonal platform (high ground).
- [ ] `transit-rune-pair`: **Transit rune pair.** Two linked glowing floor runes that teleport you between them.
- [ ] `gate-glass-shards`: **Gate-glass shards.** Sharp glassy shards across the floor.
- [ ] `collapsed-archway`: **Collapsed archway.** A broken arch forming a 10 ft choke point.
- [ ] `shrine-to-thils`: **Shrine to Thils.** A small shrine with offerings and candles.
- [ ] `strider-remains`: **Strider remains.** A lost traveler's pack and gear, worth searching.
- [ ] `hanging-cables`: **Hanging cables.** Swinging lines hanging from above.
- [ ] `polished-floor`: **Polished floor.** Slick, mirror-smooth stone (slip hazard).
- [ ] `rotating-column-ring`: **Rotating column ring.** A ring of columns that turns, so show rotation arrows.
- [ ] `narrow-catwalk`: **Narrow catwalk.** A 5 ft walkway over a 20 ft drop.
- [ ] `echoing-chamber`: **Echoing chamber.** Sound waves or an ear (nowhere to hide).
- [ ] `false-wall`: **False wall.** A wall section with a hidden passage behind it. *(DM only until found)*
- [ ] `dead-end-alcoves`: **Dead-end alcoves.** Small wall nooks.
- [ ] `pool-of-raw-stride-energy`: **Pool of raw stride energy.** A glowing pool of crackling force energy.
- [ ] `inverted-overgrowth`: **Inverted overgrowth.** Grass and vines growing down from the ceiling.
- [ ] `roll-twice`: **Roll twice.** Two features combined. A simple "×2" or two overlapping icons is enough.

## 3. Room trick icons, `tricks/` (12)
128px square. Players see these only once a trick is sprung or found.

**Floor 1**
- [ ] `snap-pillar`: **Snap-Pillar.** A hex tile with a hairline seam that launches you into the air.
- [ ] `static-vent`: **Static Vent.** A glowing fissure crackling with lightning.
- [ ] `shatter-step`: **Shatter-Step.** Floor tiles bursting into caltrops.

**Floor 2**
- [ ] `crushing-columns`: **Crushing Columns.** Two rows of pillars slamming together across a lane.
- [ ] `ricochet-monolith`: **Ricochet Monolith.** A crystal monolith firing a wild bolt.
- [ ] `magnetic-floor`: **Magnetic Floor.** A central lodestone pulling metal toward it.

**Floor 3**
- [ ] `gate-shear`: **Gate Shear.** The floor splitting along a chasm of glowing stride energy.
- [ ] `stride-vent`: **Stride Vent.** A floor vent erupting in a blinding flash.
- [ ] `gravity-inversion-tile`: **Gravity Inversion Tile.** A rune tile with an upward arrow (you fall up to the ceiling).

**Floor 4**
- [ ] `unseen-aperture`: **Unseen Aperture.** Jaws biting out of an empty corner.
- [ ] `looping-corridor`: **Looping Corridor.** A wall that wraps you to the opposite side (a looping arrow).
- [ ] `memory-drain`: **Memory Drain.** A weeping statue.

## 4. Exit icons, `exits/` (2)
64px square.

- [ ] `exit`: **Doorway.** A plain doorway or arch. Everyone sees this.
- [ ] `true-exit`: **True exit.** The same doorway but marked or glowing. Players see it only once the true exit is revealed.

## 5. Creatures, `creatures/` (33)
512px square, shown as a circle. Players see each one only once the DM reveals it.

**Wardstones**: living hex-basalt stone. They step into one column and out of another.
- [ ] `hexling`: **Hexling.** Minion, CR 1. Based on Animated Armor.
- [ ] `column-sentinel`: **Column Sentinel.** Brute, CR 2. Based on Gargoyle.
- [ ] `basalt-hound`: **Basalt Hound.** Skirmisher, CR 3. Based on Hell Hound, but with force breath.
- [ ] `maze-warden`: **Maze Warden.** Controller, CR 7. Based on Shield Guardian.
- [ ] `monolith-keeper`: **Monolith Keeper.** Elite, CR 10. Based on Stone Golem.
- [ ] `labyrinth-colossus`: **Labyrinth Colossus.** Elite, CR 16. Based on Iron Golem.

**Mazework**: trap and maze creatures. When one drops, it arms a room trick.
- [ ] `lost-thing-mimic`: **Lost-Thing Mimic.** Ambusher, CR 2. Based on Mimic.
- [ ] `corner-bull`: **Corner Bull.** Brute, CR 3. Based on Minotaur.
- [ ] `snarecrawler`: **Snarecrawler.** Controller, CR 3. Based on Phase Spider.
- [ ] `wrong-turn-stalker`: **Wrong-Turn Stalker.** Skirmisher, CR 6. Based on Invisible Stalker, so show a shimmer or outline.
- [ ] `doorcloak`: **Doorcloak.** Ambusher, CR 8. Based on Cloaker.

**The Lost**: faded, easy-to-miss lost travelers. They hide easily.
- [ ] `the-overlooked`: **The Overlooked.** Minion, CR 1. Based on Specter.
- [ ] `hollow-pilgrim`: **Hollow Pilgrim.** Brute, CR 2. Based on Ghast.
- [ ] `forgotten-one`: **Forgotten One.** Skirmisher, CR 2. Based on Nothic.
- [ ] `mourning-wanderer`: **Mourning Wanderer.** Controller, CR 4. Based on Banshee.
- [ ] `lost-regent`: **Lost Regent.** Elite, CR 5. Based on Wraith.

**Absorbed Echoes**: ghostly copies of adventurers. Each one carries a boon.
- [ ] `echo-scout`: **Echo Scout.** Skirmisher, CR 1/2. Based on Scout.
- [ ] `echo-duelist`: **Echo Duelist.** Skirmisher, CR 3. Based on Knight.
- [ ] `echo-gladiator`: **Echo Gladiator.** Brute, CR 5. Based on Gladiator.
- [ ] `echo-arcanist`: **Echo Arcanist.** Artillery, CR 6. Based on Mage.
- [ ] `echo-assassin`: **Echo Assassin.** Elite, CR 8. Based on Assassin.
- [ ] `echo-archmage`: **Echo Archmage.** Elite, CR 12. Based on Archmage.

**Gate-Born**: made of force and rift energy. They leave a glowing pool when they drop.
- [ ] `stride-wisp`: **Stride Wisp.** Artillery, CR 2. Based on Will-o'-Wisp.
- [ ] `blinkstalker`: **Blinkstalker.** Skirmisher, CR 3. Based on Displacer Beast.
- [ ] `rift-elemental`: **Rift Elemental.** Brute, CR 5. Based on Air Elemental, but dealing force damage.
- [ ] `gate-glass-golem`: **Gate-Glass Golem.** Elite, CR 9. Based on Clay Golem, but made of gate-glass.
- [ ] `cable-wyrm`: **Cable Wyrm.** Elite, CR 11. Based on Behir.

**Inverted Paradise**: holy and natural things turned wrong, wilted or upside down. Their healing harms.
- [ ] `wilting-dryad`: **Wilting Dryad.** Controller, CR 1. Based on Dryad.
- [ ] `bloomrot-mound`: **Bloomrot Mound.** Brute, CR 5. Based on Shambling Mound.
- [ ] `inverted-unicorn`: **Inverted Unicorn.** Skirmisher, CR 5. Based on Unicorn.
- [ ] `inverted-treant`: **Inverted Treant.** Brute, CR 9. Based on Treant.
- [ ] `hollow-seraph`: **Hollow Seraph.** Elite, CR 10. Based on Deva.
- [ ] `fallen-planetar`: **Fallen Planetar.** Elite, CR 16. Based on Planetar.

## 6. Bosses, `bosses/` (15)
1024px square. Players see a boss's picture once its boss room starts.
Spoiler warning: these files ship with the app, so a determined player could find them early.

**Floor 1**
- [ ] `tessellated-warden`: **The Tessellated Warden.** Heavy tank and zone controller.
- [ ] `choir-hollow-column`: **Choir of the Hollow Column.** Stationary artillery with 4 destructible pipe clusters.
- [ ] `gilded-excavation-herd`: **Gilded Excavation Herd.** A golem and two hounds, working as a pack.

**Floor 2**
- [ ] `kaelen-and-vyr`: **Kaelen and Vyr, the Fractured Striders.** A dual-form skirmisher that swaps between two forms, so show both.
- [ ] `halvard-quill`: **Senior Tracker Halvard Quill.** Trap-setter and single-target executioner.
- [ ] `lattice-spinner`: **The Lattice Spinner.** High-mobility controller.

**Floor 3**
- [ ] `stride-core`: **The Stride Core.** Artillery and hazard generator.
- [ ] `general-vane`: **General Vane of the Tenth Stride.** Stance-switching juggernaut.
- [ ] `glass-hydra`: **The Glass Hydra.** Multi-headed brawler.

**Floor 4**
- [ ] `blind-architect`: **The Blind Architect.** Control and sight manipulation.
- [ ] `chorus-unseen-angles`: **The Chorus of Unseen Angles.** A shared-HP trio, each in a different corner.
- [ ] `inverted-reliquary`: **The Inverted Reliquary.** Mimics the party's builds.

**Floor 5**: each has two phases. One picture per boss for now, showing the first phase.
- [ ] `ophaniel`: **Ophaniel of the Inverted Bloom.** Phase 1: The Wounded Idol. Phase 2: The Gate Opens.
- [ ] `sun-eaters-husk`: **The Sun-Eater's Husk.** Phase 1: Starving Gold. Phase 2: Supernova Core.
- [ ] `gatewright`: **The Gatewright.** Phase 1: The Master Builder. Phase 2: The Fractured Horizon.

---

## 7. Extras the app doesn't show yet (15)
The app needs a small code change before it shows these. You can save them now under these
names: the app ignores folders it doesn't use yet, and the code change will use these names.

### Boss second phases, `bosses/` (3)
1024px square, the same style as the boss portraits. Shown once the boss is Bloodied.

- [ ] `ophaniel-phase-2`: **Ophaniel, The Gate Opens.** Its attacks gain a radiant or necrotic edge and it grows stronger. Show the gate opening behind or within it.
- [ ] `sun-eaters-husk-phase-2`: **The Sun-Eater's Husk, Supernova Core.** The outer shell has shattered to expose a blazing core that pulls everything toward it. Gargantuan.
- [ ] `gatewright-phase-2`: **The Gatewright, The Fractured Horizon.** Three portals have opened across the arena. Show the boss among the portals.

### Boss part tokens, `boss-parts/` (6)
256px square, shown as circles like the creatures. For bosses made of several pieces, so the DM can tell the pieces apart.

- [ ] `choir-hollow-column-pipe-cluster`: **Pipe cluster** (Choir of the Hollow Column, 4 of them). A destructible cluster of resonating stone pipes that blasts thunder. The Choir can't move.
- [ ] `gilded-excavation-herd-golem`: **Golem** (Gilded Excavation Herd). A gilded digging golem with a heavy slam. The tougher piece.
- [ ] `gilded-excavation-herd-hound`: **Hound** (Gilded Excavation Herd, 2 of them). Small, fast biting hounds that run with the golem. One picture is used for both.
- [ ] `kaelen-and-vyr-kaelen`: **Kaelen** (the Fractured Striders). The close-range form: armoured, with a cleaving weapon.
- [ ] `kaelen-and-vyr-vyr`: **Vyr** (the Fractured Striders). The ranged form: lighter, fires ricocheting force bolts and teleports to high ground.
- [ ] `chorus-unseen-angles-member`: **Chorus member** (The Chorus of Unseen Angles, 3 of them, each in a different corner). Fires psychic rays. One picture is used for all three.

### Enemy family banners, `families/` (6)
512px square or a wide banner. A group picture or emblem for the whole family, for the DM's encounter panel.

- [ ] `wardstones`: **Wardstones.** Living hex-basalt stone that steps into one column and out of another.
- [ ] `mazework`: **Mazework.** Trap and maze creatures. When one drops, it arms a room trick where it fell.
- [ ] `the-lost`: **The Lost.** Faded travelers you can barely see, slipping out of sight.
- [ ] `absorbed-echoes`: **Absorbed Echoes.** Ghostly copies of adventurers, each carrying a boon.
- [ ] `gate-born`: **Gate-Born.** Creatures of force and rift energy that leave glowing pools when they drop.
- [ ] `inverted-paradise`: **Inverted Paradise.** Holy and natural things turned wrong: wilted, upside down, healing that hurts.
