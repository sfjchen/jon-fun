'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { assembleClientContextAsync } from '@/lib/notes/contextAssembler'
import {
  formatSplitFullNotes,
  mergeSplitEditorContext,
  mergeSplitTags,
  mergeSplitTitle,
  splitCompanionSession,
} from '@/lib/notes/splitContext'
import { applyAgentActions, parseAgentResponse } from '@/lib/notes/agentActions'
import { findGlossaryEntry, formatGlossaryForPrompt, upsertFromLookup } from '@/lib/notes/glossary'
import {
  activeStreamCount,
  anyStreaming,
  emptyStream,
  isLookupStreaming,
  type LookupStreamMap,
} from '@/lib/notes/lookupStreams'
import {
  findLookupOwnerSessionId,
  lookupIdsNewestFirst,
} from '@/lib/notes/lookupPersistence'
import { pushGlossaryToServer, syncMemoryBank } from '@/lib/notes/memorySync'
import { countShorthandFlags, setTodoArchivedAtLine } from '@/lib/notes/shorthand'
import { appendNoteHistory, lastHistoryEntry } from '@/lib/notes/noteHistory'
import { addToTagCatalog } from '@/lib/notes/tagRegistry'
import {
  createFolder,
  deleteFolder,
  ensureArchiveFolder,
  isArchiveFolder,
  loadFolders,
  moveFolder,
  moveSessionToFolder,
} from '@/lib/notes/folders'
import { NOTES_DESKTOP_MIN_MQ, isNotesMobileViewport } from '@/lib/notes/device'
import { useNotesDevice } from '@/lib/notes/useNotesDevice'
import { isNotesEditorTarget, isNotesTextFieldTarget } from '@/lib/notes/shortcuts'
import { streamLookup } from '@/lib/notes/streamClient'
import { loadNotesUiPrefs, saveNotesUiPrefs, normalizeSessionTitle } from '@/lib/notes/prefs'
import { initNotesTabSync, isRemoteEditing, notifyTabEditing } from '@/lib/notes/notesTabSync'
import { sanitizeMetadataText, sanitizeTags } from '@/lib/notes/textSanitize'
import { downloadSessionMarkdown, downloadSessionPdf } from '@/lib/notes/export'
import {
  createEmptySession,
  deleteSession,
  deleteSessionOnServer,
  getActiveSessionId,
  getEffectiveUserId,
  getOrCreateUserId,
  loadActiveSession,
  loadSessions,
  pushAllToServer,
  saveSessionToServer,
  saveSessionsLocal,
  SESSIONS_KEY,
  setActiveSessionId,
  syncWithServer,
  isSessionDirty,
  touchSession,
  upsertSession,
} from '@/lib/notes/storage'
import { toggleSourceForNote } from '@/lib/notes/sourceSelection'
import SidePanel from './SidePanel'
import EditorShell from './EditorShell'
import type { NoteEditorHandle } from './EditorShell'
import NotesSplitView from './NotesSplitView'
import StatusBar from './StatusBar'
import NotesTopBar, { loadHintsOpen, persistHintsOpen } from './NotesTopBar'
import GlobalSearch from './GlobalSearch'
import type { Lookup, NoteFolder, NoteHistoryKind, NoteSession, Screenshot, TriggerType } from '@/lib/notes/types'

type State = {
  session: NoteSession
  sessions: NoteSession[]
  panelOpen: boolean
  notesListOpen: boolean
  aiListOpen: boolean
  syncOpen: boolean
  glossaryOpen: boolean
  sourcesOpen: boolean
  historyOpen: boolean
  rollupOpen: boolean
  openLookupIds: string[]
  sessionHistory: Lookup[]
  streamByLookupId: LookupStreamMap
  syncOk: boolean | null
  syncKind: 'saved' | 'synced' | null
  syncError: string | null
  glossaryRefreshKey: number
  splitSessionId: string | null
}

type Action =
  | { type: 'SET_SESSIONS'; sessions: NoteSession[] }
  | { type: 'NOTES'; notes: string }
  | { type: 'TITLE'; title: string }
  | { type: 'TAGS'; tags: string[]; recordHistory?: boolean }
  | { type: 'METADATA'; metadata: NoteSession['metadata'] }
  | { type: 'PATCH_SESSION'; session: NoteSession }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'PANEL'; open: boolean }
  | { type: 'NOTES_LIST'; open: boolean }
  | { type: 'AI_LIST'; open: boolean }
  | { type: 'SYNC_OPEN'; open: boolean }
  | { type: 'GLOSSARY_OPEN'; open: boolean }
  | { type: 'SOURCES_OPEN'; open: boolean }
  | { type: 'HISTORY_OPEN'; open: boolean }
  | { type: 'ROLLUP_OPEN'; open: boolean }
  | { type: 'LOOKUP_START'; lookup: Lookup; openPanel?: boolean }
  | { type: 'STREAM'; lookupId: string; text: string }
  | { type: 'STREAM_DONE'; lookupId: string; assistantText: string; skipGlossaryAuto?: boolean }
  | { type: 'STREAM_ERROR'; lookupId: string; message: string }
  | { type: 'SELECT_LOOKUP'; lookup: Lookup }
  | { type: 'DELETE_LOOKUP'; lookupId: string }
  | { type: 'SYNC_OK'; ok: boolean; kind?: 'saved' | 'synced'; error?: string | null }
  | { type: 'LOAD_SESSION'; session: NoteSession; preserveAi?: boolean }
  | { type: 'CLEAR_LOOKUP' }
  | { type: 'DISMISS_LOOKUP'; lookupId: string }
  | { type: 'GLOSSARY_BUMP' }
  | { type: 'SPLIT_OPEN'; sessionId: string }
  | { type: 'SPLIT_CLOSE' }
  | { type: 'SESSION_NOTES'; sessionId: string; notes: string }
  | { type: 'SESSION_TITLE'; sessionId: string; title: string }
  | { type: 'SESSION_TAGS'; sessionId: string; tags: string[] }

function initState(): State {
  const prefs = typeof window !== 'undefined' ? loadNotesUiPrefs() : {}
  const desktop =
    typeof window !== 'undefined' && window.matchMedia(NOTES_DESKTOP_MIN_MQ).matches
  const initial = loadActiveSession()
  const bootSessions = loadSessions()
  const splitId = prefs.splitSessionId ?? null
  const validSplit =
    splitId && bootSessions.some((s) => s.id === splitId) ? splitId : null
  return {
    session: initial,
    sessions: bootSessions.length > 0 ? bootSessions : [initial],
    panelOpen: prefs.panelOpen ?? desktop,
    notesListOpen: prefs.notesListOpen ?? false,
    aiListOpen: true,
    syncOpen: prefs.syncOpen ?? false,
    glossaryOpen: false,
    sourcesOpen: false,
    historyOpen: false,
    rollupOpen: prefs.rollupOpen ?? true,
    openLookupIds: lookupIdsNewestFirst(initial.lookups),
    sessionHistory: [...initial.lookups].reverse(),
    streamByLookupId: {},
    syncOk: null,
    syncKind: null,
    syncError: null,
    glossaryRefreshKey: 0,
    splitSessionId: validSplit,
  }
}

function upsertLookupInSession(session: NoteSession, lookup: Lookup): NoteSession {
  const lookups = [...session.lookups.filter((l) => l.id !== lookup.id), lookup]
  return { ...session, lookups }
}

function prependOpenLookup(openIds: string[], lookupId: string): string[] {
  return [lookupId, ...openIds.filter((id) => id !== lookupId)]
}

