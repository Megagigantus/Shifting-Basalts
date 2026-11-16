# Art checklist

Every picture the app can show, with a short description to work from.
Save each file as `src/art/<folder>/<file name>` with a `.webp`, `.png`, `.jpg` or `.svg` extension
(for example `src/art/shapes/hex-hall.webp`). The file name must match exactly. Tick items off as you go.

Descriptions come from the data files. "Based on" names the Monster Manual creature a monster
borrows its stat block from. Use it as a hint for size and silhouette only. Don't copy WotC art.

**Total: 109 pictures**: 8 shapes, 20 terrain, 12 tricks, 2 exits, 33 creatures and 15 bosses,
plus 15 extras (section 7) and 4 arena areas (section 8).
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

## 7. Extras (15)
These appear on the DM's screens only.

### Boss second phases, `bosses/` (3)
1024px square, the same style as the boss portraits. The DM's boss block shows both phases side by side. Players see only phase 1.

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

## 8. Arena areas, `areas/` (4)
Areas that boss Shift Actions paint onto the boss arena during the fight. Until a file exists the app
shows a tinted outline. Players see the picture and outline but never the area's name.
Boss arenas are 14 × 14 squares, about 128px per square. Top-down, matching the arena art.
Which picture each area kind uses is set in `src/data/battle-map.json` → `areaArt`.

**Tileable** pictures repeat every 2 squares to fill an area of any size, so the left edge must
continue seamlessly into the right edge and the top into the bottom. No borders or vignettes.

- [x] `raised-section`: **Raised section** (Tessellated Warden, Piston Floor). 256 × 256, fills 2 × 2 squares. The flat top of a hex basalt column pushed 15 ft up: lit edges, a slight shadow along two sides.
- [x] `void-chasm`: **Void chasm** (Inverted Reliquary, Slot Scramble). 256 × 256, **tileable**. Fills two crossing strips, each 2 squares wide and 14 long. Bottomless purple-black void with faint distant specks of light.
- [x] `golden-meadow`: **Golden meadow** (Ophaniel, Paradise Bleed). 256 × 256, **tileable**. Fills half the arena (7 × 14). Gold grass and small blossoms growing up through the stone, warm glow.
- [x] `shattered-stone`: **Shattered stone** (Ophaniel, Paradise Bleed). 256 × 256, **tileable**. Fills the other half (7 × 14). Grey fractured stone and ash, cold and airless.

The Warden's **pit** reuses `objects/pit` (already added), so it needs no new file.


---

## 9. Boon and loot icons (Room cleared pop-up)

All 256×256 square, one bold subject centred with some margin, on a dark basalt background. Shown at about 64 to 96 px, so keep shapes simple.
Don't paint glows or rarity borders: the app adds those (evolutions purple, combinations blue, hidden boons indigo).
Anything without its own picture falls back to a tag or type icon, so start with sections 9a and 9b: those 26 make the whole pop-up look finished.

### 9a. Boon tag icons, `boon-tags/` (16)
The fallback for any boon, evolution or combination without its own picture.

- [ ] `echo`: **Echo.** Concentric rings spreading out from a strike.
- [ ] `reaper`: **Reaper.** A scythe blade with a motion trail.
- [ ] `spell`: **Spell.** A glowing rune circle.
- [ ] `crit`: **Crit.** A d20 showing 20, cracked with light.
- [ ] `stance`: **Stance.** A sword held level in a guard stance.
- [ ] `volley`: **Volley.** A fan of arrows in flight.
- [ ] `guard`: **Guard.** A heavy shield.
- [ ] `payoff`: **Payoff.** A stack of glowing basalt coins.
- [ ] `shadow`: **Shadow.** A dagger half swallowed by shadow.
- [ ] `rally`: **Rally.** A raised banner.
- [ ] `bond`: **Bond.** Two clasped hands, or a linked chain.
- [ ] `flurry`: **Flurry.** A blur of striking fists.
- [ ] `blood`: **Blood.** A single drop of blood.
- [ ] `hunt`: **Hunt.** A hunter's mark over paw prints.
- [ ] `core`: **Core.** A hexagonal basalt column with a glowing seam.
- [ ] `hidden`: **Hidden.** A closed eye under a veil. The fallback for hidden boons.

### 9b. Loot type icons, `loot-kinds/` (10)
The fallback for any item without its own picture. Trinkets always use the trinket icon.

- [ ] `trinket`: **Trinket.** A small odd keepsake, like a chalk stub and a button.
- [ ] `consumable`: **Consumable.** A corked vial.
- [ ] `healing-potion`: **Healing potion.** A red potion bottle.
- [ ] `gear-weapon`: **Gear: weapon.** A sword and an axe crossed.
- [ ] `gear-armor`: **Gear: armor.** A breastplate.
- [ ] `gear-shield`: **Gear: shield.** A round shield.
- [ ] `wondrous`: **Wondrous item.** A glowing curio, like an orb on a stand.
- [ ] `trophy`: **Boss trophy.** A boss's broken horn or shard hung on a cord.
- [ ] `credits`: **Credits.** A small pile of gold coins.
- [ ] `quantum-basalts`: **Quantum Basalts.** A floating hexagonal basalt shard glowing violet.

### 9c. Boons, `boons/` (70) *(optional)*

