'use client'

import Link from 'next/link'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { countShorthandFlags } from '@/lib/uvimco-notes/triggerParser'
import { streamLookup } from '@/lib/uvimco-notes/streamClient'
import {
  createEmptySession,
  deleteSession,
  deleteSessionOnServer,
  exportSessionMarkdown,
  getEffectiveUserId,
  loadActiveSession,
  loadSessions,
  saveSessionToServer,
  setActiveSessionId,
  syncWithServer,
  upsertSession,
} from '@/lib/uvimco-notes/storage'
import type { Lookup, NoteSession, Screenshot, TriggerType } from '@/lib/uvimco-notes/types'
import AIPanel from './AIPanel'
import MeetingsSidebar from './MeetingsSidebar'
import NoteEditor from './NoteEditor'
import ShorthandBar from './ShorthandBar'
import StatusBar from './StatusBar'
import UvimcoHeader from './UvimcoHeader'

type State = {
  session: NoteSession
  sessions: NoteSession[]
  panelOpen: boolean
  currentLookup: Lookup | null
  sessionHistory: Lookup[]
  isStreaming: boolean
  streamText: string
  syncOk: boolean | null
}

type Action =
  | { type: 'SET_SESSIONS'; sessions: NoteSession[] }
  | { type: 'NOTES'; notes: string }
  | { type: 'TITLE'; title: string }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'PANEL'; open: boolean }
  | { type: 'LOOKUP_START'; lookup: Lookup }
  | { type: 'STREAM'; text: string }
  | { type: 'STREAM_DONE'; assistantText: string }
  | { type: 'STREAM_ERROR' }
  | { type: 'SELECT_LOOKUP'; lookup: Lookup }
  | { type: 'SCREENSHOT'; shot: Screenshot }
  | { type: 'SYNC_OK'; ok: boolean }
  | { type: 'LOAD_SESSION'; session: NoteSession }
  | { type: 'CLEAR_LOOKUP' }

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
    case 'PANEL_TOGGLE':
      return { ...state, panelOpen: !state.panelOpen }
    case 'PANEL':
      return { ...state, panelOpen: action.open }
    case 'LOOKUP_START':
      return {
        ...state,
        currentLookup: action.lookup,
        isStreaming: true,
        streamText: '',
        panelOpen: true,
      }
    case 'STREAM':
      return { ...state, streamText: action.text }
    case 'STREAM_DONE': {
      if (!state.currentLookup) return { ...state, isStreaming: false }
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
      return {
        ...state,
        currentLookup: lookup,
        sessionHistory,
        session,
        isStreaming: false,
      }
    }
    case 'STREAM_ERROR':
      return { ...state, isStreaming: false }
    case 'SELECT_LOOKUP': {
      const ans = action.lookup.conversation.find((m) => m.role === 'assistant')?.content ?? ''
      return { ...state, currentLookup: action.lookup, streamText: ans, isStreaming: false }
    }
    case 'SCREENSHOT': {
      const screenshots = { ...state.session.screenshots, [action.shot.id]: action.shot }
      return { ...state, session: { ...state.session, screenshots } }
    }
    case 'SYNC_OK':
      return { ...state, syncOk: action.ok }
    case 'LOAD_SESSION':
      return {
        ...state,
        session: action.session,
        sessionHistory: [...action.session.lookups].reverse(),
        currentLookup: null,
        streamText: '',
      }
    case 'CLEAR_LOOKUP':
      return { ...state, currentLookup: null, streamText: '' }
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
  const initial = loadActiveSession()
  const bootSessions = loadSessions()
  const [state, dispatch] = useReducer(reducer, {
    session: initial,
    sessions: bootSessions.length > 0 ? bootSessions : [initial],
    panelOpen: false,
    currentLookup: null,
    sessionHistory: [...initial.lookups].reverse(),
    isStreaming: false,
    streamText: '',
    syncOk: null,
  })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    if (mq.matches) dispatch({ type: 'PANEL', open: true })
    const fn = () => {
      if (!mq.matches) dispatch({ type: 'PANEL', open: false })
    }
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const streamBuf = useRef('')
  const rafRef = useRef<number | null>(null)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingRef = useRef(false)

  const persist = useCallback(async (session: NoteSession) => {
    const saved = upsertSession(session)
    const sessions = loadSessions()
    dispatch({ type: 'SET_SESSIONS', sessions })
    const ok = await saveSessionToServer(saved)
    dispatch({ type: 'SYNC_OK', ok })
  }, [])

  useEffect(() => {
    syncWithServer().then((r) => {
      dispatch({ type: 'SET_SESSIONS', sessions: r.sessions })
      const activeId = state.session.id
      const active = r.sessions.find((s) => s.id === activeId) ?? r.sessions[0]
      if (active) {
        dispatch({ type: 'LOAD_SESSION', session: active })
        setActiveSessionId(active.id)
      }
      dispatch({ type: 'SYNC_OK', ok: r.pushOk })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount sync once
  }, [])

  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void persist(state.session)
    }, 800)
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [state.session, persist])

  const runStream = useCallback(
    async (opts: {
      type: TriggerType
      query: string
      context: string
      conversation: Lookup['conversation']
      mode?: 'lookup' | 'followup' | 'decode'
      followUpQuestion?: string
    }) => {
      if (streamingRef.current) return
      streamingRef.current = true
      streamBuf.current = ''
      const shots = screenshotsInContext(state.session.notes, state.session.screenshots)

      await streamLookup({
        type: opts.type,
        query: opts.query,
        context: opts.context,
        conversation: opts.conversation,
        screenshots: shots,
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
        onError: () => dispatch({ type: 'STREAM_ERROR' }),
        onDone: () => {
          streamingRef.current = false
          dispatch({ type: 'STREAM_DONE', assistantText: streamBuf.current })
        },
      })
    },
    [state.session.notes, state.session.screenshots],
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
    (question: string) => {
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
    a.download = `uvimco-notes-${state.session.title.replace(/\s+/g, '-').slice(0, 40) || 'session'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [state.session])

  const handleDecodeAll = useCallback(() => {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'CLEAR_LOOKUP' })
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '\\') {
        e.preventDefault()
        dispatch({ type: 'PANEL_TOGGLE' })
      }
      if (e.key === 'k') {
        e.preventDefault()
        handleDecodeAll()
      }
      if (e.key === 's') {
        e.preventDefault()
        handleExport()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleDecodeAll, handleExport])

  const handleNewMeeting = useCallback(() => {
    upsertSession(state.session)
    const fresh = createEmptySession()
    setActiveSessionId(fresh.id)
    upsertSession(fresh)
    dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
    dispatch({ type: 'LOAD_SESSION', session: fresh })
  }, [state.session])

  const handleSelectMeeting = useCallback(
    (s: NoteSession) => {
      if (s.id !== state.session.id) upsertSession(state.session)
      setActiveSessionId(s.id)
      dispatch({ type: 'LOAD_SESSION', session: s })
    },
    [state.session],
  )

  const handleDeleteMeeting = useCallback(
    (sessionId: string) => {
      void deleteSessionOnServer(getEffectiveUserId(), sessionId)
      const next = deleteSession(sessionId)
      dispatch({ type: 'SET_SESSIONS', sessions: loadSessions() })
      if (next) dispatch({ type: 'LOAD_SESSION', session: next })
    },
    [],
  )

  const counts = countShorthandFlags(state.session.notes)
  const activeQuery = state.currentLookup?.type === 'word' ? state.currentLookup.query : null

  return (
    <div className="uvimco-notes-root bg-[var(--uv-bg-base)] text-[var(--uv-text-primary)]">
      <UvimcoHeader
        panelOpen={state.panelOpen}
        onTogglePanel={() => dispatch({ type: 'PANEL_TOGGLE' })}
        onExport={handleExport}
        onDecodeAll={handleDecodeAll}
        syncOk={state.syncOk}
        homeLink={
          <>
            <Link
              href="/"
              className="text-xs text-[var(--uv-text-secondary)] hover:text-[var(--uv-accent)]"
              data-testid="uvimco-home-link"
            >
              ← sfjc.dev
            </Link>
            <span className="text-xs font-semibold text-[var(--uv-text-primary)]">UVIMCO Notes</span>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MeetingsSidebar
          sessions={state.sessions}
          activeSessionId={state.session.id}
          onSelect={handleSelectMeeting}
          onNew={handleNewMeeting}
          onDelete={handleDeleteMeeting}
        />
        <section className="uvimco-notes-editor-pane min-w-0 flex-1">
          <input
            value={state.session.title}
            onChange={(e) => dispatch({ type: 'TITLE', title: e.target.value })}
            className="shrink-0 border-b border-[var(--uv-border)] bg-[var(--uv-bg-base)] px-5 py-3 text-xl font-semibold text-[var(--uv-text-primary)] placeholder:text-[var(--uv-text-muted)] focus:outline-none sm:px-6 sm:text-2xl"
            placeholder="Meeting title"
            aria-label="Meeting title"
            data-testid="uvimco-meeting-title"
          />
          <ShorthandBar />
          <div className="uvimco-notes-editor-body" data-testid="uvimco-editor">
            <NoteEditor
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
        <AIPanel
          isOpen={state.panelOpen}
          currentLookup={state.currentLookup}
          sessionHistory={state.sessionHistory}
          streamText={state.streamText}
          isStreaming={state.isStreaming}
          onFollowUp={handleFollowUp}
          onSelectHistory={(lk) => dispatch({ type: 'SELECT_LOOKUP', lookup: lk })}
          onClose={() => dispatch({ type: 'PANEL', open: false })}
        />
      </div>
      <StatusBar chars={counts.chars} flags={counts.flags} actions={counts.actions} />
    </div>
  )
}
