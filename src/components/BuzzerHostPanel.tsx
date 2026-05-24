'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import {
  annotateQueue,
  type Buzz,
  type BuzzerSession,
  type BuzzerStatus,
} from '@/lib/jeopardy-buzzer'
import type { JeopardyPlayOp, JeopardyPlayState } from '@/lib/jeopardy-play-ops'

interface BuzzerHostPanelProps {
  slug: string
  /** Live play state — used to map a buzzed-in player name to a team for one-click "+score". */
  playState: JeopardyPlayState
  dispatchPlayOp: (op: JeopardyPlayOp) => void
  /** Optional: amount to award (defaults to the value of the currently-open clue if any). */
  awardAmount?: number
  onClose: () => void
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

const STATUS_LABEL: Record<BuzzerStatus, string> = {
  idle: 'Idle',
  armed: 'ARMED',
  locked: 'Locked',
}

const STATUS_COLOR: Record<BuzzerStatus, string> = {
  idle: '#888',
  armed: '#16a34a',
  locked: '#dc2626',
}

// Short, satisfying "ding" — Web Audio synth so we don't ship an audio file.
function playBuzzDing() {
  if (typeof window === 'undefined') return
  type WindowWithAudio = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const w = window as WindowWithAudio
  const Ctor = w.AudioContext || w.webkitAudioContext
  if (!Ctor) return
  try {
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18)
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    setTimeout(() => ctx.close().catch(() => {}), 400)
  } catch { /* audio blocked — silent fail */ }
}

