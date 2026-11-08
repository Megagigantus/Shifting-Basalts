# Shifting Basalts Tracker

## What this is
A web app for running the Shifting Basalts, a rogue-lite dungeon in a D&D 5e (2024 rules) campaign. It replaces the character sheet for everything the dungeon adds (boon slots, boons, evolutions, combinations, stat tracks, upgrades, Quantum Basalts, loot, lockouts, run history), and it generates rooms, encounters, bosses and loot from the design tables.

The full design lives in `docs/design-bible.md`. Read its "App requirements" section before any feature work. Look rules up in the bible instead of inventing them. If a rule is missing or ambiguous, ask me rather than guessing.

## Who uses it
- **DM view:** I host each run with full controls and all hidden information.
- **Player view:** players join on their own devices with a lighter view. The player view must never show enemy stats, hidden room conditions or unsprung room tricks.
- Sonder glimpses are never tracked or shown anywhere in the app.

## Ground rules
- I'm learning Claude Code and Git. Before each change, explain in plain language what you're about to do and why. Keep changes small enough for me to review.
- Game content (boons, combinations, pressures, upgrades, loot tables, enemies, room tables) lives in data files, not hard-coded logic, so new content can be added without code changes.
- Items marked *(proposed)* in the bible are the current plan but may change. Build them so they're easy to edit.
- The app tracks modifiers the dungeon adds (like +10 max HP). It never tracks a character's full stats.
- Prefer simple, well-known tools over clever ones. Ask before adding a dependency or paid service.

## Git rules
- Never commit directly to main. Create a branch for each feature or fix.
- Commit after each change that works, with a clear one-line message.
- Commit before any risky refactor so there's a clean restore point.
- Never commit API keys, passwords or .env files.
- Ask me before merging into main, deleting branches or force-pushing.
