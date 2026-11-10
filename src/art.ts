// Art lookup: which picture files exist under src/art/<kind>/<id>.<ext>.
// Vite lists the folder when the app is built, so a missing picture costs
// nothing (no failed download) and the screens just show text as before.
// See src/art/README.md for the folder layout.

export type ArtKind = 'shapes' | 'terrain' | 'tricks' | 'exits' | 'creatures' | 'bosses'

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
