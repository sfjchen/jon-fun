'use client'

/**
 * The sfjc.dev page of a daily played on its publisher's site: what the game is, a direct link to today's edition, and
 * the results of the sfjc.dev game this page used to play, kept apart from every board.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { boardUrl, getPlayer, PLAYER_CHANGED, PUBLIC_GROUP, RETIRED, retiredLabel } from '@/lib/results'
import { PUBLISHER_PLAY, type PlayId } from '@/lib/publisher-play'

type Row = { name: string; day: string; score: number }

/**
 * Renders the publisher game's page and, once loaded, the retired game's results on the player's board.
 */
export default function PublisherPlay({ id }: { id: PlayId }) {
  const { title, site, about, retired } = PUBLISHER_PLAY[id]
  const host = new URL(site).host
  const old = RETIRED[retired]
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const group = getPlayer()?.group ?? PUBLIC_GROUP
        const res = await fetch(boardUrl({ group, game: retired, days: 6000 }))
        if (!res.ok) throw new Error(String(res.status))
        const body = (await res.json()) as { rows: Row[] }
        if (!live) return
        setRows(body.rows)
        setFailed(false)
      } catch {
        if (live) setFailed(true)
      }
    }
    void load()
    window.addEventListener(PLAYER_CHANGED, load)
    return () => {
      live = false
      window.removeEventListener(PLAYER_CHANGED, load)
    }
  }, [retired])
  const days = [...new Set(rows?.map((r) => r.day))]
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid={`publisher-${id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lora text-2xl font-bold">{title}</h1>
        <Link className="text-sm underline" href="/games/daily-collection">
          Daily games
        </Link>
      </div>
      <p>{about}</p>
      {id !== 'travle' && (
        <iframe
          title={title + ' daily game'}
          src={site}
          className="h-[80dvh] min-h-96 w-full rounded-xl border border-[var(--ink-border)]"
          allow="fullscreen; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <a
        className="inline-block rounded-xl bg-[var(--game-color,var(--ink-accent))] px-4 py-3 font-semibold text-white"
        href={site}
        target="_blank"
        rel="noreferrer"
      >
        Play today’s {title} on {host} ↗
      </a>
      <p className="text-sm text-[var(--ink-muted)]">
        {title} keeps its own score, so it does not rank on sfjc.dev boards. To keep a result here, paste its share text
        under Log result in{' '}
        <Link className="underline" href="/games/daily-collection">
          Daily games
        </Link>
        .
      </p>
      {(failed || !!rows?.length) && (
        <section className="space-y-2 border-t border-[var(--ink-border)] pt-4" aria-label={`Earlier ${old.title}`}>
          <h2 className="text-lg font-semibold">Earlier {old.title} scores</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Until 2026-11-28 this page played {old.title}, sfjc.dev’s own puzzle made from Natural Earth map data, not{' '}
            {title}’s. {old.rules} These results are kept as they were and count on no board.
          </p>
          {failed && <p role="alert">Could not load the earlier scores.</p>}
          <ul className="space-y-1">
            {days.map((day) => (
              <li key={day}>
                <span className="text-[var(--ink-muted)] tabular-nums">{day}</span> ·{' '}
                {rows!
                  .filter((r) => r.day === day)
                  .map((r) => `${r.name} ${retiredLabel(retired, r.score)}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
