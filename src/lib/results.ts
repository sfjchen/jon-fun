import { siteDay } from '@/lib/daily'
export type GameId = 'bee' | 'connections' | 'mini' | 'krillion' | 'anthropeum'
export const GAMES: Record<GameId, { title: string; url: string; max: number; unit: string; rules: string }> = {
  bee: { title: 'Spelling Bee', url: '/games/spelling-bee', max: 1000, unit: 'points', rules: 'Word points; pangrams earn a 7-point bonus.' },
  connections: { title: 'Connections', url: '/games/connections/daily', max: 100, unit: 'points', rules: 'Win: 100 minus 20 per mistake. Loss: 10 per group found. Best daily result counts.' },
  mini: { title: 'Mini Crossword', url: '/games/mini', max: 10000, unit: 'points', rules: '10,000 minus solve time in seconds (minimum 1). Checks and reveals make a run practice only.' },
  krillion: { title: 'Krillion', url: '/games/krillion', max: 7000, unit: 'points', rules: 'Daily dive; scoring details appear with the puzzle.' },
  anthropeum: { title: 'Anthropeum', url: '/games/anthropeum', max: 10000, unit: 'points', rules: '10 artifacts, up to 500 location points and 500 date points each. Local scoring.' },
}
export const GAME_IDS = Object.keys(GAMES) as GameId[]
export type Stats = { n?: number; seconds?: number; mistakes?: number; solved?: boolean; max?: number; sourceDate?: string; puzzleId?: string }
export type Result = { game: GameId; day: string; score: number; stats: Stats }
export type BoardRow = Result & { name: string }
export const localDay = siteDay
export function formatScore(score: number): string { return Math.round(score).toLocaleString('en-US') }
export function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
export type Player = { name: string; group: string }
export const PUBLIC_GROUP = 'public'
export function boardName(group: string): string { return group === PUBLIC_GROUP ? 'the public board' : `group ${group}` }
const PLAYER_KEY = 'sfjc_player'
const QUEUE_KEY = 'sfjc_results_queue_v2'
export const PLAYER_CHANGED = 'sfjc-player-changed'
export const RESULTS_CHANGED = 'sfjc-results-changed'
export function getPlayer(): Player | null {
  try { const p = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Player | null; return p?.name && p.group ? p : null } catch { return null }
}
export function setPlayer(p: Player): void {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(p))
  window.dispatchEvent(new Event(PLAYER_CHANGED))
  void flushResults()
}
type Queued = Result & { player: Player | null }
function queue(): Queued[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Queued[] } catch { return [] }
}
let flushing = false
export async function flushResults(): Promise<void> {
  const player = getPlayer()
  if (!player || flushing) return
  flushing = true
  try {
    for (const item of queue()) {
      if (item.day > localDay()) continue
      const owner = item.player ?? player
      const response = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...owner, today: item.day, game: item.game, score: item.score, stats: item.stats }) })
      if (!response.ok) { if (response.status >= 500) break; continue }
      // Re-read: a newer result may have arrived while this request was in flight.
      const remaining = queue().filter(q => !(q.game === item.game && q.day === item.day && q.score <= item.score && JSON.stringify(q.player) === JSON.stringify(item.player)))
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
    const item: Queued = { game, day, score, stats: { ...stats, ...(n === undefined ? {} : { n }) }, player }
    const saved = queue()
    const index = saved.findIndex(q => q.game === game && q.day === day && JSON.stringify(q.player) === JSON.stringify(player))
    if (index >= 0 && saved[index]!.score >= score) { void flushResults(); return }
    if (index >= 0) saved[index] = item
    else saved.push(item)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(saved))
    window.dispatchEvent(new Event('sfjc-score-queued'))
    void flushResults()
  } catch { /* Storage can be disabled in a private browser. */ }
}
export function pendingResults(): number { return queue().length }
