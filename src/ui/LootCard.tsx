// Compact loot item card: 64px art (or kind icon fallback), rarity border and
// glow for rare+, item name, kind pill, 2-line description, and optional controls.
import { useState, type ReactNode } from 'react'
import { FlaskConical, Gem, Sparkles, Sword, Trophy, type LucideIcon } from 'lucide-react'
import { lootArt } from '../boonLootArt'
import { itemName, itemText, rarityName, type ItemKind, type LootItem, type Rarity } from '../rules/loot'
import { Pill } from './Pill'
import { itemNameClass } from './rarity'
import { cx, toneClasses, type Tone } from './tone'

const RARITY_TONES: Record<Rarity, Tone> = {
  common: 'stone',
  uncommon: 'emerald',
  rare: 'sky',
  'very-rare': 'purple',
  legendary: 'amber',
}

const RARITY_GLOWS: Record<Rarity, string> = {
  common: '',
  uncommon: '',
  rare: 'shadow-[0_0_12px_rgb(56_189_248/0.45)]',
  'very-rare': 'shadow-[0_0_12px_rgb(168_85_247/0.5)]',
  legendary: 'shadow-[0_0_14px_rgb(251_146_60/0.55)]',
}

const KIND_ICONS: Record<ItemKind, LucideIcon> = {
  trinket: Gem,
  consumable: FlaskConical,
  gear: Sword,
  wondrous: Sparkles,
  trophy: Trophy,
  relic: Gem,
}

export function LootCard({ item, children }: { item: LootItem; children?: ReactNode }) {
  const art = lootArt(item)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const rarity = item.rarity ?? 'common'
  const tone = RARITY_TONES[rarity]
  const glow = RARITY_GLOWS[rarity]
  const KindIcon = KIND_ICONS[item.kind]
  const text = itemText(item)

  const kindPill =
    item.kind === 'trinket' ? (
      <Pill>Trinket</Pill>
    ) : item.kind === 'relic' ? (
      <Pill tone="fuchsia">Relic, {item.relicState === 'woken' ? 'Awoken' : 'Dormant'}</Pill>
    ) : (
      <Pill tone={tone}>
        {rarityName(rarity)} {item.kind}
      </Pill>
    )

  return (
    <div className={cx('flex items-start gap-3 rounded-xl border bg-stone-950/70 p-3', toneClasses[tone].border)}>
      <div
        className={cx(
          'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-800 bg-stone-950',
          glow,
        )}
      >
        {art && failedUrl !== art ? (
          <img
            src={art}
            alt=""
            loading="lazy"
            onError={() => setFailedUrl(art)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950 text-stone-400"
          >
            <KindIcon size={24} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className={cx('text-xs', itemNameClass(item))}>{itemName(item)}</strong>
          {kindPill}
        </div>
        <p title={text} className="m-0 line-clamp-2 text-[0.6875rem] text-stone-400">
          {text}
        </p>
        {children && <div className="flex flex-wrap items-center gap-1.5">{children}</div>}
      </div>
    </div>
  )
}
