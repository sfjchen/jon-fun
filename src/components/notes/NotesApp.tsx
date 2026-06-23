'use client'

import Link from 'next/link'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { assembleClientContextAsync } from '@/lib/notes/contextAssembler'
import { upsertFromLookup } from '@/lib/notes/glossary'
import {
  activeStreamCount,
  anyStreaming,
  emptyStream,
  isLookupStreaming,
  streamTextFor,
  type LookupStreamMap,
} from '@/lib/notes/lookupStreams'
import { pushGlossaryToServer, syncMemoryBank } from '@/lib/notes/memorySync'
import { countShorthandFlags } from '@/lib/notes/triggerParser'
import { streamLookup } from '@/lib/notes/streamClient'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/notes/prefs'
import {
  createEmptySession,
  deleteSession,
  deleteSessionOnServer,
  exportSessionMarkdown,
  getEffectiveUserId,
  getOrCreateUserId,
  loadActiveSession,
  loadSessions,
  saveSessionToServer,
  setActiveSessionId,
  syncWithServer,
  upsertSession,
} from '@/lib/notes/storage'
import type { Lookup, NoteMetadata, NoteSession, Screenshot, TriggerType } from '@/lib/notes/types'
import SidePanel from './SidePanel'
import EditorShell from './EditorShell'
import type { NoteEditorHandle } from './EditorShell'
import ShorthandBar from './ShorthandBar'
import StatusBar from './StatusBar'
import NotesHeader from './NotesHeader'
import GlobalSearch from './GlobalSearch'
import NoteMetaBar from './NoteMetaBar'

