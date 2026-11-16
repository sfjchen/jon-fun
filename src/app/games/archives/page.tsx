'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Mini = {
  date: string; constructors: string[]; copyright: string; width: number; height: number
  cells: (string | null)[]
  clues: { number: string; direction: string; text: string; cells: number[]; answer: string }[]
}

export default function PuzzleArchives() {
  const [kind, setKind] = useState('connections')
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [mini, setMini] = useState<Mini | null>(null)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(`/puzzle-archives/${kind}/index.json`).then(async r => {
      if (!r.ok) throw new Error('Archive unavailable')
      const values = await r.json() as string[]
      if (!cancelled) { setDates(values); setDate(values.at(-1) ?? '') }
    }).catch(() => { if (!cancelled) setError('Could not load archive. Please try again.') })
    return () => { cancelled = true }
  }, [kind])
  useEffect(() => {
    let cancelled = false
    if (kind !== 'mini' || !date) return
    fetch(`/puzzle-archives/mini/${date.slice(0, 4)}.json`).then(async r => {
      if (!r.ok) throw new Error('Archive unavailable')
      const puzzles = await r.json() as Mini[]
      const found = puzzles.find(p => p.date === date)
      if (!found) throw new Error('Missing puzzle')
      if (!cancelled) setMini(found)
    }).catch(() => { if (!cancelled) setError('Could not load this puzzle. Please try again.') })
    return () => { cancelled = true }
  }, [kind, date])
  return <div className="mx-auto max-w-3xl space-y-6 p-4">
    <h1 className="font-lora text-3xl">Historical puzzle archives</h1>
    <p>Past NYT Connections and Mini crosswords, preserved with their original dates and answers. Independent archive; unaffiliated with The New York Times.</p>
    <p className="text-sm">Sources: <a className="underline" href="https://huggingface.co/datasets/eric27n/NYT-Connections">eric27n / NYT-Connections</a> and <a className="underline" href="https://github.com/timjkong/nyt-crossword-data">timjkong / nyt-crossword-data</a>.</p>
    <div className="flex flex-wrap gap-4">
      <label>Game <select aria-label="Game" className="rounded border p-2 bg-[var(--ink-paper)]" value={kind} onChange={e => { setKind(e.target.value); setDates([]); setDate(''); setMini(null); setReveal(false); setError('') }}><option value="connections">Connections</option><option value="mini">Mini crossword</option></select></label>
      <label>Date <select aria-label="Date" className="rounded border p-2 bg-[var(--ink-paper)]" value={date} onChange={e => { setDate(e.target.value); setMini(null); setReveal(false); setError('') }} disabled={!dates.length}>{[...dates].reverse().map(d => <option key={d}>{d}</option>)}</select></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {!dates.length && !error && <p>Loading archive…</p>}
    {dates.length > 0 && <p>{dates.length.toLocaleString()} puzzles · {dates[0]} – {dates.at(-1)} · <a className="underline" href={`/puzzle-archives/${kind}/words.json`} download>Download word list</a> · <a className="underline" href={`/puzzle-archives/${kind}/${date.slice(0, 4)}.json`} download>Download year</a></p>}
    {kind === 'connections' && date && <Link className="inline-block rounded border p-3 underline" href={`/games/connections/play/nyt-archive-${date}`}>Play Connections for {date}</Link>}
    {mini && <section className="space-y-4">
      <h2 className="text-xl">Mini · {mini.date}</h2>
      <p>By {mini.constructors.join(', ')} · © {mini.copyright} The New York Times</p>
      <button className="rounded border px-4 py-2" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide answers' : 'Reveal answers'}</button>
      <div role="img" aria-label={`Mini crossword grid, ${mini.width} columns by ${mini.height} rows${reveal ? ', answers revealed' : ''}`} className="grid max-w-sm border" style={{gridTemplateColumns: `repeat(${mini.width}, minmax(0, 1fr))`}}>
        {mini.cells.map((cell, i) => <div key={i} className="relative aspect-square border flex items-center justify-center text-xl" style={{background: cell ? 'var(--ink-paper)' : '#222'}}>
          <span className="absolute left-1 top-0 text-xs">{mini.clues.find(c => c.cells[0] === i)?.number}</span>{reveal ? cell : ''}
        </div>)}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">{['Across', 'Down'].map(direction => <div key={direction}><h3 className="text-lg font-semibold">{direction}</h3><ul className="space-y-2">{mini.clues.filter(c => c.direction === direction).map(c => <li key={c.number}><strong>{c.number}.</strong> {c.text} {reveal && <strong>— {c.answer}</strong>}</li>)}</ul></div>)}</div>
    </section>}
    <Link className="block underline" href="/games/connections">Connections library</Link>
  </div>
}