- [ ] `traverts-echoes`: **Travert's Echoes.** Echo. A physical attack hit echoes 25% of its damage in a 10 ft ring or a 10 ft directional rectangle.
- [ ] `reapers-sprint`: **Reaper's Sprint.** Reaper. On a kill, teleport up to 30 ft to a space behind another enemy.
- [ ] `spellslingers-delight`: **Spellslinger's Delight.** Spell. When a leveled spell hits, cast a cantrip for free.
- [ ] `critical-delight`: **Critical Delight.** Crit. Crit range 17 to 20, but non-crits deal 75% damage.
- [ ] `crits-are-for-suckers`: **Crits Are for Suckers.** Crit. You can't crit, but damage increases by 25%.
- [ ] `a-fine-steels-glint`: **A Fine Steel's Glint.** Stance. As a bonus action, sheathe your weapon and anchor in place.
- [ ] `stand-off`: **Stand Off.** Stance. When you approach a group of 2 or more enemies, enter stand off.
- [ ] `elemains-flight-of-fancy`: **Elemain's Flight of Fancy.** Volley. A fired or thrown projectile ricochets once for 50% damage.
- [ ] `overhealing`: **Overhealing.** Guard. Healing beyond max HP becomes temp HP.
- [ ] `hardened-hide`: **Hardened Hide.** Guard. Reduce damage taken by PB.
- [ ] `cleansing-nova`: **Cleansing Nova.** Guard. Your heals end one condition on the target.
- [ ] `riposte-step`: **Riposte Step.** Guard. When an attack misses you, move 5 ft without provoking, and your next attack against that attacker has advantage.
- [ ] `a-healthy-dose-of-pain`: **A Healthy Dose of Pain.** Payoff. Once per turn, a hit adds damage equal to the HP your Max HP track grants.
- [ ] `avalanche-stride`: **Avalanche Stride.** Payoff. Once per turn, a hit deals +1 damage for every 5 ft you moved this turn.
- [ ] `spillover`: **Spillover.** Payoff. Overhealing bursts as radiant damage on adjacent enemies.
- [ ] `overchannel`: **Overchannel.** Spell. Once per room, cast a spell one level higher than the slot you spend.
- [ ] `conduit`: **Conduit.** Spell. Once per turn, a creature your spell damages takes extra damage equal to PB.
- [ ] `unbroken-focus`: **Unbroken Focus.** Spell. Advantage on saves to maintain concentration.
- [ ] `elemental-residue`: **Elemental Residue.** Spell. When a creature fails a save against your damaging spell, a 5 ft puddle of that spell's damage type forms in its space until the end of y…
- [ ] `leyline-surge`: **Leyline Surge.** Payoff. Once per turn, unspent recovery points can be spent on a damaging spell for +1d6 force damage per point.
- [ ] `momentum`: **Momentum.** Payoff. Once per turn, on a weapon hit, unspent martial recovery points can be spent for +1d6 damage of the weapon's type per point.
- [ ] `deadeye-stance`: **Deadeye Stance.** Volley. If you haven't moved this turn, your ranged attacks ignore half cover and deal +PB damage.
- [ ] `scatter-volley`: **Scatter Volley.** Volley. Once per room, as an action, make a ranged attack against up to 3 creatures within 10 ft of a point you can see.
- [ ] `fading-veil`: **Fading Veil.** Shadow. Once per turn, after you drop an enemy, take the Hide action without spending an action.
- [ ] `first-strike`: **First Strike.** Shadow. In the first round of a room, your attacks against creatures that haven't taken a turn deal +PB damage.
- [ ] `vanishing-step`: **Vanishing Step.** Shadow. Once per room, as a bonus action, teleport to an unoccupied space you can see within 30 ft and become Invisible until the start of your n…
- [ ] `twin-flame`: **Twin Flame.** Rally. When you cast a spell that targets only one ally, they also gain PB temp HP.
- [ ] `bolster`: **Bolster.** Rally. Twice per room, as a bonus action, give an ally within 30 ft a d4 to add to one attack roll or saving throw.
- [ ] `kindled-ally`: **Kindled Ally.** Rally. Once per turn, when you hit an enemy, the next ally to hit it deals +PB damage.
- [ ] `ostras-coin`: **Ostra's Coin.** Spell. Once per room, when a creature fails a save against your spell, flip a coin.
- [ ] `lenns-descent`: **Lenn's Descent.** Spell. You know the remaining HP of every creature that failed a save against your spell this room.
- [ ] `corrows-lure`: **Corrow's Lure.** Spell. When a creature fails a save against your spell, pull it up to 10 ft toward you or toward a point in the spell's area.
- [ ] `collectors-menagerie`: **Collector's Menagerie.** Bond. Your summons, familiar, companion and Wild Shape forms gain PB temp HP at the start of each room and deal +PB damage once per turn.
- [ ] `thalisanes-weave`: **Thalisane's Weave.** Bond. When you or your companion or summon takes damage, you can split it evenly between you.
- [ ] `the-express`: **The Express.** Flurry. Each attack hit in a turn after your first deals +1 damage per earlier hit that turn.
- [ ] `breakers-last-stand`: **Breaker's Last Stand.** Blood. While Bloodied, your weapon and unarmed hits deal +PB damage.
- [ ] `thilss-favor`: **Thils's Favor.** Shadow. Advantage on checks to detect and disarm room tricks, and you take half damage from them.
- [ ] `zolics-nine-eyes`: **Zolic's Nine Eyes.** Hunt. Against bosses and Large or larger creatures, your hits deal +PB damage.
- [ ] `deflector-burst`: **Deflector Burst.** Payoff. When the temp HP from your Opening temp HP track runs out, it bursts, dealing force damage equal to that amount to creatures within 5 ft.
- [ ] `hunters-tally`: **Hunter's Tally.** Payoff. Against Bloodied creatures, your flat damage bonus applies to every hit instead of once per turn.
- [ ] `gleam-dealers-gamble`: **Gleam Dealer's Gamble.** Payoff. Before rolling, stake a Fortune Die.
- [ ] `fleet-foot`: **Fleet Foot.** Core. +10 ft speed.
- [ ] `unshackled`: **Unshackled.** Core. Advantage on saves and checks to avoid or escape Grappled and Restrained.
- [ ] `elemental-ward`: **Elemental Ward.** Core. Resistance to one of acid, cold, fire, lightning or thunder, chosen when drafted.
- [ ] `pocket-sweep`: **Pocket Sweep.** Core. Once per turn, loot or pick up an item within reach without using an action.
- [ ] `quick-cantrip`: **Quick Cantrip.** Core. Once per room, cast a cantrip as a bonus action.
- [ ] `hardy`: **Hardy.** Core. +1 max HP per character level.
- [ ] `honed`: **Honed.** Core. +1 to one ability score, up to 20.
- [ ] `keen-reflexes`: **Keen Reflexes.** Core. +2 to initiative.
- [ ] `steady-will`: **Steady Will.** Core. Advantage on saves against being Charmed or Frightened.
- [ ] `night-eyes`: **Night Eyes.** Core. Darkvision 60 ft, or +60 ft if you already have it.
- [ ] `resounding-blow`: **Resounding Blow.** Echo. Once per turn, when you hit, the target takes 25% of the damage again at the start of its next turn.
- [ ] `echoing-step`: **Echoing Step.** Echo. After you move at least 20 ft, the first attack against you before your next turn has disadvantage.
- [ ] `last-rites`: **Last Rites.** Reaper. Your hits against Bloodied creatures deal +PB damage.
- [ ] `harvest`: **Harvest.** Reaper. Each creature you drop grants a Soul (up to PB per room).
- [ ] `marked-quarry`: **Marked Quarry.** Hunt. Once per room, as a bonus action, mark a creature.
- [ ] `weak-point`: **Weak Point.** Hunt. Once per room, as a bonus action, study a creature to learn its lowest save and one resistance or vulnerability.
- [ ] `thousand-cuts`: **Thousand Cuts.** Flurry. Each hit after your first on the same creature in a turn reduces its speed by 5 ft until your next turn.
- [ ] `second-hand`: **Second Hand.** Flurry. Once per turn, an attack you make as a bonus action (Nick, Flurry of Blows, two-weapon fighting) deals +PB damage.
- [ ] `bleed-out`: **Bleed Out.** Blood. As a bonus action, lose PB HP to add 2 × PB damage to your next hit this turn.
- [ ] `red-mist`: **Red Mist.** Blood. When you become Bloodied, gain PB temp HP and +10 ft speed until your next turn.
- [ ] `lucky-break`: **Lucky Break.** Crit. Once per room, reroll a natural 1 on an attack roll.
- [ ] `iron-root`: **Iron Root.** Stance. As a bonus action, root yourself: you can't move, but you can't be moved or knocked prone.
- [ ] `pack-tactics`: **Pack Tactics.** Bond. When you and your summon or companion hit the same creature in a round, the second hit deals +PB damage.
- [ ] `swap-places`: **Swap Places.** Bond. Once per room, as a bonus action, swap places with your summon or companion.
- [ ] `elemental-quiver`: **Elemental Quiver.** Volley. Once per turn, a ranged hit deals +PB fire, cold or lightning damage, your choice.
- [ ] `battle-standard`: **Battle Standard.** Rally. Once per room, as a bonus action, plant a standard.
- [ ] `ulmas-thread`: **Ulma's Thread.** Shadow. You always know the way back to the room's entrance.
- [ ] `the-archivists-index`: **The Archivist's Index.** Spell. Once per room, swap one prepared or known spell for another on your class list.
- [ ] `weavers-mending`: **Weaver's Mending.** Guard. Your healing spells and features restore +PB HP.

