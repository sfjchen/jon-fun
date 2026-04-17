'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { partyFetch, sessionKeys } from '@/lib/party/constants'
import { usePartyRoomData } from './usePartyRoomData'

type Player = { player_id: string; name: string; score: number }
type Room = { pin: string; host_id: string | null; phase: string; round_index: number; step_index: number }
type Matchup = { id: string; round_index: number; sort_order: number; prompt_text: string; player_a: string; player_b: string }
type Answer = { matchup_id: string; player_id: string; body: string }
type Vote = { matchup_id: string; voter_player_id: string; choice: number }
type FinalAns = { player_id: string; body: string }
type FinalVote = { voter_player_id: string; slot: number; target_player_id: string }

export default function QuiplashGame() {
  const notebookLayout = true
  const keys = sessionKeys('quiplash')

  const [pinInput, setPinInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [, setVotes] = useState<Vote[]>([])
  const [finalPrompt, setFinalPrompt] = useState<{ prompt_text: string } | null>(null)
  const [finalAnswers, setFinalAnswers] = useState<FinalAns[]>([])
  const [, setFinalVotes] = useState<FinalVote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientReady, setClientReady] = useState(false)

  const onPayload = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return
    const d = data as {
      room?: Room
      players?: Player[]
      quiplash?: {
        matchups: Matchup[]
        answers: Answer[]
        votes: Vote[]
        finalPrompt: { prompt_text: string } | null
        finalAnswers: FinalAns[]
        finalVotes: FinalVote[]
      }
    }
    if (d.room) setRoom(d.room)
    if (d.players) setPlayers(d.players)
    if (d.quiplash) {
      setMatchups(d.quiplash.matchups ?? [])
      setAnswers(d.quiplash.answers ?? [])
      setVotes(d.quiplash.votes ?? [])
      setFinalPrompt(d.quiplash.finalPrompt ?? null)
      setFinalAnswers(d.quiplash.finalAnswers ?? [])
      setFinalVotes(d.quiplash.finalVotes ?? [])
    }
  }, [])

  usePartyRoomData(room?.pin ?? (pinInput.length === 4 ? pinInput : null), 'quiplash', onPayload)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = sessionStorage.getItem(keys.pin) || ''
    const pid = sessionStorage.getItem(keys.playerId) || ''
    const hid = sessionStorage.getItem(keys.hostId) || ''
    const n = sessionStorage.getItem(keys.playerName) || ''
    if (p && pid) {
      setPinInput(p)
      setPlayerId(pid)
      setHostId(hid || null)
      setNameInput(n)
    }
  }, [keys.pin, keys.playerId, keys.hostId, keys.playerName])

  const saveSession = useCallback(
    (d: { pin?: string; playerId?: string; hostId?: string | null; playerName?: string }) => {
      if (typeof window === 'undefined') return
      if (d.pin !== undefined) sessionStorage.setItem(keys.pin, d.pin)
      if (d.playerId !== undefined) sessionStorage.setItem(keys.playerId, d.playerId)
      if (d.hostId !== undefined) sessionStorage.setItem(keys.hostId, d.hostId ?? '')
      if (d.playerName !== undefined) sessionStorage.setItem(keys.playerName, d.playerName)
    },
    [keys],
  )

  const loadOnce = useCallback(
    async (p: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await partyFetch(`/api/party/rooms/${p}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Load failed')
        onPayload(data)
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        setError(aborted ? 'Request timed out' : e instanceof Error ? e.message : 'Load failed')
      } finally {
        setLoading(false)
      }
    },
    [onPayload],
  )

  const createRoom = async () => {
    if (!nameInput.trim()) {
      setError('Name required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await partyFetch('/api/party/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: nameInput.trim(), gameKind: 'quiplash' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Create failed')
      setPinInput(data.pin)
      setPlayerId(data.playerId)
      setHostId(data.hostId)
      saveSession({ pin: data.pin, playerId: data.playerId, hostId: data.hostId, playerName: nameInput.trim() })
      await loadOnce(data.pin)
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      setError(aborted ? 'Request timed out' : e instanceof Error ? e.message : 'Create failed')
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!nameInput.trim() || pinInput.length !== 4) {
      setError('Name and 4-digit PIN required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await partyFetch(`/api/party/rooms/${pinInput}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', playerName: nameInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Join failed')
      setPlayerId(data.playerId)
      saveSession({ pin: pinInput, playerId: data.playerId, playerName: nameInput.trim() })
      await loadOnce(pinInput)
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      setError(aborted ? 'Request timed out' : e instanceof Error ? e.message : 'Join failed')
    } finally {
      setLoading(false)
    }
  }

  const startGame = async () => {
    if (!room?.pin || !playerId) return
    const res = await partyFetch(`/api/party/rooms/${room.pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', playerId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Start failed')
      return
    }
    await loadOnce(room.pin)
  }

  const postQuiplash = async (body: Record<string, unknown>) => {
    if (!room?.pin || !playerId) return
    const res = await partyFetch(`/api/party/quiplash/${room.pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, playerId }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Action failed')
    await loadOnce(room.pin)
  }

  const isHost = hostId && room?.host_id === hostId
  const phase = room?.phase ?? 'lobby'

  const myMatchups = useMemo(() => {
    if (!playerId) return []
    const r = phase === 'quiplash_1_answer' ? 1 : phase === 'quiplash_2_answer' ? 2 : 0
    if (!r) return []
    return matchups.filter(
      (m) => m.round_index === r && (m.player_a === playerId || m.player_b === playerId),
    )
  }, [matchups, playerId, phase])

  const currentVoteMatchup = useMemo(() => {
    if (!room || (phase !== 'quiplash_1_vote' && phase !== 'quiplash_2_vote')) return null
    const r = phase === 'quiplash_1_vote' ? 1 : 2
    const list = matchups.filter((m) => m.round_index === r).sort((a, b) => a.sort_order - b.sort_order)
    return list[room.step_index ?? 0] ?? null
  }, [room, phase, matchups])

  const nameOf = (id: string) => players.find((p) => p.player_id === id)?.name ?? id.slice(0, 6)

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [players])

  const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' } as const

  return (
    <div className={`max-w-6xl mx-auto px-4 w-full ${notebookLayout ? 'py-4 lg:py-6' : 'py-10'}`}>
      <h1 className="font-lora text-2xl font-semibold mb-2" style={{ color: 'var(--ink-text)' }}>
        Quip Clash
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink-muted)' }}>
        Head-to-head prompts, voting, and a final round — inspired by party prompt games. 3–8 players.
      </p>

      {!room && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <aside className="rounded-lg border p-4 shadow-sm" style={cardStyle}>
            <div className="space-y-4">
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--ink-muted)' }}>Name</div>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded px-3 py-2 border"
                  style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                  placeholder="Your name"
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  className="flex-1 rounded px-3 py-2 border"
                  style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
                  placeholder="PIN"
                />
                <button type="button" onClick={joinRoom} disabled={loading || !clientReady} className="px-3 py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
                  Join
                </button>
              </div>
              <button type="button" onClick={createRoom} disabled={loading || !clientReady} className="w-full py-2 rounded text-white" style={{ backgroundColor: 'rgb(22 101 52)' }}>
                Create room
              </button>
              {error && (
                <div className="text-sm text-red-600" data-testid="party-error">
                  {error}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {room && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <aside className="rounded-lg border p-4 shadow-sm h-fit" style={cardStyle}>
            <div className="text-sm" style={{ color: 'var(--ink-muted)' }}>PIN</div>
            <div className="text-2xl font-bold tracking-widest mb-2" data-testid="party-room-pin">
              {room.pin}
            </div>
            <div className="text-xs mb-4" style={{ color: 'var(--ink-muted)' }}>Phase: {phase}</div>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {sortedPlayers.map((p) => (
                <div key={p.player_id} className="flex justify-between text-sm border rounded px-2 py-1" style={{ borderColor: 'var(--ink-border)' }}>
                  <span>{p.name}{p.player_id === room.host_id ? ' · host' : ''}</span>
                  <span className="font-mono">{p.score ?? 0}</span>
                </div>
              ))}
            </div>
            {phase === 'lobby' && isHost && (
              <button
                type="button"
                onClick={startGame}
                disabled={players.length < 3 || loading}
                className="w-full py-2 rounded text-white mb-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Start (need ≥3)
              </button>
            )}
            {(phase === 'quiplash_1_scores' || phase === 'quiplash_2_scores' || phase === 'quiplash_final_scores') && isHost && (
              <button
                type="button"
                onClick={() => postQuiplash({ action: 'advanceScoreboard' })}
                className="w-full py-2 rounded text-white mb-2"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Continue
              </button>
            )}
            {phase === 'finished' && isHost && (
              <button
                type="button"
                onClick={async () => {
                  if (!room.pin || !playerId) return
                  await partyFetch(`/api/party/rooms/${room.pin}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'play-again', playerId }),
                  })
                  await loadOnce(room.pin)
                }}
                className="w-full py-2 rounded text-white"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Play again
              </button>
            )}
          </aside>

          <main className="rounded-lg border p-4 shadow-sm space-y-4" style={cardStyle}>
            {error && (
              <div className="text-sm text-red-600" data-testid="party-error">
                {error}
              </div>
            )}

            {(phase === 'quiplash_1_answer' || phase === 'quiplash_2_answer') && playerId && (
              <div className="space-y-4">
                <h2 className="font-semibold">Your prompts</h2>
                {myMatchups.map((m) => {
                  const done = answers.some((a) => a.matchup_id === m.id && a.player_id === playerId)
                  return (
                    <div key={m.id} className="border rounded p-3 space-y-2" style={{ borderColor: 'var(--ink-border)' }}>
                      <p className="text-sm">{m.prompt_text}</p>
                      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>vs {nameOf(m.player_a === playerId ? m.player_b : m.player_a)}</p>
                      {!done ? (
                        <AnswerForm
                          onSubmit={(body) => postQuiplash({ action: 'submitAnswer', matchupId: m.id, body })}
                        />
                      ) : (
                        <span className="text-xs text-green-700">Submitted</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {(phase === 'quiplash_1_vote' || phase === 'quiplash_2_vote') && currentVoteMatchup && playerId && (
              <div className="space-y-3">
                <h2 className="font-semibold">Vote</h2>
                <p className="text-sm">{currentVoteMatchup.prompt_text}</p>
                {currentVoteMatchup.player_a === playerId || currentVoteMatchup.player_b === playerId ? (
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>You are in this matchup — wait for votes.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {([0, 1] as const).map((idx) => {
                      const pid = idx === 0 ? currentVoteMatchup.player_a : currentVoteMatchup.player_b
                      const ans = answers.find((a) => a.matchup_id === currentVoteMatchup.id && a.player_id === pid)
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="text-left px-4 py-2 rounded border w-full"
                          style={{ borderColor: 'var(--ink-accent)' }}
                          onClick={() => postQuiplash({ action: 'submitVote', choice: idx })}
                        >
                          <span className="text-xs block" style={{ color: 'var(--ink-muted)' }}>{nameOf(pid)}</span>
                          {ans?.body ?? '…'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {(phase === 'quiplash_1_scores' || phase === 'quiplash_2_scores') && (
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Round scores — host presses Continue.</p>
            )}

            {phase === 'quiplash_final_answer' && finalPrompt && playerId && (
              <div className="space-y-2">
                <h2 className="font-semibold">Final round</h2>
                <p>{finalPrompt.prompt_text}</p>
                {finalAnswers.some((a) => a.player_id === playerId) ? (
                  <span className="text-green-700 text-sm">Submitted</span>
                ) : (
                  <AnswerForm onSubmit={(body) => postQuiplash({ action: 'submitFinalAnswer', body })} />
                )}
              </div>
            )}

            {phase === 'quiplash_final_vote' && playerId && finalAnswers.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold">Cast 3 votes</h2>
                <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Pick a player per slot (can repeat).</p>
                {[1, 2, 3].map((slot) => (
                  <div key={slot} className="flex flex-wrap gap-1 items-center">
                    <span className="text-sm w-16">Slot {slot}</span>
                    {finalAnswers.map((a) => (
                      <button
                        key={`${slot}-${a.player_id}`}
                        type="button"
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--ink-border)' }}
                        onClick={() => postQuiplash({ action: 'submitFinalVote', slot, targetPlayerId: a.player_id })}
                      >
                        {nameOf(a.player_id)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {phase === 'quiplash_final_scores' && (
              <p className="text-sm">Final standings — host Continue to finish.</p>
            )}

            {phase === 'finished' && <p className="font-semibold">Game over — thanks for playing.</p>}
          </main>
        </div>
      )}
    </div>
  )
}

function AnswerForm({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form
      className="flex gap-2 flex-wrap"
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onSubmit(v.trim())
        setV('')
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={280}
        className="flex-1 min-w-[200px] rounded border px-2 py-1 text-sm"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
        placeholder="Your answer"
      />
      <button type="submit" className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--ink-accent)' }}>Submit</button>
    </form>
  )
}
