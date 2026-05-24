'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { getClueValue } from '@/lib/jeopardy'
import {
  MAX_TEAMS,
  type JeopardyPlayOp,
  type JeopardyPlayState,
} from '@/lib/jeopardy-play-ops'

interface JeopardyPlayerProps {
  board: JeopardyBoard
  playState: JeopardyPlayState
  dispatchPlayOp: (op: JeopardyPlayOp) => void
  onBack: () => void
  onEdit: () => void
  syncing?: boolean
  buzzerEnabled?: boolean
  onBuzzerToggle?: (enabled: boolean) => void
  buzzerSlot?: React.ReactNode
}

export default function JeopardyPlayer({ board, playState, dispatchPlayOp, onBack, onEdit, syncing, buzzerEnabled, onBuzzerToggle, buzzerSlot }: JeopardyPlayerProps) {
  const { teamCount, teams, used, lastAnswered } = playState
  const [open, setOpen] = useState<{ col: number; row: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const rowsCount = board.categories[0]?.clues.length ?? 5
  const COL_MIN_WIDTH_PX = 90

  const teamLayout = useMemo(() => {
    // Keep sizing consistent for 5+ teams (including 9–12): wrap into more rows instead of shrinking.
    // Only "zoom in" for small counts so the scoreboard doesn't look sparse.
    const minCardWidth = teamCount <= 2 ? 260 : teamCount <= 4 ? 220 : 170
    return { minCardWidth }
  }, [teamCount])

  const closeTile = useCallback(() => {
    setOpen((current) => {
      if (current && revealed) {
        dispatchPlayOp({ kind: 'markUsed', col: current.col, row: current.row, used: true, lastAnswered: true })
      }
      return null
    })
    setRevealed(false)
  }, [revealed, dispatchPlayOp])

  // Only clue overlay hotkeys; board navigation is mouse/touch only
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open) {
        if (e.key === ' ') { e.preventDefault(); setRevealed((r) => !r) }
        if (e.key === 'Escape') closeTile()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeTile])

  const openTile = useCallback((col: number, row: number) => {
    setOpen({ col, row })
    setRevealed(false)
  }, [])

  const adjustScore = useCallback((teamIndex: number, delta: number) => {
    dispatchPlayOp({ kind: 'adjustTeamScore', index: teamIndex, delta })
  }, [dispatchPlayOp])

  const setScore = useCallback((teamIndex: number, newScore: number) => {
    dispatchPlayOp({ kind: 'setTeamScore', index: teamIndex, score: newScore })
  }, [dispatchPlayOp])

  const resetTiles = useCallback(() => {
    dispatchPlayOp({ kind: 'resetTiles' })
    setOpen(null)
    setRevealed(false)
  }, [dispatchPlayOp])

  const resetTilesAndScores = useCallback(() => {
    dispatchPlayOp({ kind: 'resetTilesAndScores' })
    setOpen(null)
    setRevealed(false)
  }, [dispatchPlayOp])

  return (
    <div className="p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="px-4 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>← Back</button>
        <div className="flex items-center gap-2">
          {syncing ? <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>syncing…</span> : null}
          <label className="text-sm" style={{ color: 'var(--ink-muted)' }}>Teams</label>
          <select
            className="rounded-lg px-2 py-1 border"
            style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            value={teamCount}
            onChange={(e) => dispatchPlayOp({ kind: 'setTeamCount', count: Math.min(MAX_TEAMS, Math.max(1, Number(e.target.value))) })}
          >
            {Array.from({ length: MAX_TEAMS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={resetTiles} className="px-3 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Reset Tiles</button>
          <button onClick={resetTilesAndScores} className="px-3 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Reset Tiles + Scores</button>
          {onBuzzerToggle && (
            <button
              onClick={() => onBuzzerToggle(!buzzerEnabled)}
              className="px-3 py-2 rounded-lg border hover:opacity-90 font-semibold"
              style={{
                backgroundColor: buzzerEnabled ? '#16a34a' : 'var(--ink-paper)',
                borderColor: 'var(--ink-border)',
                color: buzzerEnabled ? 'white' : 'var(--ink-text)',
              }}
              title="Toggle buzzer mode for players to buzz in"
            >
              Buzzer {buzzerEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          <button onClick={onEdit} className="px-3 py-2 rounded-lg border hover:opacity-90" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Edit</button>
        </div>
      </div>

      <h1 className="text-center text-4xl font-bold font-lora mb-2" style={{ color: 'var(--ink-text)' }}>{board.title}</h1>
      <div className="text-center text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>Hotkeys: Space reveals • Esc goes back · Scores sync across devices</div>

      {/* Board */}
      <div className="max-w-6xl mx-auto w-full">
        <div className="smooth-scroll-x">
          <div style={{ minWidth: `${board.categories.length * COL_MIN_WIDTH_PX}px` }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="px-2 py-2 border text-center font-semibold uppercase tracking-wide text-xs sm:text-sm md:text-lg select-none rounded-t-lg wrap-anywhere" style={{ borderColor: 'var(--ink-border)', backgroundColor: 'var(--ink-paper)', color: 'var(--ink-text)' }}>
                  {cat.title}
                </div>
              ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="grid" style={{ gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rowsCount }, (_, rowIndex) => {
                    const value = getClueValue(board, rowIndex)
                    const disabled = used[`${colIndex}:${rowIndex}`]
                    return (
                      <button
                        key={rowIndex}
                        onClick={() => openTile(colIndex, rowIndex)}
                        className={`h-20 sm:h-24 md:h-28 lg:h-32 border text-2xl md:text-3xl font-extrabold rounded-b-lg transition-colors ${disabled ? '' : 'hover:opacity-90'}`}
                        style={{ borderColor: 'var(--ink-border)', backgroundColor: disabled ? 'var(--ink-bg)' : 'var(--ink-paper)', color: disabled ? 'var(--ink-muted)' : 'var(--ink-accent)' }}
                      >
                        <span>${value}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Buzzer Mode panel */}
      {buzzerEnabled && buzzerSlot}

      {/* Teams */}
      <div className="mt-6 w-full max-w-6xl mx-auto">
        <div
          className="grid gap-3 justify-items-stretch"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${teamLayout.minCardWidth}px, 1fr))` }}
        >
          {teams.map((team, i) => (
            <div key={i} className="rounded-xl border min-w-0 p-3" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)' }}>
            <input
              value={team.name}
              maxLength={24}
              onChange={(e) => dispatchPlayOp({ kind: 'setTeamName', index: i, name: e.target.value })}
              className="w-full bg-transparent text-center font-semibold mb-2 outline-none"
              style={{ color: 'var(--ink-text)' }}
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="-?[0-9]*"
              value={team.score}
              onChange={(e) => setScore(i, Number(e.target.value) || 0)}
              className="w-full text-center text-2xl font-bold rounded-md py-2 outline-none border"
              style={{ backgroundColor: 'var(--ink-bg)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => {
                const src = open ?? lastAnswered
                if (src) adjustScore(i, getClueValue(board, src.row))
              }} className="bg-green-600 hover:bg-green-700 text-white rounded-md py-1">+</button>
              <button onClick={() => {
                const src = open ?? lastAnswered
                if (src) adjustScore(i, -getClueValue(board, src.row))
              }} className="bg-red-600 hover:bg-red-700 text-white rounded-md py-1">-</button>
            </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto" style={{ backgroundColor: 'var(--ink-bg)' }}>
          <div className="absolute top-2 left-2">
            <button onClick={closeTile} className="min-h-11 py-2 px-4 rounded-lg border" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>ESC</button>
          </div>
          <div className="absolute top-2 right-2">
            <button onClick={() => setRevealed((r) => !r)} className="min-h-11 py-2 px-4 rounded-lg border" style={{ backgroundColor: 'var(--ink-paper)', borderColor: 'var(--ink-border)', color: 'var(--ink-text)' }}>Space: Reveal</button>
          </div>
          <div className="max-w-5xl text-center max-h-[85vh] overflow-y-auto">
            <div className="text-sm sm:text-base md:text-lg mb-2 wrap-anywhere" style={{ color: 'var(--ink-muted)' }}>{board.categories[open.col]?.title} for ${getClueValue(board, open.row)}</div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold font-lora tracking-wide wrap-anywhere" style={{ color: 'var(--ink-text)' }}>
              {!revealed ? (
                <div>{board.categories[open.col]?.clues[open.row]?.question || '—'}</div>
              ) : (
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl mb-6" style={{ color: 'var(--ink-muted)' }}>{board.categories[open.col]?.clues[open.row]?.question || '—'}</div>
                  <div style={{ color: 'var(--ink-accent)' }}>{board.categories[open.col]?.clues[open.row]?.answer || '—'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
