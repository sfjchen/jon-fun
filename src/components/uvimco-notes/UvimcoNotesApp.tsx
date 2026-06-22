'use client'

import Link from 'next/link'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { assembleClientContext } from '@/lib/uvimco-notes/contextAssembler'
import { upsertFromLookup } from '@/lib/uvimco-notes/glossary'
import { pushGlossaryToServer, syncMemoryBank } from '@/lib/uvimco-notes/memorySync'
import { countShorthandFlags } from '@/lib/uvimco-notes/triggerParser'
import { streamLookup } from '@/lib/uvimco-notes/streamClient'
import { loadNotesUiPrefs, saveNotesUiPrefs } from '@/lib/uvimco-notes/prefs'
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
} from '@/lib/uvimco-notes/storage'
import type { Lookup, NoteMetadata, NoteSession, Screenshot, TriggerType } from '@/lib/uvimco-notes/types'
import SidePanel from './SidePanel'
import EditorShell from './EditorShell'
import type { NoteEditorHandle } from './NoteEditor'
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
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  isStreaming: boolean
  streamText: string
  streamError: string | null
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
  | { type: 'LOOKUP_START'; lookup: Lookup }
  | { type: 'STREAM'; text: string }
  | { type: 'STREAM_DONE'; assistantText: string }
  | { type: 'STREAM_ERROR'; message: string }
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
    currentLookup: null,
    sessionHistory: [...initial.lookups].reverse(),
    isStreaming: false,
    streamText: '',
    streamError: null,
    syncOk: null,
    glossaryRefreshKey: 0,
  }
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
    case 'LOOKUP_START':
      return {
        ...state,
        currentLookup: action.lookup,
        isStreaming: true,
        streamText: '',
        streamError: null,
        panelOpen: true,
        aiListOpen: true,
      }
    case 'STREAM':
      return { ...state, streamText: action.text }
    case 'STREAM_DONE': {
      if (!state.currentLookup) return { ...state, isStreaming: false }
      if (!action.assistantText.trim()) return { ...state, isStreaming: false }
      const lookup: Lookup = {
        ...state.currentLookup,
        conversation: [
          ...state.currentLookup.conversation,
          { role: 'assistant', content: action.assistantText },
        ],
      }
      const lookups = [...state.session.lookups.filter((l) => l.id !== lookup.id), lookup]
      const sessionHistory = [lookup, ...state.sessionHistory.filter((l) => l.id !== lookup.id)]
      const session = { ...state.session, lookups }
      upsertFromLookup(lookup, session.id)
      return {
        ...state,
        currentLookup: lookup,
        sessionHistory,
        session,
        isStreaming: false,
        glossaryRefreshKey: state.glossaryRefreshKey + 1,
      }
    }
    case 'STREAM_ERROR':
      return { ...state, isStreaming: false, streamError: action.message }
    case 'SELECT_LOOKUP': {
      const ans = action.lookup.conversation.find((m) => m.role === 'assistant')?.content ?? ''
      return {
        ...state,
        currentLookup: action.lookup,
        streamText: ans,
        isStreaming: false,
        streamError: null,
      }
    }
    case 'SCREENSHOT': {
      const screenshots = { ...state.session.screenshots, [action.shot.id]: action.shot }
      return { ...state, session: { ...state.session, screenshots } }
    }
    case 'SYNC_OK':
      return { ...state, syncOk: action.ok }
    case 'LOAD_SESSION': {
      const preserveAi = action.preserveAi && (state.isStreaming || state.currentLookup)
      return {
        ...state,
        session: action.session,
        sessionHistory: [...action.session.lookups].reverse(),
        currentLookup: preserveAi ? state.currentLookup : null,
        streamText: preserveAi ? state.streamText : '',
        streamError: preserveAi ? state.streamError : null,
      }
    }
    case 'CLEAR_LOOKUP':
      return { ...state, currentLookup: null, streamText: '', streamError: null }
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

