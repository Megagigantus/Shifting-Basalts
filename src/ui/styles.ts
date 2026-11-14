// Shared class lists for plain form controls and buttons in the redesign.
// (Tone-colored buttons live in tone.ts; these are the everyday ones.)

/** Text input or select. */
export const FIELD =
  'box-border rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-amber-500/60 focus:outline-none'

/** Label above a field. */
export const FIELD_LABEL = 'flex flex-col gap-1 text-xs font-semibold text-stone-300'

/** Main action: solid amber. */
export const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg border-0 bg-amber-500 px-4 py-2 text-sm font-bold text-stone-950 hover:bg-amber-400 disabled:opacity-60 cursor-pointer'

/** Secondary action: dark with a border. */
export const QUIET_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-stone-800 disabled:opacity-60 cursor-pointer'

/** Small secondary action, for rows of tools (Reveal, Reroll…). */
export const SMALL_BUTTON =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-800 disabled:opacity-50 cursor-pointer'

/** A dark inner box inside a card, e.g. one terrain feature. */
export const WELL = 'rounded-lg border border-stone-800 bg-stone-950/70 p-2.5'

/** Text that acts like a link. */
export const LINK_BUTTON =
  'border-0 bg-transparent p-0 text-xs font-semibold text-amber-300 underline-offset-2 hover:bg-transparent hover:underline cursor-pointer'

/** The centered card on the sign-in screens. */
export const AUTH_CARD_BASE = 'flex flex-col gap-4 rounded-2xl border bg-stone-900/90 p-5 text-stone-100 shadow-2xl shadow-black/40'
export const AUTH_CARD = `${AUTH_CARD_BASE} border-stone-800`
