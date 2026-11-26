# Art

Drop picture files here and the app shows them. No code changes needed.
Any id without a file just shows text, so you can add art a bit at a time.

## Naming

`src/art/<kind>/<id>.<ext>`, where `<id>` is the `id` from the data file and
`<ext>` is `webp`, `png`, `jpg` or `svg`.

| Folder | Ids come from | Suggested size |
|---|---|---|
| `shapes/` | `room-layouts.json` → `shapes` (e.g. `hex-hall.webp`) | 1600×900 landscape |
| `terrain/` | `room-layouts.json` → `terrain` (e.g. `false-wall.svg`) | 128px square icon |
| `tricks/` | `room-tricks.json` → `tricks` (e.g. `snap-pillar.svg`) | 128px square icon |
| `exits/` | `exit.svg` and `true-exit.svg` | 64px square icon |
| `creatures/` | `enemies.json` → `creatures` (e.g. `hexling.webp`) | 512px square |
| `bosses/` | `bosses.json` → `bosses` (e.g. `tessellated-warden.webp`), plus `<id>-phase-2` for a second phase | 1024px square |
| `boss-parts/` | boss id + part name in lower case with dashes (e.g. `choir-hollow-column-pipe-cluster.webp`) | 256px square |
| `areas/` | `battle-map.json` → `areaArt` (e.g. `void-chasm.webp`), painted onto boss arenas by Shift Actions | 256px square, some tileable |
| `families/` | `enemies.json` → `families` (e.g. `wardstones.webp`) | 512px square |
| `rooms/` | scene ids (`forge`, `reprieve`, `thils-vault`…) plus hub art: `basalt-entrance` and `basalts-int` (page backdrops outside and during a run), `basalt-shrine`, `basalt-markets`, `basalt-lib` (the Library) and `field-of-echoes` (Characters tab banners) | 1600×900 landscape |
| `boons/` | `boons.json` ids (e.g. `traverts-echoes.webp`) | 256px square |
| `evolutions/` | `evolutions.json` ids; falls back to the original boon's art | 256px square |
| `combinations/` | `combinations.json` ids; falls back to both boons' art | 256px square |
| `hidden-boons/` | `hidden-boons.json` ids; falls back to `boon-tags/hidden` | 256px square |
| `boon-tags/` | one per boon tag in lower case (`echo`, `reaper`…), plus `hidden`; the fallback for boons | 256px square |
| `loot/` | consumable, gear, wondrous and trophy ids in `loot-items.json` | 256px square |
| `logo/` | `logo-banner` (sign-in screen) and `logo-icon` (header). The browser tab icons are copies in `public/` (`favicon.png` 64px, `apple-touch-icon.png` 180px) | banner about 1200×400, icon 256px square |
| `loot-kinds/` | `trinket`, `consumable`, `healing-potion`, `gear-weapon`, `gear-armor`, `gear-shield`, `wondrous`, `trophy`, `credits`, `quantum-basalts`; the fallback for loot | 256px square |
| `lore/` | lore card ids from the DM's deck (e.g. `boss-warden.webp`); falls back to the group picture, then a dark background | 1920×1080 landscape (16:9) |
| `lore-groups/` | lore group ids (`arrival`, `echoes`, `dispatch`, `lost`, `thils`, `death`, `bosses`) | 1920×1080 landscape (16:9) |

The full list with descriptions is in `docs/art-list.md`.

If a new picture doesn't show up while the dev server is running, restart it.

## Spoilers

Every file here ships with the app, and a curious player can find it with
browser dev tools. The app only *shows* creature, boss, trick and false-wall
pictures to players once the DM reveals them, but the files themselves are
not secret. Keep that in mind for boss art. Use your own art, not Monster
Manual art.

## Keeping files small

After adding big pictures, run `npm run compress-art` to see what it would
shrink, then `npm run compress-art -- --write` to apply it. It caps arenas,
maps, rooms and shapes at 1600 px wide (bosses at 1024 px) and re-saves them
as WebP; files it can't make at least 20% smaller are left alone.
