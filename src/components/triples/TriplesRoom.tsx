'use client'

/**
 * Plays Triples with friends in a PIN room: everyone shares 1 board and races to claim triples.
 * A right claim scores 1, a wrong one costs 1. The room syncs by broadcast pings with a 2-second poll fallback.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import TriplesBoard from '@/components/triples/TriplesBoard'
import { cardLabel } from '@/components/triples/TriplesCard'
import { supabase } from '@/lib/supabase'
import { getDevicePlayer, saveDevicePlayer } from '@/lib/syncIdentity'
import { useDeviceName } from '@/lib/use-device-name'
import { brokenFeatures, validateRoomPin, type TriplesRoom } from '@/lib/triples'

const SESSION_KEY = 'triples_session'
const NAME_KEY = 'triples_name'
const field = 'w-full rounded-lg border bg-[var(--ink-bg)] px-3 py-2'
const pill = 'rounded-full border px-4 py-2 text-sm font-semibold active:scale-95 disabled:opacity-40'
const solid = { backgroundColor: 'var(--ink-text)', borderColor: 'var(--ink-text)', color: 'var(--ink-bg)' }

type Session = { pin: string; playerId: string; playerToken: string }

/**
 * Reads the saved room session for this tab.
 */
function readSession(): Session | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
    return saved?.playerToken ? saved : null
  } catch {
    return null
  }
}

/**
 * Sends an action to the room API and returns its JSON, throwing the server's message on failure.
 */
async function call(
  url: string,
  body: object,
): Promise<{ room: TriplesRoom | null; playerId?: string; playerToken?: string }> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error ?? 'Something went wrong')
  return data
}

/**
 * Renders the lobby form, then the waiting room, the shared board and the final ranking.
 */
