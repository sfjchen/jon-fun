/** Cross-tab edit awareness — prevents stale pull from overwriting another tab's edits. */

const CHANNEL_NAME = 'sfjc-notes-tabs'
const TAB_ID =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`

type TabMsg = { from: string; kind: 'edit'; sessionId: string; until: number }

const remoteEditUntil = new Map<string, number>()

export function isRemoteEditing(sessionId: string): boolean {
  const until = remoteEditUntil.get(sessionId) ?? 0
  if (Date.now() >= until) {
    remoteEditUntil.delete(sessionId)
    return false
  }
  return true
}

export function notifyTabEditing(sessionId: string, idleMs: number): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
  const bc = new BroadcastChannel(CHANNEL_NAME)
  bc.postMessage({
    from: TAB_ID,
    kind: 'edit',
    sessionId,
    until: Date.now() + idleMs,
  } satisfies TabMsg)
  bc.close()
}

export function initNotesTabSync(onRemoteEdit?: (sessionId: string) => void): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return () => {}
  const bc = new BroadcastChannel(CHANNEL_NAME)
  bc.onmessage = (ev: MessageEvent<TabMsg>) => {
    const msg = ev.data
    if (!msg || msg.from === TAB_ID || msg.kind !== 'edit') return
    remoteEditUntil.set(msg.sessionId, msg.until)
    onRemoteEdit?.(msg.sessionId)
  }
  return () => bc.close()
}
