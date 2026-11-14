// Shrinks oversized art in src/art so the site loads faster. Run with:
//   npm run compress-art            (dry run: shows what would change)
//   npm run compress-art -- --write (replaces the files)
//   npm run compress-art -- --out <folder>  (writes copies there to compare)
//
// Each folder has a largest width and a WebP quality. A file is only replaced
// when the new version is at least 20% smaller, so running this again on
// already-compressed art changes nothing. Uses sharp (a dev-only dependency;
// it never ships with the site). New art can be dropped in at any size and
// squeezed with this script.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

// Read files into memory and keep no cache, so Windows doesn't lock a file we're about to replace.
sharp.cache(false)

/** Per folder: the largest width to keep (pixels) and the WebP quality (0 to 100). */
const RULES: Record<string, { maxWidth: number; quality: number }> = {
  // Boss arenas and battle maps show at most about 900 px wide; 1600 stays sharp on high-density screens.
  arenas: { maxWidth: 1600, quality: 80 },
  maps: { maxWidth: 1600, quality: 80 },
  // Scene art and hub backdrops (the backdrop shows at 35% opacity).
  rooms: { maxWidth: 1600, quality: 75 },
  shapes: { maxWidth: 1600, quality: 78 },
  bosses: { maxWidth: 1024, quality: 80 },
}

const MIN_SAVING = 0.2
const artRoot = new URL('../src/art/', import.meta.url)
const args = process.argv.slice(2)
const write = args.includes('--write')
const outIndex = args.indexOf('--out')
const outDir = outIndex >= 0 ? args[outIndex + 1] : null

const mb = (n: number) => `${(n / 1e6).toFixed(2)} MB`
let before = 0
let after = 0
let changed = 0

for (const [folder, rule] of Object.entries(RULES)) {
  const dir = new URL(`${folder}/`, artRoot)
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.webp')) continue
    const file = new URL(name, dir)
    const input = readFileSync(file)
    const size = input.length
    const image = sharp(input)
    const meta = await image.metadata()
    const width = meta.width ?? 0
    const output = await image
      .resize({ width: Math.min(width, rule.maxWidth), withoutEnlargement: true })
      .webp({ quality: rule.quality, effort: 6 })
      .toBuffer()
    before += size
    if (output.length > size * (1 - MIN_SAVING)) {
      after += size
      continue
    }
    after += output.length
    changed++
    console.log(`${folder}/${name}: ${mb(size)} ${width}px -> ${mb(output.length)} ${Math.min(width, rule.maxWidth)}px`)
    if (write) writeFileSync(file, output)
    if (outDir) {
      mkdirSync(join(outDir, folder), { recursive: true })
      writeFileSync(join(outDir, folder, name), output)
    }
  }
}

console.log(`\n${changed} file(s): ${mb(before)} -> ${mb(after)} in these folders.`)
if (!write) console.log(outDir ? `Copies written to ${outDir}. Nothing in src/art changed.` : 'Dry run: nothing changed. Add --write to replace the files.')