export default function BuzzerHostPanel({ slug, playState, dispatchPlayOp, awardAmount, onClose }: BuzzerHostPanelProps) {
  const [session, setSession] = useState<BuzzerSession | null>(null)
  const [queue, setQueue] = useState<Buzz[]>([])
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [pendingOp, setPendingOp] = useState(false)
  const sessionVersionRef = useRef(0)
  const queueRoundRef = useRef<string | null>(null)
  const seenBuzzIdsRef = useRef<Set<string>>(new Set())

  // ----- Create / fetch session for this board -----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/jeopardy/buzzer/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json() as { session: BuzzerSession }
        if (cancelled) return
        setSession(data.session)
        sessionVersionRef.current = data.session.version
        queueRoundRef.current = data.session.currentRoundId
        // Hydrate queue if a round is active.
        if (data.session.currentRoundId) {
          const r = await fetch(`/api/jeopardy/buzzer/sessions/${data.session.pin}`, { cache: 'no-store' })
          if (r.ok) {
            const d = await r.json() as { queue: Buzz[] }
            if (!cancelled) {
              setQueue(d.queue)
              d.queue.forEach((b) => seenBuzzIdsRef.current.add(b.id))
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Failed to start buzzer session')
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  // ----- QR code -----
  useEffect(() => {
    if (!session) return
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/games/jeopardy/buzz/${session.pin}`
      : `/games/jeopardy/buzz/${session.pin}`
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 220, color: { dark: '#1a1a1a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [session])

  // ----- Realtime subscriptions: session row + buzzes -----
  useEffect(() => {
    if (!session) return
    const sessionCh = supabase
      .channel(`buzzer:host:session:${session.id}`)
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
          // Round changed → clear local queue immediately.
          if (next.currentRoundId !== queueRoundRef.current) {
            queueRoundRef.current = next.currentRoundId
            setQueue([])
            seenBuzzIdsRef.current = new Set()
          }
        },
      )
      .subscribe()

    const buzzCh = supabase
      .channel(`buzzer:host:buzzes:${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jeopardy_buzzes', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as DbBuzzRow | null
          if (!row || !row.accepted) return
          // Ignore stale-round events (round_id changed mid-flight).
          if (queueRoundRef.current && row.round_id !== queueRoundRef.current) return
          const isFirstSeen = !seenBuzzIdsRef.current.has(row.id)
          seenBuzzIdsRef.current.add(row.id)
          const buzz = rowToBuzz(row)
          setQueue((prev) => {
            // Replace if existing (rank update), else insert in sorted position.
            const next = prev.filter((b) => b.id !== buzz.id)
            next.push(buzz)
            next.sort((a, b) => Date.parse(a.effectiveServerPressAt) - Date.parse(b.effectiveServerPressAt))
            return next
          })
          if (isFirstSeen && queue.length === 0) {
            // First buzz of the round → audio cue.
            playBuzzDing()
          }
        },
      )
      .subscribe()

    return () => {
      void sessionCh.unsubscribe()
      void buzzCh.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  // ----- Host actions -----
  const doPatch = useCallback(async (kind: 'arm' | 'clear' | 'lock' | 'unlock') => {
    if (!session) return
    setPendingOp(true)
    try {
      const res = await fetch(`/api/jeopardy/buzzer/sessions/${session.pin}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: { kind } }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { session: BuzzerSession }
      sessionVersionRef.current = data.session.version
      setSession(data.session)
      if (data.session.currentRoundId !== queueRoundRef.current) {
        queueRoundRef.current = data.session.currentRoundId
        setQueue([])
        seenBuzzIdsRef.current = new Set()
      }
    } catch (e) {
      setError((e as Error).message || `Failed to ${kind}`)
      setTimeout(() => setError(null), 3000)
    } finally {
      setPendingOp(false)
    }
  }, [session])

  const annotatedQueue = useMemo(() => annotateQueue(queue), [queue])

  // ----- Award helper: find a matching team by name (case-insensitive substring) -----
  const findTeamIndex = useCallback((playerName: string): number => {
    const needle = playerName.trim().toLowerCase()
    if (!needle) return -1
    return playState.teams.findIndex((t) => {
      const n = t.name.trim().toLowerCase()
      return n === needle || n.includes(needle) || needle.includes(n)
    })
  }, [playState.teams])

  const handleAward = useCallback((buzz: Buzz, sign: 1 | -1) => {
    const idx = findTeamIndex(buzz.name)
    if (idx < 0) {
      setError(`No team matches "${buzz.name}". Award manually from the team panel.`)
      setTimeout(() => setError(null), 3500)
      return
    }
    const amount = sign * (awardAmount ?? 200)
    dispatchPlayOp({ kind: 'adjustTeamScore', index: idx, delta: amount })
  }, [awardAmount, dispatchPlayOp, findTeamIndex])

  if (!session) {
    return (
      <div className="mt-6 mx-auto max-w-6xl rounded-xl border p-6 text-center"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-muted)' }}>
        {error ?? 'Starting buzzer session...'}
      </div>
    )
  }

  const status = session.status
  const statusColor = STATUS_COLOR[status]
  const armed = status === 'armed'

  return (
    <div className="mt-6 mx-auto max-w-6xl rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)' }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--ink-border)' }}>
        <div className="flex items-center gap-3">
          <span className="font-semibold" style={{ color: 'var(--ink-text)' }}>Buzzer</span>
          <span className="px-2 py-1 rounded text-xs font-bold uppercase" style={{ backgroundColor: statusColor, color: 'white' }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <button onClick={onClose}
          className="px-3 py-1 rounded-lg border text-sm hover:opacity-90"
          style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>
          Close
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>{error}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6 p-6">
        {/* Left: PIN + QR */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Join PIN</div>
          <div className="font-bold tracking-widest tabular-nums"
            style={{ fontSize: '6rem', lineHeight: 1, color: 'var(--ink-text)' }}>
            {session.pin}
          </div>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR for join PIN ${session.pin}`} width={220} height={220}
              className="rounded-lg border" style={{ borderColor: 'var(--ink-border)' }} />
          )}
          <div className="text-xs text-center" style={{ color: 'var(--ink-muted)' }}>
            sfjc.dev/games/jeopardy/buzz/{session.pin}
          </div>
        </div>

        {/* Right: controls + queue */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => doPatch('arm')}
              disabled={pendingOp}
              className="px-4 py-4 rounded-lg text-white font-bold text-lg shadow disabled:opacity-50"
              style={{ backgroundColor: armed ? '#15803d' : '#16a34a' }}>
              {armed ? 'Re-Arm (New Round)' : 'Arm'}
            </button>
            <button
              onClick={() => doPatch(status === 'locked' ? 'unlock' : 'lock')}
              disabled={pendingOp || status === 'idle'}
              className="px-4 py-4 rounded-lg text-white font-bold text-lg shadow disabled:opacity-40"
              style={{ backgroundColor: '#dc2626' }}>
              {status === 'locked' ? 'Unlock' : 'Lock'}
            </button>
            <button
              onClick={() => doPatch('clear')}
              disabled={pendingOp}
              className="px-4 py-4 rounded-lg font-bold text-lg shadow border disabled:opacity-50"
              style={{ backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)', borderColor: 'var(--ink-border)' }}>
              Clear
            </button>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--ink-muted)' }}>
              Queue ({annotatedQueue.length})
            </div>
            {annotatedQueue.length === 0 ? (
              <div className="text-sm py-6 text-center rounded-lg border"
                style={{ color: 'var(--ink-muted)', borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)' }}>
                {armed ? 'Waiting for first buzz...' : 'Arm the buzzer to start a round.'}
              </div>
            ) : (
              <ul className="space-y-2">
                {annotatedQueue.map((b, i) => (
                  <li key={b.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                    style={{ backgroundColor: i === 0 ? 'rgba(22, 163, 74, 0.08)' : 'var(--ink-bg)', borderColor: 'var(--ink-border)' }}>
                    <span className="font-bold tabular-nums text-lg w-7 text-right"
                      style={{ color: i === 0 ? '#15803d' : 'var(--ink-text)' }}>#{b.rank ?? i + 1}</span>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} aria-hidden />
                    <span className="font-semibold flex-1 truncate" style={{ color: 'var(--ink-text)' }}>{b.name}</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                      {i === 0 ? '0 ms' : `+${b.deltaFromFirstMs} ms`}
                    </span>
                    <button
                      onClick={() => handleAward(b, 1)}
                      className="px-2 py-1 rounded text-white text-sm font-bold"
                      style={{ backgroundColor: '#16a34a' }} title="Award points to matching team">
                      +
                    </button>
                    <button
                      onClick={() => handleAward(b, -1)}
                      className="px-2 py-1 rounded text-white text-sm font-bold"
                      style={{ backgroundColor: '#dc2626' }} title="Deduct points from matching team">
                      -
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