### 9d. Evolutions, `evolutions/` (49) *(optional)*
Without one, an evolution shows its original boon's picture.

- [ ] `ball-of-yarn`: **Ball of Yarn.** Evolves from Ulma's Thread. Once per run, extract the whole party from any room, not just after a boss, keeping loot as if you'd beaten the last boss you passed.
- [ ] `the-whole-shelf`: **The Whole Shelf.** Evolves from The Archivist's Index. While in the Basalts, you have every spell on your class list prepared.
- [ ] `master-weaver`: **Master Weaver.** Evolves from Weaver's Mending. Once per room, when an ally within 60 ft drops to 0 HP, use your reaction to cast a healing spell on them without spending a slot.
- [ ] `chain-of-echoes`: **Chain of Echoes.** Evolves from Travert's Echoes. Keeps Level 3.
- [ ] `nothing-personal`: **Nothing Personal.** Evolves from Reaper's Sprint. Hitting an enemy from behind lets you teleport behind another enemy for a free attack at 50% damage.
- [ ] `and-you-get-a-spell`: **And You Get a Spell!.** Evolves from Spellslinger's Delight. When a single-target spell hits, cast it for free at another target.
- [ ] `samurais-wake`: **Samurai's Wake.** Evolves from A Fine Steel's Glint. You get the Level 3 teleport, and enemies in the line from you to the target take lightning damage.
- [ ] `elemains-retribution`: **Elemain's Retribution.** Evolves from Elemain's Flight of Fancy. Ricochets 3 + PB times.
- [ ] `battlefield-artist`: **Battlefield Artist.** Evolves from Elemental Residue. Keeps Level 3.
- [ ] `overflowing-cup`: **Overflowing Cup.** Evolves from Overhealing. Temp HP from Overhealing stacks with other temp HP instead of replacing it.
- [ ] `titans-hide`: **Titan's Hide.** Evolves from Hardened Hide. Once per room, as a bonus action, gain resistance to all damage until the start of your next turn, and enemies within 10 ft can only atta…
- [ ] `hex-unwoven`: **Hex Unwoven.** Evolves from Cleansing Nova. Your heals also end curses and remove one level of Exhaustion, and the pulse reaches 20 ft.
- [ ] `mirror-step`: **Mirror Step.** Evolves from Riposte Step. You no longer need to Dodge: when an attack misses you, teleport up to 10 ft and counterattack for +PB damage.
- [ ] `pull-from-the-weave`: **Pull From the Weave.** Evolves from Overchannel. Your spell slots no longer have levels: any slot can cast any spell you know, at any level up to your highest slot.
- [ ] `arc-conduit`: **Arc Conduit.** Evolves from Conduit. The extra damage chains to every creature within 10 ft of the first target.
- [ ] `twin-focus`: **Twin Focus.** Evolves from Unbroken Focus. Once per room, concentrate on two spells at once until the end of your next turn.
- [ ] `every-moving-thing`: **Every Moving Thing.** Evolves from Deadeye Stance. Once per round while you haven't moved, make a ranged opportunity attack against any creature that moves within your range.
- [ ] `rain-of-splinters`: **Rain of Splinters.** Evolves from Scatter Volley. The area grows to 20 ft, and you choose which creatures in it are hit.
- [ ] `gone-in-the-gaps`: **Gone in the Gaps.** Evolves from Fading Veil. While hidden, you can move through creatures' spaces, and your first hit each turn deals +2 × PB damage.
- [ ] `opening-contract`: **Opening Contract.** Evolves from First Strike. Your first hit in each room also deals maximum damage on its dice.
- [ ] `stride-step`: **Stride Step.** Evolves from Vanishing Step. Bring one willing ally within 5 ft with you; both of you are Invisible until the start of your next turn.
- [ ] `shared-flame`: **Shared Flame.** Evolves from Twin Flame. Once per room, a single-target buff spell of any level can target one extra ally.
- [ ] `lodge-backing`: **Lodge Backing.** Evolves from Bolster. The die becomes a d10, and you can grant it as a reaction after the ally sees their roll.
- [ ] `hunting-party`: **Hunting Party.** Evolves from Kindled Ally. Every ally who hits the enemy this round deals +PB damage, not just the first.
- [ ] `the-hoard`: **The Hoard.** Evolves from Collector's Menagerie. Once per floor, keep one extra summon from a spell for a whole room without concentrating on it.
- [ ] `life-weaver`: **Life Weaver.** Evolves from Thalisane's Weave. You can weave one ally into the link as well.
- [ ] `express-line`: **Express Line.** Evolves from The Express. Your hit bonus carries into your next turn as long as you hit at least once each turn.
- [ ] `champion-of-the-ring`: **Champion of the Ring.** Evolves from Breaker's Last Stand. While Bloodied, you make one extra attack when you take the Attack action.
- [ ] `thilss-maze`: **Thils's Maze.** Evolves from Thils's Favor. Once per room, set your own trick: a 10 ft square where entering enemies must make a Dex save against your DC or take 4 × PB damage and b…
- [ ] `god-slayer`: **God-Slayer.** Evolves from Zolic's Nine Eyes. Eyes build against any creature, and at 9 Eyes your hit ignores resistance and immunity.
- [ ] `token-of-whim`: **Token of Whim.** Evolves from Ostra's Coin. Once per floor, flip the token.
- [ ] `the-rift-below`: **The Rift Below.** Evolves from Lenn's Descent. Creatures affected by your control spells take 2 × PB psychic damage at the start of each of their turns.
- [ ] `living-labyrinth`: **Living Labyrinth.** Evolves from Corrow's Lure. Pulled creatures are also Restrained until the end of their next turn.
- [ ] `seismic-aftershock`: **Seismic Aftershock.** Evolves from Resounding Blow. When your delayed echo triggers, it erupts in a 10 ft radius around the target, dealing its 40% damage to every enemy there and knocking…
- [ ] `phantom-phalanx`: **Phantom Phalanx.** Evolves from Echoing Step. Every 20 ft you move leaves a solid afterimage in the space you left (up to PB).
- [ ] `bell-tolls`: **Bell Tolls.** Evolves from Last Rites. Your execution threshold (5 × PB HP) triggers whenever an enemy starts its turn within 15 ft of you, dropping it to 0 HP with no attack r…
- [ ] `soul-furnace`: **Soul Furnace.** Evolves from Harvest. Your Soul cap doubles, and you can spend 3 Souls at once, with no action, to take an extra turn after this one (once per floor) or turn a…
- [ ] `apex-predator`: **Apex Predator.** Evolves from Marked Quarry. Mark up to 3 creatures at once.
- [ ] `fatal-anatomy`: **Fatal Anatomy.** Evolves from Weak Point. Once per room, declare an enemy vulnerable to your next attack's damage type until the end of your turn.
- [ ] `death-by-a-thousand`: **Death by a Thousand.** Evolves from Thousand Cuts. Once per room, when a creature fails its save against your 4-hit Stun, immediately make PB free attacks against it.
- [ ] `twin-tempest`: **Twin Tempest.** Evolves from Second Hand. Your bonus action attack becomes two attacks, and both get Second Hand's damage and prone riders.
- [ ] `crimson-sovereign`: **Crimson Sovereign.** Evolves from Bleed Out. Spending your own HP can't drop you below 1.
- [ ] `undying-rage`: **Undying Rage.** Evolves from Red Mist. When your Level 3 effect triggers at 0 HP, dropping an enemy before the end of your next turn ends the fall, restores you to 3 × PB HP an…
- [ ] `house-always-wins`: **House Always Wins.** Evolves from Lucky Break. When you roll a natural 1 on any d20 Test, or an enemy rolls a natural 20 against you, it becomes a critical success for you and a normal…
- [ ] `tectonic-anchor`: **Tectonic Anchor.** Evolves from Iron Root. While rooted, the ground within your reach is difficult terrain for enemies, and as a bonus action you can stomp to pull every creature w…
- [ ] `alphas-call`: **Alpha's Call.** Evolves from Pack Tactics. When you take the Attack action, your summon or companion makes one free attack against your target without using its action or reaction.
- [ ] `entanglement-rift`: **Entanglement Rift.** Evolves from Swap Places. You can also swap places with an unwilling enemy within 30 ft of your companion if it fails a Cha save against your DC, and you and your…
- [ ] `prismatic-barrage`: **Prismatic Barrage.** Evolves from Elemental Quiver. Your ranged hits apply fire, cold and lightning at once for +3 × PB total damage, and hitting a target already carrying all three trigger…
- [ ] `immortal-banner`: **Immortal Banner.** Evolves from Battle Standard. Wear the standard on your back so the aura moves with you and can't be knocked over.