export default function UvimcoNotesApp() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const editorRef = useRef<NoteEditorHandle>(null)

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
    saveNotesUiPrefs({ panelOpen: state.panelOpen, notesListOpen: state.notesListOpen })
  }, [state.panelOpen, state.notesListOpen])

  const streamBuf = useRef('')
  const rafRef = useRef<number | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingRef = useRef(false)
  const sessionRef = useRef(state.session)
  const sessionsRef = useRef(state.sessions)
  const aiActiveRef = useRef(false)
  sessionRef.current = state.session
  sessionsRef.current = state.sessions
  aiActiveRef.current = state.isStreaming || state.currentLookup !== null

  const refreshFromServer = useCallback(async () => {
    const r = await syncWithServer()
    const mem = await syncMemoryBank()
    dispatch({ type: 'GLOSSARY_BUMP' })
    dispatch({ type: 'SET_SESSIONS', sessions: r.sessions })
    const activeId = sessionRef.current.id
    const active = r.sessions.find((s) => s.id === activeId) ?? r.sessions[0]
    if (active) {
      dispatch({ type: 'LOAD_SESSION', session: active, preserveAi: aiActiveRef.current })
      setActiveSessionId(active.id)
    }
    const ok = r.pushOk && mem.glossaryOk && mem.sourcesOk
    dispatch({ type: 'SYNC_OK', ok })
    return r
  }, [])

  const persist = useCallback(async (session: NoteSession) => {
    const saved = upsertSession(session)
    const sessions = loadSessions()
    dispatch({ type: 'SET_SESSIONS', sessions })
    const ok = await saveSessionToServer(saved)
    dispatch({ type: 'SYNC_OK', ok })
  }, [])

  useEffect(() => {
    setSyncing(true)
    refreshFromServer().finally(() => setSyncing(false))
  }, [refreshFromServer])

  useEffect(() => {
    setSaving(true)
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void persist(state.session).finally(() => setSaving(false))
    }, 800)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [state.session, persist])

  useEffect(() => {
    const fn = () => upsertSession(sessionRef.current)
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [])

  useEffect(() => {
    const intervalMs = document.visibilityState === 'visible' ? 5 * 60_000 : 60 * 60_000
    const id = window.setInterval(() => {
      void refreshFromServer()
    }, intervalMs)
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
      type: TriggerType
      query: string
      context: string
      conversation: Lookup['conversation']
      mode?: 'lookup' | 'followup' | 'decode'
      followUpQuestion?: string
      extraScreenshots?: Screenshot[]
    }) => {
      if (streamingRef.current) return
      streamingRef.current = true
      streamBuf.current = ''

      const ctx = assembleClientContext({
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
          streamBuf.current += token
          if (rafRef.current) return
          rafRef.current = requestAnimationFrame(() => {
            dispatch({ type: 'STREAM', text: streamBuf.current })
            rafRef.current = null
          })
        },
        onError: (msg) => dispatch({ type: 'STREAM_ERROR', message: msg }),
        onDone: () => {
          streamingRef.current = false
          dispatch({ type: 'STREAM_DONE', assistantText: streamBuf.current })
          void pushGlossaryToServer()
        },
      })
    },
    [],
  )

  const handleTrigger = useCallback(
    (type: TriggerType, query: string, context: string) => {
      const lookup: Lookup = {
        id: `lk-${Date.now()}`,
        type,
        query,
        context,
        conversation: [],
        triggeredAt: new Date().toISOString(),
      }
      dispatch({ type: 'LOOKUP_START', lookup })
      void runStream({ type, query, context, conversation: [] })
    },
    [runStream],
  )

  const handleFollowUp = useCallback(
    (question: string, extraScreenshots?: Screenshot[]) => {
      const lk = state.currentLookup
      if (!lk || state.isStreaming) return
      const conversation = [...lk.conversation, { role: 'user' as const, content: question }]
      const updated = { ...lk, conversation }
      dispatch({ type: 'LOOKUP_START', lookup: updated })
      void runStream({
        type: lk.type,
        query: lk.query,
        context: lk.context,
        conversation: lk.conversation,
        mode: 'followup',
        followUpQuestion: question,
        ...(extraScreenshots?.length ? { extraScreenshots } : {}),
      })
    },
    [state.currentLookup, state.isStreaming, runStream],
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false)
        else if (state.panelOpen && !state.isStreaming) dispatch({ type: 'PANEL', open: false })
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
  }, [handleSummarize, handleExport, handleNewNote, state.panelOpen, state.isStreaming, searchOpen])

  const counts = countShorthandFlags(state.session.notes)
  const activeQuery = state.currentLookup?.query ?? null

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
          currentLookup={state.currentLookup}
          sessionHistory={state.sessionHistory}
          streamText={state.streamText}
          isStreaming={state.isStreaming}
          streamError={state.streamError}
          notesListOpen={state.notesListOpen}
          aiListOpen={state.aiListOpen}
          glossaryRefreshKey={state.glossaryRefreshKey}
          onNotesListOpenChange={(open) => dispatch({ type: 'NOTES_LIST', open })}
          onAiListOpenChange={(open) => dispatch({ type: 'AI_LIST', open })}
          onSelectMeeting={handleSelectMeeting}
          onNewMeeting={handleNewNote}
          onDeleteMeeting={handleDeleteMeeting}
          onFollowUp={handleFollowUp}
          onSelectHistory={(lk) => dispatch({ type: 'SELECT_LOOKUP', lookup: lk })}
          onClose={() => dispatch({ type: 'PANEL', open: false })}
          onSynced={() => void refreshFromServer()}
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
      />
    </div>
  )
}
