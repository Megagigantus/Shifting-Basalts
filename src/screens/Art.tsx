// Shows the picture for a data id if one has been added, otherwise nothing.
// Callers decide visibility: only pass ids the viewer is allowed to see.
import { artUrl, type ArtKind } from '../art'

interface Props {
  kind: ArtKind
  id: string
  /** Text for screen readers; usually the item's name. */
  alt: string
  className?: string
}

export function Art({ kind, id, alt, className }: Props) {
  const url = artUrl(kind, id)
  if (!url) return null
  return <img src={url} alt={alt} title={alt} className={`art art-${kind} ${className ?? ''}`.trim()} loading="lazy" />
}
