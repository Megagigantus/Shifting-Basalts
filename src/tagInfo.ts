// Hover text for boon tags. The wording lives in data/tag-info.json.
import tagInfoData from './data/tag-info.json'

const TAG_INFO: Record<string, string> = tagInfoData.tags

/** A one-line "what this tag is about" for a tooltip, or undefined if none is written. */
export function tagInfo(tag: string): string | undefined {
  const text = TAG_INFO[tag]
  return text ? `${tag}: ${text}` : undefined
}