type State = {
  session: NoteSession
  sessions: NoteSession[]
  panelOpen: boolean
  notesListOpen: boolean
  aiListOpen: boolean
  syncOpen: boolean
  glossaryOpen: boolean
  sourcesOpen: boolean
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
  | { type: 'TAGS'; tags: string[] }
  | { type: 'METADATA'; metadata: NoteMetadata }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'PANEL'; open: boolean }
  | { type: 'NOTES_LIST'; open: boolean }
  | { type: 'AI_LIST'; open: boolean }
  | { type: 'SYNC_OPEN'; open: boolean }
  | { type: 'GLOSSARY_OPEN'; open: boolean }
  | { type: 'SOURCES_OPEN'; open: boolean }
  | { type: 'LOOKUP_START'; lookup: Lookup }
  | { type: 'STREAM'; lookupId: string; text: string }
  | { type: 'STREAM_DONE'; lookupId: string; assistantText: string }
  | { type: 'STREAM_ERROR'; lookupId: string; message: string }
  | { type: 'SELECT_LOOKUP'; lookup: Lookup }
  | { type: 'SCREENSHOT'; shot: Screenshot }
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
    notesListOpen: prefs.notesListOpen ?? false,
    aiListOpen: true,
    syncOpen: prefs.syncOpen ?? false,
    glossaryOpen: false,
    sourcesOpen: false,
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
      const session = { ...state.session, notes: action.notes }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'TITLE': {
      const session = { ...state.session, title: action.title }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'TAGS': {
      const session = { ...state.session, tags: action.tags }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
    }
    case 'METADATA': {
      const session = { ...state.session, metadata: action.metadata }
      const sessions = state.sessions.map((s) => (s.id === session.id ? session : s))
      return { ...state, session, sessions }
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
      const session = upsertLookupInSession(state.session, lookup)
      upsertFromLookup(lookup, session.id)
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
      return {
        ...state,
        currentLookup: action.lookup,
        focusedLookupId: action.lookup.id,
      }
    }
    case 'SCREENSHOT': {
      const screenshots = { ...state.session.screenshots, [action.shot.id]: action.shot }
      return { ...state, session: { ...state.session, screenshots } }
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
  const editorRef = useRef<NoteEditorHandle>(null)

  const streamBufs = useRef<Record<string, string>>({})
  const rafByLookup = useRef<Record<string, number>>({})

  useEffect(() => {
    getOrCreateUserId()
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
      syncOpen: state.syncOpen,
    })
  }, [state.panelOpen, state.notesListOpen, state.syncOpen])

  const sessionRef = useRef(state.session)
  const sessionsRef = useRef(state.sessions)
  const streamRef = useRef(state.streamByLookupId)
  sessionRef.current = state.session
  sessionsRef.current = state.sessions
  streamRef.current = state.streamByLookupId

  const persistLocal = useCallback((session: NoteSession) => {
    upsertSession(session)
    const sessions = loadSessions()
    dispatch({ type: 'SET_SESSIONS', sessions })
  }, [])

  const pushToServer = useCallback(async (session: NoteSession) => {
    const ok = await saveSessionToServer(session)
    dispatch({ type: 'SYNC_OK', ok })
    return ok
  }, [])

  const refreshFromServer = useCallback(async (opts?: { skipPersist?: boolean }) => {
    if (!opts?.skipPersist) persistLocal(sessionRef.current)
    const r = await syncWithServer()
    const mem = await syncMemoryBank()
    dispatch({ type: 'GLOSSARY_BUMP' })
    dispatch({ type: 'SET_SESSIONS', sessions: r.sessions })
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
      void pushToServer(state.session).finally(() => setSaving(false))
    }, 800)
    return () => clearTimeout(t)
  }, [state.session, pushToServer])

  useEffect(() => {
    const fn = () => upsertSession(sessionRef.current)
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [])

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
      mode?: 'lookup' | 'followup' | 'decode'
      followUpQuestion?: string
      extraScreenshots?: Screenshot[]
    }) => {
      streamBufs.current[opts.lookupId] = ''

      const ctx = await assembleClientContextAsync({
        query: opts.query,
        activeSession: sessionRef.current,
        allSessions: sessionsRef.current,
      })

      const noteShots = screenshotsInContext(sessionRef.current.notes, sessionRef.current.screenshots)
      const screenshots = [...noteShots, ...(opts.extraScreenshots ?? [])]

      await streamLookup({
        type: opts.type,
        query: opts.query,
        context: opts.context,
        conversation: opts.conversation,
        screenshots,
        glossaryBlock: ctx.glossaryBlock,
        sourcesBlock: ctx.sourcesBlock,
        relatedNotesBlock: ctx.relatedNotesBlock,
        noteTags: ctx.noteTags,
        noteDomain: sessionRef.current.metadata?.domain ?? ctx.domainId,
        fullNotes: sessionRef.current.notes,
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
          dispatch({
            type: 'STREAM_DONE',
            lookupId: opts.lookupId,
            assistantText: streamBufs.current[opts.lookupId] ?? '',
          })
          void pushGlossaryToServer()
        },
      })
    },
    [],
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
      void runStream({ lookupId: lookup.id, type, query, context, conversation: [] })
    },
    [runStream],
  )

  const handleFollowUp = useCallback(
    (question: string, extraScreenshots?: Screenshot[]) => {
      const lk = state.currentLookup
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
        mode: 'followup',
        followUpQuestion: question,
        ...(extraScreenshots?.length ? { extraScreenshots } : {}),
      })
    },
    [state.currentLookup, state.streamByLookupId, runStream],
  )

  const handleExport = useCallback(() => {
    const md = exportSessionMarkdown(state.session)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes-${state.session.title.replace(/\s+/g, '-').slice(0, 40) || 'session'}.md`
    a.click()
    URL.revokeObjectURL(url)
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

  const handleNewNote = useCallback(() => {
    upsertSession(state.session)
    const fresh = createEmptySession()
    setActiveSessionId(fresh.id)
    upsertSession(fresh)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    dispatch({ type: 'LOAD_SESSION', session: fresh })
    dispatch({ type: 'PANEL', open: true })
    dispatch({ type: 'NOTES_LIST', open: true })
  }, [state.session])

  const handleSelectMeeting = useCallback(
    (s: NoteSession) => {
      if (s.id !== state.session.id) upsertSession(state.session)
      setActiveSessionId(s.id)
      dispatch({ type: 'LOAD_SESSION', session: s })
    },
    [state.session],
  )

  const handleDeleteMeeting = useCallback((sessionId: string) => {
    void deleteSessionOnServer(getEffectiveUserId(), sessionId)
    const next = deleteSession(sessionId)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    if (next) dispatch({ type: 'LOAD_SESSION', session: next })
  }, [])

  const handleJump = useCallback(
    (sessionId: string, lineIndex?: number) => {
      const target = state.sessions.find((s) => s.id === sessionId)
      if (!target) return
      if (target.id !== state.session.id) {
        upsertSession(state.session)
        setActiveSessionId(target.id)
        dispatch({ type: 'LOAD_SESSION', session: target })
      }
      if (lineIndex != null) {
        setTimeout(() => editorRef.current?.scrollToLine(lineIndex), 100)
      }
    },
    [state.sessions, state.session],
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
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '\\') {
        e.preventDefault()
        dispatch({ type: 'PANEL_TOGGLE' })
      }
      if (e.key === 'k') {
        e.preventDefault()
        handleSummarize()
      }
      if (e.key === 's') {
        e.preventDefault()
        handleExport()
      }
      if (e.shiftKey && e.key === 'N') {
        e.preventDefault()
        handleNewNote()
      }
      if (e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSummarize, handleExport, handleNewNote, state.panelOpen, aiBusy, searchOpen])

  const focusedId = state.focusedLookupId ?? state.currentLookup?.id ?? null
  const focusedLookup =
    state.currentLookup ??
    (focusedId ? state.sessionHistory.find((l) => l.id === focusedId) ?? null : null)
  const convAns =
    [...(focusedLookup?.conversation ?? [])].reverse().find((m) => m.role === 'assistant')?.content ?? ''
  const displayText = streamTextFor(state.streamByLookupId, focusedId, convAns)
  const displayStreaming = focusedId ? isLookupStreaming(state.streamByLookupId, focusedId) : false
  const displayError = focusedId ? (state.streamByLookupId[focusedId]?.error ?? null) : null

  const counts = countShorthandFlags(state.session.notes)
  const activeQuery = focusedLookup?.query ?? null

  return (
    <div className="uvimco-notes-root bg-[var(--uv-bg-base)] text-[var(--uv-text-primary)]">
      <NotesHeader
        panelOpen={state.panelOpen}
        onTogglePanel={() => dispatch({ type: 'PANEL_TOGGLE' })}
        onExport={handleExport}
        onSummarize={handleSummarize}
        onNewNote={handleNewNote}
        onOpenSearch={() => setSearchOpen(true)}
        homeLink={
          <>
            <Link
              href="/"
              className="text-xs text-[var(--uv-text-secondary)] hover:text-[var(--uv-accent)]"
              data-testid="notes-home-link"
            >
              ← sfjc.dev
            </Link>
            <span className="text-xs font-semibold text-[var(--uv-text-primary)]">Notes</span>
          </>
        }
      />
      <GlobalSearch
        open={searchOpen}
        sessions={state.sessions}
        onClose={() => setSearchOpen(false)}
        onJump={handleJump}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="uvimco-notes-editor-pane min-w-0 flex-1">
          <input
            value={state.session.title}
            onChange={(e) => dispatch({ type: 'TITLE', title: e.target.value })}
            className="shrink-0 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-5 py-3 text-xl font-semibold text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none sm:px-6 sm:text-2xl"
            placeholder="Note title"
            aria-label="Note title"
            data-testid="notes-meeting-title"
          />
          <NoteMetaBar
            tags={state.session.tags ?? []}
            {...(state.session.metadata ? { metadata: state.session.metadata } : {})}
            onTagsChange={(tags) => dispatch({ type: 'TAGS', tags })}
            onMetadataChange={(metadata) => dispatch({ type: 'METADATA', metadata })}
          />
          <ShorthandBar />
          <div className="uvimco-notes-editor-body" data-testid="notes-editor">
            <EditorShell
              ref={editorRef}
              value={state.session.notes}
              onChange={(notes) => dispatch({ type: 'NOTES', notes })}
              onTrigger={handleTrigger}
              onScreenshotPaste={(id, base64, mimeType) =>
                dispatch({ type: 'SCREENSHOT', shot: { id, base64, mimeType } })
              }
              activeTriggerQuery={activeQuery}
            />
          </div>
        </section>
        <SidePanel
          isOpen={state.panelOpen}
          sessions={state.sessions}
          activeSessionId={state.session.id}
          focusedLookup={focusedLookup}
          sessionHistory={state.sessionHistory}
          streamByLookupId={state.streamByLookupId}
          displayText={displayText}
          displayStreaming={displayStreaming}
          displayError={displayError}
          aiActiveCount={aiActiveCount}
          notesListOpen={state.notesListOpen}
          aiListOpen={state.aiListOpen}
          syncOpen={state.syncOpen}
          glossaryOpen={state.glossaryOpen}
          sourcesOpen={state.sourcesOpen}
          glossaryRefreshKey={state.glossaryRefreshKey}
          onNotesListOpenChange={(open) => dispatch({ type: 'NOTES_LIST', open })}
          onAiListOpenChange={(open) => dispatch({ type: 'AI_LIST', open })}
          onSyncOpenChange={(open) => dispatch({ type: 'SYNC_OPEN', open })}
          onGlossaryOpenChange={(open) => dispatch({ type: 'GLOSSARY_OPEN', open })}
          onSourcesOpenChange={(open) => dispatch({ type: 'SOURCES_OPEN', open })}
          onSelectMeeting={handleSelectMeeting}
          onNewMeeting={handleNewNote}
          onDeleteMeeting={handleDeleteMeeting}
          onFollowUp={handleFollowUp}
          onSelectHistory={(lk) => dispatch({ type: 'SELECT_LOOKUP', lookup: lk })}
          onClose={() => dispatch({ type: 'PANEL', open: false })}
          onSynced={(opts) => void refreshFromServer(opts)}
          onJumpTodo={handleJump}
          onSourcesChange={() => {
            dispatch({ type: 'GLOSSARY_BUMP' })
            void syncMemoryBank()
          }}
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
      />
    </div>
  )
}
