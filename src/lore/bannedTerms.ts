// Helpers for parsing banned-term lists and scanning lore cards or arbitrary
// values for leaked terms. Browser-safe: no Node imports.
import type { LoreCard } from './types.ts'

export interface BannedTermHit {
  path: string
  term: string
}

/**
 * Parse a banned-terms file into unique, trimmed, lowercase terms.
 * Ignores blank lines and lines starting with `#`.
 */
export function parseBannedTerms(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

/**
 * Walk strings, arrays, and plain objects, returning every case-insensitive
 * substring match along with its dotted path. Keys in `skipKeys` are ignored
 * at every depth.
 */
export function findBannedTerms(
  value: unknown,
  terms: string[],
  skipKeys: string[] = [],
): BannedTermHit[] {
  const activeTerms = terms
    .filter((t) => t.length > 0)
    .map((t) => ({ reported: t, lower: t.toLowerCase() }))
  if (activeTerms.length === 0) return []

  const skipSet = new Set(skipKeys)
  const hits: BannedTermHit[] = []
  const visiting = new WeakSet<object>()

  function walk(node: unknown, path: string): void {
    if (typeof node === 'string') {
      const lower = node.toLowerCase()
      for (const term of activeTerms) {
        if (lower.includes(term.lower)) {
          hits.push({ path, term: term.reported })
        }
      }
      return
    }

    if (typeof node !== 'object' || node === null) return
    if (visiting.has(node)) return
    visiting.add(node)

    try {
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
          const nextPath = path ? `${path}.${i}` : String(i)
          walk(node[i], nextPath)
        }
        return
      }

      const proto = Object.getPrototypeOf(node)
      if (proto !== Object.prototype && proto !== null) return

      for (const [key, child] of Object.entries(node)) {
        if (skipSet.has(key)) continue
        const nextPath = path ? `${path}.${key}` : key
        walk(child, nextPath)
      }
    } finally {
      visiting.delete(node)
    }
  }

  walk(value, '')
  return hits
}

/**
 * Check every field on a lore card for banned terms, read-aloud included.
 */
export function findBannedInCard(card: LoreCard, terms: string[]): BannedTermHit[] {
  return findBannedTerms(card, terms)
}
