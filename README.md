# Shifting Basalts

A tracker and generator for the Shifting Basalts, a rogue-lite dungeon in a D&D 5e (2024) campaign. The design lives in [docs/design-bible.md](docs/design-bible.md).

## Run it locally

Needs [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app locally and reloads on every save |
| `npm run build` | Type-checks and builds the app into `dist/` |
| `npm run lint` | Looks for common code mistakes |
| `npm run check-data` | Checks the game-content files in `src/data/` for broken references |

## Game content

Boons, evolutions and combinations live in `src/data/*.json`. Their shapes are described in `src/data/types.ts`. Add or edit entries there, then run `npm run check-data`.

## Firebase setup (one time)

1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. Add a **Web app** to it and copy its config values.
3. Copy `.env.example` to `.env.local` and paste the values in. `.env.local` is never committed.
4. Run `npx firebase login`, then `npx firebase use --add` and pick the project.
5. To publish: `npm run build`, then `npx firebase deploy --only hosting`.
