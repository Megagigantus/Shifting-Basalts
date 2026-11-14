// Art lookup: which picture files exist under src/art/<kind>/<id>.<ext>.
// Vite lists the folder when the app is built, so a missing picture costs
// nothing (no failed download) and the screens just show text as before.
// See src/art/README.md for the folder layout.

export type ArtKind =
  | 'shapes'
  | 'terrain'
  | 'tricks'
  | 'exits'
  | 'creatures'
  | 'bosses'
  | 'boss-parts'
  | 'families'
  | 'maps'
  | 'arenas'
  | 'objects'
  | 'summons'
  | 'portraits'
  | 'rooms'

const files = import.meta.glob<string>('./art/*/*.{webp,png,jpg,jpeg,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// './art/creatures/hexling.webp' -> 'creatures/hexling'
const byKey = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
  const key = path.replace(/^\.\/art\//, '').replace(/\.[a-z]+$/, '')
  byKey.set(key, url)
}

/** URL of the picture for this id, or null when no file has been added yet. */
export function artUrl(kind: ArtKind, id: string): string | null {
  return byKey.get(`${kind}/${id}`) ?? null
}

/** Picture id for a boss part: 'choir-hollow-column' + 'Pipe cluster' -> 'choir-hollow-column-pipe-cluster'. */
export function partArtId(bossId: string, partName: string): string {
  const slug = partName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${bossId}-${slug}`
}

/** Picture id for a boss's second phase, e.g. 'ophaniel-phase-2'. */
export const phase2ArtId = (bossId: string) => `${bossId}-phase-2`
