/**
 * Notes — localStorage + Supabase sync (mirrors daily-learn pattern).
 */

import { createEmptySessionId, getOrCreateUserId, stampDeviceOnMetadata } from './deviceIdentity'
import { saveGlossary } from './glossary'
import { normalizeSessionTitle } from './prefs'
import { ensureBuiltinSources } from './knowledge/builtinSources'
import { restoreMemoryBankFromServer } from './memorySync'
import { saveSourcesLocal } from './sources'
import { sanitizeMetadataText, sanitizeSessionForSync, sanitizeTags } from './textSanitize'
import {
  FOLDERS_KEY,
  FOLDERS_VAULT_SESSION_ID,
  foldersToVaultNotes,
  loadFolders,
  mergeFolders,
  parseFoldersFromVaultNotes,
  replaceFoldersFromSessions,
  saveFolders,
} from './folders'
import type { NoteFolder, NoteSession, Screenshot } from './types'

export { buildSessionMarkdown, exportSessionMarkdown } from './export'

const SYNC_KEY = 'notes_sync_key'
export const SESSIONS_KEY = 'notes_sessions'
const ACTIVE_SESSION_KEY = 'notes_active_session_id'

export { getOrCreateUserId } from './deviceIdentity'

const PUSH_RETRIES = 3
const RETRY_DELAY_MS = 500

export type PushResult = { ok: boolean; error?: string }

async function parseApiError(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) msg = data.error
  } catch {
    /* ignore */
  }
  return msg
}

/** Serialize sync/push so async fetch cannot merge against a stale local snapshot. */
let syncChain: Promise<void> = Promise.resolve()

function runSyncExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn)
  syncChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
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

/** Alias — UI uses "sync password". */
export const getSyncPassword = getSyncKey
export const setSyncPassword = setSyncKey

export function getEffectiveUserId(): string {
  const sk = getSyncKey()
  return sk || getOrCreateUserId()
}

export function createEmptySession(title?: string, folderId?: string | null): NoteSession {
  const now = new Date().toISOString()
  const defaultTitle = title ?? ''
  return {
    id: createEmptySessionId(),
    title: defaultTitle,
    notes: '',
    tags: [],
    metadata: folderId ? { folderId } : {},
    lookups: [],
    screenshots: {},
    startedAt: now,
    updatedAt: now,
    history: [{ kind: 'created', at: now, detail: defaultTitle || 'Untitled' }],
  }
}

function normalizeSession(s: NoteSession): NoteSession {
  return sanitizeSessionForSync({
    ...s,
    tags: sanitizeTags(Array.isArray(s.tags) ? s.tags : []),
    metadata: s.metadata ?? {},
    history: Array.isArray(s.history) ? s.history : [],
    title: sanitizeMetadataText(normalizeSessionTitle(s.title), 200),
    lookups: (s.lookups ?? []).map((lk) => ({
      ...lk,
      type: (lk.type as string) === 'section' ? 'section' : 'line',
    })),
  }) as NoteSession
}

function stripVaultRows(sessions: NoteSession[]): NoteSession[] {
  return sessions.filter((s) => s.id !== FOLDERS_VAULT_SESSION_ID)
}

function vaultRowFromFolders(folders: NoteFolder[]): NoteSession {
  const now = new Date().toISOString()
  return {
    id: FOLDERS_VAULT_SESSION_ID,
    title: '',
    notes: foldersToVaultNotes(folders),
    tags: [],
    metadata: {},
    lookups: [],
    screenshots: {},
    startedAt: now,
    updatedAt: now,
  }
}

function foldersFromSessions(sessions: NoteSession[]): NoteFolder[] {
  const row = sessions.find((s) => s.id === FOLDERS_VAULT_SESSION_ID)
  return row ? parseFoldersFromVaultNotes(row.notes) : []
}

