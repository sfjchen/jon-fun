'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { siteDay } from '@/lib/daily'

const titles = [
  ['Krillion', '/games/krillion'],
  ['Noillirk', 'https://noillirk.com'],
  ['Wordle', '/games/wordle'],
  ['Connections', '/games/connections/daily'],
  ['Who’s More Famous?', 'https://whosmorefamous.com'],
  ['Chainle', '/games/chainle'],
  ['Daily Orbs', '/games/orbs'],
  ['Kabloom', 'https://kabloom.io'],
  ['Plain', 'https://playplain.app'],
  ['Bandle', 'https://bandle.app/menu'],
  ['Headcount', 'https://headcountgame.com'],
  ['Daily Roll', 'https://playdailyroll.com'],
  ['Fermi', 'https://fermi.gg'],
  ['Poople', 'https://poople.io'],
  ['Perceptle', 'https://perceptle.net'],
  ['Travle', 'https://travle.earth'],
  ['Worldle', 'https://worldle.teuteuf.fr'],
  ['MapTap', 'https://maptap.gg'],
  ['Contexto', 'https://contexto.me'],
] as const

const prefix = 'daily-collection:v1:'
type Saved = { title: string; day: string; result: string }

export default function Page() {
  const [records, setRecords] = useState<Saved[]>([])
  const [editing, setEditing] = useState('')
  const [day, setDay] = useState('')
  const [result, setResult] = useState('')
  const [notice, setNotice] = useState('')
  function read() {
    const rows: Saved[] = []
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue
      try {
        const row = JSON.parse(localStorage.getItem(key) ?? 'null') as Saved
        if (
          row &&
          typeof row.result === 'string' &&
          typeof row.day === 'string' &&
          titles.some(([t]) => t === row.title)
        )
          rows.push(row)
      } catch {
        continue
      }
    }
    setRecords(rows.sort((a, b) => b.day.localeCompare(a.day) || a.title.localeCompare(b.title)))
  }
  useEffect(() => {
    setDay(siteDay())
    read()
    window.addEventListener('storage', read)
    window.addEventListener('focus', read)
    return () => {
      window.removeEventListener('storage', read)
      window.removeEventListener('focus', read)
    }
  }, [])
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-5">
      <h1 className="text-3xl font-bold">Daily games</h1>
      <p>For games played on the publisher’s site, paste the shared result to keep it in your personal history.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {titles.map(([title, url]) => (
          <section key={title} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
            {url.startsWith('/') ? (
              <Link className="font-semibold underline" href={url}>
                {title}
              </Link>
            ) : (
              <>
                <a className="font-semibold underline" href={url} target="_blank" rel="noreferrer">
                  {title} ↗
                </a>
                <button
                  className="text-sm underline"
                  onClick={() => {
                    setEditing(title)
                    setDay(siteDay())
                    setResult(records.find((r) => r.title === title && r.day === siteDay())?.result ?? '')
                    setNotice('')
                  }}
                >
                  Log result
                </button>
              </>
            )}
            {editing === title && (
              <form
                className="w-full space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!result.trim()) return
                  try {
                    localStorage.setItem(
                      prefix + title + ':' + day,
                      JSON.stringify({ title, day, result: result.trim() }),
                    )
                    read()
                    setEditing('')
                    setNotice('Result saved.')
                  } catch {
                    setNotice('Could not save this result on this device.')
                  }
                }}
              >
                <label>
                  Edition{' '}
                  <input
                    required
                    type="date"
                    max={siteDay()}
                    value={day}
                    onChange={(e) => {
                      setDay(e.target.value)
                      setResult(records.find((r) => r.title === title && r.day === e.target.value)?.result ?? '')
                    }}
                  />
                </label>
                <textarea
                  className="w-full rounded border p-2"
                  aria-label="Shared result"
                  required
                  maxLength={5000}
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
                <button className="underline">Save result</button>{' '}
                <button type="button" onClick={() => setEditing('')}>
                  Cancel
                </button>
              </form>
            )}
          </section>
        ))}
      </div>
      <p role="status">{notice}</p>
      <h2 className="text-xl font-semibold">Personal history ({records.length})</h2>
      {!!records.length && (
        <button
          className="underline"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }))
            const link = document.createElement('a')
            link.href = url
            link.download = 'daily-game-results.json'
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }}
        >
          Export results
        </button>
      )}
      {records.map((r) => (
        <details key={r.title + r.day}>
          <summary>
            {r.day} · {r.title}
          </summary>
          <p className="whitespace-pre-wrap">{r.result}</p>
        </details>
      ))}
    </main>
  )
}
