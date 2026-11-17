import { shiftDay } from '@/lib/daily'
import type { BoardRow } from '@/lib/results'
export function winners(rows: BoardRow[]): string[] {
  if (new Set(rows.map(r => r.name)).size < 2) return []
  const best = Math.max(...rows.map(r => r.score))
  return best > 0 ? rows.filter(r => r.score === best).map(r => r.name) : []
}
export function streaks(rows: BoardRow[], day: string): { current: number; longest: number } {
  const days = new Set(rows.filter(r => r.day <= day).map(r => r.day))
  let current = 0, longest = 0
  for (let d = days.has(day) ? day : shiftDay(day, -1); days.has(d); d = shiftDay(d, -1)) current++
  for (const d of days) {
    if (days.has(shiftDay(d, -1))) continue
    let length = 0
    for (let next = d; days.has(next); next = shiftDay(next, 1)) length++
    longest = Math.max(longest, length)
  }
  return { current, longest }
}
export function winsByPlayer(rows: BoardRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const key of new Set(rows.map(r => `${r.game}:${r.day}`))) {
    for (const name of winners(rows.filter(r => `${r.game}:${r.day}` === key))) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return counts
}
export function average(values: number[]): number { return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0 }
/** Most game wins determines an overall day winner; ties have no outright winner. */
export function overallDay(rows: BoardRow[]): { names: string[]; gameWins: Map<string, number> } {
  const gameWins = winsByPlayer(rows)
  const best = Math.max(0, ...gameWins.values())
  return { names: [...gameWins].filter(([,n]) => n === best).map(([name]) => name), gameWins }
}
