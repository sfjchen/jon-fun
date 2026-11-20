'use client'

/**
 * Loads a group's board for the leaderboard and the Daily drawer. The long history loads once per page view and again
 * after this device posts a result. Only the selected day, the one part other players keep changing, is polled.
 */

import { useEffect, useState } from 'react'
import { GAMES, RESULTS_CHANGED, boardUrl, onLiveRefresh, type BoardRow } from '@/lib/results'

type Loaded = { key: string; at: number; rows: BoardRow[]; legacyRows: BoardRow[] }
/** Keeps each board's last history, so a remount shows it at once. */
const cache = new Map<string, Loaded>()

/**
 * Fetches 1 board read and stamps it with its start time, so an older read never replaces a newer one.
 */
async function read(key: string, query: Record<string, string | number>, signal: AbortSignal): Promise<Loaded> {
  const at = Date.now()
  const r = await fetch(boardUrl(query), { signal })
  if (!r.ok) throw new Error('Could not load scores. Saved scores retry on their own.')
  const d = (await r.json()) as { rows: BoardRow[]; legacyRows?: BoardRow[] }
  return { key, at, rows: d.rows.filter((x) => GAMES[x.game]), legacyRows: d.legacyRows ?? [] }
}

/**
 * Returns the group's rows for the last `days` days with the freshest copy of `day` merged in, in the server's
 * order. While `live`, `day` is fetched at once and on every live refresh. A failed history load retries on the
 * same refresh.
 */
export function useBoard(group: string, days: number, day: string, live = true) {
  const histKey = `${group}:${days}`,
    dayKey = `${group}:${day}`
  const [hist, setHist] = useState<Loaded | null>(null)
  const [fresh, setFresh] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const ctl = new AbortController()
    let ok = false,
      busy = false
    const load = () => {
      busy = true
      return read(histKey, { group, days }, ctl.signal)
        .then((next) => {
          ok = true
          if ((cache.get(histKey)?.at ?? 0) > next.at) return
          cache.set(histKey, next)
          setHist(next)
          setError('')
        })
        .catch((e: unknown) => {
          if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load scores')
        })
        .finally(() => {
          busy = false
        })
    }
    void load()
    const stop = onLiveRefresh(() => {
      if (!ok && !busy) void load()
    })
    window.addEventListener(RESULTS_CHANGED, load)
    return () => {
      ctl.abort()
      stop()
      window.removeEventListener(RESULTS_CHANGED, load)
    }
  }, [group, days, histKey])
  useEffect(() => {
    if (!live) return
    const ctl = new AbortController()
    const load = () =>
      void read(dayKey, { group, day }, ctl.signal)
        .then((next) => setFresh((p) => (p?.key === dayKey && p.at > next.at ? p : next)))
        .catch(() => {})
    load()
    const stop = onLiveRefresh(load)
    return () => {
      ctl.abort()
      stop()
    }
  }, [group, day, dayKey, live])
  const h = hist?.key === histKey ? hist : cache.get(histKey)
  // A day read that started before the history did may lack a result this device just posted, so the history wins.
  const f = fresh?.key === dayKey && fresh.at >= (h?.at ?? 0) ? fresh : null
  const merged = (k: 'rows' | 'legacyRows') => {
    const all = h?.[k] ?? []
    return f ? [...all.filter((r) => r.day > day), ...f[k], ...all.filter((r) => r.day < day)] : all
  }
  return { rows: merged('rows'), legacyRows: merged('legacyRows'), loaded: !!h, error }
}