export function syncFoldersFromSessions(sessions: NoteSession[]): NoteFolder[] {
  const remote = foldersFromSessions(sessions)
  const local = loadFolders()
  const merged = mergeFolders(local, remote)
  saveFolders(merged)
  return merged
}

export function sessionsForPush(sessions: NoteSession[]): NoteSession[] {
  const folders = loadFolders()
  return [...stripVaultRows(sessions), vaultRowFromFolders(folders)]
}

function withNormalizedTitles(sessions: NoteSession[]): NoteSession[] {
  return stripVaultRows(sessions.map(normalizeSession))
}

export function loadSessions(): NoteSession[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(SESSIONS_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as NoteSession[]
    if (!Array.isArray(arr)) return []
    const normalized = withNormalizedTitles(arr)
    const normalizedJson = JSON.stringify(normalized)
    if (raw !== normalizedJson) saveSessionsLocal(normalized)
    return normalized.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
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
  for (const s of withNormalizedTitles([...local, ...remote])) {
    const existing = byId.get(s.id)
    if (!existing || new Date(s.updatedAt) > new Date(existing.updatedAt)) {
      byId.set(s.id, s)
    }
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
}

export function touchSession(session: NoteSession): NoteSession {
  return { ...session, updatedAt: new Date().toISOString() }
}

/** True when in-memory session differs from persisted copy (content only — not history). */
export function isSessionDirty(session: NoteSession, baseline?: NoteSession): boolean {
  const stored = baseline ?? loadSessions().find((s) => s.id === session.id)
  if (!stored) return true
  return (
    stored.notes !== session.notes ||
    stored.title !== session.title ||
    JSON.stringify(stored.tags) !== JSON.stringify(session.tags) ||
    JSON.stringify(stored.metadata) !== JSON.stringify(session.metadata) ||
    JSON.stringify(stored.lookups) !== JSON.stringify(session.lookups) ||
    JSON.stringify(stored.screenshots) !== JSON.stringify(session.screenshots)
  )
}

/** Persist session as-is — preserves updatedAt unless caller already bumped it. */
export function upsertSession(session: NoteSession): NoteSession {
  const stamped: NoteSession = {
    ...session,
    metadata: stampDeviceOnMetadata(session.metadata),
  }
  const sessions = loadSessions()
  const idx = sessions.findIndex((s) => s.id === stamped.id)
  if (idx >= 0) sessions[idx] = stamped
  else sessions.unshift(stamped)
  saveSessionsLocal(sessions)
  return stamped
}

export function resetLocalNotesVault(): NoteSession {
  if (typeof window === 'undefined') return createEmptySession()
  localStorage.removeItem(FOLDERS_KEY)
  localStorage.removeItem('notes_tag_catalog')
  saveGlossary([])
  saveSourcesLocal(ensureBuiltinSources([]))
  const session = createEmptySession()
  saveSessionsLocal([session])
  setActiveSessionId(session.id)
  return session
}

async function fetchRawSessionsFromServer(
  userId: string,
  syncPasswordOverride?: string,
): Promise<{ sessions: NoteSession[]; error?: string }> {
  const deviceUserId = getOrCreateUserId()
  const qs = new URLSearchParams({ userId, deviceUserId })
  const syncPassword = syncPasswordOverride ?? getSyncKey()
  if (syncPassword) qs.set('syncPassword', syncPassword)
  try {
    const res = await fetch(`/api/notes/sessions?${qs.toString()}`)
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const data = (await res.json()) as { error?: string }
        if (data.error) msg = data.error
      } catch {
        /* ignore */
      }
      return { sessions: [], error: msg }
    }
    const data = (await res.json()) as { sessions?: NoteSession[] }
    const sessions = Array.isArray(data.sessions) ? data.sessions.map(normalizeSession) : []
    return { sessions }
  } catch {
    return { sessions: [], error: 'Network error — check connection' }
  }
}

