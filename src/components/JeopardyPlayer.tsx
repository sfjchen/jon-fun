'use client'

import { useEffect, useState } from 'react'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { getClueValue } from '@/lib/jeopardy'

interface JeopardyPlayerProps {
  board: JeopardyBoard
  onBack: () => void
  onEdit: () => void
}

type Team = { name: string; score: number }

export default function JeopardyPlayer({ board, onBack, onEdit }: JeopardyPlayerProps) {
  const [teams, setTeams] = useState<Team[]>([{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }])
  const [teamCount, setTeamCount] = useState(2)
  const [open, setOpen] = useState<{ col: number; row: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [used, setUsed] = useState<Record<string, boolean>>({})
  const [lastAnswered, setLastAnswered] = useState<{ col: number; row: number } | null>(null)
  const rowsCount = board.categories[0]?.clues.length ?? 5
  // Keep last-clicked cell for UX focus; currently not rendered
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [focused, setFocused] = useState<{ col: number; row: number } | null>(null)
  const colMinWidthPx = 90

  useEffect(() => {
    // normalize team list to 1-8
    setTeams((prev) => {
      const next: Team[] = Array.from({ length: teamCount }, (_, i) => {
        const existing = prev[i]
        if (existing) return existing
        return { name: `Team ${i + 1}`, score: 0 }
      })
      return next
    })
  }, [teamCount])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function tileKey(col: number, row: number) {
    return `${col}:${row}`
  }

  function openTile(col: number, row: number) {
    setOpen({ col, row })
    setRevealed(false)
  }

  function closeTile() {
    setOpen((current) => {
      if (current && revealed) {
        const key = tileKey(current.col, current.row)
        setUsed((u) => ({ ...u, [key]: true }))
        setLastAnswered({ col: current.col, row: current.row })
      }
      return null
    })
    setRevealed(false)
  }

  function adjustScore(teamIndex: number, delta: number) {
    setTeams((prev) => {
      const next = [...prev]
      const existing = next[teamIndex] ?? { name: `Team ${teamIndex + 1}`, score: 0 }
      next[teamIndex] = { ...existing, score: existing.score + delta }
      return next
    })
  }

  function setScore(teamIndex: number, newScore: number) {
    setTeams((prev) => {
      const next = [...prev]
      const existing = next[teamIndex] ?? { name: `Team ${teamIndex + 1}`, score: 0 }
      next[teamIndex] = { ...existing, score: newScore }
      return next
    })
  }

  function resetTiles() {
    setUsed({})
    setOpen(null)
    setRevealed(false)
  }

  function resetTilesAndScores() {
    resetTiles()
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })))
  }

  return (
    <div className="min-h-screen bg-[#142c6d] text-white p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/20">← Back</button>
        <div className="flex items-center gap-2">
          <label className="text-sm text-white/80">Teams</label>
          <select
            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1"
            value={teamCount}
            onChange={(e) => setTeamCount(Math.min(8, Math.max(1, Number(e.target.value))))}
          >
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={resetTiles} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Reset Tiles</button>
          <button onClick={resetTilesAndScores} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Reset Tiles + Scores</button>
          <button onClick={onEdit} className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20">Edit</button>
        </div>
      </div>

      <h1 className="text-center text-4xl font-bold mb-2">{board.title}</h1>
      <div className="text-center text-white/70 text-sm mb-4">Hotkeys: Space reveals • Esc goes back</div>

      {/* Board */}
      <div className="max-w-6xl mx-auto w-full">
        <div className="smooth-scroll-x">
          <div style={{ minWidth: `${board.categories.length * colMinWidthPx}px` }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="px-2 py-2 border border-black/60 bg-[#1f3aa8] text-center font-semibold uppercase tracking-wide text-xs sm:text-sm md:text-lg select-none rounded-t-lg wrap-anywhere">
                  {cat.title}
                </div>
              ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))` }}>
              {board.categories.map((cat, colIndex) => (
                <div key={colIndex} className="grid" style={{ gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rowsCount }, (_, rowIndex) => {
                    const value = getClueValue(board, rowIndex)
                    const key = tileKey(colIndex, rowIndex)
                    const disabled = used[key]
                    return (
                      <button
                        key={rowIndex}
                        onClick={() => { setFocused({ col: colIndex, row: rowIndex }); openTile(colIndex, rowIndex) }}
                        className={`h-20 sm:h-24 md:h-28 lg:h-32 border border-black/60 text-2xl md:text-3xl font-extrabold rounded-b-lg ${disabled ? 'bg-[#0c1a5a]' : 'bg-[#10226d] hover:bg-[#13297f]'}`}
                      >
                        <span className={`${disabled ? 'text-[#6c79c9] opacity-60' : 'text-[#ffcc00]'} transition-opacity`}>${value}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="flex flex-wrap items-stretch gap-3 justify-center mt-6">
        {teams.map((team, i) => (
          <div key={i} className="bg-white/10 rounded-xl border border-white/20 p-3 w-44">
            <input
              value={team.name}
              onChange={(e) => setTeams((prev) => prev.map((t, idx) => idx === i ? { ...t, name: e.target.value } : t))}
              className="w-full bg-transparent text-center font-semibold mb-2 outline-none"
            />
            <input
              value={team.score}
              onChange={(e) => setScore(i, Number(e.target.value) || 0)}
              className="w-full bg-[#0e235b] text-center text-2xl font-bold rounded-md py-2 outline-none"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => {
                const src = open ?? lastAnswered
                if (src) adjustScore(i, getClueValue(board, src.row))
              }} className="bg-green-600 hover:bg-green-700 rounded-md py-1">+</button>
              <button onClick={() => {
                const src = open ?? lastAnswered
                if (src) adjustScore(i, -getClueValue(board, src.row))
              }} className="bg-red-600 hover:bg-red-700 rounded-md py-1">-</button>
            </div>
          </div>
        ))}
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-[#142c6d] text-white flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto">
          <div className="absolute top-2 left-2">
            <button onClick={closeTile} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">ESC</button>
          </div>
          <div className="absolute top-2 right-2">
            <button onClick={() => setRevealed((r) => !r)} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg">Space: Reveal</button>
          </div>
          <div className="max-w-5xl text-center max-h-[85vh] overflow-y-auto">
            <div className="text-white/80 text-sm sm:text-base md:text-lg mb-2 wrap-anywhere">{board.categories[open.col]?.title} for ${getClueValue(board, open.row)}</div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-wide wrap-anywhere">
              {!revealed ? (
                <div>{board.categories[open.col]?.clues[open.row]?.question || '—'}</div>
              ) : (
                <div>
                  <div className="opacity-70 text-2xl sm:text-3xl md:text-4xl mb-6">{board.categories[open.col]?.clues[open.row]?.question || '—'}</div>
                  <div className="text-[#ffda79]">{board.categories[open.col]?.clues[open.row]?.answer || '—'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


