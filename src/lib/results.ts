import { siteDay } from '@/lib/daily'
import { getDevicePlayer, saveDevicePlayer, ensureSyncIdentity, getDeviceId, deviceKind, type DeviceKind } from '@/lib/syncIdentity'
export type GameId = 'bee' | 'connections' | 'mini' | 'krillion' | 'anthropeum' | 'fivefold'
export const GAMES: Record<GameId, { title: string; url: string; max: number; unit: string; rules: string; lowerIsBetter?: boolean }> = {
  krillion: { title: 'Krillion', url: '/games/krillion', max: 700, unit: 'points', rules: 'Seven 25-second rounds. Original rarity scores: 10, 15, 30, 60, 85 or 100 points per answer. Maximum 700. Your first finished dive counts.' },
  anthropeum: { title: 'Anthropeum', url: '/games/anthropeum', max: 100000, unit: 'points', rules: 'Ten artifacts, 250-year guesses, up to 5,000 location and 5,000 time points each. Original scoring formulas. Your first finished game counts.' },
  connections: { title: 'Connections', url: '/games/connections/daily', max: 4, unit: 'matches', rules: 'Four groups, four mistakes maximum. Solved puzzles rank by time, fastest first; unsolved ones rank below by groups found. Mistakes do not break ties. Your first finished game counts.' },
  fivefold: { title: 'Wordle', url: '/games/wordle', max: 6, unit: 'points', rules: 'Guess the 5-letter word in 6 tries. Ranked by fewest guesses; equal guess counts share the rank. A loss counts as 7 guesses in averages. Your first finished game counts.' },
  mini: { title: 'Mini', url: '/games/mini', max: 864000, unit: 'time', lowerIsBetter: true, rules: 'First unassisted solve time; lower is better. The clock pauses when you pause or leave. Checks and reveals are unranked.' },
  bee: { title: 'Spelling Bee', url: '/games/spelling-bee', max: 1000, unit: 'points', rules: 'Word points; pangrams earn a 7-point bonus. Your score grows as you find words through the day.' },
}
export const GAME_IDS = Object.keys(GAMES) as GameId[]
export type Stats = { n?: number; seconds?: number; mistakes?: number; solved?: boolean; max?: number; sourceDate?: string; puzzleId?: string; scoringVersion?: number; hard?: boolean; moves?: unknown }
export type Result = { game: GameId; day: string; score: number; stats: Stats }
export type BoardRow = Result & { name: string; device?: DeviceKind }
export function scoringVersion(game: GameId): number { return ['mini','connections','krillion','anthropeum','fivefold','bee'].includes(game) ? 2 : 1 }
export function formatGameScore(game: GameId, score: number): string { return game === 'mini' ? formatTime(Math.round(score)) : game === 'connections' ? `${Number.isInteger(score)?score:score.toFixed(1)}/4` : game === 'fivefold' ? (score > 0 ? `${Number.isInteger(score)?7-score:(7-score).toFixed(1)}/6` : 'X/6') : formatScore(score) }
export function bestGameScore(game: GameId, scores: number[]): number { return GAMES[game].lowerIsBetter ? Math.min(...scores) : Math.max(...scores) }
export function compareResults(a: Result, b: Result): number {
  if(a.game==='connections'){
    const complete=(r:Result)=>r.score===4&&typeof r.stats.seconds==='number'
    const ac=complete(a),bc=complete(b)
    if(ac!==bc)return ac?-1:1
    return ac&&bc?a.stats.seconds!-b.stats.seconds!:b.score-a.score
  }
  return (a.score-b.score)*(GAMES[a.game].lowerIsBetter?1:-1)
}
export function resultLabel(r: Result): string {
  // Connections shows its solve time with the lives left out of 4, like the 4 mistake dots in the original.
  if(r.game==='connections'){
    const time=r.stats.seconds===undefined?'':formatTime(r.stats.seconds)
    if(r.score===4&&time)return r.stats.mistakes===undefined?time:`${time} · ${4-r.stats.mistakes}♥`
    return [`${r.stats.n??r.score}/4`,time].filter(Boolean).join(' · ')
  }
  // Hard-mode Wordle results carry the same * that Wordle puts on its own share text.
  return formatGameScore(r.game,r.score)+(r.game==='fivefold'&&r.stats.hard?'*':'')
}
export const localDay = siteDay
export function formatScore(score: number): string { return Math.round(score).toLocaleString('en-US') }
export function formatTime(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
export type Player = { name: string; group: string }
export const PUBLIC_GROUP = 'public'
export function boardName(group: string): string { return group === PUBLIC_GROUP ? 'the public board' : `group ${group}` }
const QUEUE_KEY = 'sfjc_results_queue_v2'
/** Marks the day a player is mid-game on, per game, so usePlayDay can resume it after a reload past midnight. */
export const PLAYING_KEY = 'sfjc_playing:'
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
/** Reads the results saved on this device that are not yet synced. */
export function queue(): Queued[] {
  try { return (JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Queued[]).filter(q => q.game in GAMES) } catch { return [] }
}
let flushing = false, again = false
export async function flushResults(): Promise<void> {
  await ensureSyncIdentity()
  const player = getPlayer()
  if (!player) return
  // A result queued during a flush gets its own pass right after, instead of waiting for the next timer.
  if (flushing) { again = true; return }
  flushing = true
  try {
    for (const item of queue()) {
      if (item.day > localDay()) continue
      const owner = item.player ?? player
      const response = await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...owner, deviceId: getDeviceId(), device: deviceKind(), today: item.day, game: item.game, score: item.score, stats: item.stats }) })
      // A server or rate-limit error retries later; any other rejection is final, so the result leaves the queue.
      if (response.status >= 500 || response.status === 429) break
      // The board keeps 1 spelling per name, so adopt its spelling when this device typed the name in another case.
      const saved = response.ok ? ((await response.json()) as { name?: string }).name : undefined
      const current = getPlayer()
      if (saved && saved !== owner.name && current?.name === owner.name && current.group === owner.group) saveDevicePlayer({ ...current, name: saved })
      // Re-read: a newer result may have arrived while this request was in flight.
      const remaining = queue().filter(q => !(q.game === item.game && q.day === item.day && (item.game === 'mini' ? q.score === item.score : q.score <= item.score) && JSON.stringify(q.player) === JSON.stringify(item.player)))
      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
      window.dispatchEvent(new CustomEvent(RESULTS_CHANGED, { detail: { game: item.game, day: item.day } }))
    }
  } catch { /* Keep the queue for the next connection/focus. */ }
  finally { flushing = false; if (again) { again = false; void flushResults() } }
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
  try { localStorage.setItem(PLAYING_KEY + game, JSON.stringify({ day, at: 0 })) } catch {}
  if (isPracticeResult(game, day) || !Number.isFinite(score) || (stats.sourceDate && stats.sourceDate !== day)) return
  try {
    const player = getPlayer()
    if (game === 'connections' && n !== undefined) score = n
    const item: Queued = { game, day, score, stats: { scoringVersion: scoringVersion(game), ...stats, ...(n === undefined ? {} : { n }) }, player }
    const saved = queue()
    const index = saved.findIndex(q => q.game === game && q.day === day && JSON.stringify(q.player) === JSON.stringify(player))
    // Every game keeps its first finished result. Spelling Bee is the exception: its score grows through the day.
    if (index >= 0 && (game !== 'bee' || saved[index]!.score >= score)) { void flushResults(); return }
    if (index >= 0) saved[index] = item
    else saved.push(item)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(saved))
    window.dispatchEvent(new Event('sfjc-score-queued'))
    void flushResults()
  } catch { /* Storage can be disabled in a private browser. */ }
}
export function pendingResults(): number { return queue().length }
/**
 * Calls reload whenever other players' results may have changed: every 15 seconds while the page is visible, and when
 * the tab becomes visible, regains focus, comes back online or is restored from the back-forward cache (Safari
 * pauses background timers and often skips focus on these). Returns a cleanup function.
 */
export function onLiveRefresh(reload: () => void): () => void {
  const visible = () => { if (document.visibilityState === 'visible') reload() }
  const timer = setInterval(visible, 15000)
  const events: [EventTarget, string][] = [[document, 'visibilitychange'], [window, 'focus'], [window, 'online'], [window, 'pageshow']]
  for (const [target, type] of events) target.addEventListener(type, visible)
  return () => { clearInterval(timer); for (const [target, type] of events) target.removeEventListener(type, visible) }
}
