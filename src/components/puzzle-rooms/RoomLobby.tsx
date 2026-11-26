'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { action as button } from '@/components/daily/DayNav'
import { supabase } from '@/lib/supabase'
import { useDeviceName } from '@/lib/use-device-name'
import { roomPath, roomTopic, validRoomId, type Room, type RoomEdit, type RoomGame } from '@/lib/puzzle-rooms/types'

type Session = { seat: string; seq: number; batch: RoomEdit[]; queued: RoomEdit[] }
export type RoomBoardProps = { room: Room; edit: (edit: RoomEdit) => void; controls: ReactNode }
type Props = {
  game: RoomGame
  day: string
  id: string
  mini?: boolean
  board: ComponentType<RoomBoardProps>
}

const entryClass = 'rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2'
const keyFor = (id: string) => `puzzle-room:v1:${id}`
function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}
const defaultSession = (): Session => ({ seat: crypto.randomUUID(), seq: 0, batch: [], queued: [] })

function readSession(id: string): Session | null {
  if (!id) return null
  try {
    return JSON.parse(sessionStorage.getItem(keyFor(id)) ?? 'null') as Session | null
  } catch {
    return null
  }
}

function saveSession(id: string, session: Session) {
  try {
    sessionStorage.setItem(keyFor(id), JSON.stringify(session))
  } catch {
    // The open tab can still play if browser storage is disabled.
  }
}

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request(path: string, body?: object, signal?: AbortSignal): Promise<Room> {
  const response = await fetch(path, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(28_000),
    ...(body && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new RequestError(data?.error ?? 'Could not reach the room.', response.status)
  if (!data) throw new RequestError('The room did not respond.', 503)
  return data as Room
}

const roomApi = (id: string) => `/api/puzzle-rooms${id ? `/${id}` : ''}`

function sharedProgress(room: Room, pending: RoomEdit[]): Room {
  if (room.solved || !pending.length) return room
  const words = new Set(room.words)
  const entries = { ...room.entries }
  for (const edit of pending) {
    if ('word' in edit) words.add(edit.word)
    else if (edit.value) entries[edit.cell] = edit.value
    else delete entries[edit.cell]
  }
  return { ...room, words: [...words], entries }
}

const noopSubscribe = () => () => {}
export default function RoomLobby(props: Props) {
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  if (!ready) return <p>Loading room…</p>
  return <Lobby key={props.id} {...props} />
}

function Lobby({ game, id, day, mini, board: Board }: Props) {
  const [name, setName] = useDeviceName()
  const [session, setSession] = useState(() => readSession(id))
  const [room, setRoom] = useState<Room | null>(null)
  const [status, setStatus] = useState<'connecting' | 'live' | 'polling'>('connecting')
  const [error, setError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [missing, setMissing] = useState(false)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState<RoomEdit[]>(() => (session ? [...session.batch, ...session.queued] : []))
  const attempt = useRef<{ id: string; day: string; session: Session } | null>(null)
  const version = useRef(-1)
  const wake = useRef<(() => void) | null>(null)
  const lookup = validRoomId(id)

  const accept = (next: Room) => {
    if (next.version <= version.current) return
    version.current = next.version
    setRoom(next)
  }

  // Broadcasts signal a committed revision. The room API is the authority for the board and score.
  useEffect(() => {
    if (!lookup) return
    const controller = new AbortController()
    let reading = false
    let refreshAgain = false
    let live = false
    let lastRead = 0
    const refresh = async () => {
      if (reading) {
        refreshAgain = true
        return
      }
      reading = true
      lastRead = Date.now()
      try {
        const next = await request(roomApi(id), undefined, controller.signal)
        if (controller.signal.aborted) return
        if (next.puzzle.game !== game) {
          setError('This link is for a different game.')
          setMissing(true)
          return
        }
        accept(next)
        setError('')
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof RequestError && cause.status === 404) {
          setError(cause.message)
          setMissing(true)
        } else if (version.current < 0) {
          setError('Could not load the room. Reconnecting…')
        }
      } finally {
        reading = false
        if (refreshAgain && !controller.signal.aborted) {
          refreshAgain = false
          void refresh()
        }
      }
    }
    void refresh()
    const channel = supabase
      .channel(roomTopic(id))
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        if (!Number.isInteger(payload?.version) || payload.version <= version.current) return
        void refresh()
      })
      .subscribe((state) => {
        if (controller.signal.aborted) return
        live = state === 'SUBSCRIBED'
        setStatus(live ? 'live' : 'polling')
        if (live) void refresh()
      })
    const poll = window.setInterval(() => {
      if (Date.now() - lastRead >= (live ? 10_000 : 2_000)) void refresh()
    }, 1000)
    const reconnect = () => {
      if (!document.hidden) void refresh()
    }
    window.addEventListener('online', reconnect)
    document.addEventListener('visibilitychange', reconnect)
    return () => {
      controller.abort()
      clearInterval(poll)
      window.removeEventListener('online', reconnect)
      document.removeEventListener('visibilitychange', reconnect)
      void supabase.removeChannel(channel)
    }
  }, [game, id, lookup])

  // One in-flight batch per seat. A retried batch keeps its sequence number, so a lost
  // response cannot cause an old edit to overwrite a teammate's newer change.
  useEffect(() => {
    if (!session || !lookup) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let sending = false
    let failures = 0
    const send = async () => {
      if (sending || controller.signal.aborted || (!session.queued.length && !session.batch.length)) return
      sending = true
      if (!session.batch.length) {
        session.batch = session.queued.splice(0, 32)
        session.seq += 1
        saveSession(id, session)
      }
      let delay = 30
      try {
        const next = await request(
          roomApi(id),
          {
            action: 'edit',
            seat: session.seat,
            seq: session.seq,
            edits: session.batch,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        accept(next)
        session.batch = []
        failures = 0
        setWriteError('')
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof RequestError && cause.status < 500 && cause.status !== 429) {
          session.batch = []
          setWriteError(cause.message)
        } else {
          failures += 1
          delay = Math.min(8000, 350 * 2 ** (failures - 1))
          setWriteError('Reconnecting. Your edits are queued.')
        }
      } finally {
        if (!controller.signal.aborted) {
          sending = false
          saveSession(id, session)
          setPending([...session.batch, ...session.queued])
          schedule(delay)
        }
      }
    }
    function schedule(delay = 30) {
      if (!sending && (session?.batch.length || session?.queued.length)) {
        clearTimeout(timer)
        timer = setTimeout(() => void send(), delay)
      }
    }
    const online = () => schedule(0)
    wake.current = () => {
      if (!failures) schedule()
    }
    window.addEventListener('online', online)
    schedule()
    return () => {
      controller.abort()
      clearTimeout(timer)
      window.removeEventListener('online', online)
      wake.current = null
    }
  }, [id, lookup, session])

  function edit(next: RoomEdit) {
    if (!session || room?.solved) return
    session.queued.push(next)
    saveSession(id, session)
    setPending([...session.batch, ...session.queued])
    wake.current?.()
  }

  async function enter() {
    if (joining || !name.trim()) return
    setJoining(true)
    setError('')
    try {
      if (!attempt.current || attempt.current.day !== day) {
        attempt.current = {
          id: id || newRoomId(),
          day,
          session: defaultSession(),
        }
      }
      const draft = attempt.current
      const seat = draft.session.seat
      const next = id
        ? await request(roomApi(id), { action: 'join', name, game, seat })
        : await request(roomApi(''), { name, game, seat, day, id: draft.id, mini })
      saveSession(next.id, draft.session)
      accept(next)
      setSession(draft.session)
      if (!id) window.history.replaceState(null, '', `${roomPath[game]}?room=${next.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enter the room.')
    } finally {
      setJoining(false)
    }
  }

  const back =
    game === 'bee' && (room?.puzzle.board.date ?? day)
      ? `${roomPath.bee}?d=${room?.puzzle.board.date ?? day}`
      : roomPath[game]
  if ((!lookup && id) || missing)
    return (
      <div className="space-y-3">
        <p role="alert">{error || 'Invalid room link.'}</p>
        <Link className={button} href={back}>
          Back to {game === 'bee' ? 'Spelling Bee' : 'Crossword'}
        </Link>
      </div>
    )

  if (!id || !session || !room)
    return (
      <div className="space-y-4">
        {lookup && !room ? (
          <p role={error ? 'alert' : 'status'}>{error || 'Loading room…'}</p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void enter()
            }}
          >
            {room && (
              <p className="w-full text-sm text-[var(--ink-muted)]">
                {room.players.join(' · ')} · <time dateTime={room.puzzle.board.date}>{room.puzzle.board.date}</time>{' '}
                puzzle{room.solved && ' · solved'}
              </p>
            )}
            <label className="grid gap-1 text-sm">
              Your name
              <input
                className={entryClass}
                autoComplete="nickname"
                required
                maxLength={32}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className={`${button} min-h-10`} disabled={joining || (!day && !id)} type="submit">
              {joining ? 'Connecting…' : id ? 'Join room' : 'Create room'}
            </button>
            {error && (
              <p role="alert" className="w-full text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
        {game === 'bee' && (
          <Link className={button} href={back}>
            Back to solo
          </Link>
        )}
      </div>
    )

  const controls = (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--ink-border)] pb-3 text-sm">
      <span className="font-semibold">Shared room</span>
      <span role="status" className="text-xs text-[var(--ink-muted)]">
        {status === 'live' ? 'Live' : status === 'polling' ? 'Syncing by refresh' : 'Connecting…'}
        {pending.length > 0 && ' · Saving…'}
      </span>
      <div className="ml-auto flex flex-wrap gap-1">
        <button
          className={button}
          type="button"
          onClick={async () => {
            const url = new URL(`${roomPath[game]}?room=${room.id}`, window.location.origin)
            try {
              await navigator.clipboard.writeText(url.href)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              window.prompt('Copy this invite link', url.href)
            }
          }}
        >
          {copied ? 'Invite copied' : 'Copy invite'}
        </button>
        <Link className={button} href={back}>
          {game === 'bee' ? 'Solo' : 'Change puzzle'}
        </Link>
      </div>
      <p className="w-full break-words text-[var(--ink-muted)]">{room.players.join(' · ')}</p>
      {writeError && (
        <p role="alert" className="w-full text-red-700">
          {writeError}
        </p>
      )}
    </div>
  )
  return <Board room={sharedProgress(room, pending)} edit={edit} controls={controls} />
}