function resolveLookup(session: NoteSession, history: Lookup[], id: string): Lookup | null {
  return session.lookups.find((l) => l.id === id) ?? history.find((l) => l.id === id) ?? null
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }
    case 'NOTES': {
      const session = touchSession({ ...state.session, notes: action.notes })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'TITLE': {
      const session = touchSession({
        ...state.session,
        title: sanitizeMetadataText(normalizeSessionTitle(action.title), 200),
      })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'TAGS': {
      const cleanTags = sanitizeTags(action.tags)
      let session = { ...state.session, tags: cleanTags }
      if (action.recordHistory) {
        session = appendNoteHistory(session, { kind: 'tags', detail: cleanTags.join(', ') })
      }
      for (const t of cleanTags) addToTagCatalog(t)
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'METADATA': {
      const session: NoteSession = { ...state.session, metadata: action.metadata ?? {} }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'PATCH_SESSION': {
      const sessions = state.sessions.map((s) => (s.id === action.session.id ? action.session : s))
      return {
        ...state,
        session: state.session.id === action.session.id ? action.session : state.session,
        sessions,
      }
    }
    case 'PANEL_TOGGLE':
      return { ...state, panelOpen: !state.panelOpen }
    case 'PANEL':
      return { ...state, panelOpen: action.open }
    case 'NOTES_LIST':
      return { ...state, notesListOpen: action.open }
    case 'AI_LIST':
      return { ...state, aiListOpen: action.open }
    case 'SYNC_OPEN':
      return { ...state, syncOpen: action.open }
    case 'GLOSSARY_OPEN':
      return { ...state, glossaryOpen: action.open }
    case 'SOURCES_OPEN':
      return { ...state, sourcesOpen: action.open }
    case 'HISTORY_OPEN':
      return { ...state, historyOpen: action.open }
    case 'ROLLUP_OPEN':
      return { ...state, rollupOpen: action.open }
    case 'LOOKUP_START': {
      const session = upsertLookupInSession(state.session, action.lookup)
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      const sessionHistory = [
        action.lookup,
        ...state.sessionHistory.filter((l) => l.id !== action.lookup.id),
      ]
      return {
        ...state,
        session,
        sessions,
        sessionHistory,
        openLookupIds: prependOpenLookup(state.openLookupIds, action.lookup.id),
        streamByLookupId: {
          ...state.streamByLookupId,
          [action.lookup.id]: { text: '', isStreaming: true, error: null },
        },
        panelOpen: action.openPanel !== false ? true : state.panelOpen,
        aiListOpen: true,
      }
    }
    case 'STREAM':
      return {
        ...state,
        streamByLookupId: {
          ...state.streamByLookupId,
          [action.lookupId]: {
            ...(state.streamByLookupId[action.lookupId] ?? emptyStream()),
            text: action.text,
            isStreaming: true,
          },
        },
      }
    case 'STREAM_DONE': {
      const ownerSessionId =
        findLookupOwnerSessionId(state.sessions, state.session.id, action.lookupId) ??
        state.session.id
      const ownerSession =
        state.sessions.find((s) => s.id === ownerSessionId) ??
        (ownerSessionId === state.session.id ? state.session : null)
      const base =
        ownerSession?.lookups.find((l) => l.id === action.lookupId) ??
        resolveLookup(state.session, state.sessionHistory, action.lookupId)
      if (!base || !action.assistantText.trim()) {
        const nextMap = { ...state.streamByLookupId }
        if (nextMap[action.lookupId]) nextMap[action.lookupId] = { ...nextMap[action.lookupId]!, isStreaming: false }
        return { ...state, streamByLookupId: nextMap }
      }
      const lookup: Lookup = {
        ...base,
        conversation: [...base.conversation, { role: 'assistant', content: action.assistantText }],
      }
      const updatedOwner = touchSession(upsertLookupInSession(ownerSession ?? state.session, lookup))
      if (!action.skipGlossaryAuto && ownerSessionId === state.session.id) {
        upsertFromLookup(lookup, updatedOwner.id)
      }
      const sessions = state.sessions.map((s) => (s.id === ownerSessionId ? updatedOwner : s))
      const isActiveOwner = ownerSessionId === state.session.id
      const session = isActiveOwner ? updatedOwner : state.session
      const sessionHistory = isActiveOwner
        ? [lookup, ...state.sessionHistory.filter((l) => l.id !== lookup.id)]
        : state.sessionHistory
      const nextMap = { ...state.streamByLookupId }
      nextMap[action.lookupId] = { text: action.assistantText, isStreaming: false, error: null }
      return {
        ...state,
        sessionHistory,
        session,
        sessions,
        streamByLookupId: nextMap,
        glossaryRefreshKey: state.glossaryRefreshKey + 1,
      }
    }
    case 'STREAM_ERROR': {
      const prev = state.streamByLookupId[action.lookupId] ?? emptyStream()
      return {
        ...state,
        streamByLookupId: {
          ...state.streamByLookupId,
          [action.lookupId]: { ...prev, isStreaming: false, error: action.message },
        },
      }
    }
    case 'SELECT_LOOKUP': {
      const lookup = state.session.lookups.find((l) => l.id === action.lookup.id) ?? action.lookup
      return {
        ...state,
        openLookupIds: prependOpenLookup(state.openLookupIds, lookup.id),
        aiListOpen: true,
      }
    }
    case 'DELETE_LOOKUP': {
      const lookups = state.session.lookups.filter((l) => l.id !== action.lookupId)
      const session = { ...state.session, lookups }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      const sessionHistory = state.sessionHistory.filter((l) => l.id !== action.lookupId)
      const nextMap = { ...state.streamByLookupId }
      delete nextMap[action.lookupId]
      return {
        ...state,
        session,
        sessions,
        sessionHistory,
        streamByLookupId: nextMap,
        openLookupIds: state.openLookupIds.filter((id) => id !== action.lookupId),
      }
    }
    case 'SYNC_OK':
      return {
        ...state,
        syncOk: action.ok,
        syncKind: action.ok ? (action.kind ?? 'saved') : null,
        syncError: action.ok ? null : (action.error ?? null),
      }
    case 'LOAD_SESSION': {
      const preserveAi = action.preserveAi && anyStreaming(state.streamByLookupId)
      const splitSessionId =
        state.splitSessionId === action.session.id ? null : state.splitSessionId
      const sessionLookupIds = new Set(action.session.lookups.map((l) => l.id))
      let openLookupIds = lookupIdsNewestFirst(action.session.lookups)
      let streamByLookupId: LookupStreamMap = {}
      if (preserveAi) {
        const keptOpen = state.openLookupIds.filter((id) => sessionLookupIds.has(id))
        openLookupIds = keptOpen.length > 0 ? keptOpen : openLookupIds
        for (const [id, stream] of Object.entries(state.streamByLookupId)) {
          if (sessionLookupIds.has(id)) streamByLookupId[id] = stream
        }
      }
      return {
        ...state,
        session: action.session,
        splitSessionId,
        sessionHistory: [...action.session.lookups].reverse(),
        openLookupIds,
        streamByLookupId,
      }
    }
    case 'CLEAR_LOOKUP':
      return { ...state, openLookupIds: [] }
    case 'DISMISS_LOOKUP':
      return {
        ...state,
        openLookupIds: state.openLookupIds.filter((id) => id !== action.lookupId),
      }
    case 'GLOSSARY_BUMP':
      return { ...state, glossaryRefreshKey: state.glossaryRefreshKey + 1 }
    case 'SPLIT_OPEN': {
      if (action.sessionId === state.session.id) return state
      const exists = state.sessions.some((s) => s.id === action.sessionId)
      if (!exists) return state
      return { ...state, splitSessionId: action.sessionId }
    }
    case 'SPLIT_CLOSE':
      return state.splitSessionId ? { ...state, splitSessionId: null } : state
    case 'SESSION_NOTES': {
      const target = state.sessions.find((s) => s.id === action.sessionId)
      if (!target) return state
      const session = touchSession({ ...target, notes: action.notes })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return {
        ...state,
        sessions,
        session: state.session.id === session.id ? session : state.session,
      }
    }
    case 'SESSION_TITLE': {
      const target = state.sessions.find((s) => s.id === action.sessionId)
      if (!target) return state
      const session = touchSession({
        ...target,
        title: sanitizeMetadataText(normalizeSessionTitle(action.title), 200),
      })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return {
        ...state,
        sessions,
        session: state.session.id === session.id ? session : state.session,
      }
    }
    case 'SESSION_TAGS': {
      const target = state.sessions.find((s) => s.id === action.sessionId)
      if (!target) return state
      const session = touchSession({ ...target, tags: sanitizeTags(action.tags) })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return {
        ...state,
        sessions,
        session: state.session.id === session.id ? session : state.session,
      }
    }
    default:
      return state
  }
}

function screenshotsInContext(notes: string, shots: Record<string, Screenshot>): Screenshot[] {
  const out: Screenshot[] = []
  for (const [id, shot] of Object.entries(shots)) {
    if (notes.includes(id)) out.push(shot)
  }
  return out
}

export default function NotesApp() {
  const { isMobile } = useNotesDevice()
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [folders, setFolders] = useState<NoteFolder[]>(() =>
    typeof window !== 'undefined' ? loadFolders() : [],
  )
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['__inbox__']
    return loadNotesUiPrefs().expandedFolderIds ?? ['__inbox__']
  })
  const [pdfExportBusy, setPdfExportBusy] = useState(false)
  const [dictToast, setDictToast] = useState<string | null>(null)
  const dictToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [splitRatio, setSplitRatio] = useState(() => {
    const r = typeof window !== 'undefined' ? loadNotesUiPrefs().splitRatio : undefined
    return typeof r === 'number' && r >= 0.25 && r <= 0.75 ? r : 0.5
  })
  const editorRef = useRef<NoteEditorHandle>(null)
  const secondaryEditorRef = useRef<NoteEditorHandle>(null)
  const streamBufs = useRef<Record<string, string>>({})
  const rafByLookup = useRef<Record<string, number>>({})

  useEffect(() => {
    getOrCreateUserId()
    setHintsOpen(loadHintsOpen())
    return initNotesTabSync()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(NOTES_DESKTOP_MIN_MQ)
    const fn = () => {
      dispatch({ type: 'PANEL', open: mq.matches })
      if (!mq.matches) dispatch({ type: 'SPLIT_CLOSE' })
    }
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    saveNotesUiPrefs({
      panelOpen: state.panelOpen,
      notesListOpen: state.notesListOpen,
      rollupOpen: state.rollupOpen,
      syncOpen: state.syncOpen,
      splitSessionId: state.splitSessionId,
      splitRatio,
    })
  }, [state.panelOpen, state.notesListOpen, state.rollupOpen, state.syncOpen, state.splitSessionId, splitRatio])

  const sessionRef = useRef(state.session)
  const sessionsRef = useRef(state.sessions)
  const splitSessionIdRef = useRef(state.splitSessionId)
  const streamRef = useRef(state.streamByLookupId)
  /** Min ms between background server pulls (visibility, periodic, debounced save). */
  const BACKGROUND_PULL_MIN_MS = 30_000
  const PERIODIC_VISIBLE_MS = 5 * 60_000
  const PERIODIC_HIDDEN_MS = 60 * 60_000
  /** Skip remote overwrite while user is typing (extends on each keystroke). */
  const EDIT_IDLE_MS = 1500
  const lastPullAtRef = useRef(0)
  const hiddenAtRef = useRef<number | null>(null)
  const pullingRef = useRef(false)
  const editIdleUntilRef = useRef(0)
  const syncInFlightRef = useRef(false)
  const pendingSyncRef = useRef(false)
  sessionRef.current = state.session
  sessionsRef.current = state.sessions
  splitSessionIdRef.current = state.splitSessionId
  streamRef.current = state.streamByLookupId

  const bumpEditActivity = useCallback(() => {
    editIdleUntilRef.current = Date.now() + EDIT_IDLE_MS
    notifyTabEditing(sessionRef.current.id, EDIT_IDLE_MS)
  }, [])

  const isActivelyEditing = useCallback(() => Date.now() < editIdleUntilRef.current, [])

  const flushEditorNotes = useCallback((sessionId: string): string | null => {
    if (sessionId === sessionRef.current.id) {
      return editorRef.current?.flushPendingChanges() ?? null
    }
    if (sessionId === splitSessionIdRef.current) {
      return secondaryEditorRef.current?.flushPendingChanges() ?? null
    }
    return null
  }, [])

  const commitFlushedNotes = useCallback((sessionId: string, notes: string): NoteSession => {
    const target = sessionsRef.current.find((s) => s.id === sessionId) ?? sessionRef.current
    const session = touchSession({ ...target, notes })
    upsertSession(session)
    const nextSessions = sessionsRef.current.map((s) => (s.id === sessionId ? session : s))
    sessionsRef.current = nextSessions
    if (sessionId === sessionRef.current.id) {
      sessionRef.current = session
      dispatch({ type: 'NOTES', notes })
    } else {
      dispatch({ type: 'SESSION_NOTES', sessionId, notes })
    }
    return session
  }, [])

  const flushAndCommitEditor = useCallback(
    (sessionId: string): NoteSession | null => {
      const notes = flushEditorNotes(sessionId)
      if (notes == null) return null
      const target = sessionsRef.current.find((s) => s.id === sessionId)
      if (!target || target.notes === notes) return null
      return commitFlushedNotes(sessionId, notes)
    },
    [flushEditorNotes, commitFlushedNotes],
  )

  const flushAllEditors = useCallback(() => {
    flushAndCommitEditor(sessionRef.current.id)
    const splitId = splitSessionIdRef.current
    if (splitId) flushAndCommitEditor(splitId)
  }, [flushAndCommitEditor])

  const persistLocal = useCallback((session: NoteSession) => {
    upsertSession(session)
    const sessions = loadSessions()
    dispatch({ type: 'SET_SESSIONS', sessions })
  }, [])

  const commitSession = useCallback((session: NoteSession) => {
    upsertSession(session)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    if (session.id === sessionRef.current.id) {
      dispatch({ type: 'PATCH_SESSION', session })
    }
  }, [])

  const reloadLocalVault = useCallback(() => {
    const sessions = loadSessions()
    const active = loadActiveSession()
    dispatch({ type: 'SET_SESSIONS', sessions })
    setFolders(loadFolders())
    dispatch({ type: 'LOAD_SESSION', session: active })
    dispatch({ type: 'GLOSSARY_BUMP' })
  }, [])

  const applyServerSync = useCallback(async (opts?: { skipPersist?: boolean }) => {
    if (!opts?.skipPersist) persistLocal(sessionRef.current)
    const r = await syncWithServer()
    lastPullAtRef.current = Date.now()
    const mem = await syncMemoryBank()
    dispatch({ type: 'GLOSSARY_BUMP' })
    const inMem = sessionRef.current
    const preserveAi = anyStreaming(streamRef.current)
    const active = loadActiveSession()
    const sameSession = inMem.id === active.id
    const activeDirty = sameSession && isSessionDirty(inMem)
    const editing = isActivelyEditing()
    const remoteEditing = isRemoteEditing(inMem.id)
    const protectActive = sameSession && (activeDirty || editing || remoteEditing)

    let sessions = r.sessions
    if (protectActive) {
      sessions = r.sessions.map((s) => (s.id === inMem.id ? inMem : s))
      upsertSession(inMem)
    }
    dispatch({ type: 'SET_SESSIONS', sessions })
    setFolders(loadFolders())

    const mergedActive = r.sessions.find((s) => s.id === active.id) ?? active
    const remoteNewer =
      mergedActive.id === inMem.id &&
      new Date(mergedActive.updatedAt).getTime() > new Date(inMem.updatedAt).getTime()
    const contentDiffers =
      mergedActive.notes !== inMem.notes || mergedActive.title !== inMem.title

    if (!preserveAi && !protectActive && (remoteNewer || contentDiffers)) {
      dispatch({
        type: 'LOAD_SESSION',
        session: mergedActive,
        preserveAi,
      })
      setActiveSessionId(mergedActive.id)
    }

    const ok = r.pushOk && mem.glossaryOk && mem.sourcesOk
    const syncError = !r.pushOk ? (r.pushError ?? null) : !mem.glossaryOk || !mem.sourcesOk ? 'Dictionary or sources sync failed' : null
    dispatch({ type: 'SYNC_OK', ok, kind: 'synced', error: syncError })
    return r
  }, [persistLocal, isActivelyEditing])

  const shouldBackgroundPull = useCallback((force?: boolean) => {
    if (force) return true
    const now = Date.now()
    if (now - lastPullAtRef.current >= BACKGROUND_PULL_MIN_MS) return true
    const hiddenAt = hiddenAtRef.current
    return hiddenAt != null && now - hiddenAt >= BACKGROUND_PULL_MIN_MS
  }, [])

  const refreshFromServer = useCallback(
    async (opts?: { skipPersist?: boolean; force?: boolean; reloadLocal?: boolean }) => {
      if (opts?.reloadLocal) {
        reloadLocalVault()
        return undefined
      }
      if (!opts?.force && isActivelyEditing()) return undefined
      if (!shouldBackgroundPull(opts?.force)) return undefined
      if (pullingRef.current) {
        pendingSyncRef.current = true
        return undefined
      }
      pullingRef.current = true
      try {
        const syncOpts = opts?.skipPersist ? { skipPersist: true as const } : undefined
        return await applyServerSync(syncOpts)
      } finally {
        pullingRef.current = false
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false
          if (!isActivelyEditing()) {
            void refreshFromServer(opts?.force ? { force: true } : undefined)
          }
        }
      }
    },
    [applyServerSync, shouldBackgroundPull, isActivelyEditing, reloadLocalVault],
  )

  const syncToServer = useCallback(
    async (session: NoteSession, opts?: { forcePull?: boolean }) => {
      if (syncInFlightRef.current) {
        pendingSyncRef.current = true
        upsertSession(session)
        return { sessions: loadSessions(), pushOk: true }
      }
      syncInFlightRef.current = true
      try {
        upsertSession(session)
        const pullDue = shouldBackgroundPull(opts?.forcePull) && !isActivelyEditing()
        if (pullDue) {
          const pullOpts = opts?.forcePull
            ? ({ skipPersist: false as const, force: true as const })
            : ({ skipPersist: false as const })
          const r = await refreshFromServer(pullOpts)
          if (r) return r
        }
        const push = await saveSessionToServer(session)
        dispatch({
          type: 'SYNC_OK',
          ok: push.ok,
          kind: 'saved',
          error: push.ok ? null : (push.error ?? null),
        })
        return { sessions: loadSessions(), pushOk: push.ok, pushError: push.error }
      } finally {
        syncInFlightRef.current = false
        if (pendingSyncRef.current) {
          pendingSyncRef.current = false
          void syncToServer(sessionRef.current)
        }
      }
    },
    [refreshFromServer, shouldBackgroundPull, isActivelyEditing],
  )

  const syncAllToServer = useCallback(
    async (opts?: { forcePull?: boolean }) => {
      persistLocal(sessionRef.current)
      const pullDue = shouldBackgroundPull(opts?.forcePull) && !isActivelyEditing()
      if (pullDue) {
        const pullOpts = opts?.forcePull
          ? ({ skipPersist: false as const, force: true as const })
          : ({ skipPersist: false as const })
        const r = await refreshFromServer(pullOpts)
        if (r) return r
      }
      const push = await pushAllToServer()
      dispatch({
        type: 'SYNC_OK',
        ok: push.ok,
        kind: 'saved',
        error: push.ok ? null : (push.error ?? null),
      })
      return { sessions: loadSessions(), pushOk: push.ok, pushError: push.error }
    },
    [persistLocal, refreshFromServer, shouldBackgroundPull, isActivelyEditing],
  )

  const saveWithHistory = useCallback(
    async (kind: NoteHistoryKind, detail?: string, doSync = false) => {
      flushAllEditors()
      let session = appendNoteHistory(sessionRef.current, { kind, ...(detail ? { detail } : {}) })
      commitSession(session)
      if (!doSync) return
      setSaving(true)
      const r = await syncToServer(session, { forcePull: true })
      if (r?.pushOk) {
        session = appendNoteHistory(session, { kind: 'synced' })
        commitSession(session)
      }
      setSaving(false)
    },
    [commitSession, flushAllEditors, syncToServer],
  )

  useEffect(() => {
    setSyncing(true)
    refreshFromServer({ force: true }).finally(() => setSyncing(false))
  }, [refreshFromServer])

  useEffect(() => {
    persistLocal(state.session)
  }, [state.session, persistLocal])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSIONS_KEY || e.newValue == null) return
      try {
        const sessions = loadSessions()
        dispatch({ type: 'SET_SESSIONS', sessions })
        const activeId = getActiveSessionId()
        if (!activeId || sessions.some((s) => s.id === activeId)) return
        const next = loadActiveSession()
        dispatch({ type: 'LOAD_SESSION', session: next })
      } catch {
        /* ignore corrupt cross-tab payload */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    setSaving(true)
    const t = setTimeout(() => {
      void syncToServer(state.session).finally(() => setSaving(false))
    }, 800)
    return () => clearTimeout(t)
  }, [state.session, syncToServer])

  const secondarySession = state.splitSessionId
    ? state.sessions.find((s) => s.id === state.splitSessionId) ?? null
    : null

  useEffect(() => {
    if (!secondarySession) return
    const t = setTimeout(() => {
      void syncToServer(secondarySession)
    }, 800)
    return () => clearTimeout(t)
  }, [secondarySession, syncToServer])

  useEffect(() => {
    const fn = () => {
      flushAllEditors()
      const session = appendNoteHistory(sessionRef.current, { kind: 'saved', detail: 'tab close' })
      upsertSession(session)
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveWithHistory('saved', 'tab hidden', true)
    }
    window.addEventListener('beforeunload', fn)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', fn)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flushAllEditors, saveWithHistory])

  useEffect(() => {
    let id: number | undefined
    const schedule = () => {
      if (id != null) clearInterval(id)
      const ms =
        document.visibilityState === 'visible' ? PERIODIC_VISIBLE_MS : PERIODIC_HIDDEN_MS
      id = window.setInterval(() => void refreshFromServer(), ms)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      void refreshFromServer()
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      if (id != null) clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshFromServer])

  const runStream = useCallback(
    async (opts: {
      lookupId: string
      type: TriggerType
      query: string
      context: string
      conversation: Lookup['conversation']
      mode?: 'lookup' | 'followup' | 'decode' | 'agent'
      followUpQuestion?: string
      extraScreenshots?: Screenshot[]
    }) => {
      streamBufs.current[opts.lookupId] = ''

      const companion = splitCompanionSession(
        sessionRef.current,
        sessionsRef.current,
        splitSessionIdRef.current,
      )

      const ctx = await assembleClientContextAsync({
        query: opts.query,
        activeSession: sessionRef.current,
        allSessions: sessionsRef.current,
        ...(companion ? { companionSession: companion } : {}),
      })

      const agentMode = opts.mode === 'agent' || opts.mode === 'followup'
      const glossaryBlock = agentMode ? formatGlossaryForPrompt(40) : ctx.glossaryBlock

      const withDomain: NoteSession = {
        ...sessionRef.current,
        metadata: { ...sessionRef.current.metadata, inferredDomain: ctx.domainId },
      }
      commitSession(withDomain)

      const noteShots = screenshotsInContext(withDomain.notes, withDomain.screenshots)
      const companionShots = companion
        ? screenshotsInContext(companion.notes, companion.screenshots)
        : []
      const screenshots = [...noteShots, ...companionShots, ...(opts.extraScreenshots ?? [])]

      const mergedFullNotes = formatSplitFullNotes(withDomain, companion)
      const mergedTitle = mergeSplitTitle(withDomain, companion)
      const mergedTags = mergeSplitTags(withDomain, companion)

      await streamLookup({
        type: opts.type,
        query: opts.query,
        context: opts.context,
        conversation: opts.conversation,
        screenshots,
        glossaryBlock,
        sourcesBlock: ctx.sourcesBlock,
        relatedNotesBlock: ctx.relatedNotesBlock,
        noteTags: mergedTags,
        noteDomain: ctx.domainId,
        fullNotes: mergedFullNotes,
        title: mergedTitle,
        ...(opts.mode ? { mode: opts.mode } : {}),
        ...(opts.followUpQuestion ? { followUpQuestion: opts.followUpQuestion } : {}),
        onToken: (token) => {
          streamBufs.current[opts.lookupId] = (streamBufs.current[opts.lookupId] ?? '') + token
          if (rafByLookup.current[opts.lookupId]) return
          rafByLookup.current[opts.lookupId] = requestAnimationFrame(() => {
            dispatch({
              type: 'STREAM',
              lookupId: opts.lookupId,
              text: streamBufs.current[opts.lookupId] ?? '',
            })
            delete rafByLookup.current[opts.lookupId]
          })
        },
        onError: (msg) => dispatch({ type: 'STREAM_ERROR', lookupId: opts.lookupId, message: msg }),
        onDone: () => {
          if (rafByLookup.current[opts.lookupId]) {
            cancelAnimationFrame(rafByLookup.current[opts.lookupId]!)
            delete rafByLookup.current[opts.lookupId]
          }
          const raw = streamBufs.current[opts.lookupId] ?? ''
          const { displayText, actions } = parseAgentResponse(raw)
          let skipGlossaryAuto = agentMode

          if (actions.length) {
            const applied = applyAgentActions(actions, sessionRef.current, opts.lookupId)
            if (applied.session) {
              commitSession(applied.session)
              dispatch({ type: 'PATCH_SESSION', session: applied.session })
              void syncToServer(applied.session)
            }
            if (applied.dictionaryChanged) {
              skipGlossaryAuto = true
              dispatch({ type: 'GLOSSARY_BUMP' })
              void pushGlossaryToServer()
            }
          }

          const assistantText = agentMode ? displayText || raw.trim() : raw
          dispatch({
            type: 'STREAM_DONE',
            lookupId: opts.lookupId,
            assistantText,
            skipGlossaryAuto,
          })
          queueMicrotask(() => {
            const ownerId = findLookupOwnerSessionId(
              sessionsRef.current,
              sessionRef.current.id,
              opts.lookupId,
            )
            const owner =
              (ownerId ? sessionsRef.current.find((s) => s.id === ownerId) : null) ??
              sessionRef.current
            const lk = owner.lookups.find((l) => l.id === opts.lookupId)
            if (lk?.conversation.some((m) => m.role === 'assistant')) {
              upsertSession(owner)
            }
          })
          if (!skipGlossaryAuto) void pushGlossaryToServer()
        },
      })
    },
    [commitSession],
  )

  const handleTrigger = useCallback(
    (type: TriggerType, query: string, context: string, pane: 'left' | 'right' = 'left') => {
      const companion = splitCompanionSession(
        sessionRef.current,
        sessionsRef.current,
        splitSessionIdRef.current,
      )
      const mergedContext = mergeSplitEditorContext(
        context,
        sessionRef.current,
        companion,
        pane,
      )
      const lookup: Lookup = {
        id: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        query,
        context: mergedContext,
        conversation: [],
        triggeredAt: new Date().toISOString(),
      }
      dispatch({ type: 'LOOKUP_START', lookup })
      void saveWithHistory('lookup', query)
      void runStream({ lookupId: lookup.id, type, query, context: mergedContext, conversation: [] })
    },
    [runStream, saveWithHistory],
  )

  const handleSecondaryTrigger = useCallback(
    (type: TriggerType, query: string, context: string) => {
      handleTrigger(type, query, context, 'right')
    },
    [handleTrigger],
  )

  const showDictToast = useCallback((msg: string) => {
    setDictToast(msg)
    if (dictToastTimerRef.current) clearTimeout(dictToastTimerRef.current)
    dictToastTimerRef.current = setTimeout(() => setDictToast(null), 2800)
  }, [])

  const handleAddSelectionToDictionary = useCallback(
    (term: string, contextNotes: string) => {
      const label = term.trim()
      if (!label) return false

      const existing = findGlossaryEntry(label)
      dispatch({ type: 'GLOSSARY_OPEN', open: true })
      if (!isMobile) dispatch({ type: 'PANEL', open: true })

      if (existing) {
        showDictToast(`Already in dictionary: ${existing.term}`)
        return true
      }

      showDictToast(`Looking up “${label}” for dictionary…`)
      handleTrigger('line', label, contextNotes)
      return true
    },
    [handleTrigger, showDictToast, isMobile],
  )

  const handlePanelLookup = useCallback(
    (raw: string) => {
      const query = raw.trim()
      if (!query) return
      const companion = splitCompanionSession(
        state.session,
        state.sessions,
        state.splitSessionId,
      )
      const mergedNotes = formatSplitFullNotes(state.session, companion)
      const lookup: Lookup = {
        id: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'line',
        query,
        context: mergedNotes,
        conversation: [],
        triggeredAt: new Date().toISOString(),
      }
      dispatch({ type: 'LOOKUP_START', lookup })
      dispatch({ type: 'PANEL', open: true })
      void saveWithHistory('lookup', query)
      void runStream({
        lookupId: lookup.id,
        type: 'line',
        query,
        context: mergedNotes,
        conversation: [],
        mode: 'agent',
      })
    },
    [runStream, saveWithHistory, state.session, state.sessions, state.splitSessionId],
  )

  const handleFollowUp = useCallback(
    (lookupId: string, question: string) => {
      const lk =
        state.session.lookups.find((l) => l.id === lookupId) ??
        state.sessionHistory.find((l) => l.id === lookupId)
      if (!lk || isLookupStreaming(state.streamByLookupId, lk.id)) return
      const conversation = [...lk.conversation, { role: 'user' as const, content: question }]
      const updated = { ...lk, conversation }
      dispatch({ type: 'LOOKUP_START', lookup: updated })
      void runStream({
        lookupId: lk.id,
        type: lk.type,
        query: lk.query,
        context: lk.context,
        conversation,
        mode: 'agent',
        followUpQuestion: question,
      })
    },
    [state.session.lookups, state.sessionHistory, state.streamByLookupId, runStream],
  )

  const handleDictionaryChange = useCallback(() => {
    dispatch({ type: 'GLOSSARY_BUMP' })
    void pushGlossaryToServer()
  }, [])

  const handleAttachmentAdd = useCallback(
    (attachment: Screenshot) => {
      const session = touchSession({
        ...state.session,
        screenshots: { ...state.session.screenshots, [attachment.id]: attachment },
      })
      upsertSession(session)
      dispatch({ type: 'PATCH_SESSION', session })
    },
    [state.session],
  )

  const handleAttachmentUpdate = useCallback(
    (id: string, patch: Partial<Screenshot>) => {
      const existing = state.session.screenshots[id]
      if (!existing) return
      let display = existing.display
      if (patch.display) {
        display = { ...existing.display, ...patch.display }
        if ('crop' in patch.display && patch.display.crop === undefined) {
          const d = { ...display }
          delete d.crop
          display = d
        }
      }
      const merged: Screenshot = { ...existing, ...patch, ...(display ? { display } : {}) }
      if (patch.preview) merged.preview = patch.preview
      const session = touchSession({
        ...state.session,
        screenshots: { ...state.session.screenshots, [id]: merged },
      })
      upsertSession(session)
      dispatch({ type: 'PATCH_SESSION', session })
    },
    [state.session],
  )

  const handleExportMd = useCallback(() => {
    downloadSessionMarkdown(state.session)
  }, [state.session])

  const handleExportPdf = useCallback(async () => {
    setPdfExportBusy(true)
    try {
      await downloadSessionPdf(state.session)
    } finally {
      setPdfExportBusy(false)
    }
  }, [state.session])

  const handleSummarize = useCallback(() => {
    const mobile = isNotesMobileViewport()
    if (!mobile) dispatch({ type: 'PANEL', open: true })
    const companion = splitCompanionSession(
      state.session,
      state.sessions,
      state.splitSessionId,
    )
    const mergedNotes = formatSplitFullNotes(state.session, companion)
    const lookup: Lookup = {
      id: `decode-${Date.now()}`,
      type: 'line',
      query: mergedNotes,
      context: mergedNotes,
      conversation: [],
      triggeredAt: new Date().toISOString(),
    }
    dispatch({ type: 'LOOKUP_START', lookup, openPanel: !mobile })
    void runStream({
      lookupId: lookup.id,
      type: 'line',
      query: mergedNotes,
      context: mergedNotes,
      conversation: [],
      mode: 'decode',
    })
  }, [state.session, state.sessions, state.splitSessionId, runStream])

  const handleNewNote = useCallback((folderId: string | null = null) => {
    const fid = typeof folderId === 'string' ? folderId : null
    const flushed = flushAndCommitEditor(sessionRef.current.id)
    const prev = touchSession(flushed ?? sessionRef.current)
    upsertSession(prev)
    const storedPrev = loadSessions().find((x) => x.id === prev.id)
    if (flushed || isSessionDirty(prev, storedPrev)) {
      const saved = appendNoteHistory(prev, { kind: 'saved', detail: 'before new note' })
      upsertSession(saved)
      void (async () => {
        await syncToServer(saved)
        dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      })()
    }

    const fresh = createEmptySession(undefined, fid)
    setActiveSessionId(fresh.id)
    upsertSession(fresh)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    dispatch({ type: 'LOAD_SESSION', session: fresh })
    dispatch({ type: 'SPLIT_CLOSE' })
    dispatch({ type: 'PANEL', open: true })
    dispatch({ type: 'NOTES_LIST', open: true })
    if (fid) {
      setExpandedFolderIds((prevIds) => {
        if (prevIds.includes(fid)) return prevIds
        const next = [...prevIds, fid]
        saveNotesUiPrefs({ expandedFolderIds: next })
        return next
      })
    }
  }, [flushAndCommitEditor, syncToServer])

  const handleNewFolder = useCallback((parentId: string | null, name: string) => {
    const folder = createFolder(name, parentId)
    setFolders(loadFolders())
    setExpandedFolderIds((prev) => {
      const next = [...new Set([...prev, folder.id, '__inbox__', ...(parentId ? [parentId] : [])])]
      saveNotesUiPrefs({ expandedFolderIds: next })
      return next
    })
    void syncAllToServer()
  }, [syncAllToServer])

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = loadFolders().find((f) => f.id === folderId)
    if (folder && isArchiveFolder(folder)) return
    const { folders: nextFolders, sessions: nextSessions } = deleteFolder(folderId, loadSessions())
    saveSessionsLocal(nextSessions)
    setFolders(nextFolders)
    dispatch({ type: 'SET_SESSIONS', sessions: nextSessions })
    dispatch({ type: 'LOAD_SESSION', session: loadActiveSession() })
    void syncAllToServer()
  }, [syncAllToServer])

  const handleToggleSourceForNote = useCallback((sourceId: string, enabled: boolean, sessionId?: string) => {
    const targetId = sessionId ?? sessionRef.current.id
    const target = sessionsRef.current.find((s) => s.id === targetId) ?? sessionRef.current
    const metadata = toggleSourceForNote(target.metadata, sourceId, enabled)
    const updated = touchSession({ ...target, metadata })
    upsertSession(updated)
    dispatch({ type: 'PATCH_SESSION', session: updated })
    if (targetId === sessionRef.current.id) dispatch({ type: 'METADATA', metadata })
  }, [])

  const handleMoveNote = useCallback(
    (sessionId: string, folderId: string | null) => {
      const s = loadSessions().find((x) => x.id === sessionId)
      if (!s) return
      const updated = moveSessionToFolder(s, folderId)
      upsertSession(updated)
      dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      if (sessionId === state.session.id) {
        dispatch({ type: 'METADATA', metadata: updated.metadata ?? {} })
      }
      void syncToServer(updated)
      if (folderId) {
        setExpandedFolderIds((prev) => {
          if (prev.includes(folderId)) return prev
          const next = [...prev, folderId, '__inbox__']
          saveNotesUiPrefs({ expandedFolderIds: next })
          return next
        })
      }
    },
    [state.session.id, syncToServer],
  )

  const handleArchiveNote = useCallback(
    (sessionId: string) => {
      const archiveFolder = ensureArchiveFolder()
      setFolders(loadFolders())
      setExpandedFolderIds((prev) => {
        const next = [...new Set([...prev, archiveFolder.id, '__inbox__'])]
        saveNotesUiPrefs({ expandedFolderIds: next })
        return next
      })
      const s = loadSessions().find((x) => x.id === sessionId)
      if (!s) return
      const updated = moveSessionToFolder(s, archiveFolder.id)
      upsertSession(updated)
      dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      if (sessionId === state.session.id) {
        dispatch({ type: 'METADATA', metadata: updated.metadata ?? {} })
      }
      void syncToServer(updated)
    },
    [state.session.id, syncToServer],
  )

  const handleMoveFolder = useCallback((folderId: string, parentId: string | null) => {
    const next = moveFolder(folderId, parentId)
    if (!next) return
    setFolders(next)
    setExpandedFolderIds((prev) => {
      const nextExpanded = [...new Set([...prev, folderId, ...(parentId ? [parentId] : []), '__inbox__'])]
      saveNotesUiPrefs({ expandedFolderIds: nextExpanded })
      return nextExpanded
    })
    void syncAllToServer()
  }, [syncAllToServer])

  const handleToggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
      saveNotesUiPrefs({ expandedFolderIds: next })
      return next
    })
  }, [])

  const handleSelectMeeting = useCallback((s: NoteSession, opts?: { keepSplit?: boolean }) => {
    if (s.id === sessionRef.current.id) return

    const flushed = flushAndCommitEditor(sessionRef.current.id)
    const prev = touchSession(flushed ?? sessionRef.current)
    upsertSession(prev)

    const target =
      sessionsRef.current.find((x) => x.id === s.id) ??
      loadSessions().find((x) => x.id === s.id) ??
      s
    const switched = appendNoteHistory(target, { kind: 'switch', detail: target.title || 'Untitled' })

    setActiveSessionId(switched.id)
    dispatch({ type: 'LOAD_SESSION', session: switched })
    if (!opts?.keepSplit) dispatch({ type: 'SPLIT_CLOSE' })
    dispatch({
      type: 'SET_SESSIONS',
      sessions: sessionsRef.current.map((x) =>
        x.id === switched.id ? switched : x.id === prev.id ? prev : x,
      ),
    })

    queueMicrotask(() => {
      upsertSession(switched)
      const storedPrev = loadSessions().find((x) => x.id === prev.id)
      if (flushed || isSessionDirty(prev, storedPrev)) {
        const saved = appendNoteHistory(prev, { kind: 'saved' })
        upsertSession(saved)
        void (async () => {
          await syncToServer(saved)
          dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
          if (sessionRef.current.id === prev.id) {
            dispatch({ type: 'PATCH_SESSION', session: saved })
          }
        })()
      }
    })
  }, [flushAndCommitEditor, syncToServer])

  const handleRenameMeeting = useCallback(
    (sessionId: string, title: string) => {
      const s = loadSessions().find((x) => x.id === sessionId)
      if (!s) return
      const newTitle = sanitizeMetadataText(normalizeSessionTitle(title), 200)
      if (newTitle === s.title) return
      const updated = touchSession({ ...s, title: newTitle })
      upsertSession(updated)
      dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      if (sessionId === sessionRef.current.id) {
        bumpEditActivity()
        dispatch({ type: 'PATCH_SESSION', session: updated })
      }
      void syncToServer(updated)
    },
    [bumpEditActivity, syncToServer],
  )

  const handleDeleteMeeting = useCallback((sessionId: string) => {
    void deleteSessionOnServer(getEffectiveUserId(), sessionId)
    const next = deleteSession(sessionId)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    if (state.splitSessionId === sessionId) dispatch({ type: 'SPLIT_CLOSE' })
    if (next) dispatch({ type: 'LOAD_SESSION', session: next })
  }, [state.splitSessionId])

  const handleDeleteLookup = useCallback(
    (lookupId: string) => {
      const lookups = state.session.lookups.filter((l) => l.id !== lookupId)
      const session = touchSession({ ...state.session, lookups })
      upsertSession(session)
      dispatch({ type: 'DELETE_LOOKUP', lookupId })
      void syncToServer(session)
    },
    [state.session, syncToServer],
  )

  const handleJump = useCallback(
    (sessionId: string, lineIndex?: number) => {
      const target = state.sessions.find((s) => s.id === sessionId)
      if (!target) return
      if (target.id !== state.session.id) {
        handleSelectMeeting(target)
      }
      if (lineIndex != null) {
        setTimeout(() => editorRef.current?.scrollToLine(lineIndex), 100)
      }
    },
    [state.sessions, state.session.id, handleSelectMeeting],
  )

  const patchSessionTodo = useCallback(
    (sessionId: string, lineIndex: number, archived: boolean) => {
      const target = state.sessions.find((s) => s.id === sessionId)
      if (!target) return
      const notes = setTodoArchivedAtLine(target.notes, lineIndex, archived)
      if (notes === target.notes) return
      const session = touchSession({ ...target, notes })
      upsertSession(session)
      dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      if (state.session.id === sessionId) {
        dispatch({ type: 'NOTES', notes })
      }
      void syncToServer(session)
    },
    [state.sessions, state.session.id, syncToServer],
  )

  const handleArchiveTodo = useCallback(
    (sessionId: string, lineIndex: number) => patchSessionTodo(sessionId, lineIndex, true),
    [patchSessionTodo],
  )

  const handleRestoreTodo = useCallback(
    (sessionId: string, lineIndex: number) => patchSessionTodo(sessionId, lineIndex, false),
    [patchSessionTodo],
  )

  const handleDropOnPane = useCallback(
    (sessionId: string, side: 'left' | 'right') => {
      const sessions = sessionsRef.current
      const primaryId = sessionRef.current.id
      if (isNotesMobileViewport()) {
        const target = sessions.find((s) => s.id === sessionId)
        if (target) handleSelectMeeting(target)
        return
      }
      if (side === 'right') {
        if (sessionId !== primaryId) dispatch({ type: 'SPLIT_OPEN', sessionId })
        return
      }
      if (sessionId === primaryId) return
      const target = sessions.find((s) => s.id === sessionId)
      if (!target) return
      const rightId = state.splitSessionId
      if (sessionId === rightId) {
        handleSelectMeeting(target)
        return
      }
      const keepRight = rightId && rightId !== sessionId ? rightId : null
      handleSelectMeeting(target, { keepSplit: !!keepRight })
      if (keepRight) dispatch({ type: 'SPLIT_OPEN', sessionId: keepRight })
    },
    [state.splitSessionId, handleSelectMeeting],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('notesE2e') !== '1') return
    const w = window as typeof window & {
      __notesE2eSplitDrop?: (sessionId: string, side: 'left' | 'right') => void
    }
    w.__notesE2eSplitDrop = (sessionId, side) => handleDropOnPane(sessionId, side)
    return () => {
      delete w.__notesE2eSplitDrop
    }
  }, [handleDropOnPane])

  const patchSecondarySession = useCallback(
    (patch: (s: NoteSession) => NoteSession) => {
      if (!state.splitSessionId) return
      const target = state.sessions.find((s) => s.id === state.splitSessionId)
      if (!target) return
      const session = touchSession(patch(target))
      upsertSession(session)
      dispatch({ type: 'PATCH_SESSION', session })
    },
    [state.splitSessionId, state.sessions],
  )

  const handleSecondaryNotes = useCallback(
    (notes: string) => {
      if (!state.splitSessionId) return
      const target = sessionsRef.current.find((s) => s.id === state.splitSessionId)
      if (!target) return
      upsertSession(touchSession({ ...target, notes }))
      dispatch({ type: 'SESSION_NOTES', sessionId: state.splitSessionId, notes })
    },
    [state.splitSessionId],
  )

  const handleSecondaryTitle = useCallback(
    (title: string) => {
      if (!state.splitSessionId) return
      const target = sessionsRef.current.find((s) => s.id === state.splitSessionId)
      if (!target) return
      upsertSession(
        touchSession({
          ...target,
          title: sanitizeMetadataText(normalizeSessionTitle(title), 200),
        }),
      )
      dispatch({ type: 'SESSION_TITLE', sessionId: state.splitSessionId, title })
    },
    [state.splitSessionId],
  )

  const handleSecondaryAttachmentAdd = useCallback(
    (attachment: Screenshot) => {
      patchSecondarySession((s) => ({
        ...s,
        screenshots: { ...s.screenshots, [attachment.id]: attachment },
      }))
    },
    [patchSecondarySession],
  )

  const handleSecondaryAttachmentUpdate = useCallback(
    (id: string, patch: Partial<Screenshot>) => {
      patchSecondarySession((s) => {
        const existing = s.screenshots[id]
        if (!existing) return s
        let display = existing.display
        if (patch.display) {
          display = { ...existing.display, ...patch.display }
          if ('crop' in patch.display && patch.display.crop === undefined) {
            const d = { ...display }
            delete d.crop
            display = d
          }
        }
        const merged: Screenshot = { ...existing, ...patch, ...(display ? { display } : {}) }
        if (patch.preview) merged.preview = patch.preview
        return { ...s, screenshots: { ...s.screenshots, [id]: merged } }
      })
    },
    [patchSecondarySession],
  )

  const handleSecondaryTags = useCallback(
    (tags: string[]) => {
      if (!state.splitSessionId) return
      const target = sessionsRef.current.find((s) => s.id === state.splitSessionId)
      if (!target) return
      upsertSession(touchSession({ ...target, tags: sanitizeTags(tags) }))
      dispatch({ type: 'SESSION_TAGS', sessionId: state.splitSessionId, tags })
    },
    [state.splitSessionId],
  )

  const aiActiveCount = activeStreamCount(state.streamByLookupId)

  useEffect(() => {
    return () => {
      if (dictToastTimerRef.current) clearTimeout(dictToastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mobile = isNotesMobileViewport()
      const inPanelField = isNotesTextFieldTarget(e.target) && !isNotesEditorTarget(e.target)

      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false)
        else dispatch({ type: 'CLEAR_LOOKUP' })
        return
      }

      if (!e.ctrlKey && !e.metaKey) return

      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey

      if (inPanelField) {
        if (mod && key === 's') {
          e.preventDefault()
          void saveWithHistory('saved', 'Ctrl+S', true)
        }
        return
      }

      if (!mod) return

      if (mod && key === 's') {
        e.preventDefault()
        void saveWithHistory('saved', 'Ctrl+S', true)
        return
      }

      if (mobile) return

      if (key === '\\' || key === '|') {
        e.preventDefault()
        dispatch({ type: 'PANEL_TOGGLE' })
        return
      }
      if (key === 'k') {
        e.preventDefault()
        handleSummarize()
        return
      }
      if (key === 'e') {
        e.preventDefault()
        handleExportMd()
        return
      }
      if (e.shiftKey && key === 'n') {
        e.preventDefault()
        handleNewNote()
        return
      }
      if (e.shiftKey && key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (e.shiftKey && key === 'h') {
        e.preventDefault()
        setHintsOpen((v) => {
          persistHintsOpen(!v)
          return !v
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSummarize, handleExportMd, saveWithHistory, handleNewNote, searchOpen])

  const openLookups = state.openLookupIds
    .map((id) => resolveLookup(state.session, state.sessionHistory, id))
    .filter((lk): lk is Lookup => lk != null)

  const streamingQueries = openLookups
    .filter((lk) => isLookupStreaming(state.streamByLookupId, lk.id))
    .map((lk) => lk.query)

  const leftActiveQueries = streamingQueries.filter((q) => {
    const line = `${q}?`
    const section = `${q}??`
    return state.session.notes.includes(line) || state.session.notes.includes(section)
  })

  const rightActiveQueries =
    secondarySession != null
      ? streamingQueries.filter((q) => {
          const line = `${q}?`
          const section = `${q}??`
          return secondarySession.notes.includes(line) || secondarySession.notes.includes(section)
        })
      : []
  const counts = countShorthandFlags(state.session.notes)
  const lastHist = lastHistoryEntry(state.session)
  const splitActive = !isMobile && !!secondarySession

  const primaryTopBar = (
    <NotesTopBar
      pane="primary"
      title={state.session.title}
      startedAt={state.session.startedAt}
      updatedAt={state.session.updatedAt}
      {...(state.session.metadata?.lastDeviceLabel
        ? { lastDeviceLabel: state.session.metadata.lastDeviceLabel }
        : {})}
      tags={state.session.tags ?? []}
      sessions={state.sessions}
      onTitleChange={(title) => {
        bumpEditActivity()
        dispatch({ type: 'TITLE', title })
      }}
      onTagsChange={(tags) => dispatch({ type: 'TAGS', tags, recordHistory: true })}
      onDeleteNote={() => handleDeleteMeeting(state.session.id)}
    />
  )

  const secondaryTopBar =
    secondarySession ? (
      <NotesTopBar
        pane="secondary"
        title={secondarySession.title}
        startedAt={secondarySession.startedAt}
        updatedAt={secondarySession.updatedAt}
        {...(secondarySession.metadata?.lastDeviceLabel
          ? { lastDeviceLabel: secondarySession.metadata.lastDeviceLabel }
          : {})}
        tags={secondarySession.tags ?? []}
        sessions={state.sessions}
        onTitleChange={handleSecondaryTitle}
        onTagsChange={handleSecondaryTags}
        onDeleteNote={() => handleDeleteMeeting(secondarySession.id)}
        onClosePane={() => dispatch({ type: 'SPLIT_CLOSE' })}
        showHomeLink={false}
      />
    ) : null

  return (
    <div className="notes-root bg-[var(--uv-bg-base)] text-[var(--uv-text-primary)]">
      {!splitActive ? primaryTopBar : null}
      <GlobalSearch
        open={searchOpen}
        sessions={state.sessions}
        onClose={() => setSearchOpen(false)}
        onJump={handleJump}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {state.panelOpen ? (
          <button
            type="button"
            className="notes-panel-backdrop md:hidden"
            aria-label="Close panel"
            data-testid="notes-panel-backdrop"
            onClick={() => dispatch({ type: 'PANEL', open: false })}
          />
        ) : null}
        <section className="notes-editor-pane min-w-0 flex-1">
          <NotesSplitView
            split={splitActive}
            splitRatio={splitRatio}
            primarySession={state.session}
            secondarySession={secondarySession}
            leftHeader={splitActive ? primaryTopBar : null}
            rightHeader={splitActive ? secondaryTopBar : null}
            onSplitRatioChange={setSplitRatio}
            onDropNote={handleDropOnPane}
            leftEditor={
              <EditorShell
                sessionId={state.session.id}
                ref={editorRef}
                value={state.session.notes}
                screenshots={state.session.screenshots}
                onChange={(notes) => {
                  bumpEditActivity()
                  dispatch({ type: 'NOTES', notes })
                }}
                onTrigger={(type, query, context) => handleTrigger(type, query, context, 'left')}
                activeTriggerQueries={leftActiveQueries}
                onAttachmentAdd={handleAttachmentAdd}
                onAttachmentUpdate={handleAttachmentUpdate}
                onLookupSelection={(query, type) =>
                  handleTrigger(type, query, state.session.notes, 'left')
                }
                onAddSelectionToDictionary={(term) =>
                  handleAddSelectionToDictionary(term, state.session.notes)
                }
                onArchiveTodoLine={(lineIndex) => handleArchiveTodo(state.session.id, lineIndex)}
                onRestoreTodoLine={(lineIndex) => handleRestoreTodo(state.session.id, lineIndex)}
              />
            }
            rightEditor={
              secondarySession ? (
                <EditorShell
                  sessionId={secondarySession.id}
                  ref={secondaryEditorRef}
                  value={secondarySession.notes}
                  screenshots={secondarySession.screenshots}
                  onChange={handleSecondaryNotes}
                  onTrigger={handleSecondaryTrigger}
                  activeTriggerQueries={rightActiveQueries}
                  onAttachmentAdd={handleSecondaryAttachmentAdd}
                  onAttachmentUpdate={handleSecondaryAttachmentUpdate}
                  onLookupSelection={(query, type) =>
                    handleSecondaryTrigger(type, query, secondarySession.notes)
                  }
                  onAddSelectionToDictionary={(term) =>
                    handleAddSelectionToDictionary(term, secondarySession.notes)
                  }
                  onArchiveTodoLine={(lineIndex) => handleArchiveTodo(secondarySession.id, lineIndex)}
                  onRestoreTodoLine={(lineIndex) => handleRestoreTodo(secondarySession.id, lineIndex)}
                />
              ) : null
            }
          />
        </section>
        <SidePanel
          isOpen={state.panelOpen}
          sessions={state.sessions}
          folders={folders}
          expandedFolderIds={expandedFolderIds}
          activeSessionId={state.session.id}
          splitSessionId={state.splitSessionId}
          activeSession={state.session}
          openLookups={openLookups}
          sessionHistory={state.sessionHistory}
          streamByLookupId={state.streamByLookupId}
          aiActiveCount={aiActiveCount}
          notesListOpen={state.notesListOpen}
          aiListOpen={state.aiListOpen}
          syncOpen={state.syncOpen}
          glossaryOpen={state.glossaryOpen}
          sourcesOpen={state.sourcesOpen}
          historyOpen={state.historyOpen}
          rollupOpen={state.rollupOpen}
          noteHistory={state.session.history ?? []}
          glossaryRefreshKey={state.glossaryRefreshKey}
          onNotesListOpenChange={(open) => dispatch({ type: 'NOTES_LIST', open })}
          onAiListOpenChange={(open) => dispatch({ type: 'AI_LIST', open })}
          onSyncOpenChange={(open) => dispatch({ type: 'SYNC_OPEN', open })}
          onGlossaryOpenChange={(open) => dispatch({ type: 'GLOSSARY_OPEN', open })}
          onSourcesOpenChange={(open) => dispatch({ type: 'SOURCES_OPEN', open })}
          onHistoryOpenChange={(open) => dispatch({ type: 'HISTORY_OPEN', open })}
          onRollupOpenChange={(open) => dispatch({ type: 'ROLLUP_OPEN', open })}
          onSelectMeeting={handleSelectMeeting}
          onNewNote={handleNewNote}
          onNewFolder={handleNewFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveNote={handleMoveNote}
          onMoveFolder={handleMoveFolder}
          onToggleFolder={handleToggleFolder}
          onDeleteMeeting={handleDeleteMeeting}
          onRenameMeeting={handleRenameMeeting}
          onArchiveNote={handleArchiveNote}
          onDeleteLookup={handleDeleteLookup}
          onPanelLookup={handlePanelLookup}
          onFollowUp={handleFollowUp}
          onSelectHistory={(lk) => dispatch({ type: 'SELECT_LOOKUP', lookup: lk })}
          onDismissLookup={(lookupId) => dispatch({ type: 'DISMISS_LOOKUP', lookupId })}
          onSynced={(opts) => void refreshFromServer(opts)}
          onJumpTodo={handleJump}
          onArchiveTodo={handleArchiveTodo}
          onRestoreTodo={handleRestoreTodo}
          onToggleSourceForNote={handleToggleSourceForNote}
          onSourcesChange={() => {
            dispatch({ type: 'GLOSSARY_BUMP' })
            void syncMemoryBank()
          }}
          onDictionaryChange={handleDictionaryChange}
        />
      </div>
      {dictToast ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="notes-dictionary-toast"
          className="pointer-events-none fixed bottom-10 left-1/2 z-50 max-w-[min(90vw,24rem)] -translate-x-1/2 rounded-md border border-[var(--uv-border)] bg-[var(--uv-bg-elevated)] px-3 py-2 text-center text-[11px] text-[var(--uv-text-primary)] shadow-md"
        >
          {dictToast}
        </div>
      ) : null}
      <StatusBar
        chars={counts.chars}
        flags={counts.flags}
        actions={counts.actions}
        syncOk={state.syncOk}
        syncKind={state.syncKind}
        syncError={state.syncError}
        saving={saving}
        syncing={syncing}
        aiActiveCount={aiActiveCount}
        lastHistory={lastHist}
        hintsOpen={hintsOpen}
        panelOpen={state.panelOpen}
        pdfExportBusy={pdfExportBusy}
        onSearch={() => setSearchOpen(true)}
        onNewNote={handleNewNote}
        onExportMd={handleExportMd}
        onExportPdf={handleExportPdf}
        onSummarize={handleSummarize}
        onTogglePanel={() => dispatch({ type: 'PANEL_TOGGLE' })}
        onHintsToggle={() => {
          setHintsOpen((v) => {
            persistHintsOpen(!v)
            return !v
          })
        }}
      />
    </div>
  )
}