export default function TriplesRoomPlay({ initialPin }: { initialPin: string }) {
  const router = useRouter()
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [session, setSession] = useState<Session | null>(null)
  const [room, setRoom] = useState<TriplesRoom | null>(null)
  const [name, setName, restoreName] = useDeviceName()
  const [pin, setPin] = useState(initialPin)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [shake, setShake] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ready, setReady] = useState(false)
  const channel = useRef<RealtimeChannel | null>(null)

  if (hydrated && !ready) {
    setReady(true)
    const saved = readSession()
    setSession(saved && (!initialPin || saved.pin === initialPin) ? saved : null)
    try {
      restoreName(localStorage.getItem(NAME_KEY) ?? '')
    } catch {}
  }

  const save = (s: Session | null) => {
    setSession(s)
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {}
  }

  const load = useCallback(async (p: string) => {
    try {
      const r = await fetch(`/api/triples/rooms/${p}`)
      if (r.status === 404) {
        setRoom(null)
        setSession(null)
        try {
          if (readSession()?.pin === p) sessionStorage.removeItem(SESSION_KEY)
        } catch {}
        return
      }
      if (r.ok) {
        const next = ((await r.json()) as { room: TriplesRoom }).room
        setRoom((cur) => (cur && cur.version > next.version ? cur : next))
      }
    } catch {
      /* Keep the seat and last board while the next poll retries. */
    }
  }, [])

  const roomPin = session?.pin
  useEffect(() => {
    if (!roomPin) return
    queueMicrotask(() => void load(roomPin))
    const ch = supabase
      .channel(`triples:${roomPin}`)
      .on('broadcast', { event: 'sync' }, () => void load(roomPin))
      .subscribe()
    channel.current = ch
    const poll = setInterval(() => void load(roomPin), 2000)
    return () => {
      clearInterval(poll)
      void ch.unsubscribe()
      channel.current = null
    }
  }, [roomPin, load])

  const [boardKey, setBoardKey] = useState('')
  const key = room?.board.join(',') ?? ''
  if (key !== boardKey) {
    setBoardKey(key)
    setSelected((s) => s.filter((c) => room?.board.includes(c)))
  }

  const act = async (body: object) => {
    if (!session) return null
    try {
      const data = await call(`/api/triples/rooms/${session.pin}`, {
        ...body,
        playerId: session.playerId,
        playerToken: session.playerToken,
      })
      if (data.room) setRoom(data.room)
      void channel.current?.send({ type: 'broadcast', event: 'sync', payload: {} })
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return null
    }
  }

  const enter = async (create: boolean) => {
    const n = name.trim()
    if (!n) return setError('Enter your name')
    if (!create && !validateRoomPin(pin)) return setError('Enter the 4-digit PIN')
    setBusy(true)
    setError('')
    try {
      localStorage.setItem(NAME_KEY, n)
    } catch {}
    try {
      const data = create
        ? await call('/api/triples/rooms', { name: n })
        : await call(`/api/triples/rooms/${pin}`, { action: 'join', name: n })
      if (!data.room || !data.playerId || !data.playerToken) throw new Error('Could not join')
      saveDevicePlayer({ name: n, group: getDevicePlayer()?.group ?? 'public' })
      setRoom(data.room)
      save({ pin: data.room.pin, playerId: data.playerId, playerToken: data.playerToken })
      router.replace(`/games/triples?pin=${data.room.pin}`, { scroll: false })
      if (!create) {
        const ch = supabase.channel(`triples:${data.room.pin}`)
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED')
            void ch.send({ type: 'broadcast', event: 'sync', payload: {} }).then(() => ch.unsubscribe())
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    await act({ action: 'leave' })
    save(null)
    setRoom(null)
  }

  if (!ready) return null

  if (!session || !room) {
    return (
      <form
        className="mx-auto max-w-sm space-y-3 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}
        onSubmit={(e) => {
          e.preventDefault()
          void enter(false)
        }}
      >
        <label className="block text-sm">
          Your name
          <input className={field} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm">
            Room PIN
            <input
              className={field}
              inputMode="numeric"
              placeholder="1234"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <button className={pill} style={solid} disabled={busy}>
            Join
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ink-muted)' }}>
          <span className="h-px flex-1" style={{ background: 'var(--ink-border)' }} />
          or
          <span className="h-px flex-1" style={{ background: 'var(--ink-border)' }} />
        </div>
        <button
          type="button"
          className={`${pill} w-full`}
          style={{ borderColor: 'currentColor' }}
          disabled={busy}
          onClick={() => void enter(true)}
        >
          Create a room
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    )
  }

  const me = room.players.find((p) => p.id === session.playerId)
  const isHost = room.hostId === session.playerId
  const ranked = [...room.players].sort((a, b) => b.score - a.score || a.misses - b.misses)
  const claim = room.lastClaim
  const claimText = claim
    ? claim.ok
      ? `${claim.by === session.playerId ? 'You' : claim.name} found a triple! +1`
      : `${claim.by === session.playerId ? 'You' : claim.name} missed (${brokenFeatures(claim.cards).join(', ')}) −1`
    : ''

  const pick = async (card: number) => {
    if (room.status !== 'active' || busy) return
    const next = selected.includes(card) ? selected.filter((c) => c !== card) : [...selected, card]
    setSelected(next)
    if (next.length < 3) return
    setBusy(true)
    const data = await act({ action: 'claim', cards: next })
    setBusy(false)
    if (data?.room?.lastClaim?.ok === false) {
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setSelected([])
      }, 450)
    } else setSelected([])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Room PIN
          </p>
          <p className="text-2xl font-bold tracking-widest">{room.pin}</p>
        </div>
        <button
          className={pill}
          style={{ borderColor: 'currentColor' }}
          title="Copy a link friends can open to join"
          onClick={() =>
            void navigator.clipboard
              .writeText(`${location.origin}/games/triples?pin=${room.pin}`)
              .then(() => setCopied(true))
          }
        >
          {copied ? 'Link copied' : 'Invite'}
        </button>
        <button className={pill} style={{ borderColor: 'currentColor' }} onClick={() => void leave()}>
          Leave
        </button>
      </div>

      <ol className="flex flex-wrap gap-1.5 text-sm" aria-label="Scores">
        {ranked.map((p) => (
          <li
            key={p.id}
            className="rounded-full border px-3 py-1"
            style={{ borderColor: p.id === session.playerId ? 'var(--ink-text)' : 'var(--ink-border)' }}
            title={`${p.misses} miss${p.misses === 1 ? '' : 'es'}`}
          >
            {p.id === room.hostId && <span title="Host">★ </span>}
            {p.name} <strong className="tabular-nums">{p.score}</strong>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-red-700" onClick={() => setError('')}>
          {error}
        </p>
      )}

      {room.status === 'waiting' && (
        <div className="space-y-3 rounded-xl border p-6 text-center" style={{ borderColor: 'var(--ink-border)' }}>
          <p>
            {room.players.length} player{room.players.length === 1 ? '' : 's'} here. Share the PIN or the invite link.
          </p>
          {isHost ? (
            <button className={pill} style={solid} onClick={() => void act({ action: 'start' })}>
              Start game
            </button>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Waiting for the host to start…
            </p>
          )}
        </div>
      )}

      {room.status === 'active' && (
        <>
          <div className="flex items-center justify-between text-sm" style={{ color: 'var(--ink-muted)' }}>
            <span>{room.deckCount} in deck</span>
            <span role="status" className="font-medium" style={{ color: 'var(--ink-text)' }}>
              {claimText}
            </span>
          </div>
          <TriplesBoard
            board={room.board}
            selected={selected}
            shake={shake}
            disabled={busy}
            onPick={(c) => void pick(c)}
          />
          {claim?.ok && <p className="sr-only">Last triple: {claim.cards.map(cardLabel).join(', ')}</p>}
        </>
      )}

      {room.status === 'finished' && (
        <div className="space-y-3 rounded-xl border p-5 text-center" style={{ borderColor: 'var(--ink-border)' }}>
          <p className="font-lora text-2xl font-semibold">
            {ranked.filter((p) => p.score === ranked[0]?.score && p.misses === ranked[0]?.misses).length > 1
              ? 'Tie: ' +
                ranked
                  .filter((p) => p.score === ranked[0]?.score && p.misses === ranked[0]?.misses)
                  .map((p) => p.name)
                  .join(' & ')
              : ranked[0]?.id === me?.id
                ? 'You win!'
                : `${ranked[0]?.name ?? 'Nobody'} wins`}
          </p>
          <ol className="mx-auto max-w-xs space-y-1 text-left">
            {ranked.map((p, i) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {i + 1}. {p.name}
                </span>
                <span className="tabular-nums">
                  {p.score} <span style={{ color: 'var(--ink-muted)' }}>({p.misses} missed)</span>
                </span>
              </li>
            ))}
          </ol>
          {isHost ? (
            <button className={pill} style={solid} onClick={() => void act({ action: 'start' })}>
              Play again
            </button>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              The host can start another round.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
