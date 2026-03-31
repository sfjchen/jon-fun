'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { partyFetch, sessionKeys } from '@/lib/party/constants'
import { EAY_INTAKE_QUESTIONS } from '@/lib/party/prompts-eay'
import { usePartyRoomData } from './usePartyRoomData'

type Player = { player_id: string; name: string; score: number }
type Room = {
  pin: string
  host_id: string | null
  phase: string
  round_index: number
  step_index: number
  settings?: { eayQuestionIds?: string[]; eayFinalPair?: { text: string; isTruth: boolean }[] }
}
type EayRound = {
  id: string
  round_index: number
  subject_player_id: string
  question_template: string
  truth: string
  option_order: { text: string; truth: boolean; authorId: string | null }[] | null
}
type IntakeRow = { player_id: string; question_id: string; answer: string }
type Lie = { round_id: string; player_id: string; lie_text: string; from_suggestion: boolean }
type Pick = { round_id: string; player_id: string; picked_index: number }
type FinalRow = { player_id: string; truth_text: string; lie_text: string }

export default function EayGame() {
  const pathname = usePathname() ?? ''
  const notebookLayout = !pathname.startsWith('/theme2')
  const keys = sessionKeys('eay')

  const [pinInput, setPinInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [hostId, setHostId] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [intake, setIntake] = useState<IntakeRow[]>([])
  const [rounds, setRounds] = useState<EayRound[]>([])
  const [lies, setLies] = useState<Lie[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [finals, setFinals] = useState<FinalRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clientReady, setClientReady] = useState(false)

  const onPayload = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return
    const d = data as {
      room?: Room
      players?: Player[]
      eay?: {
        intake: IntakeRow[]
        rounds: EayRound[]
        lies: Lie[]
        picks: Pick[]
        finals: FinalRow[]
      }
    }
    if (d.room) setRoom(d.room)
    if (d.players) setPlayers(d.players)
    if (d.eay) {
      setIntake(d.eay.intake ?? [])
      setRounds(d.eay.rounds ?? [])
      setLies(d.eay.lies ?? [])
      setPicks(d.eay.picks ?? [])
      setFinals(d.eay.finals ?? [])
    }
  }, [])

  usePartyRoomData(room?.pin ?? (pinInput.length === 4 ? pinInput : null), 'eay', onPayload)

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
  }, [keys])

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
    if (!nameInput.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await partyFetch('/api/party/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: nameInput.trim(), gameKind: 'eay' }),
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
    if (!nameInput.trim() || pinInput.length !== 4) return
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
    if (!res.ok) setError(data.error || 'Start failed')
    await loadOnce(room.pin)
  }

  const postEay = async (body: Record<string, unknown>) => {
    if (!room?.pin || !playerId) return
    const res = await partyFetch(`/api/party/eay/${room.pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, playerId }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Action failed')
    await loadOnce(room.pin)
  }

  const playAgain = async () => {
    if (!room?.pin || !playerId) return
    await partyFetch(`/api/party/rooms/${room.pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'play-again', playerId }),
    })
    await loadOnce(room.pin)
  }

  const isHost = hostId && room?.host_id === hostId
  const phase = room?.phase ?? 'lobby'
  const qIds = room?.settings?.eayQuestionIds ?? EAY_INTAKE_QUESTIONS.map((q) => q.id)

  const currentRound = useMemo(
    () => rounds.find((r) => r.round_index === room?.round_index) ?? rounds[rounds.length - 1],
    [rounds, room?.round_index],
  )

  const nameOf = (id: string) => players.find((p) => p.player_id === id)?.name ?? id.slice(0, 6)
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [players])
  const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' } as const

  const myIntakeFor = (qid: string) => intake.find((i) => i.player_id === playerId && i.question_id === qid)
  const myLie = currentRound ? lies.find((l) => l.round_id === currentRound.id && l.player_id === playerId) : null
  const myPick = currentRound ? picks.find((p) => p.round_id === currentRound.id && p.player_id === playerId) : null
  const myFinal = playerId ? finals.find((f) => f.player_id === playerId) : null

  const finalSubject = players[room?.step_index ?? 0]
  const finalPair = room?.settings?.eayFinalPair ?? []

  return (
    <div className={`max-w-6xl mx-auto px-4 w-full ${notebookLayout ? 'py-4 lg:py-6' : 'py-10'}`}>
      <h1 className="font-lora text-2xl font-semibold mb-2" style={{ color: 'var(--ink-text)' }}>Enough About You</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink-muted)' }}>
        Private intake, then bluff rounds about each player and a final truth-vs-lie vote. 3–8 players.
      </p>

      {!room && (
        <aside className="rounded-lg border p-4 max-w-md shadow-sm" style={cardStyle}>
          <div className="space-y-3">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name"
              className="w-full rounded border px-3 py-2"
              style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
            />
            <div className="flex gap-2">
              <input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                placeholder="PIN"
                className="flex-1 rounded border px-3 py-2"
                style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
              />
              <button type="button" onClick={joinRoom} disabled={loading || !clientReady} className="px-3 py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
                Join
              </button>
            </div>
            <button type="button" onClick={createRoom} disabled={loading || !clientReady} className="w-full py-2 rounded text-white" style={{ backgroundColor: 'rgb(22 101 52)' }}>
              Create
            </button>
            {error && (
              <div className="text-sm text-red-600" data-testid="party-error">
                {error}
              </div>
            )}
          </div>
        </aside>
      )}

      {room && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="rounded-lg border p-4 h-fit shadow-sm" style={cardStyle}>
            <div className="text-xl font-bold tracking-widest mb-2" data-testid="party-room-pin">
              {room.pin}
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--ink-muted)' }}>
              {phase} · R{room.round_index} · S{room.step_index}
            </div>
            {sortedPlayers.map((p) => (
              <div key={p.player_id} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: 'var(--ink-border)' }}>
                <span>
                  {p.name}
                  {p.player_id === room.host_id ? ' · host' : ''}
                </span>
                <span className="font-mono">{p.score}</span>
              </div>
            ))}
            {phase === 'lobby' && isHost && (
              <button
                type="button"
                onClick={startGame}
                disabled={players.length < 3}
                className="mt-4 w-full py-2 rounded text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--ink-accent)' }}
              >
                Start (need ≥3)
              </button>
            )}
            {(phase === 'eay_scores' || phase === 'eay_final_scores') && isHost && (
              <button type="button" onClick={() => postEay({ action: 'advance' })} className="mt-4 w-full py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
                Next
              </button>
            )}
            {phase === 'finished' && isHost && (
              <button type="button" onClick={() => void playAgain()} className="mt-4 w-full py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
                Play again
              </button>
            )}
          </aside>

          <main className="rounded-lg border p-4 shadow-sm space-y-4" style={cardStyle}>
            {error && (
              <div className="text-red-600 text-sm" data-testid="party-error">
                {error}
              </div>
            )}

            {phase === 'eay_intake' && playerId && (
              <div className="space-y-4">
                <h2 className="font-semibold">Answer privately (all {qIds.length} required)</h2>
                {qIds.map((qid) => {
                  const meta = EAY_INTAKE_QUESTIONS.find((q) => q.id === qid)
                  const done = !!myIntakeFor(qid)
                  return (
                    <IntakeQuestionForm
                      key={qid}
                      label={meta?.template.replace('{name}', 'you') ?? qid}
                      done={done}
                      onSubmit={(answer) => postEay({ action: 'submitIntake', questionId: qid, answer })}
                    />
                  )
                })}
              </div>
            )}

            {phase === 'eay_lie' && currentRound && playerId && (
              <div>
                <p className="text-sm mb-2">{currentRound.question_template}</p>
                {currentRound.subject_player_id === playerId ? (
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    You&apos;re the subject — others are bluffing.
                  </p>
                ) : myLie ? (
                  <p className="text-sm text-green-700">Lie submitted</p>
                ) : (
                  <LieInputEay onSubmit={(text) => postEay({ action: 'submitLie', text })} onSuggest={() => postEay({ action: 'submitLie', fromSuggestion: true })} />
                )}
              </div>
            )}

            {phase === 'eay_pick' && currentRound?.option_order && playerId && (
              <div>
                <p className="font-medium mb-1">{currentRound.question_template}</p>
                {currentRound.subject_player_id === playerId ? (
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Wait for picks.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {currentRound.option_order.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={!!myPick}
                          className="w-full text-left px-3 py-2 rounded border disabled:opacity-60"
                          style={{ borderColor: 'var(--ink-border)' }}
                          onClick={() => postEay({ action: 'submitPick', pickedIndex: i })}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs mt-3" style={{ color: 'var(--ink-muted)' }}>Like a lie (optional):</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {players.map((p) => (
                        <button
                          key={p.player_id}
                          type="button"
                          className="text-xs px-2 py-1 border rounded"
                          style={{ borderColor: 'var(--ink-border)' }}
                          onClick={() => postEay({ action: 'submitLike', targetPlayerId: p.player_id })}
                        >
                          👍 {p.name}
                        </button>
                      ))}
                    </div>
                    {myPick && <p className="text-sm text-green-700 mt-2">Pick locked</p>}
                  </>
                )}
              </div>
            )}

            {(phase === 'eay_scores' || phase === 'eay_final_scores') && (
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Scoreboard — host Next.</p>
            )}

            {phase === 'eay_final_submit' && playerId && (
              <div>
                <h2 className="font-semibold mb-2">Final: one truth, one lie about you</h2>
                {myFinal ? (
                  <p className="text-sm text-green-700">Submitted</p>
                ) : (
                  <FinalSubmitForm onSubmit={(truthText, lieText) => postEay({ action: 'submitFinal', truthText, lieText })} />
                )}
              </div>
            )}

            {phase === 'eay_final_vote' && finalSubject && playerId && finalPair.length === 2 && (
              <div>
                <p className="font-medium mb-2">Which is true for {nameOf(finalSubject.player_id)}?</p>
                {finalSubject.player_id === playerId ? (
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Others are voting.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {finalPair.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        className="text-left px-3 py-2 rounded border"
                        style={{ borderColor: 'var(--ink-accent)' }}
                        onClick={() => postEay({ action: 'submitFinalPick', choiceIndex: i })}
                      >
                        {slot.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {phase === 'finished' && <p className="font-semibold">Game over — thanks for playing!</p>}
          </main>
        </div>
      )}
    </div>
  )
}

function IntakeQuestionForm({ label, done, onSubmit }: { label: string; done: boolean; onSubmit: (a: string) => void }) {
  const [v, setV] = useState('')
  if (done) return <p className="text-sm text-green-700 border rounded p-2">{label} ✓</p>
  return (
    <form
      className="border rounded p-3 space-y-2"
      style={{ borderColor: 'var(--ink-border)' }}
      onSubmit={(e) => {
        e.preventDefault()
        if (!v.trim()) return
        onSubmit(v.trim())
        setV('')
      }}
    >
      <label className="text-sm block">{label}</label>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={280}
        className="w-full rounded border px-2 py-1 text-sm"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
      />
      <button type="submit" className="text-sm px-3 py-1 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
        Save
      </button>
    </form>
  )
}

function LieInputEay({ onSubmit, onSuggest }: { onSubmit: (t: string) => void; onSuggest: () => void }) {
  const [v, setV] = useState('')
  return (
    <div className="space-y-2">
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
          className="flex-1 min-w-[180px] rounded border px-2 py-1"
          style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
          placeholder="Your bluff"
        />
        <button type="submit" className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--ink-accent)' }}>
          Submit
        </button>
      </form>
      <button type="button" onClick={onSuggest} className="text-sm underline" style={{ color: 'var(--ink-accent)' }}>
        Suggest for me
      </button>
    </div>
  )
}

function FinalSubmitForm({ onSubmit }: { onSubmit: (t: string, l: string) => void }) {
  const [truth, setTruth] = useState('')
  const [lie, setLie] = useState('')
  return (
    <form
      className="space-y-2 max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        if (!truth.trim() || !lie.trim()) return
        onSubmit(truth.trim(), lie.trim())
      }}
    >
      <label className="text-xs block" style={{ color: 'var(--ink-muted)' }}>
        Truth
      </label>
      <input
        value={truth}
        onChange={(e) => setTruth(e.target.value)}
        maxLength={280}
        className="w-full rounded border px-2 py-1"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
      />
      <label className="text-xs block" style={{ color: 'var(--ink-muted)' }}>
        Lie
      </label>
      <input
        value={lie}
        onChange={(e) => setLie(e.target.value)}
        maxLength={280}
        className="w-full rounded border px-2 py-1"
        style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }}
      />
      <button type="submit" className="px-3 py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>
        Submit pair
      </button>
    </form>
  )
}
