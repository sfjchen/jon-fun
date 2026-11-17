'use client'

import { useRef, useState } from 'react'

export type MiniPuzzle = {
  date: string; constructors: string[]; copyright: string; width: number; height: number
  cells: (string | null)[]
  clues: { number: string; direction: string; text: string; cells: number[]; answer: string }[]
}

export default function MiniPlay({ puzzle }: { puzzle: MiniPuzzle }) {
  const [entries, setEntries] = useState(() => puzzle.cells.map(() => ''))
  const [active, setActive] = useState(0)
  const [direction, setDirection] = useState('Across')
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const clue = puzzle.clues.find(c => c.direction === direction && c.cells.includes(active))
  const solved = puzzle.cells.every((answer, i) => !answer || entries[i] === answer)
  function focus(index: number) {
    if (puzzle.cells[index]) { setActive(index); inputs.current[index]?.focus() }
  }
  function move(index: number, step: number) {
    let next = index + step
    while (next >= 0 && next < puzzle.cells.length) {
      if (puzzle.cells[next]) { focus(next); return }
      next += step
    }
  }
  function enter(index: number, value: string) {
    const letter = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
    setEntries(previous => previous.map((v, i) => i === index ? letter : v))
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
    <div className="flex flex-wrap gap-2">
      <button className="rounded border px-4 py-2" onClick={() => setChecked(true)}>Check answers</button>
      <button className="rounded border px-4 py-2" onClick={() => { setEntries(puzzle.cells.map(c => c ?? '')); setRevealed(true); setChecked(false) }}>Reveal answers</button>
      <button className="rounded border px-4 py-2" onClick={() => { setEntries(puzzle.cells.map(() => '')); setChecked(false); setRevealed(false); focus(puzzle.cells.findIndex(Boolean)) }}>Reset puzzle</button>
    </div>
    <p role="status" aria-live="polite">{solved ? revealed ? 'Answers revealed.' : 'Puzzle solved!' : checked ? 'Incorrect filled squares are marked. Keep going!' : clue ? `${clue.number} ${clue.direction}: ${clue.text}` : 'Choose a square to begin.'}</p>
    <div className="grid w-full max-w-sm border" style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))` }}>
      {puzzle.cells.map((answer, i) => {
        const incorrect = checked && Boolean(entries[i]) && entries[i] !== answer
        const number = puzzle.clues.find(c => c.cells[0] === i)?.number
        return <div key={i} className="relative aspect-square border" style={{ background: answer ? i === active ? '#f9df6d' : clue?.cells.includes(i) ? '#dce7fa' : 'var(--ink-paper)' : '#222' }}>
          {number && <span className="pointer-events-none absolute left-1 top-0 z-10 text-xs" style={{ color: '#333' }}>{number}</span>}
          {answer && <input ref={element => { inputs.current[i] = element }} aria-label={`Row ${Math.floor(i / puzzle.width) + 1}, column ${i % puzzle.width + 1}${number ? `, ${number}` : ''}`} aria-invalid={incorrect} autoComplete="off" autoCapitalize="characters" spellCheck={false} value={entries[i]} className="h-full w-full bg-transparent pt-2 text-center text-xl font-semibold outline-offset-[-3px] sm:text-2xl" style={{ color: incorrect ? '#b91c1c' : '#222' }} onFocus={() => setActive(i)} onClick={() => { if (active === i) setDirection(d => d === 'Across' ? 'Down' : 'Across') }} onChange={e => enter(i, e.target.value)} onKeyDown={e => {
            if (e.key.startsWith('Arrow')) {
              e.preventDefault()
              const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
              setDirection(horizontal ? 'Across' : 'Down')
              move(i, (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) * (horizontal ? 1 : puzzle.width))
            } else if (e.key === 'Backspace' && !entries[i]) { e.preventDefault(); move(i, direction === 'Across' ? -1 : -puzzle.width) }
            else if (e.key === ' ') { e.preventDefault(); setDirection(d => d === 'Across' ? 'Down' : 'Across') }
          }} />}
          {incorrect && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-1 text-xs text-red-700">×</span>}
        </div>
      })}
    </div>
    <div className="grid gap-6 sm:grid-cols-2">{['Across', 'Down'].map(d => <div key={d}><h3 className="text-lg font-semibold">{d}</h3><ul className="space-y-2">{puzzle.clues.filter(c => c.direction === d).map(c => <li key={c.number}><button className="w-full rounded p-1 text-left hover:underline" style={{ background: clue === c ? 'var(--ink-bg)' : undefined }} onClick={() => { setDirection(d); focus(c.cells[0] ?? 0) }}><strong>{c.number}.</strong> {c.text}</button></li>)}</ul></div>)}</div>
  </section>
}
