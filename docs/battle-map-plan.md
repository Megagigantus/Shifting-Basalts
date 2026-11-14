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

## Boss phase art

Bosses with a second phase change it at **Bloodied**, which the app already tracks, either
automatically from HP or by the DM's Bloodied button. One switch drives everything below.

| Where | Phase 1 | Phase 2 (Bloodied) | Status |
| --- | --- | --- | --- |
| DM boss block | Both portraits side by side, the current phase outlined | Same, outline moves to phase 2 | Built |
| Player room screen | Phase 1 portrait | Switches to the phase 2 portrait, plus a Bloodied tag | Built |
| Map token | Round crop of the phase 1 portrait | Swaps to the phase 2 portrait | Phase 4 |
| Arena | Phase 1 arena | **The Husk and the Gatewright** swap to their phase 2 arena. Phase 1 objects that don't belong in phase 2 hide (the Husk's columns and braziers), and phase 2 objects appear (the Gatewright's portals) | Phase 4 |
| Phase reveal (proposed) | | Players get a one-time full-width reveal of the phase 2 portrait with its name, e.g. "The Gate Opens". It closes with a tap or after a few seconds | Phase 4 |

- **Which bosses:** Ophaniel, the Sun-Eater's Husk and the Gatewright have phase 2 portraits; the Husk and the Gatewright also have phase 2 arenas. Other bosses with Bloodied effects (e.g. the Tessellated Warden's Lens Flare) keep one portrait.
- **Kaelen and Vyr** use the same token-swap idea for their forms. The DM gets a "Swap form" button, and the token switches between the Kaelen and Vyr art. Each form keeps its own AC and ability profile.
- **Going back:** if the DM turns Bloodied off, everything returns to phase 1.

## Portals in the Gatewright's phase 2 arena

- **Painted portals stay visible.** The three portals painted into the phase 2 arena are fixed features. The app draws only a thin outline and a name label on them, never the portal object image, so players can see the three different gates.
- **Names (no spoilers):** Gilded portal, Void portal and Archive portal.
- **The `portal` object** is for portals the DM places somewhere else. If the Gatewright's Shift Portal moves one, it appears at the new spot as the portal object, and its painted spot gets a dimmed "closed" outline.

## Entrances

- The party enters from the south edge, **except in the split chamber, where it enters from the east** (the chasm runs north to south).
- Each boss arena gets its own entrance in the data, matched to its painting.
- Room movement rules for the tiered stair and split chamber are in the bible (Size, elevation, exits and lighting).

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

The full checklist, with file names and descriptions for building prompts, is in
`docs/battle-map-art-list.md`: 75 core pictures (8 room maps, 15 boss arenas,
16 objects, 8 summon tokens, 24 portraits, and 9 post-boss and Reprieve pictures),
plus optional extras for the rest of the app.
