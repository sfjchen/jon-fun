'use client'

/**
 * Lists every daily game in 2 groups: the ones with a page on this site, and the ones played on their publisher's site,
 * whose shared result can be pasted in to keep a personal history on this device and its synced devices.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DailyHeader } from '@/components/daily/DailyDrawer'
import { siteDay } from '@/lib/daily'
import { PLAY_IDS, playUrl } from '@/lib/publisher-play'

import { COLLECTION_PLAYERS, TOP_LEVEL_PLAY } from '@/lib/publisher-collection'

const titles = [
  ['Krillion', '/games/krillion'],
  ['Noillirk', '/games/noillirk'],
  ['Wordle', '/games/wordle'],
  ['Connections', '/games/connections/daily'],
  ['Chainle', '/games/chainle'],
  ['Daily Orbs', '/games/orbs'],
  ['Kabloom', '/games/kabloom'],
  ['Headcount', '/games/headcount'],
  ['Mini', '/games/mini'],
  ['Crossword', '/games/crossword'],
  ['Spelling Bee', '/games/spelling-bee'],
  ['Anthropeum', '/games/anthropeum'],
  ['Fermi', '/games/fermi'],
  ['Travle', '/games/travle'],
  ['Worldle', '/games/worldle'],
  ['MapTap', '/games/maptap'],
  ...COLLECTION_PLAYERS.map((game) => [game.title, '/games/' + game.id] as const),
] as const

/** Whether a game is played on its publisher's site, either straight from this list or from its page here. */
const elsewhere = (url: string) => TOP_LEVEL_PLAY.has(url)

/** The list in its 2 groups, each with a heading and a line on how its results are kept. */
const groups = [
  ['On sfjc.dev', 'Each opens its own page on this site.', titles.filter(([, url]) => !elsewhere(url))],
  [
    'On the publisher’s site',
    'Paste the shared result to keep it in your personal history.',
    titles.filter(([, url]) => elsewhere(url)),
  ],
] as const

const prefix = 'daily-collection:v1:'
type Saved = { title: string; day: string; result: string }

/**
 * Renders the game list, the result form of the game being logged, and the saved history with its export.
 */
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
    const initialRead = window.setTimeout(read, 0)
    window.addEventListener('storage', read)
    window.addEventListener('focus', read)
    return () => {
      window.clearTimeout(initialRead)
      window.removeEventListener('storage', read)
      window.removeEventListener('focus', read)
    }
  }, [])
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-5">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Daily games</h1>
        <DailyHeader />
      </header>
      {groups.map(([heading, note, list]) => (
        <section key={heading} className="space-y-2" aria-label={heading}>
          <h2 className="text-xl font-semibold">{heading}</h2>
          <p className="text-[var(--ink-muted)]">{note}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map(([title, url]) => (
              <section key={title} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                {url.startsWith('/') ? (
                  <Link className="font-semibold underline" href={url}>
                    {title === 'Noillirk' ? 'Crowdict' : title}
                  </Link>
                ) : (
                  <a className="font-semibold underline" href={url} target="_blank" rel="noreferrer">
                    {title} ↗
                  </a>
                )}
                {(title === 'Noillirk' ||
                  PLAY_IDS.some((id) => playUrl(id) === url) ||
                  COLLECTION_PLAYERS.some((game) => game.title === title)) && (
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
        </section>
      ))}
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
    </div>
  )
}
