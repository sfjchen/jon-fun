import { siteDay } from '@/lib/daily'
import { getDevicePlayer, saveDevicePlayer, ensureSyncIdentity, getDeviceId } from '@/lib/syncIdentity'
export type GameId = 'bee' | 'connections' | 'mini' | 'krillion' | 'anthropeum'
export const GAMES: Record<GameId, { title: string; url: string; max: number; unit: string; rules: string; lowerIsBetter?: boolean }> = {
  bee: { title: 'Spelling Bee', url: '/games/spelling-bee', max: 1000, unit: 'points', rules: 'Word points; pangrams earn a 7-point bonus.' },
  connections: { title: 'Connections', url: '/games/connections/daily', max: 4, unit: 'matches', rules: 'Four groups, four mistakes maximum. Standings compare groups solved, then fewer mistakes.' },
  mini: { title: 'Mini Crossword', url: '/games/mini', max: 864000, unit: 'time', lowerIsBetter: true, rules: 'First unassisted solve time; lower is better. The clock pauses when you pause or leave. Checks and reveals are unranked.' },
  krillion: { title: 'Krillion', url: '/games/krillion', max: 700, unit: 'points', rules: 'Seven 25-second rounds. Original rarity scores: 10, 15, 30, 60, 85 or 100 points per answer. Maximum 700.' },
  anthropeum: { title: 'Anthropeum', url: '/games/anthropeum', max: 100000, unit: 'points', rules: 'Ten artifacts, 250-year guesses, up to 5,000 location and 5,000 time points each. Original scoring formulas.' },
}
export const GAME_IDS = Object.keys(GAMES) as GameId[]
export type Stats = { n?: number; seconds?: number; mistakes?: number; solved?: boolean; max?: number; sourceDate?: string; puzzleId?: string; scoringVersion?: number }
export type Result = { game: GameId; day: string; score: number; stats: Stats }
export type BoardRow = Result & { name: string }
export function scoringVersion(game: GameId): number { return ['mini','connections','krillion','anthropeum'].includes(game) ? 2 : 1 }
export function formatGameScore(game: GameId, score: number): string { return game === 'mini' ? formatTime(Math.round(score)) : game === 'connections' ? `${Number.isInteger(score)?score:score.toFixed(1)}/4` : formatScore(score) }
export function bestGameScore(game: GameId, scores: number[]): number { return GAMES[game].lowerIsBetter ? Math.min(...scores) : Math.max(...scores) }
export function compareResults(a: Result, b: Result): number {
  const score=(a.score-b.score)*(GAMES[a.game].lowerIsBetter?1:-1)
  return score || (a.game==='connections'?(a.stats.mistakes??4)-(b.stats.mistakes??4):0)
}
export function resultLabel(r: Result): string { return formatGameScore(r.game,r.score)+(r.game==='connections'?` · ${r.stats.mistakes??'—'} mistakes`:'') }
export const localDay = siteDay
export function formatScore(score: number): string { return Math.round(score).toLocaleString('en-US') }
export function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
export type Player = { name: string; group: string }
export const PUBLIC_GROUP = 'public'
export function boardName(group: string): string { return group === PUBLIC_GROUP ? 'the public board' : `group ${group}` }
const QUEUE_KEY = 'sfjc_results_queue_v2'
export const PLAYER_CHANGED = 'sfjc-player-changed'
export const RESULTS_CHANGED = 'sfjc-results-changed'
export function getPlayer(): Player | null {
  return getDevicePlayer()
}
export function setPlayer(p: Player): void {
  saveDevicePlayer(p)
  void flushResults()
}
type Queued = Result & { player: Player | null }
function queue(): Queued[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Queued[] } catch { return [] }
}
let flushing = false
export async function flushResults(): Promise<void> {
  await ensureSyncIdentity()
  const player = getPlayer()
  if (!player || flushing) return
  flushing = true
  try {
    for (const item of queue()) {
      if (item.day > localDay()) continue
      const owner = item.player ?? player
      const response = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...owner, deviceId: getDeviceId(), today: item.day, game: item.game, score: item.score, stats: item.stats }) })
      if (!response.ok) { if (response.status >= 500) break; continue }
      // Re-read: a newer result may have arrived while this request was in flight.
      const remaining = queue().filter(q => !(q.game === item.game && q.day === item.day && (item.game === 'mini' ? q.score === item.score : q.score <= item.score) && JSON.stringify(q.player) === JSON.stringify(item.player)))
      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
      window.dispatchEvent(new CustomEvent(RESULTS_CHANGED, { detail: { game: item.game, day: item.day } }))
    }
  } catch { /* Keep the queue for the next connection/focus. */ }
  finally { flushing = false }
}
/** Future previews stay practice even after their calendar date arrives. */
export function markPracticeIfFuture(game: GameId, day?: string): void {
  if (!day || day <= localDay()) return
  try { localStorage.setItem(`sfjc_future_practice:${game}:${day}`, '1') } catch {}
}
export function isPracticeResult(game: GameId, day: string): boolean {
  if (day > localDay()) return true
  try { return localStorage.getItem(`sfjc_future_practice:${game}:${day}`) === '1' } catch { return false }
}
/** Persist before sending; results earned before setting a player are sent after setup. */
export function logResult(game: GameId, score: number, n?: number, day = localDay(), stats: Stats = {}): void {
  markPracticeIfFuture(game, day)
  if (isPracticeResult(game, day) || !Number.isFinite(score)) return
  try {
    const player = getPlayer()
    if (game === 'connections' && n !== undefined) score = n
    const item: Queued = { game, day, score, stats: { scoringVersion: scoringVersion(game), ...stats, ...(n === undefined ? {} : { n }) }, player }
    const saved = queue()
    const index = saved.findIndex(q => q.game === game && q.day === day && JSON.stringify(q.player) === JSON.stringify(player))
    if (index >= 0 && (game === 'mini' || ((saved[index]!.stats.scoringVersion ?? 1) === (item.stats.scoringVersion ?? 1) && (saved[index]!.score > score || saved[index]!.score === score && !(game === 'connections' && (stats.mistakes??4)<(saved[index]!.stats.mistakes??4)))))) { void flushResults(); return }
    if (index >= 0) saved[index] = item
    else saved.push(item)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(saved))
    window.dispatchEvent(new Event('sfjc-score-queued'))
    void flushResults()
  } catch { /* Storage can be disabled in a private browser. */ }
}
export function pendingResults(): number { return queue().length }
