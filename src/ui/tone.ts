// Color "tones" for the redesigned screens (docs/ui-redesign-plan.md).
// Each tone has a meaning, so the same color always says the same thing:
//   amber: primary actions and highlights    emerald: success, healing, confirm
//   rose: danger, DM secrets, Pressures      sky: players, Extract
//   indigo: Shrine, Devotions, Descend       violet: hidden boons, evolve
//   purple: Quantum Basalts                  teal: summons and companions
//   fuchsia: boss parts                      stone: neutral
//
// Class names are written out in full (never built from pieces) because
// Tailwind only generates classes it can find as whole words in the source.

export type Tone =
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'teal'
  | 'fuchsia'
  | 'stone'

export const TONES: readonly Tone[] = [
  'amber',
  'emerald',
  'rose',
  'sky',
  'indigo',
  'violet',
  'purple',
  'teal',
  'fuchsia',
  'stone',
]

interface ToneClasses {
  /** Small rounded label: tinted background, matching border and text. */
  pill: string
  /** Accent border for a card or panel. */
  border: string
  /** Text color for a heading or number in this tone. */
  text: string
  /** Solid button in this tone. */
  button: string
}

export const toneClasses: Record<Tone, ToneClasses> = {
  amber: {
    pill: 'bg-amber-500/20 border-amber-500/40 text-amber-200',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    button: 'bg-amber-500 hover:bg-amber-400 text-stone-950',
  },
  emerald: {
    pill: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    button: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  rose: {
    pill: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
    border: 'border-rose-500/40',
    text: 'text-rose-300',
    button: 'bg-rose-700 hover:bg-rose-600 text-white',
  },
  sky: {
    pill: 'bg-sky-500/20 border-sky-500/40 text-sky-200',
    border: 'border-sky-500/40',
    text: 'text-sky-300',
    button: 'bg-sky-600 hover:bg-sky-500 text-white',
  },
  indigo: {
    pill: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200',
    border: 'border-indigo-500/40',
    text: 'text-indigo-300',
    button: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  },
  violet: {
    pill: 'bg-violet-500/20 border-violet-500/40 text-violet-200',
    border: 'border-violet-500/40',
    text: 'text-violet-300',
    button: 'bg-violet-600 hover:bg-violet-500 text-white',
  },
  purple: {
    pill: 'bg-purple-500/20 border-purple-500/40 text-purple-200',
    border: 'border-purple-500/40',
    text: 'text-purple-300',
    button: 'bg-purple-600 hover:bg-purple-500 text-white',
  },
  teal: {
    pill: 'bg-teal-500/20 border-teal-500/40 text-teal-200',
    border: 'border-teal-500/40',
    text: 'text-teal-300',
    button: 'bg-teal-600 hover:bg-teal-500 text-white',
  },
  fuchsia: {
    pill: 'bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-200',
    border: 'border-fuchsia-500/40',
    text: 'text-fuchsia-300',
    button: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white',
  },
  stone: {
    pill: 'bg-stone-800/80 border-stone-700 text-stone-300',
    border: 'border-stone-800',
    text: 'text-stone-200',
    button: 'bg-stone-800 hover:bg-stone-700 text-stone-100 border border-stone-700',
  },
}

/** Join class names, skipping empty ones. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Up to two capital letters for a placeholder: 'Corner Bull' -> 'CB', 'hexling' -> 'H'. */
export function initials(name: string): string {
  const words = name
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
