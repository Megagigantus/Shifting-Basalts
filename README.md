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
| `npm run dev` | Starts the app locally against the real Firebase project |
| `npm run dev:local` | Local test mode: starts the app against Firebase emulators on this computer (see below) |
| `npm run build` | Type-checks and builds the app into `dist/` |
| `npm run lint` | Looks for common code mistakes |
| `npm test` | Runs the unit tests for the game rules |
| `npm run test:rules` | Tests the database security rules in the Firestore emulator |
| `npm run check-data` | Checks the game-content files in `src/data/` for broken references, and that `firestore.rules` is in sync |
| `npm run sync-rules` | Copies upgrade prices and stat track caps into `firestore.rules` after editing them |

The emulator commands (`dev:local`, `test:rules`) also need [Java](https://learn.microsoft.com/java/openjdk/download) 21 or newer.

## Local test mode

`npm run dev:local` runs the app at http://localhost:5174 against Firebase emulators on this computer, with a made-up `demo-` project, so nothing touches real data. It starts with two accounts:

| Role | Email | Password |
| --- | --- | --- |
| DM | dm@example.com | local-test-dm |
| Player | player@example.com | local-test-player |

These exist only in the emulator and are wiped every time it stops. Two characters come ready-made: **Test Fighter** (played by the test player, owning Starting Boon, Reroll, Forge, Banish, Attunement, Hidden Sight and Reprieve rank 4) and **Test Wizard** (played by the DM).

To be the DM and a player at once, sign in as the DM at http://localhost:5174 and as the player in another tab at http://[::1]:5174. The browser treats those as separate sites, so each keeps its own sign-in. Keep the DM's tab open: it applies the players' draft choices. The emulator doesn't send real email: list the verification and password-reset links it would have sent with `curl http://127.0.0.1:9099/emulator/v1/projects/demo-shifting-basalts/oobCodes`.

## Signing in

The app is invite only. The DM adds emails to the invite list; anyone not on it sees no data.
- **Google:** "Sign in with Google".
- **Any other email (Yahoo, Hotmail and so on):** create an account with email and password, then click the verification link Firebase emails you. Password resets are on the sign-in screen.

## Game content

Boons, evolutions and combinations live in `src/data/*.json`. Their shapes are described in `src/data/types.ts`. Add or edit entries there, then run `npm run check-data`.

## Firebase setup (one time)

1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. Add a **Web app** to it and copy its config values.
3. Copy `.env.example` to `.env.local` and paste the values in. `.env.local` is never committed.
4. Under **Authentication → Sign-in method**, enable **Google** and **Email/Password** (the first switch only; leave "Email link" off).
5. Run `npx firebase login`, then `npx firebase use --add` and pick the project.
6. To publish: `npm run build`, then `npx firebase deploy --only hosting` (add `,firestore:rules` when the rules changed).
