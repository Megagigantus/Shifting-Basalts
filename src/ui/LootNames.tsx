// A comma-separated list of item names, each in its rarity color (rarity.ts).
// Used by run history lines; "none" when the list is empty.
import { Fragment } from 'react'
import { itemName, type LootItem } from '../rules/loot'
import { itemNameClass } from './rarity'

export function LootNames({ items }: { items: LootItem[] | undefined }) {
  if (!items?.length) return <>none</>
  return (
    <>
      {items.map((i, n) => (
        <Fragment key={i.uid}>
          {n > 0 && ', '}
          <span className={itemNameClass(i)}>{itemName(i)}</span>
        </Fragment>
      ))}
    </>
  )
}
