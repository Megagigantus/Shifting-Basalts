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
| `families/` | `enemies.json` → `families` (e.g. `wardstones.webp`) | 512px square |

The full list with descriptions is in `docs/art-list.md`.

If a new picture doesn't show up while the dev server is running, restart it.

## Spoilers

Every file here ships with the app, and a curious player can find it with
browser dev tools. The app only *shows* creature, boss, trick and false-wall
pictures to players once the DM reveals them, but the files themselves are
not secret. Keep that in mind for boss art. Use your own art, not Monster
Manual art.
