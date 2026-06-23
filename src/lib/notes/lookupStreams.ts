/** Per-lookup stream state for parallel AI requests. */

export type LookupStreamSlice = {
  text: string
  isStreaming: boolean
  error: string | null
}

export type LookupStreamMap = Record<string, LookupStreamSlice>

export function emptyStream(): LookupStreamSlice {
  return { text: '', isStreaming: false, error: null }
}

export function activeStreamCount(map: LookupStreamMap): number {
  return Object.values(map).filter((s) => s.isStreaming).length
}

export function anyStreaming(map: LookupStreamMap): boolean {
  return activeStreamCount(map) > 0
}

export function streamTextFor(
  map: LookupStreamMap,
  lookupId: string | null,
  fallbackFromConversation: string,
): string {
  if (!lookupId) return fallbackFromConversation
  const live = map[lookupId]
  if (live?.isStreaming || live?.text) return live.text
  return fallbackFromConversation
}

export function isLookupStreaming(map: LookupStreamMap, lookupId: string): boolean {
  return map[lookupId]?.isStreaming ?? false
}