export async function restoreFromServer(
  userId: string,
): Promise<{ restored: number; cleared?: boolean; error?: string }> {
  if (typeof window === 'undefined') return { restored: 0 }
  const key = userId.trim()
  if (!key) return { restored: 0, error: 'Enter sync password or device ID' }

  const { sessions: remoteRaw, error } = await fetchRawSessionsFromServer(key, key)
  if (error) return { restored: 0, error }

  setSyncKey(key)

  if (remoteRaw.length === 0) {
    resetLocalNotesVault()
    return { restored: 0, cleared: true }
  }

  // Server wins — wipe stale local vault artifacts before applying remote snapshot.
  localStorage.removeItem(FOLDERS_KEY)
  localStorage.removeItem('notes_tag_catalog')
  saveGlossary([])
  saveSourcesLocal(ensureBuiltinSources([]))

  replaceFoldersFromSessions(remoteRaw)
  const remote = withNormalizedTitles(remoteRaw)
  saveSessionsLocal(remote)
  if (remote[0]) setActiveSessionId(remote[0].id)
  await restoreMemoryBankFromServer()
  return { restored: remote.length }
}

export async function fetchSessionsFromServer(): Promise<NoteSession[]> {
  const { sessions } = await fetchRawSessionsFromServer(getEffectiveUserId())
  return withNormalizedTitles(sessions)
}

async function pushWithRetry(sessions: NoteSession[]): Promise<PushResult> {
  const userId = getEffectiveUserId()
  const deviceUserId = getOrCreateUserId()
  const toSend = sessionsForPush(sessions)
  const slim = toSend.map((s) => ({
    ...sanitizeSessionForSync(s),
    screenshots: stripScreenshotsForSync(s.screenshots),
  }))
  const body = JSON.stringify({
    userId,
    sessions: slim,
    deviceUserId,
    ...(getSyncKey() ? { syncPassword: getSyncKey() } : {}),
  })
  let lastError = 'Network error — check connection'
  for (let i = 0; i < PUSH_RETRIES; i++) {
    try {
      const res = await fetch('/api/notes/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok) return { ok: true }
      lastError = await parseApiError(res)
      if (res.status === 413) return { ok: false, error: lastError }
      if (res.status === 403) return { ok: false, error: lastError }
    } catch {
      lastError = 'Network error — check connection'
    }
    if (i < PUSH_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
  }
  return { ok: false, error: lastError }
}

export async function pushAllToServer(): Promise<PushResult> {
  return runSyncExclusive(() => pushWithRetry(loadSessions()))
}

export async function syncWithServer(): Promise<{
  sessions: NoteSession[]
  pushOk: boolean
  pushError?: string
}> {
  if (typeof window === 'undefined') return { sessions: loadSessions(), pushOk: true }
  return runSyncExclusive(async () => {
    const userId = getEffectiveUserId()
    const { sessions: remoteRaw } = await fetchRawSessionsFromServer(userId)
    const local = loadSessions()
    syncFoldersFromSessions([...local, ...remoteRaw])
    const merged = mergeSessions(local, remoteRaw)
    const mergedJson = JSON.stringify(merged)
    if (localStorage.getItem(SESSIONS_KEY) !== mergedJson) {
      saveSessionsLocal(merged)
    }
    const push = await pushWithRetry(merged)
    return {
      sessions: merged,
      pushOk: push.ok,
      ...(push.error ? { pushError: push.error } : {}),
    }
  })
}

export async function saveSessionToServer(session: NoteSession): Promise<PushResult> {
  return runSyncExclusive(async () => {
    upsertSession(session)
    return pushWithRetry(loadSessions())
  })
}

export type SessionPatch = Partial<
  Pick<NoteSession, 'title' | 'notes' | 'tags' | 'metadata' | 'lookups' | 'screenshots'>
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
    metadata: stampDeviceOnMetadata(patch.metadata ?? base.metadata),
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
  const res = await fetch('/api/notes/sessions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      sessionId,
      deviceUserId: getOrCreateUserId(),
      ...(getSyncKey() ? { syncPassword: getSyncKey() } : {}),
    }),
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
