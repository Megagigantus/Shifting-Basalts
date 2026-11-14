# UI redesign plan

Bring the look, layout and screens of the Gemini prototype (`D:\Shifting-Basalts-G`) into this app. We keep this app's rules, data, Firestore setup, security rules and battle-map placement. We port the **design**, not Gemini's code: its engine, Realtime Database sync and local tab-sync mode stay behind.

## Decisions (2026-11-14)

- **Styling:** add Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`) and `lucide-react` icons. Gemini's class names and icons then carry over almost unchanged.
- **Navigation:** header tabs. The DM gets Run, Characters, History and Tables. Invites and the player preview become header buttons.
- **Extras to bring over:** the run-entry video, an art lightbox, a JSON backup (download only for now) and void run with rollback.
- **Reprieve:** each living player picks Rest or Reflect.
  - Rest gives a short rest's benefits, applied at the table. The app only logs it.
  - Reflect levels up one boon.
  - A player with no boon that can level gets catch-up Basalts instead: 1 × the entry multiplier, counted as passed so it survives death. This is a new rule, so it gets added to the bible.
- **Devices:** both the DM and players get Gemini's desktop look. Players also get a phone layout that stacks into one column with slightly larger text.
- **Order:** do the look first, then the features. Each step is its own branch and pull request.

## Look and feel to match

- **Palette:**
  - Stone neutrals: stone-950 for the page, stone-900 for cards, stone-950 for inner wells, stone-800 for borders.
  - Amber is the primary accent.
  - Semantic colors:
    - emerald: success and heal
    - rose: danger, DM secrets, Pressures and tricks
    - sky: player and Extract
    - indigo: Shrine, Devotions and Descend
    - violet: hidden boons and evolve
    - purple: Basalts
    - teal: summons
    - fuchsia: boss parts
- **Type:** system or Inter, small and dense (11 to 12 px), uppercase tracked section labels, mono for numbers.
- **Cards:** rounded-xl cards, rounded-full tinted pills, and the "art card" pattern: an image, a dark gradient, then a label and a pill along the bottom.
- **Backdrop:** a full-page room image at 35% opacity: `basalt-entrance` outside a run and `basalts-int` during one.

## Steps

1. **Foundations.**
   - Install Tailwind and lucide.
   - Set the theme colors.
   - Build shared components: Panel, Pill, ArtCard (with an SVG fallback when an image fails), StatStrip, one shared Lightbox, and a two-step ConfirmButton.
   - Copy the hub art (`basalt-entrance`, `basalts-int`, `basalt-shrine`, `basalt-markets`) into `src/art/rooms`.
   - Keep the old CSS working until each screen moves over.
2. **Shell and header.**
   - A sticky header with tabs, a role pill and the DM's view-as-player toggle.
   - The Invites modal and the Player link button.
   - A restyled sign-in screen.
3. **DM run screen.**
   - The "Prepare next run" lobby: party cards, a stat strip and Pressure cards.
   - The active run in 8 + 4 columns. The main column holds:
     - the tracker banner
     - the DM control well
     - the battle map (current placement, restyled)
     - the room card with its art banner
     - the encounter roster with HP rows
     - draft cards
     - scenes as station cards
     - the loot and extraction "What you're taking home" view
     - the run log
   - The sidebar holds one card per player.
4. **Player screens.** The same look on desktop, plus a one-column phone layout. Visibility rules don't change: no enemy stats, hidden conditions or unsprung tricks.
5. **Characters tab.**
   - A roster list and a profile card with the portrait picker.
   - Basalt Shrine and Basalt Markets as art banners with Visit and Leave buttons.
   - Inventory and run history.
6. **Extras.**
   - The run-entry video plays for players only, once per run per device, with Skip and Sound buttons. It's a 7.2 MB file.
   - The lightbox on all art.
   - A JSON backup download.
   - Cancel run gets a two-step confirm. Check that nothing writes to characters mid-run, so cancelling is a true rollback.
7. **Reprieve recording.** Rules, tests and UI for Rest, Reflect and catch-up Basalts, plus the bible update.
8. **No-placement areas.** Add more areas in `battle-map.json` for column-forest and twisted-vault.
9. **Arena recompression.** The arenas total about 14 MB (about 0.9 MB each). Shrinking them needs an image tool, which I'll ask about before adding one.

## Not porting (Gemini issues found)

- Players can "play as" anyone's character.
- Party Wipe and character delete have no confirmation.
- Floor banner art is referenced but missing.
- The palette mixes slate and stone.
- Copy doesn't match the logic, for example "claim the Boss Cache" with no cache UI.
- Class triggers live only in one browser and don't sync.
- Gemini's rule differences: the bible wins (for example "Rest", not "Mend").

- **Run-entry video:** plays for players only, not the DM.

## Still open

- Which image tool to use for step 9, decided at that step.
