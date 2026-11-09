// Copies upgrade prices and stat track caps from the data files into
// firestore.rules. Run with: npm run sync-rules
import { readFileSync, writeFileSync } from 'node:fs'
import { withGeneratedBlock } from './rules-generated.ts'

const path = new URL('../firestore.rules', import.meta.url)
// Work in plain \n line endings; Git converts them on Windows.
const before = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const after = withGeneratedBlock(before)
if (after === before) {
  console.log('firestore.rules is already up to date.')
} else {
  writeFileSync(path, after)
  console.log('Updated the generated section of firestore.rules. Run npm run test:rules, then deploy the rules.')
}
