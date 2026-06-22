/**
 * UVIMCO Notes — localStorage + Supabase sync (mirrors daily-learn pattern).
 */

import { normalizeSessionTitle } from './prefs'
import type { NoteSession, Screenshot } from './types'

const USER_ID_KEY = 'uvimco_notes_user_id'
const SYNC_KEY = 'uvimco_notes_sync_key'
export const SESSIONS_KEY = 'uvimco_notes_sessions'
const ACTIVE_SESSION_KEY = 'uvimco_notes_active_session_id'

const PUSH_RETRIES = 3
const RETRY_DELAY_MS = 500

function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(USER_ID_KEY)
  if (!id) {
    id = genUuid()
    localStorage.setItem(USER_ID_KEY, id)
  }
  return id
}

export function getSyncKey(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(SYNC_KEY) ?? ''
}

export function setSyncKey(key: string): void {
  if (typeof window === 'undefined') return
  if (key.trim()) localStorage.setItem(SYNC_KEY, key.trim())
  else localStorage.removeItem(SYNC_KEY)
}

export function getEffectiveUserId(): string {
  const sk = getSyncKey()
  return sk || getOrCreateUserId()
}

export function createEmptySession(title?: string): NoteSession {
  const now = new Date().toISOString()
  const defaultTitle =
    title ??
    `Note ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return {
    id: genUuid(),
    title: defaultTitle,
    notes: '',
    lookups: [],
    screenshots: {},
    startedAt: now,
    updatedAt: now,
  }
}

export function loadSessions(): NoteSession[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(SESSIONS_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as NoteSession[]
    if (!Array.isArray(arr)) return []
    return arr
      .map((s) => ({ ...s, title: normalizeSessionTitle(s.title) }))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
  } catch {
    return []
  }
}

export function saveSessionsLocal(sessions: NoteSession[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

export function setActiveSessionId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_SESSION_KEY, id)
}

export function loadActiveSession(): NoteSession {
  const sessions = loadSessions()
  const activeId = getActiveSessionId()
  const found = activeId ? sessions.find((s) => s.id === activeId) : undefined
  if (found) return found
  if (sessions[0]) {
    setActiveSessionId(sessions[0].id)
    return sessions[0]
  }
  const fresh = createEmptySession()
  saveSessionsLocal([fresh])
  setActiveSessionId(fresh.id)
  return fresh
}

function mergeSessions(local: NoteSession[], remote: NoteSession[]): NoteSession[] {
  const byId = new Map<string, NoteSession>()
  for (const s of [...local, ...remote]) {
    const existing = byId.get(s.id)
    if (!existing || new Date(s.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(s.id, s)
    }
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
}

export function upsertSession(session: NoteSession): NoteSession {
  const updated = { ...session, updatedAt: new Date().toISOString() }
  const sessions = loadSessions()
  const idx = sessions.findIndex((s) => s.id === updated.id)
  if (idx >= 0) sessions[idx] = updated
  else sessions.unshift(updated)
  saveSessionsLocal(sessions)
  return updated
}

export async function fetchSessionsFromServer(): Promise<NoteSession[]> {
  const userId = getEffectiveUserId()
  const res = await fetch(`/api/uvimco-notes/sessions?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { sessions?: NoteSession[] }
  return Array.isArray(data.sessions) ? data.sessions : []
}

async function pushWithRetry(sessions: NoteSession[]): Promise<boolean> {
  const userId = getEffectiveUserId()
  const body = JSON.stringify({ userId, sessions })
  for (let i = 0; i < PUSH_RETRIES; i++) {
    const res = await fetch('/api/uvimco-notes/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) return true
    if (i < PUSH_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }
  return false
}

export async function syncWithServer(): Promise<{ sessions: NoteSession[]; pushOk: boolean }> {
  if (typeof window === 'undefined') return { sessions: loadSessions(), pushOk: true }
  const local = loadSessions()
  const remote = await fetchSessionsFromServer()
  const merged = mergeSessions(local, remote)
  const mergedJson = JSON.stringify(merged)
  if (localStorage.getItem(SESSIONS_KEY) !== mergedJson) {
    saveSessionsLocal(merged)
  }
  const pushOk = await pushWithRetry(merged)
  return { sessions: merged, pushOk }
}

export async function saveSessionToServer(session: NoteSession): Promise<boolean> {
  upsertSession(session)
  return pushWithRetry(loadSessions())
}

export function exportSessionMarkdown(session: NoteSession): string {
  const date = new Date(session.startedAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const actions = session.notes
    .split('\n')
    .filter((l) => /^\s*>/.test(l))
    .map((l) => l.replace(/^\s*>\s?/, ''))
  const lookupLines = session.lookups.flatMap((lk) => {
    const ans = lk.conversation.find((m) => m.role === 'assistant')?.content ?? ''
    const label = lk.type === 'word' ? `?${lk.query}` : `${lk.query}?`
    return ans ? [`**${label}** — ${ans}`] : []
  })

  return [
    `# Notes`,
    `Date: ${date}`,
    `Session: ${session.title}`,
    '',
    '---',
    '',
    '## Raw Notes',
    session.notes,
    '',
    '---',
    '',
    '## AI Lookups',
    lookupLines.length ? lookupLines.join('\n\n') : '_None_',
    '',
    '---',
    '',
    '## Action Items',
    actions.length ? actions.map((a) => `- ${a}`).join('\n') : '_None_',
  ].join('\n')
}

export type SessionPatch = Partial<
  Pick<NoteSession, 'title' | 'notes' | 'lookups' | 'screenshots'>
>

export function patchSession(id: string, patch: SessionPatch): NoteSession {
  const sessions = loadSessions()
  const idx = sessions.findIndex((s) => s.id === id)
  const base = idx >= 0 ? sessions[idx]! : createEmptySession()
  const updated: NoteSession = {
    ...base,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) sessions[idx] = updated
  else sessions.unshift(updated)
  saveSessionsLocal(sessions)
  return updated
}

export function deleteSession(sessionId: string): NoteSession | null {
  if (typeof window === 'undefined') return null
  const sessions = loadSessions().filter((s) => s.id !== sessionId)
  saveSessionsLocal(sessions)
  const next = sessions[0] ?? createEmptySession()
  if (sessions.length === 0) saveSessionsLocal([next])
  setActiveSessionId(next.id)
  return next
}

export async function deleteSessionOnServer(userId: string, sessionId: string): Promise<boolean> {
  const res = await fetch('/api/uvimco-notes/sessions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sessionId }),
  })
  return res.ok
}

export function stripScreenshotsForSync(screenshots: Record<string, Screenshot>): Record<string, Screenshot> {
  const out: Record<string, Screenshot> = {}
  for (const [k, v] of Object.entries(screenshots)) {
    if (v.base64.length > 200_000) continue
    out[k] = v
  }
  return out
}
