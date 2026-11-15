import type { Random } from './draft'

export type DiceRoll = {
  notation: string
  count: number
  sides: number
  modifier: number
  rolls: number[]
  total: number
}

const MIN_COUNT = 1
const MAX_COUNT = 100
const MIN_SIDES = 1
const MAX_SIDES = 1000
const DICE_PATTERN = /^\s*(\d+)?\s*[dD]\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/

/** Parse standard dice notation (e.g. "2d6+3", "d20", "4d8-1"). */
export function parseDice(notation: string): { count: number; sides: number; modifier: number } {
  if (notation.trim() === '') {
    throw new Error('Dice notation is empty. Use a form like "2d6+3".')
  }

  const match = DICE_PATTERN.exec(notation)
  if (!match) {
    throw new Error(
      `Invalid dice notation "${notation}". Use the form NdS+M, like "2d6+3", "d20" or "4d8-1".`,
    )
  }

  const count = match[1] !== undefined ? Number(match[1]) : 1
  const sides = Number(match[2])

  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    throw new Error(`Invalid dice count in "${notation}": expected ${MIN_COUNT} to ${MAX_COUNT}`)
  }
  if (!Number.isInteger(sides) || sides < MIN_SIDES || sides > MAX_SIDES) {
    throw new Error(`Invalid dice sides in "${notation}": expected ${MIN_SIDES} to ${MAX_SIDES}`)
  }

  const rawModifier = match[4] !== undefined ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0
  const modifier = rawModifier === 0 ? 0 : rawModifier

  return { count, sides, modifier }
}

/** Roll dice from standard dice notation and return individual rolls and total. */
export function rollDice(notation: string, random: Random = Math.random): DiceRoll {
  const { count, sides, modifier } = parseDice(notation)
  const rolls: number[] = []
  let sum = 0

  for (let i = 0; i < count; i++) {
    const roll = 1 + Math.floor(random() * sides)
    rolls.push(roll)
    sum += roll
  }

  return {
    notation: notation.trim(),
    count,
    sides,
    modifier,
    rolls,
    total: sum + modifier,
  }
}
