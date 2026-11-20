/** All players use the same calendar and deterministic daily schedule. */
export const DAILY_EPOCH = '2026-11-01'
const pacificDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
})
export function siteDay(d = new Date()): string {
  return pacificDate.format(d)
}
/** Pacific midnight is 07:00 UTC in PDT and 08:00 UTC in PST. */
export function nextSiteMidnight(now = new Date()): number {
  const tomorrow = shiftDay(siteDay(now), 1)
  const early = Date.parse(`${tomorrow}T07:00:00Z`)
  return siteDay(new Date(early)) === tomorrow ? early : early + 3600000
}

export function validDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
}
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}
export function dayIndex(day: string): number { return Math.floor((Date.parse(day) - Date.parse(DAILY_EPOCH)) / 86400000) }
export function archiveDay(day: string, dates: string[]): string {
  if (!dates.length) throw new Error('Puzzle archive is empty')
  if (dates.includes(day)) return day
  return dates[((dayIndex(day) % dates.length) + dates.length) % dates.length]!
}
