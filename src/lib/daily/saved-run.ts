'use client'

/**
 * Opens a day the player already finished on its saved result. Each game keeps its run in this browser, so a day
 * finished under the same name on another device would otherwise show a fresh board. Before a game mounts, the
 * player's saved result for the day is fetched and, unless this browser already holds a finished run, the run is
 * rebuilt from the saved moves and stored where the game restores it from. The check runs again each time the player
 * returns to an open page, so a day finished on a phone meanwhile shows on the computer without a reload.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { siteDay } from '@/lib/daily'
import { artifactScore, type Artifact } from '@/lib/artifact-scoring'
import { ORBS_BOARD_FIRST_DAY, type OrbsPuzzle } from '@/lib/orbs'
import { isOrbsMoveSet, legacyOrbsPicks, replayOrbsDay } from '@/lib/orbs-run'
import { FIVEFOLD_TRIES } from '@/lib/daily/fivefold'
import { getPlayer, isPracticeResult, onLiveRefresh, PLAYER_CHANGED, type GameId, type Stats } from '@/lib/results'

export type DailyGameId = Exclude<GameId, 'bee'>
export type SavedResult = { score: number; stats: Stats; moves: unknown }

const PREFIX: Record<DailyGameId, string> = {
  fivefold: 'fivefold:nyt-v2',
  krillion: 'krillion:v3',
  connections: 'connections:v2',
  mini: 'mini:v3',
  anthropeum: 'anthropeum:v2',
  orbs: 'orbs:v1',
}

/**
 * Names the browser storage entry that holds a game's run for a day. The id is the part of the puzzle the run
 * belongs to: Wordle's answer, a Connections slug, or the puzzle date.
 */
export function runKey(game: DailyGameId, day: string, id: string): string {
  return `${PREFIX[game]}:${day}:${id}`
}

/** Gives revised Orbs boards their own storage entry, keeping earlier dailies and their marks intact. */
export function orbsRunKey(day: string): string {
  return runKey('orbs', day, day < ORBS_BOARD_FIRST_DAY ? day : `${day}:board`)
}

/** A game's stored run: the entry that shows it is finished, the finished test, and the entries a saved result fills. */
type Local = { key: string; done: (v: never) => boolean; fill: (s: SavedResult) => Record<string, unknown> }

/**
 * Describes each game's stored run for a day's puzzle, in the shape its player component restores.
 */
const LOCAL: { [G in DailyGameId]: (day: string, puzzle: never) => Local } = {
  fivefold: (day, { answer }: { answer: string }) => {
    const key = runKey('fivefold', day, answer)
    return {
      key,
      done: (v: { guesses?: string[] } | null) =>
        v?.guesses?.at(-1) === answer || (v?.guesses?.length ?? 0) >= FIVEFOLD_TRIES,
      fill: (s) => ({ [key]: { guesses: s.moves, hard: !!s.stats.hard } }),
    }
  },
  krillion: (day, { date }: { date: string }) => {
    const key = runKey('krillion', day, date)
    return {
      key,
      done: (v: { phase?: string } | null) => v?.phase === 'done',
      fill: (s) => ({ [key]: { phase: 'done', index: 6, endsAt: null, draft: '', outcomes: s.moves } }),
    }
  },
  connections: (day, { slug }: { slug: string }) => {
    const key = runKey('connections', day, slug)
    return {
      key: `${key}:time`,
      done: (v: { done?: boolean } | null) => !!v?.done,
      fill: (s) => ({ [key]: s.moves, [`${key}:time`]: { ms: (s.stats.seconds ?? 0) * 1000, done: true } }),
    }
  },
  mini: (day, { date }: { date: string }) => {
    const key = runKey('mini', day, date)
    return {
      key,
      done: (v: { firstSolveSeconds?: number | null } | null) => typeof v?.firstSolveSeconds === 'number',
      fill: (s) => ({
        [key]: {
          entries: s.moves,
          elapsedMs: s.score * 1000,
          activeSince: null,
          started: true,
          complete: true,
          assisted: false,
          firstSolveSeconds: s.score,
          pencil: [],
          confirmed: [],
        },
      }),
    }
  },
  orbs: (day, puzzle: OrbsPuzzle) => {
    const key = orbsRunKey(day)
    const finished = (value: unknown) => {
      const moves = isOrbsMoveSet(value) ? value : legacyOrbsPicks(value)
      return replayOrbsDay(puzzle, moves)?.every((state) => state.done) === true
    }
    return {
      key,
      done: (run: { picks?: unknown } | null) => finished(isOrbsMoveSet(run) ? run : run?.picks),
      fill: ({ moves }) => {
        if (!finished(moves)) throw new Error('Invalid saved Orbs run')
        return { [key]: isOrbsMoveSet(moves) ? { ...moves, complete: true } : { picks: moves } }
      },
    }
  },
  anthropeum: (day, { date, artifacts }: { date: string; artifacts: Artifact[] }) => {
    const key = runKey('anthropeum', day, date)
    return {
      key,
      done: (v: unknown[] | null) => v?.length === artifacts.length,
      fill: (s) => ({
        [key]: (s.moves as { lat: number; lon: number; year: number }[]).map(({ year, ...pin }, i) => ({
          pin,
          year,
          total: artifactScore(artifacts[i]!, pin, year).total,
        })),
      }),
    }
  },
}

