/**
 * Daily Connections: one puzzle per local calendar day, taken in order from the curated bank in
 * public/connections/daily.json. Append new puzzles to the end of that file so past days never change.
 * Progress saves per day in localStorage.
 */

import type { ConnectionsGroup, ConnectionsProgress, ConnectionsPuzzle } from '@/lib/connections'
import { CONNECTIONS_SCHEMA_VERSION, parseConnectionsGroup, validateConnectionsPuzzleShape } from '@/lib/connections'

/** Day 0 of the daily archive (puzzle #1). */
export const CONNECTIONS_DAILY_EPOCH = '2026-11-01'
const PROGRESS_PREFIX = 'connections:daily:'

export type DailyBank = ConnectionsGroup[][]

/**
 * Returns the day number of a YYYY-MM-DD date since the epoch.
 */
export const dailyDayNum = (d: string) => Math.round((Date.parse(d) - Date.parse(CONNECTIONS_DAILY_EPOCH)) / 864e5)

/**
 * Shifts a YYYY-MM-DD date by n days.
 */
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10)

/**
 * Returns the date to show for a ?d= value: that date when it is inside the archive, else today.
 */
export function resolveDailyDate(param: string | null, today: string): string {
  return param && /^\d{4}-\d{2}-\d{2}$/.test(param) && param <= today && dailyDayNum(param) >= 0 ? param : today
}

let bankPromise: Promise<DailyBank> | null = null

/**
 * Loads and validates the puzzle bank once per page load. Invalid entries are dropped.
 */
export function loadDailyBank(): Promise<DailyBank> {
  bankPromise ??= fetch('/connections/daily.json')
    .then((r) => {
      if (!r.ok) throw new Error(r.statusText)
      return r.json() as Promise<{ groups: unknown[] }[]>
    })
    .then((raw) => {
      const bank: DailyBank = []
      for (const p of raw) {
        const groups = Array.isArray(p?.groups) ? p.groups.map(parseConnectionsGroup) : []
        if (groups.length !== 4 || groups.some((g) => !g)) continue
        const valid = groups as ConnectionsGroup[]
        if (validateConnectionsPuzzleShape({ title: 'daily', groups: valid }) === null) bank.push(valid)
      }
      if (!bank.length) throw new Error('empty bank')
      return bank
    })
    .catch((e: unknown) => {
      bankPromise = null
      throw e
    })
  return bankPromise
}

/**
 * Builds the puzzle for a date. The bank wraps around once every puzzle has been used.
 */
export function dailyPuzzle(date: string, bank: DailyBank): ConnectionsPuzzle {
  const n = dailyDayNum(date)
  const groups = bank[((n % bank.length) + bank.length) % bank.length]!
  return {
    id: `daily-${date}`,
    version: CONNECTIONS_SCHEMA_VERSION,
    slug: `daily-${date}`,
    title: `Daily #${n + 1}`,
    description: '',
    tags: ['daily'],
    groups,
    authorDisplay: 'sfjc',
    authorFingerprint: '',
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  }
}

/**
 * Reads the saved game for a date, or undefined when there is none.
 */
export function loadDailyProgress(date: string): ConnectionsProgress | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_PREFIX + date) ?? 'null') as ConnectionsProgress | null
    if (!p || !Array.isArray(p.guesses) || !p.guesses.every((g) => Array.isArray(g) && g.length === 4)) return undefined
    return { guesses: p.guesses, gaveUp: p.gaveUp === true }
  } catch {
    return undefined
  }
}

/**
 * Saves the game for a date.
 */
export function saveDailyProgress(date: string, p: ConnectionsProgress): void {
  try {
    localStorage.setItem(PROGRESS_PREFIX + date, JSON.stringify(p))
  } catch {}
}
