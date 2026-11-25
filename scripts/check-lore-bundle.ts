// Scans the built app (dist/) for any banned term listed in
// private/lore-banned-terms.txt, using parseBannedTerms from
// ../src/lore/bannedTerms.ts.
// Run with: npm run check-lore-bundle
// Warns and exits 0 if the private terms file is missing; exits 1 if dist/ is
// missing or if any banned term is found in the built bundle.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBannedTerms } from '../src/lore/bannedTerms.ts'

const SCAN_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.html',
  '.json',
  '.txt',
  '.svg',
  '.map',
  '.webmanifest',
])

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const termsPath = join(repoRoot, 'private', 'lore-banned-terms.txt')
const distDir = join(repoRoot, 'dist')

if (!existsSync(termsPath)) {
  console.warn('Warning: private/lore-banned-terms.txt not found; skipping lore bundle check.')
  process.exit(0)
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error('Error: dist/ directory not found. Run the build first (e.g. "npm run build").')
  process.exit(1)
}

const terms = parseBannedTerms(readFileSync(termsPath, 'utf8'))

function collectFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath))
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push(fullPath)
    }
  }
  return results
}

const files = collectFiles(distDir)
const hits: { file: string; term: string }[] = []

for (const file of files) {
  const lowerContent = readFileSync(file, 'utf8').toLowerCase()
  const relPath = relative(repoRoot, file).replace(/\\/g, '/')
  for (const term of terms) {
    if (lowerContent.includes(term)) {
      hits.push({ file: relPath, term })
    }
  }
}

if (hits.length > 0) {
  console.error(`Found ${hits.length} banned term hit(s) in dist/:`)
  for (const hit of hits) {
    console.error(`  - ${hit.file}: ${hit.term}`)
  }
  process.exit(1)
}

console.log(`Lore bundle OK: checked ${files.length} files against ${terms.length} banned terms.`)
