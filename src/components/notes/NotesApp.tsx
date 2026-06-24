'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { assembleClientContextAsync } from '@/lib/notes/contextAssembler'
import { applyAgentActions, parseAgentResponse } from '@/lib/notes/agentActions'
import { formatGlossaryForPrompt, upsertFromLookup } from '@/lib/notes/glossary'
import {
  activeStreamCount,
  anyStreaming,
  emptyStream,
  isLookupStreaming,
  type LookupStreamMap,
} from '@/lib/notes/lookupStreams'
import { pushGlossaryToServer, syncMemoryBank } from '@/lib/notes/memorySync'
import { countShorthandFlags } from '@/lib/notes/shorthand'
import { appendNoteHistory, lastHistoryEntry } from '@/lib/notes/noteHistory'
import { addToTagCatalog } from '@/lib/notes/tagRegistry'
import {
  createFolder,
  deleteFolder,
  loadFolders,
  moveFolder,
  moveSessionToFolder,
} from '@/lib/notes/folders'
import { isNotesTextFieldTarget } from '@/lib/notes/shortcuts'
import { streamLookup } from '@/lib/notes/streamClient'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'
import { downloadSessionMarkdown, downloadSessionPdf } from '@/lib/notes/export'
import {
  createEmptySession,
  deleteSession,
  deleteSessionOnServer,
  getEffectiveUserId,
  getOrCreateUserId,
  loadActiveSession,
  loadSessions,
  pushAllToServer,
  saveSessionToServer,
  saveSessionsLocal,
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
  focusedLookupId: string | null
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  streamByLookupId: LookupStreamMap
  syncOk: boolean | null
  glossaryRefreshKey: number
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
  | { type: 'LOOKUP_START'; lookup: Lookup }
  | { type: 'STREAM'; lookupId: string; text: string }
  | { type: 'STREAM_DONE'; lookupId: string; assistantText: string; skipGlossaryAuto?: boolean }
  | { type: 'STREAM_ERROR'; lookupId: string; message: string }
  | { type: 'SELECT_LOOKUP'; lookup: Lookup }
  | { type: 'DELETE_LOOKUP'; lookupId: string }
  | { type: 'SYNC_OK'; ok: boolean }
  | { type: 'LOAD_SESSION'; session: NoteSession; preserveAi?: boolean }
  | { type: 'CLEAR_LOOKUP' }
  | { type: 'GLOSSARY_BUMP' }

function initState(): State {
  const prefs = typeof window !== 'undefined' ? loadNotesUiPrefs() : {}
  const initial = loadActiveSession()
  const bootSessions = loadSessions()
  return {
    session: initial,
    sessions: bootSessions.length > 0 ? bootSessions : [initial],
    panelOpen: prefs.panelOpen ?? false,
    notesListOpen: prefs.notesListOpen ?? true,
    aiListOpen: true,
    syncOpen: prefs.syncOpen ?? false,
    glossaryOpen: false,
    sourcesOpen: false,
    historyOpen: false,
    rollupOpen: prefs.rollupOpen ?? true,
    focusedLookupId: null,
    currentLookup: null,
    sessionHistory: [...initial.lookups].reverse(),
    streamByLookupId: {},
    syncOk: null,
    glossaryRefreshKey: 0,
  }
}

function upsertLookupInSession(session: NoteSession, lookup: Lookup): NoteSession {
  const lookups = [...session.lookups.filter((l) => l.id !== lookup.id), lookup]
  return { ...session, lookups }
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
      const session = touchSession({ ...state.session, title: action.title })
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'TAGS': {
      let session = { ...state.session, tags: action.tags }
      if (action.recordHistory) {
        session = appendNoteHistory(session, { kind: 'tags', detail: action.tags.join(', ') })
      }
      for (const t of action.tags) addToTagCatalog(t)
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
        currentLookup: action.lookup,
        focusedLookupId: action.lookup.id,
        streamByLookupId: {
          ...state.streamByLookupId,
          [action.lookup.id]: { text: '', isStreaming: true, error: null },
        },
        panelOpen: true,
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
      const base =
        state.currentLookup?.id === action.lookupId
          ? state.currentLookup
          : state.session.lookups.find((l) => l.id === action.lookupId)
      if (!base || !action.assistantText.trim()) {
        const nextMap = { ...state.streamByLookupId }
        if (nextMap[action.lookupId]) nextMap[action.lookupId] = { ...nextMap[action.lookupId]!, isStreaming: false }
        return { ...state, streamByLookupId: nextMap }
      }
      const lookup: Lookup = {
        ...base,
        conversation: [...base.conversation, { role: 'assistant', content: action.assistantText }],
      }
      const session = touchSession(upsertLookupInSession(state.session, lookup))
      if (!action.skipGlossaryAuto) upsertFromLookup(lookup, session.id)
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      const sessionHistory = [lookup, ...state.sessionHistory.filter((l) => l.id !== lookup.id)]
      const nextMap = { ...state.streamByLookupId }
      nextMap[action.lookupId] = { text: action.assistantText, isStreaming: false, error: null }
      return {
        ...state,
        currentLookup: state.focusedLookupId === action.lookupId ? lookup : state.currentLookup,
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
        currentLookup: lookup,
        focusedLookupId: lookup.id,
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
      const clearedFocus = state.focusedLookupId === action.lookupId
      return {
        ...state,
        session,
        sessions,
        sessionHistory,
        streamByLookupId: nextMap,
        currentLookup: clearedFocus ? null : state.currentLookup,
        focusedLookupId: clearedFocus ? null : state.focusedLookupId,
      }
    }
    case 'SYNC_OK':
      return { ...state, syncOk: action.ok }
    case 'LOAD_SESSION': {
      const preserveAi = action.preserveAi && anyStreaming(state.streamByLookupId)
      return {
        ...state,
        session: action.session,
        sessionHistory: [...action.session.lookups].reverse(),
        currentLookup: preserveAi ? state.currentLookup : null,
        focusedLookupId: preserveAi ? state.focusedLookupId : null,
        streamByLookupId: preserveAi ? state.streamByLookupId : {},
      }
    }
    case 'CLEAR_LOOKUP':
      return { ...state, currentLookup: null, focusedLookupId: null }
    case 'GLOSSARY_BUMP':
      return { ...state, glossaryRefreshKey: state.glossaryRefreshKey + 1 }
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
  const editorRef = useRef<NoteEditorHandle>(null)

  const streamBufs = useRef<Record<string, string>>({})
  const rafByLookup = useRef<Record<string, number>>({})

  useEffect(() => {
    getOrCreateUserId()
    setHintsOpen(loadHintsOpen())
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const fn = () => {
      if (!mq.matches) dispatch({ type: 'PANEL', open: false })
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
    })
  }, [state.panelOpen, state.notesListOpen, state.rollupOpen, state.syncOpen])

  const sessionRef = useRef(state.session)
  const sessionsRef = useRef(state.sessions)
  const streamRef = useRef(state.streamByLookupId)
  /** Min ms between server pulls on autosave paths (debounced typing, folder ops). */
  const PULL_MIN_INTERVAL_MS = 60_000
  const lastPullAtRef = useRef(0)
  sessionRef.current = state.session
  sessionsRef.current = state.sessions
  streamRef.current = state.streamByLookupId

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

  const applyServerSync = useCallback(async (opts?: { skipPersist?: boolean }) => {
    if (!opts?.skipPersist) persistLocal(sessionRef.current)
    const r = await syncWithServer()
    lastPullAtRef.current = Date.now()
    const mem = await syncMemoryBank()
    dispatch({ type: 'GLOSSARY_BUMP' })
    dispatch({ type: 'SET_SESSIONS', sessions: r.sessions })
    setFolders(loadFolders())
    const active = loadActiveSession()
    const mergedActive = r.sessions.find((s) => s.id === active.id) ?? active
    const inMem = sessionRef.current
    const preserveAi = anyStreaming(streamRef.current)
    const storageNewer =
      mergedActive.id !== inMem.id ||
      mergedActive.notes !== inMem.notes ||
      mergedActive.title !== inMem.title ||
      new Date(mergedActive.updatedAt).getTime() > new Date(inMem.updatedAt).getTime()
    if (storageNewer || preserveAi) {
      dispatch({
        type: 'LOAD_SESSION',
        session: mergedActive,
        preserveAi,
      })
      setActiveSessionId(mergedActive.id)
    }
    const ok = r.pushOk && mem.glossaryOk && mem.sourcesOk
    dispatch({ type: 'SYNC_OK', ok })
    return r
  }, [persistLocal])

  const refreshFromServer = applyServerSync

  const syncToServer = useCallback(
    async (session: NoteSession, opts?: { forcePull?: boolean }) => {
      upsertSession(session)
      const shouldPull =
        opts?.forcePull || Date.now() - lastPullAtRef.current >= PULL_MIN_INTERVAL_MS
      if (shouldPull) return applyServerSync({ skipPersist: true })
      const ok = await saveSessionToServer(session)
      dispatch({ type: 'SYNC_OK', ok })
      return { sessions: loadSessions(), pushOk: ok }
    },
    [applyServerSync],
  )

  const syncAllToServer = useCallback(
    async (opts?: { forcePull?: boolean }) => {
      persistLocal(sessionRef.current)
      const shouldPull =
        opts?.forcePull ?? Date.now() - lastPullAtRef.current >= PULL_MIN_INTERVAL_MS
      if (shouldPull) return applyServerSync({ skipPersist: true })
      const ok = await pushAllToServer()
      dispatch({ type: 'SYNC_OK', ok })
      return { sessions: loadSessions(), pushOk: ok }
    },
    [applyServerSync, persistLocal],
  )

  const saveWithHistory = useCallback(
    async (kind: NoteHistoryKind, detail?: string, doSync = false) => {
      let session = appendNoteHistory(sessionRef.current, { kind, ...(detail ? { detail } : {}) })
      commitSession(session)
      if (!doSync) return
      setSaving(true)
      const r = await syncToServer(session, { forcePull: true })
      if (r.pushOk) {
        session = appendNoteHistory(session, { kind: 'synced' })
        commitSession(session)
      }
      setSaving(false)
    },
    [commitSession, syncToServer],
  )

  useEffect(() => {
    setSyncing(true)
    refreshFromServer().finally(() => setSyncing(false))
  }, [refreshFromServer])

  useEffect(() => {
    persistLocal(state.session)
  }, [state.session, persistLocal])

  useEffect(() => {
    setSaving(true)
    const t = setTimeout(() => {
      void syncToServer(state.session).finally(() => setSaving(false))
    }, 800)
    return () => clearTimeout(t)
  }, [state.session, syncToServer])

  useEffect(() => {
    const fn = () => {
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
  }, [saveWithHistory])

  useEffect(() => {
    const intervalMs = document.visibilityState === 'visible' ? 5 * 60_000 : 60 * 60_000
    const id = window.setInterval(() => void refreshFromServer(), intervalMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshFromServer()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
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

      const ctx = await assembleClientContextAsync({
        query: opts.query,
        activeSession: sessionRef.current,
        allSessions: sessionsRef.current,
      })

      const agentMode = opts.mode === 'agent' || opts.mode === 'followup'
      const glossaryBlock = agentMode ? formatGlossaryForPrompt(40) : ctx.glossaryBlock

      const withDomain: NoteSession = {
        ...sessionRef.current,
        metadata: { ...sessionRef.current.metadata, inferredDomain: ctx.domainId },
      }
      commitSession(withDomain)

      const noteShots = screenshotsInContext(withDomain.notes, withDomain.screenshots)
      const screenshots = [...noteShots, ...(opts.extraScreenshots ?? [])]

      await streamLookup({
        type: opts.type,
        query: opts.query,
        context: opts.context,
        conversation: opts.conversation,
        screenshots,
        glossaryBlock,
        sourcesBlock: ctx.sourcesBlock,
        relatedNotesBlock: ctx.relatedNotesBlock,
        noteTags: ctx.noteTags,
        noteDomain: ctx.domainId,
        fullNotes: withDomain.notes,
        title: withDomain.title,
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
          if (!skipGlossaryAuto) void pushGlossaryToServer()
        },
      })
    },
    [commitSession],
  )

  const handleTrigger = useCallback(
    (type: TriggerType, query: string, context: string) => {
      const lookup: Lookup = {
        id: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        query,
        context,
        conversation: [],
        triggeredAt: new Date().toISOString(),
      }
      dispatch({ type: 'LOOKUP_START', lookup })
      void saveWithHistory('lookup', query)
      void runStream({ lookupId: lookup.id, type, query, context, conversation: [] })
    },
    [runStream, saveWithHistory],
  )

  const handlePanelLookup = useCallback(
    (raw: string) => {
      const query = raw.trim()
      if (!query) return
      const lookup: Lookup = {
        id: `lk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'line',
        query,
        context: state.session.notes,
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
        context: state.session.notes,
        conversation: [],
        mode: 'agent',
      })
    },
    [runStream, saveWithHistory, state.session.notes],
  )

  const handleFollowUp = useCallback(
    (question: string) => {
      const lkId = state.focusedLookupId ?? state.currentLookup?.id
      if (!lkId) return
      const lk = state.session.lookups.find((l) => l.id === lkId) ?? state.currentLookup
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
    [state.focusedLookupId, state.currentLookup, state.session.lookups, state.streamByLookupId, runStream],
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
    dispatch({ type: 'PANEL', open: true })
    const lookup: Lookup = {
      id: `decode-${Date.now()}`,
      type: 'line',
      query: state.session.notes,
      context: state.session.notes,
      conversation: [],
      triggeredAt: new Date().toISOString(),
    }
    dispatch({ type: 'LOOKUP_START', lookup })
    void runStream({
      lookupId: lookup.id,
      type: 'line',
      query: state.session.notes,
      context: state.session.notes,
      conversation: [],
      mode: 'decode',
    })
  }, [state.session.notes, runStream])

  const handleNewNote = useCallback((folderId: string | null = null) => {
    const fid = typeof folderId === 'string' ? folderId : null
    const prev = sessionRef.current
    const storedPrev = sessionsRef.current.find((x) => x.id === prev.id)
    if (isSessionDirty(prev, storedPrev)) {
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
  }, [syncToServer])

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
    if (!window.confirm('Delete folder? Notes move to Inbox.')) return
    const { folders: nextFolders, sessions: nextSessions } = deleteFolder(folderId, loadSessions())
    saveSessionsLocal(nextSessions)
    setFolders(nextFolders)
    dispatch({ type: 'SET_SESSIONS', sessions: nextSessions })
    dispatch({ type: 'LOAD_SESSION', session: loadActiveSession() })
    void syncAllToServer()
  }, [syncAllToServer])

  const handleToggleSourceForNote = useCallback((sourceId: string, enabled: boolean) => {
    const metadata = toggleSourceForNote(sessionRef.current.metadata, sourceId, enabled)
    dispatch({ type: 'METADATA', metadata })
    upsertSession({ ...sessionRef.current, metadata })
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

  const handleSelectMeeting = useCallback((s: NoteSession) => {
    if (s.id === sessionRef.current.id) return

    const prev = sessionRef.current
    const storedPrev = sessionsRef.current.find((x) => x.id === prev.id)
    if (isSessionDirty(prev, storedPrev)) {
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

    const switched = appendNoteHistory(s, { kind: 'switch', detail: s.title || 'Untitled' })
    setActiveSessionId(switched.id)
    upsertSession(switched)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    dispatch({ type: 'LOAD_SESSION', session: switched })
  }, [syncToServer])

  const handleDeleteMeeting = useCallback((sessionId: string) => {
    void deleteSessionOnServer(getEffectiveUserId(), sessionId)
    const next = deleteSession(sessionId)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    if (next) dispatch({ type: 'LOAD_SESSION', session: next })
  }, [])

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

  const aiBusy = anyStreaming(state.streamByLookupId)
  const aiActiveCount = activeStreamCount(state.streamByLookupId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false)
        else if (state.panelOpen && !aiBusy) dispatch({ type: 'PANEL', open: false })
        else dispatch({ type: 'CLEAR_LOOKUP' })
        return
      }

      if (!e.ctrlKey && !e.metaKey) return

      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const inField = isNotesTextFieldTarget(e.target)

      if (inField) {
        if (mod && key === 's') {
          e.preventDefault()
          void saveWithHistory('saved', 'Ctrl+S', true)
        }
        return
      }

      if (!mod) return

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
      if (key === 's') {
        e.preventDefault()
        void saveWithHistory('saved', 'Ctrl+S', true)
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
  }, [handleSummarize, handleExportMd, saveWithHistory, handleNewNote, state.panelOpen, aiBusy, searchOpen])

  const focusedId = state.focusedLookupId ?? state.currentLookup?.id ?? null
  const focusedLookup =
    state.currentLookup ??
    (focusedId ? state.sessionHistory.find((l) => l.id === focusedId) ?? null : null)
  const streamText = focusedId ? (state.streamByLookupId[focusedId]?.text ?? '') : ''
  const displayStreaming = focusedId ? isLookupStreaming(state.streamByLookupId, focusedId) : false
  const displayError = focusedId ? (state.streamByLookupId[focusedId]?.error ?? null) : null

  const counts = countShorthandFlags(state.session.notes)
  const activeQuery = focusedLookup?.query ?? null
  const lastHist = lastHistoryEntry(state.session)

  return (
    <div className="notes-root bg-[var(--uv-bg-base)] text-[var(--uv-text-primary)]">
      <NotesTopBar
        title={state.session.title}
        startedAt={state.session.startedAt}
        updatedAt={state.session.updatedAt}
        tags={state.session.tags ?? []}
        sessions={state.sessions}
        onTitleChange={(title) => dispatch({ type: 'TITLE', title })}
        onTagsChange={(tags) => dispatch({ type: 'TAGS', tags, recordHistory: true })}
        onDeleteNote={() => handleDeleteMeeting(state.session.id)}
      />
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
          <div className="notes-editor-body" data-testid="notes-editor">
            <EditorShell
              key={state.session.id}
              ref={editorRef}
              value={state.session.notes}
              screenshots={state.session.screenshots}
              onChange={(notes) => dispatch({ type: 'NOTES', notes })}
              onTrigger={handleTrigger}
              activeTriggerQuery={activeQuery}
              onAttachmentAdd={handleAttachmentAdd}
              onAttachmentUpdate={handleAttachmentUpdate}
            />
          </div>
        </section>
        <SidePanel
          isOpen={state.panelOpen}
          sessions={state.sessions}
          folders={folders}
          expandedFolderIds={expandedFolderIds}
          activeSessionId={state.session.id}
          activeSession={state.session}
          focusedLookup={focusedLookup}
          sessionHistory={state.sessionHistory}
          streamByLookupId={state.streamByLookupId}
          streamText={streamText}
          displayStreaming={displayStreaming}
          displayError={displayError}
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
          onDeleteLookup={handleDeleteLookup}
          onPanelLookup={handlePanelLookup}
          onFollowUp={handleFollowUp}
          onSelectHistory={(lk) => dispatch({ type: 'SELECT_LOOKUP', lookup: lk })}
          onClearLookup={() => dispatch({ type: 'CLEAR_LOOKUP' })}
          onClose={() => dispatch({ type: 'PANEL', open: false })}
          onSynced={(opts) => void refreshFromServer(opts)}
          onJumpTodo={handleJump}
          onToggleSourceForNote={handleToggleSourceForNote}
          onSourcesChange={() => {
            dispatch({ type: 'GLOSSARY_BUMP' })
            void syncMemoryBank()
          }}
          onDictionaryChange={handleDictionaryChange}
        />
      </div>
      <StatusBar
        chars={counts.chars}
        flags={counts.flags}
        actions={counts.actions}
        syncOk={state.syncOk}
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