### 9e. Combinations, `combinations/` (21) *(optional)*
Without one, a combination shows both boons' pictures overlapped.

- [ ] `super-normal`: **Super Normal.** Critical Delight + Crits Are for Suckers. You lose Critical Delight's non-crit penalty and never critically fail an attack roll: a natural 1 still misses if it doesn't meet AC, bu…
- [ ] `still-water`: **Still Water.** A Fine Steel's Glint + Stand Off. Entering either stance activates both, and you can still counter while in stance.
- [ ] `elemains-fancy-criticals`: **Elemain's Fancy Criticals.** Elemain's Flight of Fancy + Critical Delight. Your ricochets use your Critical Delight crit range (10 to 20) instead of only a natural 20, and each ricochet crit builds and benefits f…
- [ ] `shooting-gallery`: **Shooting Gallery.** Elemain's Flight of Fancy + Travert's Echoes. Each ricochet triggers a Level 3 Travert's Echo (three pulses for 25% of the ricochet's damage in a 10 ft ring around each target hit), a…
- [ ] `dragnet`: **Dragnet.** Corrow's Lure + Elemental Residue. Pulled creatures trigger every puddle they're dragged through.
- [ ] `rush-hour`: **Rush Hour.** The Express + Travert's Echoes. Your echoes gain The Express's hit bonus.
- [ ] `immovable-object`: **Immovable Object.** Hardened Hide + Stand Off. While in stand off, your damage reduction doubles, and counters deal extra damage equal to the damage you reduced this round.
- [ ] `blood-and-glory`: **Blood and Glory.** Breaker's Last Stand + Critical Delight. While Bloodied, Critical Delight's non-crit penalty doesn't apply.
- [ ] `pack-leader`: **Pack Leader.** Collector's Menagerie + Twin Flame. Buff spells you cast on yourself also affect your summon or companion.
- [ ] `contract-kill`: **Contract Kill.** Zolic's Nine Eyes + First Strike. Your first hit on a boss each room grants 3 Eyes.
- [ ] `ghost-reaper`: **Ghost Reaper.** Fading Veil + Reaper's Sprint. Every Reaper's Sprint teleport leaves you hidden.
- [ ] `seismic-waltz`: **Seismic Waltz.** Resounding Blow + Echoing Step. Moving 20 ft detonates any pending Resounding Blows on enemies within 30 ft for 50% damage instead of 40%, and each detonation triggers E…
- [ ] `the-ferrymans-toll`: **The Ferryman's Toll.** Last Rites + Harvest. Your execution threshold rises by PB HP for every Soul you hold (up to 10 × PB HP), and executing a creature grants 2 Souls instead of 1.
- [ ] `dead-to-rights`: **Dead to Rights.** Marked Quarry + Weak Point. Marking a quarry also applies Weak Point with the same bonus action.
- [ ] `blender`: **Blender.** Thousand Cuts + Second Hand. Each hit from your bonus action attacks counts as 2 hits toward Thousand Cuts.
- [ ] `martyrs-engine`: **Martyr's Engine.** Bleed Out + Red Mist. Spending HP on Bleed Out triggers all of Red Mist's Bloodied effects even if you aren't Bloodied.
- [ ] `loaded-dice`: **Loaded Dice.** Lucky Break + Ostra's Coin. When you score a crit or spend a Lucky Break use, Ostra's Coin flips and lands on your called side, triggering both the heal and the necr…
- [ ] `living-bastion`: **Living Bastion.** Iron Root + Battle Standard. Using Iron Root plants your Battle Standard in your space for free, with no once-per-room limit, and the standard can't be damaged or kno…
- [ ] `pack-swap`: **Pack Swap.** Pack Tactics + Swap Places. Swapping places with your companion deals 2 × PB force damage to every enemy adjacent to either space and gives your companion a free opp…
- [ ] `tempest-volley`: **Tempest Volley.** Elemental Quiver + Scatter Volley. Scatter Volley can be used once per turn instead of twice per room (up to 3 creatures), and every creature hit suffers both of your chose…
- [ ] `hemomancer`: **Hemomancer.** Bleed Out + Cleansing Nova. Spending HP for Bleed Out releases a 10 ft Cleansing Nova pulse that heals allies for the HP spent and deals that much radiant damage to…

