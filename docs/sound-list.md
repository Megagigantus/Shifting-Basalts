# Sound checklist

Every sound effect the app can play for dungeon events. Save each file as an MP3 at
`public/sounds/cues/<file name>` (for example `public/sounds/cues/room-open.mp3`). The file name must match exactly.
Until a file exists, its event stays silent, so you can add them one at a time. Tick items off as you go.

No music or ambience: those run through the table's sound system.

## Style notes

- **Short:** 0.5 to 2 seconds for most cues. Boss reveal and lore can run to about 3 seconds.
- **Small:** aim for under 100 KB each (MP3, 128 kbps, mono is fine) so phones load them quickly.
- **Even volume:** normalize all files to about the same loudness so none of them blasts.
- **Same world:** dark hex-basalt stone, grinding columns, faint rune light, gold veins.
- **Free sources:** Freesound.org (filter for CC0), Kenney.nl, Pixabay sound effects, Sonniss GDC bundles.
- To change a file path, edit `sounds` in `src/data/moment-theme.json`. To change which screens play a cue,
  edit `src/data/sound-cues.json` (`table`, `tableAndOwn` or `own`).

## Where sounds play

- **Table display:** the DM's second screen (Table display mode). Plays every shared event.
- **Player phone:** plays only that player's own events (their loot, fusion, evolution, lore card and spending).
- **DM main screen:** stays silent, except when the DM taps a spend there.
- Every device's sound on/off and volume settings apply. Phones on silent (iPhone switch) stay quiet.

## Cues

| Done | File | When it plays | Plays on | Feel |
|---|---|---|---|---|
| [ ] | `room-open.mp3` | The party enters a new room (not a boss room) | Table | Stone columns grinding apart, a doorway opening |
| [ ] | `boss-reveal.mp3` | The party enters a boss room (replaces room open) | Table | Deep boom, rumble, rising dread |
| [ ] | `shift.mp3` | The DM triggers a Shift Action in the room | Table | The floor lurching, columns sliding and locking |
| [ ] | `trap.mp3` | A room trick is revealed or springs, or the hidden room condition is revealed | Table | Sharp click and snap, a mechanism releasing |
| [ ] | `loot.mp3` | New loot is added to the party's haul (Table), or an item is assigned to you at extraction (your phone) | Table and own phone | Coins and gems clinking, a satisfying chime |
| [ ] | `fusion-done.mp3` | A boon combination is confirmed (after the fusion card flip) | Table and own phone | Two tones merging into one, a resonant hum |
| [ ] | `evolution-done.mp3` | A boon evolution is confirmed (after the evolve card flip) | Table and own phone | Rising crystalline shimmer, a bloom of power |
| [ ] | `lore.mp3` | A lore card is revealed to the screen it is sent to | Table and/or the targeted phone | Soft whisper, turning page, a distant bell |
| [ ] | `spend-basalts.mp3` | You buy an upgrade with Quantum Basalts | The device you tapped on | Crystal chime, stone humming with charge |
| [ ] | `spend-devotions.mp3` | You put Devotions into a stat track | The device you tapped on | Warm low bell, a quiet prayerful tone |

The existing reveal sounds (card flips, deal, dim, claimed, condition met) stay in `public/sounds/moments/`.
