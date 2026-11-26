'use client'

/**
 * Opens a day the player already finished on its saved result. Each game keeps its run in this browser, so a day
 * finished under the same name on another device would otherwise show a fresh board. Before a game mounts, the
 * player's saved result for the day is fetched and, unless this browser already holds a finished run, the run is
 * rebuilt from the saved moves and stored where the game restores it from.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { siteDay } from '@/lib/daily'
import { artifactScore, type Artifact } from '@/lib/artifact-scoring'
import { ORBS_BOARD_FIRST_DAY, ORBS_MAX } from '@/lib/orbs'
import { validOrbsPicks } from '@/lib/orbs-storage'
import { FIVEFOLD_TRIES } from '@/lib/daily/fivefold'
import { getPlayer, isPracticeResult, PLAYER_CHANGED, type GameId, type Stats } from '@/lib/results'

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
  orbs: (day) => {
    const key = orbsRunKey(day)
    return {
      key,
      done: (run: { picks?: unknown } | null) => validOrbsPicks(run?.picks) && run.picks.length === ORBS_MAX,
      fill: ({ moves }) => {
        if (!validOrbsPicks(moves) || moves.length !== ORBS_MAX) throw new Error('Invalid saved Orbs run')
        return { [key]: { picks: moves } }
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
 * of a fresh board.
 */
export function useSavedRun(game: DailyGameId, day: string, puzzle: unknown): { ready: boolean; played?: SavedResult } {
  const who = useSyncExternalStore(
    subscribePlayer,
    () => {
      const p = getPlayer()
      return p ? `${p.group}\n${p.name}` : ''
    },
    () => '',
  )
  const key = `${game}:${day}:${who}`
  const request = useRef<{ key: string; saved: Promise<SavedResult | null> }>(undefined)
  const [settled, setSettled] = useState<{ key: string; played?: SavedResult }>()
  const skip = !who || day > siteDay() || isPracticeResult(game, day)
  useEffect(() => {
    if (skip) return
    // The request starts with the puzzle's own, so the 2 overlap and the game waits for the slower one.
    if (request.current?.key !== key) {
      const [group, name] = who.split('\n')
      request.current = {
        key,
        saved: fetch('/api/results/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({ group, name, game, day }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { result: SavedResult | null } | null) => d?.result ?? null)
          .catch(() => null),
      }
    }
    if (!puzzle) return
    let live = true
    void request.current.saved.then((saved) => {
      if (!live) return
      try {
        const local = LOCAL[game](day, puzzle as never)
        if (!saved || local.done(JSON.parse(localStorage.getItem(local.key) ?? 'null') as never))
          return setSettled({ key })
        if (saved.moves == null) return setSettled({ key, played: saved })
        for (const [k, v] of Object.entries(local.fill(saved))) localStorage.setItem(k, JSON.stringify(v))
        setSettled({ key })
      } catch {
        // Without storage or with moves that no longer fit the puzzle, the saved score still shows.
        setSettled(saved ? { key, played: saved } : { key })
      }
    })
    return () => {
      live = false
    }
  }, [skip, key, who, game, day, puzzle])
  if (skip) return { ready: true }
  return settled?.key === key
    ? { ready: true, ...(settled.played ? { played: settled.played } : {}) }
    : { ready: false }
}