### 9f. Hidden boons, `hidden-boons/` (20) *(optional)*

- [ ] `unbroken`: **Unbroken.** While Bloodied, your Rage damage bonus doubles.
- [ ] `charm-the-pants-off`: **Charm the Pants Off.** Once per room, a creature that fails a save against your charm spell fights for you until the end of its next turn.
- [ ] `divine-witness`: **Divine Witness.** Channel Divinity regains one use after each boss.
- [ ] `many-faces`: **Many Faces.** You can cast cantrips while in Wild Shape.
- [ ] `perfect-form`: **Perfect Form.** Action Surge regains one use after each boss.
- [ ] `empty-hand`: **Empty Hand.** Flurry of Blows makes one extra strike.
- [ ] `oathkeeper`: **Oathkeeper.** Once per room, Divine Smite costs no spell slot.
- [ ] `pogs-path`: **Pog's Path.** You ignore difficult terrain, and room tricks never reveal your position.
- [ ] `unseen-hand`: **Unseen Hand.** Your Sneak Attack dice become d8s.
- [ ] `wild-overflow`: **Wild Overflow.** Regain half your Sorcery Points at the end of each room.
- [ ] `pact-echo`: **Pact Echo.** Your Pact Magic slots refresh after each boss.
- [ ] `the-archivist`: **The Archivist.** Once per floor, cast a spell of 5th level or lower from your spellbook without spending a slot.
- [ ] `lost-and-found`: **Lost and Found.** Once per run, recover one consumable you used up this run.
- [ ] `thilss-wink`: **Thils's Wink.** Once per room, reroll a d20 test made against a room trick.
- [ ] `pilgrims-due`: **Pilgrim's Due.** Gain 1 extra Devotion when you extract.
- [ ] `keeper-of-ways`: **Keeper of Ways.** You always see a room's true exit.
- [ ] `collectors-eye`: **Collector's Eye.** Your share of run loot increases by 10%.
- [ ] `trapwise`: **Trapwise.** Room tricks you trigger deal half damage to you.
- [ ] `maze-runner`: **Maze Runner.** +10 ft speed in rooms with more than one exit.
- [ ] `offering-accepted`: **Offering Accepted.** Once per floor, when you drop to 0 HP, drop to 1 instead.

