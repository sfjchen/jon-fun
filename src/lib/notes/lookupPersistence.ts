import type { Lookup } from './types'

/** Newest lookup ids first — matches sessionHistory ordering. */
export function lookupIdsNewestFirst(lookups: Lookup[]): string[] {
  return [...lookups]
    .sort((a, b) => (b.triggeredAt > a.triggeredAt ? 1 : b.triggeredAt < a.triggeredAt ? -1 : 0))
    .map((l) => l.id)
}

/** Merge lookup arrays by id — prefer longer conversation, then newer triggeredAt. */
export function mergeSessionLookups(local: Lookup[], remote: Lookup[]): Lookup[] {
  const byId = new Map<string, Lookup>()
  for (const lk of [...local, ...remote]) {
    const existing = byId.get(lk.id)
    if (!existing) {
      byId.set(lk.id, lk)
      continue
    }
    const pickNew =
      lk.conversation.length > existing.conversation.length ||
      (lk.conversation.length === existing.conversation.length &&
        lk.triggeredAt >= existing.triggeredAt)
    if (pickNew) byId.set(lk.id, lk)
  }
  return lookupIdsNewestFirst([...byId.values()]).map((id) => byId.get(id)!)
}

export function findLookupOwnerSessionId(
  sessions: { id: string; lookups: Lookup[] }[],
  activeSessionId: string,
  lookupId: string,
): string | null {
  if (sessions.some((s) => s.id === activeSessionId && s.lookups.some((l) => l.id === lookupId))) {
    return activeSessionId
  }
  const owner = sessions.find((s) => s.lookups.some((l) => l.id === lookupId))
  return owner?.id ?? null
}
