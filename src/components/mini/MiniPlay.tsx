'use client'

import { useEffect, useRef, useState } from 'react'
import { formatTime, logResult, isPracticeResult, markPracticeIfFuture } from '@/lib/results'

export type MiniPuzzle = {
  date: string; constructors: string[]; copyright: string; width: number; height: number
  cells: (string | null)[]
  clues: { number: string; direction: string; text: string; cells: number[]; answer: string }[]
}

type Run = { entries: string[]; startedAt: number | null; finishedAt: number | null; assisted: boolean }
export default function MiniPlay({ puzzle, dailyDay }: { puzzle: MiniPuzzle; dailyDay?: string }) {
  const storageKey = `mini:v2:${dailyDay ?? 'archive'}:${puzzle.date}`
  const empty = (): Run => ({ entries: puzzle.cells.map(() => ''), startedAt: null, finishedAt: null, assisted: false })
  const [run, setRun] = useState<Run>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Run | null
      if (saved && saved.entries.length === puzzle.cells.length && saved.entries.every(v => typeof v === 'string' && /^[A-Z]*$/.test(v))) return saved
    } catch {}
    return empty()
  })
  const entries = run.entries
  const [active, setActive] = useState(() => puzzle.cells.findIndex(Boolean))
  const [direction, setDirection] = useState('Across')
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [clock, setClock] = useState(0)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const clue = puzzle.clues.find(c => c.direction === direction && c.cells.includes(active))
  const solved = puzzle.cells.every((answer, i) => !answer || entries[i] === answer)
  const seconds = run.startedAt ? Math.max(0, Math.floor(((run.finishedAt ?? clock) - run.startedAt) / 1000)) : 0
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(run)) } catch {}
    if (dailyDay && solved && !run.assisted && run.finishedAt && run.startedAt) {
      const elapsed = Math.max(1, Math.floor((run.finishedAt - run.startedAt) / 1000))
      logResult('mini', Math.max(1, 10000 - elapsed), undefined, dailyDay, { seconds: elapsed, solved: true, sourceDate: puzzle.date, puzzleId: `mini:${puzzle.date}` })
    }
  }, [run, solved, dailyDay, puzzle.date, storageKey])
  function focus(index: number) {
    if (puzzle.cells[index]) { setActive(index); inputs.current[index]?.focus() }
  }
  function move(index: number, step: number, withinRow = false) {
    let next = index + step
    while (next >= 0 && next < puzzle.cells.length) {
      if (withinRow && Math.floor(next / puzzle.width) !== Math.floor(index / puzzle.width)) return
      if (puzzle.cells[next]) { focus(next); return }
      next += step
    }
  }
  function enter(index: number, value: string) {
    markPracticeIfFuture('mini', dailyDay)
    const letter = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
    setRun(previous => {
      const next = previous.entries.map((v, i) => i === index ? letter : v)
      const done = puzzle.cells.every((answer, i) => !answer || next[i] === answer)
      return { ...previous, entries: next, startedAt: previous.startedAt ?? Date.now(), finishedAt: done ? previous.finishedAt ?? Date.now() : null }
    })
    setChecked(false)
    if (letter) {
      const current = puzzle.clues.find(c => c.direction === direction && c.cells.includes(index))
      const next = current?.cells[(current?.cells.indexOf(index) ?? -1) + 1]
      if (next !== undefined) focus(next)
    }
  }
  return <section className="space-y-4">
    <h2 className="text-xl">Mini · {puzzle.date}</h2>
    <p>By {puzzle.constructors.join(', ')}</p>
    <p className="text-sm">Select a clue or square and type. Click a square again to switch direction. Arrow keys move between squares.</p>
    <p className="text-sm tabular-nums">Time: {formatTime(seconds)}{run.assisted ? ' · Assisted practice · not ranked' : dailyDay ? isPracticeResult('mini', dailyDay) ? ' · Future preview · practice only' : ' · Daily ranked run' : ' · Archive practice'}</p>
    <div className="flex flex-wrap gap-2">
      <button className="rounded border px-4 py-2" onClick={() => { setChecked(true); setRun(r => ({ ...r, assisted: true })) }}>Check answers</button>
      <button className="rounded border px-4 py-2" onClick={() => { setRun(r => ({ ...r, entries: puzzle.cells.map(c => c ?? ''), assisted: true, finishedAt: Date.now() })); setRevealed(true); setChecked(false) }}>Reveal answers</button>
      <button className="rounded border px-4 py-2" onClick={() => { setRun(r => ({ ...empty(), assisted: r.assisted })); setChecked(false); setRevealed(false); focus(puzzle.cells.findIndex(Boolean)) }}>Reset puzzle</button>
    </div>
    <p role="status" aria-live="polite">{solved ? revealed ? 'Answers revealed.' : 'Puzzle solved!' : checked ? 'Incorrect filled squares are marked. Keep going!' : clue ? `${clue.number} ${clue.direction}: ${clue.text}` : 'Choose a square to begin.'}</p>
    <div className="grid w-full max-w-sm border" style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))` }}>
      {puzzle.cells.map((answer, i) => {
        const incorrect = checked && Boolean(entries[i]) && entries[i] !== answer
        const number = puzzle.clues.find(c => c.cells[0] === i)?.number
        return <div key={i} className="relative aspect-square border" style={{ background: answer ? i === active ? '#f9df6d' : clue?.cells.includes(i) ? '#dce7fa' : 'var(--ink-paper)' : '#222' }}>
          {number && <span className="pointer-events-none absolute left-1 top-0 z-10 text-xs" style={{ color: '#333' }}>{number}</span>}
          {answer && <input ref={element => { inputs.current[i] = element }} aria-label={`Row ${Math.floor(i / puzzle.width) + 1}, column ${i % puzzle.width + 1}${number ? `, ${number}` : ''}`} aria-invalid={incorrect} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={entries[i]} className="h-full w-full bg-transparent pt-2 text-center text-xl font-semibold outline-offset-[-3px] sm:text-2xl" style={{ color: incorrect ? '#b91c1c' : '#222' }} onFocus={() => setActive(i)} onPointerDown={() => { if (document.activeElement === inputs.current[i]) setDirection(d => d === 'Across' ? 'Down' : 'Across') }} onChange={e => enter(i, e.target.value)} onKeyDown={e => {
            if (e.key.startsWith('Arrow')) {
              e.preventDefault()
              const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
              setDirection(horizontal ? 'Across' : 'Down')
              if (horizontal && (e.key === 'ArrowLeft' && i % puzzle.width === 0 || e.key === 'ArrowRight' && i % puzzle.width === puzzle.width - 1)) return
              move(i, (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) * (horizontal ? 1 : puzzle.width), horizontal)
            } else if (e.key === 'Backspace' && !entries[i]) { e.preventDefault(); move(i, direction === 'Across' ? -1 : -puzzle.width, direction === 'Across') }
            else if (e.key === ' ') { e.preventDefault(); setDirection(d => d === 'Across' ? 'Down' : 'Across') }
          }} />}
          {incorrect && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1 text-xs text-red-700">×</span>}
        </div>
      })}
    </div>
    <div className="grid gap-6 sm:grid-cols-2">{['Across', 'Down'].map(d => <div key={d}><h3 className="text-lg font-semibold">{d}</h3><ul className="space-y-2">{puzzle.clues.filter(c => c.direction === d).map(c => <li key={c.number}><button className="w-full rounded p-1 text-left hover:underline" style={{ background: clue === c ? 'var(--ink-bg)' : undefined }} onClick={() => { setDirection(d); focus(c.cells[0] ?? 0) }}><strong>{c.number}.</strong> {c.text}</button></li>)}</ul></div>)}</div>
  </section>
}
