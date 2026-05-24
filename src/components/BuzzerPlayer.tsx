'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  annotateQueue,
  measureClockOffset,
  type Buzz,
  type BuzzerSession,
  type BuzzerStatus,
} from '@/lib/jeopardy-buzzer'
import { getOrCreateIdentity, setEditorName, type EditorIdentity } from '@/lib/jeopardy-identity'

interface BuzzerPlayerProps {
  pin: string
  initialSession: BuzzerSession
  initialQueue: Buzz[]
  boardTitle: string | null
}

type DbBuzzRow = {
  id: string
  session_id: string
  round_id: string
  player_id: string
  name: string
  color: string
  client_press_at: string
  server_receive_at: string
  effective_server_press_at: string
  rank: number | null
  accepted: boolean
  reject_reason: string | null
}

function rowToBuzz(r: DbBuzzRow): Buzz {
  return {
    id: r.id,
    sessionId: r.session_id,
    roundId: r.round_id,
    playerId: r.player_id,
    name: r.name,
    color: r.color,
    clientPressAt: r.client_press_at,
    serverReceiveAt: r.server_receive_at,
    effectiveServerPressAt: r.effective_server_press_at,
    rank: r.rank,
    accepted: r.accepted,
    rejectReason: r.reject_reason,
  }
}

type CalibrationState = 'idle' | 'calibrating' | 'ready' | 'error'

