/**
 * The shared calendar of the daily games: every player gets the puzzle for the same Pacific date. Holds the date
 * helpers and each game's playable range, with no dependencies, so both the browser and the server import it.
 */

import { ORBS_FIRST_DAY } from '@/lib/orbs'

/** The first day of the dailies that sfjc.dev serves itself (Krillion, Anthropeum, SET). */
export const DAILY_EPOCH = '2026-11-01'
/** The first published puzzle of each NYT daily, which is as far back as its archive goes. */
export const NYT_FIRST_DAY = {
  fivefold: '2021-06-19',
  bee: '2018-05-06',
  mini: '2014-08-21',
  connections: '2023-06-12',
} as const
export type NytGame = keyof typeof NYT_FIRST_DAY
/** The earliest day any daily game has a puzzle. */
export const FIRST_DAY = Object.values(NYT_FIRST_DAY).sort()[0]!
/** The last day a date picker or API accepts. */
export const MAX_DAY = '2100-12-31'

/**
 * Tells whether a game plays the original NYT puzzle of its publication date.
 */
export function isNytGame(game: string): game is NytGame {
  return Object.hasOwn(NYT_FIRST_DAY, game)
}

/**
 * Returns the first day a daily game can be played.
 */
export function firstDay(game: string): string {
  if (game === 'orbs') return ORBS_FIRST_DAY
  return isNytGame(game) ? NYT_FIRST_DAY[game] : DAILY_EPOCH
}

const pacificDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const pacificHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: '2-digit',
  hourCycle: 'h23',
})

/**
 * Returns the Pacific calendar date as YYYY-MM-DD.
 */
export function siteDay(d = new Date()): string {
  return pacificDate.format(d)
}

/**
 * Returns the Pacific hour of the day, 0 to 23.
 */
export function siteHour(d = new Date()): number {
  return Number(pacificHour.format(d))
}

/**
 * Returns the time of the next Pacific midnight, which is 07:00 UTC in PDT and 08:00 UTC in PST.
 */
export function nextSiteMidnight(now = new Date()): number {
  const tomorrow = shiftDay(siteDay(now), 1)
  const early = Date.parse(`${tomorrow}T07:00:00Z`)
  return siteDay(new Date(early)) === tomorrow ? early : early + 3600000
}

/**
 * Tells whether a value is a real calendar date written as YYYY-MM-DD.
 */
export function validDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const time = Date.parse(`${day}T12:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day
}

/**
 * Tells whether a game has (or may later have) a puzzle on a day: a real date from its first day to MAX_DAY.
 */
export function playableDay(game: string, day: unknown): day is string {
  return validDay(day) && day >= firstDay(game) && day <= MAX_DAY
}

/**
 * Moves a date by n days.
 */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}
