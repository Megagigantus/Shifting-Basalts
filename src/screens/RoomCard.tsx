// The room as a picture: shape banner, lighting tint, and icon rows for
// terrain, tricks and exits. Shared by the DM and player rooms. Each caller
// passes only what its viewer may see; the DM can mark items as hidden so
// they show dimmed. Renders nothing until at least one picture exists.
import { artUrl, type ArtKind } from '../art'
import { Art } from './Art'
import { lightingName, shapeOf, sizeOf, terrainOf, trickOf } from '../rules/rooms'

interface Props {
  shape: string
  size: string
  lighting: string
  exits: number
  /** The true exit's number, or null when the viewer doesn't know it. */
  trueExit: number | null
  terrain: string[]
  tricks: string[]
  /** DM only: ids (terrain or trick) players can't see yet. */
  hidden?: Set<string>
}

interface Icon {
  kind: ArtKind
  id: string
  name: string
}

export function RoomCard({ shape, size, lighting, exits, trueExit, terrain, tricks, hidden }: Props) {
  const shapeUrl = artUrl('shapes', shape)
  const icons: Icon[] = [
    ...terrain.map((id) => ({ kind: 'terrain' as const, id, name: terrainOf(id).name })),
    ...tricks.map((id) => ({ kind: 'tricks' as const, id, name: trickOf(id).name })),
  ].filter((i) => artUrl(i.kind, i.id))
  const exitIds = Array.from({ length: exits }, (_, i) => (i + 1 === trueExit ? 'true-exit' : 'exit'))
  const showExits = exitIds.some((id) => artUrl('exits', id))

  if (!shapeUrl && icons.length === 0 && !showExits) return null

  return (
    <figure className="room-card">
      {shapeUrl && (
        <div className={`room-banner light-${lighting}`}>
          <Art kind="shapes" id={shape} alt={shapeOf(shape).name} />
          <figcaption>
            {shapeOf(shape).name} · {sizeOf(size).feet} ft · {lightingName(lighting)}
          </figcaption>
        </div>
      )}
      {icons.length > 0 && (
        <ul className="room-icons">
          {icons.map((i) => (
            <li key={`${i.kind}-${i.id}`} className={hidden?.has(i.id) ? 'is-hidden' : undefined}>
              <Art kind={i.kind} id={i.id} alt={i.name} />
              <span>{i.name}</span>
            </li>
          ))}
        </ul>
      )}
      {showExits && (
        <ul className="room-icons room-exits">
          {exitIds.map((id, i) => (
            <li key={i}>
              <Art kind="exits" id={id} alt={id === 'true-exit' ? `Doorway ${i + 1}, true exit` : `Doorway ${i + 1}`} />
              <span>#{i + 1}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
