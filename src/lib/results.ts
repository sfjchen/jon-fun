/**
 * Shared daily results for the Scores hub: the games that log themselves, and the browser-side player
 * (name + group code) that results are filed under. Runs on both the client and the /api/results route.
 */

export type GameId = 'bee' | '24' | 'connections'

/** Each game's title, page and highest accepted score. */
export const GAMES: Record<GameId, { title: string; url: string; max: number }> = {
  bee: { title: 'Spelling Bee', url: '/games/spelling-bee', max: 1000 },
  '24': { title: '24', url: '/games/24', max: 16000 },
  connections: { title: 'Connections', url: '/games/connections/daily', max: 100 },
}

export const GAME_IDS = Object.keys(GAMES) as GameId[]

/** Extra facts kept with a result. `n` is the words found in Spelling Bee. */
export type Stats = { n?: number }

export type Result = { game: GameId; day: string; score: number; stats: Stats }
export type BoardRow = Result & { name: string }

/**
 * Returns the browser's local date as YYYY-MM-DD.
 */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Formats a score with grouped digits.
 */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-US')
}

export type Player = { name: string; group: string }

const PLAYER_KEY = 'sfjc_player'
export const PLAYER_CHANGED = 'sfjc-player-changed'

/**
 * Returns this browser's player, or null until a name and group code are both saved.
 */
export function getPlayer(): Player | null {
  try {
    const p = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Player | null
    return p?.name && p.group ? p : null
  } catch {
    return null
  }
}

/**
 * Saves the player and tells open pages to reload their boards.
 */
export function setPlayer(p: Player): void {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(p))
  window.dispatchEvent(new Event(PLAYER_CHANGED))
}

/**
 * Sends a game's score for today to the group's board, resolving once it is stored. Does nothing until a
 * player is saved.
 */
export function logResult(game: GameId, score: number, n?: number): Promise<void> {
  const p = getPlayer()
  if (!p) return Promise.resolve()
  return fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...p, today: localDay(), game, score, n }),
  }).then(
    () => {},
    () => {},
  )
}
