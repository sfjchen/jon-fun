'use client'

import { useCallback, useMemo, useState } from 'react'
import { partyFetch } from '@/lib/party/constants'
import { usePartyRoomData } from './usePartyRoomData'
import { usePartyLobby } from './usePartyLobby'
import { usePartyRoomActions } from './usePartyRoomActions'
import PartyLobbyForm from './PartyLobbyForm'

type Player = { player_id: string; name: string; score: number }
type Room = { pin: string; host_id: string | null; phase: string; round_index: number }
type FibRound = {
  id: string
  round_index: number
  category: string
  prompt_template: string
  truth: string
  picker_player_id?: string | null
  option_order: { text: string; truth: boolean; authorId: string | null }[] | null
}
type Lie = { round_id: string; player_id: string; lie_text: string; from_suggestion: boolean }
type Pick = { round_id: string; player_id: string; picked_index: number }

export default function FibbageGame() {
  const notebookLayout = true

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<FibRound[]>([])
  const [lies, setLies] = useState<Lie[]>([])
  const [picks, setPicks] = useState<Pick[]>([])

  const onPayload = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return
    const d = data as {
      room?: Room
      players?: Player[]
      fibbage?: { rounds: FibRound[]; lies: Lie[]; picks: Pick[] }
    }
    if (d.room) setRoom(d.room)
    if (d.players) setPlayers(d.players)
    if (d.fibbage) {
      setRounds(d.fibbage.rounds ?? [])
      setLies(d.fibbage.lies ?? [])
      setPicks(d.fibbage.picks ?? [])
    }
  }, [])

  const {
    pinInput,
    setPinInput,
    nameInput,
    setNameInput,
    playerId,
    hostId,
    error,
    setError,
    loading,
    clientReady,
    createRoom,
    joinRoom,
    loadOnce,
  } = usePartyLobby('fibbage', onPayload)

  const { startGame, playAgain } = usePartyRoomActions(room?.pin, playerId, loadOnce, setError)

  usePartyRoomData(room?.pin ?? (pinInput.length === 4 ? pinInput : null), 'fibbage', onPayload)

  const postFib = async (body: Record<string, unknown>) => {
    if (!room?.pin || !playerId) return
    const res = await partyFetch(`/api/party/fibbage/${room.pin}`, {
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
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_index === room?.round_index) ?? rounds[rounds.length - 1],
    [rounds, room?.round_index],
  )

  const nameOf = (id: string) => players.find((p) => p.player_id === id)?.name ?? id.slice(0, 6)
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [players])
  const cardStyle = { backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' } as const

  const myLie = currentRound ? lies.find((l) => l.round_id === currentRound.id && l.player_id === playerId) : null
  const myPick = currentRound ? picks.find((p) => p.round_id === currentRound.id && p.player_id === playerId) : null

  return (
    <div className={`max-w-6xl mx-auto px-4 w-full ${notebookLayout ? 'py-4 lg:py-6' : 'py-10'}`}>
      <h1 className="font-lora text-2xl font-semibold mb-2" style={{ color: 'var(--ink-text)' }}>Fib It</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink-muted)' }}>
        Bluff-the-truth trivia: submit lies, pick the real answer, likes for flair. 2–8 players.
      </p>

      {!room && (
        <PartyLobbyForm
          nameInput={nameInput}
          setNameInput={setNameInput}
          pinInput={pinInput}
          setPinInput={setPinInput}
          onCreate={createRoom}
          onJoin={joinRoom}
          loading={loading}
          clientReady={clientReady}
          error={error}
        />
      )}

      {room && (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="rounded-lg border p-4 h-fit shadow-sm" style={cardStyle}>
            <div className="text-xl font-bold tracking-widest mb-2" data-testid="party-room-pin">
              {room.pin}
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--ink-muted)' }}>{phase} · R{room.round_index}</div>
            {sortedPlayers.map((p) => (
              <div key={p.player_id} className="flex justify-between text-sm py-1 border-b" style={{ borderColor: 'var(--ink-border)' }}>
                <span>{p.name}</span>
                <span className="font-mono">{p.score}</span>
              </div>
            ))}
            {phase === 'lobby' && isHost && (
              <button type="button" onClick={startGame} disabled={players.length < 2} className="mt-4 w-full py-2 rounded text-white disabled:opacity-50" style={{ backgroundColor: 'var(--ink-accent)' }}>Start</button>
            )}
            {phase === 'fibbage_scores' && isHost && (
              <button type="button" onClick={() => postFib({ action: 'advance' })} className="mt-4 w-full py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>Next</button>
            )}
            {phase === 'finished' && isHost && (
              <button type="button" onClick={() => void playAgain()} className="mt-4 w-full py-2 rounded text-white" style={{ backgroundColor: 'var(--ink-accent)' }}>Play again</button>
            )}
          </aside>
          <main className="rounded-lg border p-4 shadow-sm space-y-4" style={cardStyle}>
            {error && (
              <div className="text-red-600 text-sm" data-testid="party-error">
                {error}
              </div>
            )}
            {currentRound && phase === 'fibbage_lie' && (
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--ink-muted)' }}>
                  {currentRound.category} · picker:{' '}
                  {currentRound.picker_player_id ? nameOf(currentRound.picker_player_id) : '—'}
                </div>
                <p className="font-medium mb-3">{currentRound.prompt_template.replace('___', '_____')}</p>
                {myLie ? (
                  <p className="text-sm text-green-700">Lie submitted</p>
                ) : (
                  <div className="space-y-2">
                    <LieInput onSubmit={(text) => postFib({ action: 'submitLie', text })} onSuggest={() => postFib({ action: 'submitLie', fromSuggestion: true })} />
                  </div>
                )}
              </div>
            )}
            {currentRound && phase === 'fibbage_pick' && currentRound.option_order && (
              <div>
                <p className="font-medium mb-2">Pick the truth</p>
                <div className="space-y-2">
                  {currentRound.option_order.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={!!myPick}
                      className="w-full text-left px-3 py-2 rounded border disabled:opacity-60"
                      style={{ borderColor: 'var(--ink-border)' }}
                      onClick={() => postFib({ action: 'submitPick', pickedIndex: i })}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)' }}>Like a player&apos;s lie (optional, during pick):</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {players.map((p) => (
                    <button key={p.player_id} type="button" className="text-xs px-2 py-1 border rounded" style={{ borderColor: 'var(--ink-border)' }} onClick={() => postFib({ action: 'submitLike', targetPlayerId: p.player_id })}>
                      👍 {p.name}
                    </button>
                  ))}
                </div>
                {myPick && <p className="text-sm text-green-700 mt-2">Pick locked</p>}
              </div>
            )}
            {phase === 'fibbage_scores' && <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Round scores — host Next.</p>}
            {phase === 'finished' && <p className="font-semibold">Done!</p>}
          </main>
        </div>
      )}
    </div>
  )
}

function LieInput({ onSubmit, onSuggest }: { onSubmit: (t: string) => void; onSuggest: () => void }) {
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
        <input value={v} onChange={(e) => setV(e.target.value)} maxLength={280} className="flex-1 min-w-[180px] rounded border px-2 py-1" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-bg)', color: 'var(--ink-text)' }} placeholder="Your lie" />
        <button type="submit" className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: 'var(--ink-accent)' }}>Submit</button>
      </form>
      <button type="button" onClick={onSuggest} className="text-sm underline" style={{ color: 'var(--ink-accent)' }}>Lie for me</button>
    </div>
  )
}