/**
 * Follows the player's board and name as 1 string, empty when no name is set.
 */
function subscribePlayer(cb: () => void) {
  window.addEventListener(PLAYER_CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PLAYER_CHANGED, cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Holds a game back until the player's saved result for the day has been checked. `ready` turns true once the
 * browser's run is settled, which takes 1 request, or no time without a name or on a practice day. `played` carries
 * a saved result that has no moves to rebuild from (saved before moves were kept), for the page to show in place
 * of a fresh board. `rev` rises when a later check fills in a run finished elsewhere, for the page to remount the game.
 */
export function useSavedRun(
  game: DailyGameId,
  day: string,
  puzzle: unknown,
): { ready: boolean; rev: number; played?: SavedResult } {
  const who = useSyncExternalStore(
    subscribePlayer,
    () => {
      const p = getPlayer()
      return p ? `${p.group}\n${p.name}` : ''
    },
    () => '',
  )
  const key = `${game}:${day}:${who}`
  // A failed lookup resolves to undefined, apart from null for a day with no saved result.
  const request = useRef<{ key: string; saved: Promise<SavedResult | null | undefined> }>(undefined)
  // The run this hook filled in, which counts as finished even after the leaving game rewrote its own entry.
  const filled = useRef('')
  // The key whose first check has finished. Only checks after that one are returns that may leave the page as it is:
  // a return while the first check is still out (a tab opened in the background, then switched to) must still settle.
  const checked = useRef('')
  const [settled, setSettled] = useState<{ key: string; rev: number; played?: SavedResult }>()
  // Counts the player's returns to the open page. Each one checks again for a run finished on another device.
  const [seen, setSeen] = useState(0)
  const skip = !who || day > siteDay() || isPracticeResult(game, day)
  useEffect(() => {
    if (skip) return
    // A return fires several events at once (visible, focus, pageshow), which count as 1.
    let last = 0
    return onLiveRefresh(() => {
      if (Date.now() - last < 2000) return
      last = Date.now()
      setSeen((n) => n + 1)
    }, false)
  }, [skip])
  useEffect(() => {
    if (skip) return
    // Reports whether this browser already holds the day's finished run.
    const done = () => {
      if (filled.current === key) return true
      try {
        const local = LOCAL[game](day, puzzle as never)
        return local.done(JSON.parse(localStorage.getItem(local.key) ?? 'null') as never)
      } catch {
        return false
      }
    }
    // A run this browser already finished has nothing to gain from a later check.
    if (checked.current === key && puzzle && done()) return
    // The request starts with the puzzle's own, so the 2 overlap and the game waits for the slower one.
    const asked = `${key}:${seen}`
    if (request.current?.key !== asked) {
      const [group, name] = who.split('\n')
      request.current = {
        key: asked,
        saved: fetch('/api/results/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ group, name, game, day }),
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ result: SavedResult | null }>) : undefined))
          .then((d) => d && (d.result ?? null))
          .catch(() => undefined),
      }
    }
    if (!puzzle) return
    let live = true
    void request.current.saved.then((saved) => {
      if (!live) return
      // A later check that fails or finds nothing new leaves the page as it is.
      if (checked.current === key && (!saved || done())) return
      checked.current = key
      try {
        if (!saved || done()) return setSettled({ key, rev: seen })
        if (saved.moves == null) return setSettled({ key, rev: seen, played: saved })
        const local = LOCAL[game](day, puzzle as never)
        for (const [k, v] of Object.entries(local.fill(saved))) localStorage.setItem(k, JSON.stringify(v))
        filled.current = key
        setSettled({ key, rev: seen })
      } catch {
        // Without storage or with moves that no longer fit the puzzle, the saved score still shows.
        setSettled({ key, rev: seen, ...(saved ? { played: saved } : {}) })
      }
    })
    return () => {
      live = false
    }
  }, [skip, key, who, game, day, puzzle, seen])
  if (skip) return { ready: true, rev: 0 }
  return settled?.key === key
    ? { ready: true, rev: settled.rev, ...(settled.played ? { played: settled.played } : {}) }
    : { ready: false, rev: 0 }
}
