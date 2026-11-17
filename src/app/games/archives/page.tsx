'use client'

import Link from 'next/link'
import MiniPlay, { type MiniPuzzle } from '@/components/mini/MiniPlay'
import { useEffect, useState } from 'react'

export default function PuzzleArchives() {
  const [kind, setKind] = useState('connections')
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [mini, setMini] = useState<MiniPuzzle | null>(null)
  const [error, setError] = useState('')
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
      const puzzles = await r.json() as MiniPuzzle[]
      const found = puzzles.find(p => p.date === date)
      if (!found) throw new Error('Missing puzzle')
      if (!cancelled) setMini(found)
    }).catch(() => { if (!cancelled) setError('Could not load this puzzle. Please try again.') })
    return () => { cancelled = true }
  }, [kind, date])
  return <div className="mx-auto max-w-3xl space-y-6 p-4">
    <h1 className="font-lora text-3xl">Past puzzles</h1>
    <p className="text-xs text-[var(--ink-muted)]">Sources: <a className="underline" href="https://huggingface.co/datasets/eric27n/NYT-Connections">eric27n / NYT-Connections</a> and <a className="underline" href="https://github.com/timjkong/nyt-crossword-data">timjkong / nyt-crossword-data</a>.</p>
    <div className="flex flex-wrap gap-4">
      <label>Game <select aria-label="Game" className="rounded border p-2 bg-[var(--ink-paper)]" value={kind} onChange={e => { setKind(e.target.value); setDates([]); setDate(''); setMini(null); setError('') }}><option value="connections">Connections</option><option value="mini">Mini crossword</option></select></label>
      <label>Date <input type="date" aria-label="Date" className="rounded border p-2 bg-[var(--ink-paper)]" value={date} min={dates[0]} max={dates.at(-1)} disabled={!dates.length} onChange={e => { if (dates.includes(e.target.value)) { setDate(e.target.value); setMini(null); setError('') } }} /></label>
      <button className="rounded border px-3 py-2" disabled={!dates.length} onClick={() => { setDate(dates[Math.floor(Math.random() * dates.length)] ?? ''); setMini(null); setError('') }}>Random</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!dates.length && !error && <p>Loading archive…</p>}
    {dates.length > 0 && <p className="text-sm text-[var(--ink-muted)]">{dates.length.toLocaleString()} puzzles · {dates[0]} to {dates.at(-1)}</p>}
    {kind === 'connections' && date && <Link className="inline-block rounded border p-3 underline" href={`/games/connections/play/nyt-archive-${date}`}>Play Connections for {date}</Link>}
    {mini && <MiniPlay key={mini.date} puzzle={mini} />}
    <Link className="block underline" href="/games/connections">Connections library</Link>
  </div>
}