### 9g. Loot items, `loot/` (81) *(optional)*
Trophy pictures ship with the app, so keep them free of boss spoilers.

- [ ] `healing-potion`: **Healing potion.** Consumable. A Potion of Healing of the floor's grade: common Healing, uncommon Greater, rare Superior, very rare and up Supreme.
- [ ] `pilgrims-wax`: **Pilgrim's wax.** Consumable. Light it as a Bonus Action.
- [ ] `tourists-chalk`: **Tourist's chalk.** Consumable. Draw an arrow on a wall.
- [ ] `vial-of-upward-dew`: **Vial of upward dew.** Consumable. Drink it: for 10 minutes you can walk on walls and ceilings, and you can choose to fall upward.
- [ ] `gate-glass-splinter`: **Gate-glass splinter.** Consumable. Throw it at a creature within 30 ft: Charisma save or it's teleported up to 15 ft to a space you choose.
- [ ] `paradise-honey`: **Paradise honey.** Consumable. Eat it as a Bonus Action: gain 5 × PB temp HP, and you can't be Frightened while they last.
- [ ] `echo-phial`: **Echo phial.** Consumable. Uncork it as a Bonus Action: your next hit before the end of your next turn repeats as an echo for half its damage, as force.
- [ ] `snap-pillar-charge`: **Snap-pillar charge.** Consumable. A disarmed room trick.
- [ ] `lodge-contract-ink`: **Lodge contract ink.** Consumable. Write a creature's name on any tag as a Bonus Action.
- [ ] `capped-static-vent`: **Capped static vent.** Consumable. Throw it up to 30 ft: creatures within 10 ft make a Constitution save or take PB d6 lightning damage and lose Reactions until their next…
- [ ] `thils-lucky-pip`: **Thils's lucky pip.** Consumable. A single die face.
- [ ] `stride-spark`: **Stride spark.** Consumable. Crush it as a Bonus Action to teleport 30 ft, or crush it before a stride roll to add +PB to the roll.
- [ ] `lodge-hunting-blade`: **Lodge hunting blade.** Gear. Your first hit against a creature that hasn't acted yet this combat deals +1d6 damage.
- [ ] `columnbreaker`: **Columnbreaker.** Gear. Double damage to objects and structures.
- [ ] `ricochet-sling`: **Ricochet sling.** Gear. Once per turn, when you miss, the shot bounces: attack another creature within 10 ft of the first.
- [ ] `cable-lash`: **Cable-lash.** Gear. Reach 15 ft.
- [ ] `hymn-tuned-glaive`: **Hymn-tuned polearm.** Gear. On a hit, the weapon hums: the next ally to attack that target before your next turn adds 1d4 to the roll.
- [ ] `gate-glass-edge`: **Gate-glass edge.** Gear. Deals force damage instead of its normal type when you choose.
- [ ] `wardstone-plate`: **Wardstone mail.** Gear. When an effect would push, pull or knock you Prone, you can use your Reaction to stay put.
- [ ] `surveyors-coat`: **Surveyor's coat.** Gear. Advantage on checks to spot traps, room tricks and false walls.
- [ ] `echo-stitched-leathers`: **Echo-stitched leathers.** Gear. When an attack misses you, you can use your Reaction to move 5 ft without provoking Opportunity Attacks.
- [ ] `choir-shield`: **Choir shield.** Gear. When you take the Dodge action, allies within 5 ft of you have half cover.
- [ ] `lodestone-shield`: **Lodestone shield.** Gear. You ignore magnetic pulls like the Magnetic Floor.
- [ ] `meadowlight-breastplate`: **Meadowlight breastplate.** Gear. While Bloodied, you shed golden light in a 10 ft radius and have advantage on Death Saving Throws.
- [ ] `finders-staff`: **Finder's staff.** Gear. Spellcasting focus.
- [ ] `bellringer`: **Bellringer.** Gear. Once per turn, when you hit, the strike rings like a shrine bell: the target can't take Reactions until the start of its next turn.
- [ ] `bentshot-bow`: **Bentshot bow.** Gear. Your shots ignore half cover.
- [ ] `lodge-hush-piece`: **Lodge hush-piece.** Gear. Attacks with it make no sound, and a miss doesn't reveal you while you're hidden or Invisible.
- [ ] `strangers-sidearm`: **Stranger's sidearm.** Gear. Left behind by a strider from a tech-heavy world.
- [ ] `seamsplitter`: **Seamsplitter.** Gear. A gate-builder's tool for splitting stone.
- [ ] `charge-pole`: **Charge-pole.** Gear. If you move at least 20 ft straight toward a creature and hit it with this weapon on the same turn, it takes +1d8 damage and you can push…
- [ ] `offering-scale`: **Offering scale.** Gear. Its scales are pilgrims' offering tokens.
- [ ] `wayward-compass`: **Wayward compass.** Wondrous (common). Points to the last thing you lost.
- [ ] `pilgrims-bell`: **Pilgrim's bell.** Wondrous (common). Chimes softly when you come within 10 ft of an armed trap or room trick, without showing where.
- [ ] `ask-me-about-the-shift-pin`: **"Ask Me About the Shift" pin.** Wondrous (common). Locals of the Basalts treat the wearer as a fellow pilgrim.
- [ ] `self-humming-hymnal`: **Self-humming hymnal.** Wondrous (common). Quietly plays any hymn you've heard once, up to 1 hour a day.
- [ ] `meadow-locket`: **Meadow locket.** Wondrous (common). Opening it smells of rain and honey.
- [ ] `echo-spool`: **Echo spool.** Wondrous (common). Records 6 seconds of sound and replays it on command.
- [ ] `hourglass-that-falls-up`: **Hourglass that falls up.** Wondrous (common). Its sand runs upward and keeps exact time on any plane.
- [ ] `lost-and-found-pouch`: **Lost-and-found pouch.** Wondrous (common). Anything that once sat in the pouch and is then lost reappears in it at the next dawn, once per item.
- [ ] `gamewrights-dice`: **Gamewright's dice.** Wondrous (uncommon). Twice per day, when a creature within 30 ft makes a d20 test, roll 1d6 and add it to or subtract it from the roll.
- [ ] `survey-beacon`: **Survey beacon.** Wondrous (uncommon). Plant it as an action.
- [ ] `gate-glass-monocle`: **Gate-glass monocle.** Wondrous (uncommon). Once per day, as a Bonus Action, see invisible creatures and objects within 30 ft through it for 1 minute.
- [ ] `rune-pair-tiles`: **Rune-pair tiles.** Wondrous (uncommon). Once per day, set both tiles down up to 60 ft apart.
- [ ] `cloak-of-the-unregarded`: **Cloak of the unregarded.** Wondrous (uncommon). You can Hide while only lightly obscured, as long as no creature is looking directly at you.
- [ ] `paradise-seed`: **Paradise seed.** Wondrous (uncommon). Plant it and it grows overnight into a shrub with 1d4 + PB golden berries.
- [ ] `collectors-loupe`: **Collector's loupe.** Wondrous (uncommon). Touch a magic item through it to identify it, learn its value in credits, and learn the name of the last person who lost it.
- [ ] `ball-of-red-thread`: **Ball of red thread.** Wondrous (uncommon). Tie it off at a doorway.
- [ ] `wardstone-heart`: **Wardstone heart.** Wondrous (rare). Once per day, as an action, it unfolds into a Column Sentinel (Gargoyle stat block) that obeys you for 1 hour.
- [ ] `contract-seal`: **Contract seal.** Wondrous (rare). Once per day, as a Bonus Action, seal a contract on a creature you can see.
- [ ] `anchoring-spike`: **Anchoring spike.** Wondrous (rare). Once per day, drive it into the ground as an action.
- [ ] `folded-room`: **Folded room.** Wondrous (rare). A hex tile that unfolds into a 20 ft hexagonal room with one door, for up to 8 hours a day (as Leomund's Tiny Hut, but solid).
- [ ] `echo-locket`: **Echo locket.** Wondrous (rare). Once per day, when you drop to 0 HP, an echo takes your place: you drop to 1 HP instead and are Invisible until the start of your next turn.
- [ ] `pressed-bookmark`: **Pressed bookmark.** Wondrous (rare). When you cast a healing spell, one target also ends the Charmed, Frightened or Poisoned condition.
- [ ] `dead-surveyors-log`: **Dead surveyor's log.** Wondrous (rare). Once per day, ask it a yes-or-no question about the place you're in.
- [ ] `doorwrights-calipers`: **Doorwright's calipers.** Wondrous (rare). Once per day, measure a doorway you're touching and one you touched in the last 24 hours within 500 ft.
- [ ] `the-thousandth-key`: **The thousandth key.** Wondrous (very rare). Once per day, turn it in any door.
- [ ] `pilgrim-saints-censer`: **Pilgrim-saint's censer.** Wondrous (very rare). Once per day, swing it as an action to fill a 30 ft radius with golden smoke for 1 minute.
- [ ] `collectors-satchel`: **Collector's satchel.** Wondrous (very rare). Works as a Bag of Holding.
- [ ] `duelists-echo-mask`: **Duelist's echo mask.** Wondrous (very rare). Once per day, as a Bonus Action, call a past strider's echo for 1 minute.
- [ ] `gate-glass-eye`: **Gate-glass eye.** Wondrous (very rare). You have Truesight to 30 ft, and you always know the way out of any maze or labyrinth you're in, except Thils's own.
- [ ] `hourglass-of-the-shift`: **Hourglass of the Shift.** Wondrous (very rare). Once per day, as a Reaction at the start of another creature's turn, swap two creatures you can see within 60 ft (Charisma save for an un…
- [ ] `thils-cast-off-die`: **Thils's cast-off die.** Wondrous (legendary). A d20 the god lost in a game.
- [ ] `meadow-in-a-jar`: **Meadow in a jar.** Wondrous (legendary). A living patch of a sunlit meadow, sealed.
- [ ] `ring-of-many-exits`: **Ring of many exits.** Wondrous (legendary). Cast Dimension Door at will, as long as you leave from and arrive at a doorway, archway or other opening.
- [ ] `first-expeditions-stride-compass`: **First Expedition's stride compass.** Wondrous (legendary). When you stride, you can choose your stride roll's result instead of rolling.
- [ ] `wardens-cracked-lens`: **Warden's cracked lens.** Boss trophy. Once per day, as an action, hold it up: a creature within 30 ft that can see it makes a Wisdom save or is Charmed for 1 minute, walking t…
- [ ] `hollow-pipe`: **Hollow pipe.** Boss trophy. 3 charges, regained at dawn.
- [ ] `gilded-tether`: **Gilded tether.** Boss trophy. Once per day, as a Bonus Action, tether a creature within 30 ft to a column or object (Dexterity save).
- [ ] `twin-swap-bands`: **Twin-swap bands.** Boss trophy. A pair of bracers for two wearers.
- [ ] `quills-longshot-scope`: **Quill's longshot scope.** Boss trophy. Fits any ranged weapon.
- [ ] `spinners-spool`: **Spinner's spool.** Boss trophy. As a Bonus Action, string a glowing cable between two points within 60 ft (up to 2 at once, 1 minute each).
- [ ] `core-shard`: **Core shard.** Boss trophy. Once per day, as an action, open a 10 ft pool of raw stride energy within 60 ft for 1 minute.
- [ ] `tenth-stride-pauldron`: **Tenth Stride pauldron.** Boss trophy. Switch stance as a Bonus Action.
- [ ] `hydra-prism`: **Hydra prism.** Boss trophy. When a ray, line or beam spell targets or includes you, use your Reaction to roll a d20.
- [ ] `seamless-veil`: **Seamless veil.** Boss trophy. Once per day, for 1 minute, creatures looking at you have disadvantage on attacks against you.
- [ ] `three-black-angles`: **Three black angles.** Boss trophy. Three polyhedrons orbit you.
- [ ] `reliquary-lock`: **Reliquary lock.** Boss trophy. 2 charges, regained at dawn.
- [ ] `inverted-bloom`: **Inverted bloom.** Boss trophy. While you hold it, allies within 10 ft regain PB HP at the start of their turns.
- [ ] `sun-eaters-antler`: **Sun-eater's antler.** Boss trophy. 3 charges, regained at dawn.
- [ ] `gatewrights-three-keys`: **Gatewright's three keys.** Boss trophy. Once per day, for 1 minute, open three portals within 60 ft.
