import type { NoteFolder, NoteSession } from './types'
import { sanitizeMetadataText } from './textSanitize'

export const FOLDERS_KEY = 'notes_folders'
export const FOLDERS_VAULT_SESSION_ID = '__notes_folders__'
export const ARCHIVE_FOLDER_NAME = 'Archive'

export function findArchiveFolder(folders: NoteFolder[]): NoteFolder | undefined {
  return folders.find(
    (f) =>
      f.parentId === null &&
      f.name.localeCompare(ARCHIVE_FOLDER_NAME, undefined, { sensitivity: 'accent' }) === 0,
  )
}

export function isArchiveFolder(folder: NoteFolder): boolean {
  return (
    folder.parentId === null &&
    folder.name.localeCompare(ARCHIVE_FOLDER_NAME, undefined, { sensitivity: 'accent' }) === 0
  )
}

/** Creates the root Archive folder when missing (used by Archive note). */
export function ensureArchiveFolder(): NoteFolder {
  const folders = loadFolders()
  const existing = findArchiveFolder(folders)
  if (existing) return existing
  return createFolder(ARCHIVE_FOLDER_NAME, null)
}

export function loadFolders(): NoteFolder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as NoteFolder[]
    return Array.isArray(arr) ? arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) : []
  } catch {
    return []
  }
}

export function saveFolders(folders: NoteFolder[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function createFolder(name: string, parentId: string | null = null): NoteFolder {
  const folders = loadFolders()
  const now = new Date().toISOString()
  const siblings = folders.filter((f) => f.parentId === parentId)
  const folder: NoteFolder = {
    id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: sanitizeMetadataText(name.trim() || 'New folder'),
    parentId,
    sortOrder: siblings.length,
    createdAt: now,
  }
  saveFolders([...folders, folder])
  return folder
}

export function deleteFolder(id: string, sessions: NoteSession[]): { folders: NoteFolder[]; sessions: NoteSession[] } {
  const toRemove = new Set<string>([id])
  const folders = loadFolders()
  let changed = true
  while (changed) {
    changed = false
    for (const f of folders) {
      if (f.parentId && toRemove.has(f.parentId) && !toRemove.has(f.id)) {
        toRemove.add(f.id)
        changed = true
      }
    }
  }
  const nextFolders = folders.filter((f) => !toRemove.has(f.id))
  const nextSessions = sessions.map((s) => {
    const fid = s.metadata?.folderId
    if (!fid || !toRemove.has(fid)) return s
    const metadata = { ...s.metadata }
    delete metadata.folderId
    return { ...s, metadata }
  })
  saveFolders(nextFolders)
  return { folders: nextFolders, sessions: nextSessions }
}

export function moveSessionToFolder(session: NoteSession, folderId: string | null): NoteSession {
  const metadata = { ...session.metadata }
  if (folderId) metadata.folderId = folderId
  else delete metadata.folderId
  return { ...session, metadata }
}

export function sessionsInFolder(sessions: NoteSession[], folderId: string | null): NoteSession[] {
  return sessions
    .filter((s) => (s.metadata?.folderId ?? null) === folderId)
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0))
}

export function childFolders(folders: NoteFolder[], parentId: string | null): NoteFolder[] {
  return folders.filter((f) => f.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

/** True when `maybeDescendantId` is `ancestorId` or nested under it. */
export function isFolderDescendant(folders: NoteFolder[], ancestorId: string, maybeDescendantId: string): boolean {
  if (ancestorId === maybeDescendantId) return true
  const byId = new Map(folders.map((f) => [f.id, f]))
  let cur: string | null = maybeDescendantId
  while (cur) {
    if (cur === ancestorId) return true
    cur = byId.get(cur)?.parentId ?? null
  }
  return false
}

export function moveFolder(folderId: string, newParentId: string | null): NoteFolder[] | null {
  const folders = loadFolders()
  if (newParentId === folderId) return null
  if (newParentId && isFolderDescendant(folders, folderId, newParentId)) return null

  const siblingCount = folders.filter((f) => f.parentId === newParentId && f.id !== folderId).length
  const next = folders.map((f) =>
    f.id === folderId ? { ...f, parentId: newParentId, sortOrder: siblingCount } : f,
  )
  saveFolders(next)
  return next
}

export function parseFoldersFromVaultNotes(notes: string): NoteFolder[] {
  try {
    const arr = JSON.parse(notes) as NoteFolder[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function foldersToVaultNotes(folders: NoteFolder[]): string {
  return JSON.stringify(folders)
}

export function mergeFolders(local: NoteFolder[], remote: NoteFolder[]): NoteFolder[] {
  const byId = new Map<string, NoteFolder>()
  for (const f of [...local, ...remote]) {
    const existing = byId.get(f.id)
    if (!existing || f.createdAt >= existing.createdAt) byId.set(f.id, f)
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

/** Replace local folder tree from server vault row (restore — no merge with stale local). */
export function replaceFoldersFromSessions(sessions: NoteSession[]): NoteFolder[] {
  const folders = foldersFromSessions(sessions)
  saveFolders(folders)
  return folders
}

function foldersFromSessions(sessions: NoteSession[]): NoteFolder[] {
  const row = sessions.find((s) => s.id === FOLDERS_VAULT_SESSION_ID)
  return row ? parseFoldersFromVaultNotes(row.notes) : []
}