async function pingClock(pin: string, t0: number): Promise<{ t0: number; tS: number }> {
  const res = await fetch(`/api/jeopardy/buzzer/sessions/${pin}/clock?t0=${t0}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('clock ping failed')
  return await res.json()
}

export default function BuzzerPlayer({ pin, initialSession, initialQueue, boardTitle }: BuzzerPlayerProps) {
  const [identity, setIdentity] = useState<EditorIdentity | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [calibration, setCalibration] = useState<CalibrationState>('idle')
  const [offsetMs, setOffsetMs] = useState(0)
  const [rttMs, setRttMs] = useState(0)
  const [session, setSession] = useState<BuzzerSession>(initialSession)
  const [queue, setQueue] = useState<Buzz[]>(initialQueue)
  const [pendingBuzz, setPendingBuzz] = useState(false)
  const [rejectReason, setRejectReason] = useState<string | null>(null)

  const sessionVersionRef = useRef(initialSession.version)
  const queueRoundRef = useRef<string | null>(initialSession.currentRoundId)
  const offsetRef = useRef(0)
  // Tracks whether THIS player has already buzzed in the current round.
  const lastBuzzedRoundRef = useRef<string | null>(null)

  // ----- Load identity from localStorage; prompt for name if missing -----
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = getOrCreateIdentity()
    if (!id.name) {
      setPendingName('')
    } else {
      setIdentity(id)
    }
  }, [])

  const confirmName = useCallback(() => {
    const trimmed = pendingName.trim()
    if (!trimmed) return
    setEditorName(trimmed)
    setIdentity(getOrCreateIdentity())
  }, [pendingName])

  // ----- Clock sync (runs once identity is ready, then again every 30s + on visibility) -----
  const calibrate = useCallback(async () => {
    setCalibration('calibrating')
    try {
      const { offsetMs: off, rttMs: rtt } = await measureClockOffset((t0) => pingClock(pin, t0))
      offsetRef.current = off
      setOffsetMs(off)
      setRttMs(rtt)
      setCalibration('ready')
    } catch {
      setCalibration('error')
    }
  }, [pin])

  useEffect(() => {
    if (!identity) return
    let cancelled = false
    ;(async () => {
      await calibrate()
      if (cancelled) return
      try {
        await fetch(`/api/jeopardy/buzzer/sessions/${pin}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: identity.id,
            name: identity.name,
            color: identity.color,
            clockOffsetMs: offsetRef.current,
          }),
        })
      } catch { /* ignore — clock-sync still local */ }
    })()
    return () => { cancelled = true }
  }, [identity, calibrate, pin])

  // Re-calibrate periodically (drift correction) + on tab refocus.
  useEffect(() => {
    if (!identity) return
    const id = setInterval(() => { void calibrate() }, 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') void calibrate() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [identity, calibrate])

  // ----- Realtime subscriptions -----
  useEffect(() => {
    const sessCh = supabase
      .channel(`buzzer:player:session:${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jeopardy_buzzer_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new as Record<string, unknown> | null
          if (!row) return
          const incomingVersion = typeof row.version === 'number' ? row.version : 0
          if (incomingVersion <= sessionVersionRef.current) return
          sessionVersionRef.current = incomingVersion
          const next: BuzzerSession = {
            id: row.id as string,
            boardId: row.board_id as string,
            pin: row.pin as string,
            status: row.status as BuzzerStatus,
            armedAt: (row.armed_at as string | null) ?? null,
            lockedAt: (row.locked_at as string | null) ?? null,
            currentRoundId: (row.current_round_id as string | null) ?? null,
            version: incomingVersion,
            updatedAt: row.updated_at as string,
          }
          setSession(next)
          if (next.currentRoundId !== queueRoundRef.current) {
            queueRoundRef.current = next.currentRoundId
            setQueue([])
            setRejectReason(null)
          }
        },
      )
      .subscribe()

    const buzzCh = supabase
      .channel(`buzzer:player:buzzes:${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jeopardy_buzzes', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as DbBuzzRow | null
          if (!row || !row.accepted) return
          if (queueRoundRef.current && row.round_id !== queueRoundRef.current) return
          const buzz = rowToBuzz(row)
          setQueue((prev) => {
            const next = prev.filter((b) => b.id !== buzz.id)
            next.push(buzz)
            next.sort((a, b) => Date.parse(a.effectiveServerPressAt) - Date.parse(b.effectiveServerPressAt))
            return next
          })
        },
      )
      .subscribe()

    return () => {
      void sessCh.unsubscribe()
      void buzzCh.unsubscribe()
    }
  }, [session.id])

  // ----- Press handler -----
  const myBuzz = useMemo(() => {
    if (!identity) return null
    return queue.find((b) => b.playerId === identity.id) ?? null
  }, [queue, identity])

  const myRank = myBuzz?.rank ?? null
  const annotated = useMemo(() => annotateQueue(queue), [queue])

  const handleBuzz = useCallback(async () => {
    if (!identity) return
    if (session.status !== 'armed') return
    if (myBuzz) return // already buzzed this round
    // CAPTURE PRESS TIME FIRST — before any async work or React state churn.
    const clientPressAt = Date.now()
    setPendingBuzz(true)
    setRejectReason(null)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(60) } catch { /* ignore */ }
    }
    lastBuzzedRoundRef.current = session.currentRoundId
    try {
      const res = await fetch(`/api/jeopardy/buzzer/sessions/${pin}/buzz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: identity.id,
          name: identity.name,
          color: identity.color,
          clientPressAt,
          clockOffsetMs: offsetRef.current,
        }),
      })
      if (!res.ok) throw new Error(`buzz failed: ${res.status}`)
      const data = await res.json() as { rejected?: boolean; reason?: string; queue?: Buzz[] }
      if (data.rejected) {
        setRejectReason(data.reason ?? 'rejected')
      } else if (Array.isArray(data.queue)) {
        setQueue(data.queue)
      }
    } catch {
      setRejectReason('network_error')
    } finally {
      setPendingBuzz(false)
    }
  }, [identity, session.status, session.currentRoundId, myBuzz, pin])

  // ----- Render gates -----

  if (identity === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border p-6"
          style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-text)' }}>Pick a name</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>
            Shown to the host and other players. PIN: <span className="font-bold tabular-nums">{pin}</span>
          </p>
          <input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value.slice(0, 40))}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmName() }}
            placeholder="Your name"
            className="w-full px-3 py-2 rounded-lg border mb-3 outline-none"
            style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            autoFocus
          />
          <button
            onClick={confirmName}
            disabled={!pendingName.trim()}
            className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--ink-accent)' }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (calibration !== 'ready') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 text-center">
        <div>
          <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--ink-muted)' }}>
            {calibration === 'error' ? 'Calibration failed' : 'Calibrating timing'}
          </div>
          <div className="text-2xl font-semibold mb-4" style={{ color: 'var(--ink-text)' }}>
            Levelling the playing field
          </div>
          <div className="flex items-center justify-center gap-1 mb-4" aria-hidden>
            <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ink-accent)', animationDelay: '0ms' }} />
            <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ink-accent)', animationDelay: '150ms' }} />
            <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ink-accent)', animationDelay: '300ms' }} />
          </div>
          {calibration === 'error' && (
            <button onClick={() => void calibrate()}
              className="px-4 py-2 rounded-lg border"
              style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // ----- Main buzzer view -----
  const status = session.status
  const armed = status === 'armed'
  const alreadyBuzzed = !!myBuzz
  const canBuzz = armed && !alreadyBuzzed && !pendingBuzz

  let label = 'Waiting for host'
  let subLabel: string | null = null
  let buttonBg = '#6b7280' // gray
  if (status === 'locked') { label = 'Locked'; subLabel = 'Host has locked the buzzer' }
  else if (status === 'idle') { label = 'Stand by'; subLabel = 'Host has not armed yet' }
  else if (armed && alreadyBuzzed) {
    label = `#${myRank ?? '?'}`
    subLabel = myBuzz ? (myRank === 1 ? 'You buzzed first!' : `${annotated.find((a) => a.id === myBuzz.id)?.deltaFromFirstMs ?? 0} ms behind #1`) : null
    buttonBg = myRank === 1 ? '#15803d' : '#3b82f6'
  } else if (armed) {
    label = 'BUZZ'
    subLabel = 'Tap as fast as you can'
    buttonBg = '#dc2626'
  }
  if (pendingBuzz) { label = 'Sending...'; subLabel = null; buttonBg = '#3b82f6' }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between text-xs"
        style={{ borderBottom: '1px solid var(--ink-border)', color: 'var(--ink-muted)', backgroundColor: 'var(--ink-paper)' }}>
        <div className="truncate">
          {boardTitle ? <span className="font-semibold" style={{ color: 'var(--ink-text)' }}>{boardTitle}</span> : <span>Buzzer</span>}
          <span className="ml-2">PIN {pin}</span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span>{identity.name}</span>
          <span title="Round-trip latency to server">RTT {rttMs}ms</span>
          <span title="Clock offset (client → server)">Δ {offsetMs >= 0 ? '+' : ''}{offsetMs}ms</span>
        </div>
      </div>

      {/* Big button */}
      <button
        onClick={handleBuzz}
        disabled={!canBuzz}
        className="flex-1 w-full text-white font-extrabold transition-transform active:scale-[0.97]"
        style={{
          backgroundColor: buttonBg,
          fontSize: 'clamp(3rem, 18vw, 8rem)',
          letterSpacing: '0.04em',
          touchAction: 'manipulation',
        }}
      >
        <div className="flex flex-col items-center justify-center gap-3 px-6">
          <span>{label}</span>
          {subLabel && <span className="text-base sm:text-lg font-medium opacity-90" style={{ letterSpacing: 0 }}>{subLabel}</span>}
          {rejectReason && (
            <span className="text-sm font-medium px-3 py-1 rounded mt-2" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
              {rejectReason === 'pressed_before_armed' ? 'Too early — wait for ARM' :
               rejectReason === 'round_not_armed' ? 'Buzzer not armed yet' :
               rejectReason === 'network_error' ? 'Network error, try again' :
               rejectReason}
            </span>
          )}
        </div>
      </button>

      {/* Mini queue footer */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}>
        {annotated.length === 0 ? (
          <div className="text-xs text-center" style={{ color: 'var(--ink-muted)' }}>No one has buzzed this round.</div>
        ) : (
          <ol className="flex gap-2 overflow-x-auto text-xs whitespace-nowrap">
            {annotated.slice(0, 5).map((b, i) => (
              <li key={b.id} className="flex items-center gap-1 px-2 py-1 rounded"
                style={{ backgroundColor: i === 0 ? 'rgba(22, 163, 74, 0.1)' : 'var(--ink-bg)', color: 'var(--ink-text)' }}>
                <span className="font-bold">#{b.rank ?? i + 1}</span>
                <span>{b.name}</span>
                <span className="tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                  {i === 0 ? '0ms' : `+${b.deltaFromFirstMs}ms`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
