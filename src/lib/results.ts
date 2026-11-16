/**
 * Shared daily results for the Scores hub: the tracked games, parsers for the text each official game's
 * Share button copies, and the browser-side player (name + group code) that results are filed under.
 * Runs on both the client and the /api/results route.
 */

export type GameId = 'anthropeum' | 'krillion' | 'nyt-connections' | 'nyt-mini' | 'nyt-bee' | 'bee' | '24'

type GameDef = {
  title: string
  url: string
  /** Highest accepted score (seconds for timed games, mistakes for Connections). */
  max: number
  lowerWins?: boolean
  time?: boolean
  /** Own games report as play goes on, so the day's best score is kept instead of the first one. */
  best?: boolean
  /** Played on its maker's site, so play time is measured from opening it to logging the result. */
  official?: boolean
}

export const GAMES: Record<GameId, GameDef> = {
  anthropeum: { title: 'Anthropeum', url: '/games/anthropeum', max: 100000, official: true },
  krillion: { title: 'Krillion', url: 'https://krillion.io/', max: 700, official: true },
  'nyt-connections': {
    title: 'NYT Connections',
    url: 'https://www.nytimes.com/games/connections',
    max: 4,
    lowerWins: true,
    official: true,
  },
  'nyt-mini': {
    title: 'NYT Mini',
    url: 'https://www.nytimes.com/crosswords/game/mini',
    max: 3600,
    lowerWins: true,
    time: true,
    official: true,
  },
  'nyt-bee': { title: 'NYT Spelling Bee', url: 'https://www.nytimes.com/puzzles/spelling-bee', max: 2000, official: true },
  bee: { title: 'Spelling Bee', url: '/games/spelling-bee', max: 1000, best: true },
  '24': { title: '24', url: '/games/24', max: 16000, best: true },
}

export const GAME_IDS = Object.keys(GAMES) as GameId[]

/** Extra facts kept with a result. All optional, so old rows and hand-typed scores stay valid. */
export type Stats = {
  /** Seconds from opening the game to logging the result. */
  secs?: number
  /** Anthropeum: "top N% of players today". */
  pct?: number
  /** Anthropeum: rounds scoring 9,000 or more. */
  top?: number
  /** Connections: color of the first group solved. */
  first?: string
  /** Connections: guesses made. Spelling Bee: words found. */
  n?: number
}

export type Result = { game: GameId; day: string; score: number; detail: string; stats: Stats }
export type BoardRow = Result & { name: string }

const COLORS: Record<string, string> = { '🟨': 'yellow', '🟩': 'green', '🟦': 'blue', '🟪': 'purple' }
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * Formats year, month (1-12) and day as YYYY-MM-DD.
 */
function iso(y: number | string, m: number | string, d: number | string): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Returns the browser's local date as YYYY-MM-DD.
 */
export function localDay(d = new Date()): string {
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/**
 * Reads a pasted share text and returns the game, puzzle day and score, or null when no known game matches.
 * Results without a date in the text (Krillion, Connections) are filed under `today`.
 */
export function parseShare(text: string, today: string): Result | null {
  const an = text.match(/Anthropeum\.com\s*·\s*([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)
  if (an) {
    const mo = MONTHS.indexOf(an[1]!.toLowerCase()) + 1
    const sc = text.slice(an.index! + an[0].length).match(/^\s*(\d[\d,]*)/m)
    if (!mo || !sc) return null
    const tiers = text.match(/[🟦🟩🟨🟥]{5,}/u)?.[0] ?? ''
    const pct = text.match(/top (\d{1,3})%/)
    return {
      game: 'anthropeum',
      day: iso(an[3]!, mo, an[2]!),
      score: Number(sc[1]!.replace(/,/g, '')),
      detail: tiers,
      stats: { ...(pct ? { pct: Number(pct[1]) } : {}), top: Array.from(tiers).filter((c) => c === '🟦').length },
    }
  }
  const kr = text.match(/Krillion #(\d+)\s*🦐\s*(\d+)/u)
  if (kr) return { game: 'krillion', day: today, score: Number(kr[2]), detail: `#${kr[1]}`, stats: {} }
  const co = text.match(/Connections\s+Puzzle #([\d,]+)/)
  if (co) {
    const rows = text.match(/[🟨🟩🟦🟪]{4}/gu) ?? []
    const miss = rows.filter((r) => new Set(Array.from(r)).size > 1).length
    const first = rows.find((r) => new Set(Array.from(r)).size === 1)
    return {
      game: 'nyt-connections',
      day: today,
      score: rows.length - miss === 4 ? Math.min(miss, 3) : 4,
      detail: `#${co[1]}`,
      stats: { n: rows.length, ...(first ? { first: COLORS[Array.from(first)[0]!]! } : {}) },
    }
  }
  const mi = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}) New York Times Mini Crossword in (?:(\d+):)?(\d{1,2}):(\d{2})/)
  if (mi) {
    return {
      game: 'nyt-mini',
      day: iso(mi[3]!, mi[1]!, mi[2]!),
      score: Number(mi[4] ?? 0) * 3600 + Number(mi[5]) * 60 + Number(mi[6]),
      detail: '',
      stats: {},
    }
  }
  return null
}

/**
 * Formats seconds as m:ss.
 */
export function formatTime(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')}`
}

/**
 * Formats a score for display: m:ss for timed games, mistakes for Connections, grouped digits otherwise.
 */
export function formatScore(game: GameId, score: number): string {
  if (GAMES[game].time) return formatTime(score)
  if (game === 'nyt-connections') return score >= 4 ? 'missed' : `${score} wrong`
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

const PLAY_KEY = 'sfjc_play'
export const PLAY_CHANGED = 'sfjc-play-changed'

/**
 * Notes that an official game was just opened, so its result can be asked for and timed on return.
 */
export function startPlay(game: GameId): void {
  try {
    localStorage.setItem(PLAY_KEY, JSON.stringify({ game, t: Date.now() }))
    window.dispatchEvent(new Event(PLAY_CHANGED))
  } catch {}
}

/**
 * Returns the official game opened in the last 3 hours and not logged yet, with seconds since it was opened.
 */
export function getPlay(): { game: GameId; secs: number } | null {
  try {
    const p = JSON.parse(localStorage.getItem(PLAY_KEY) ?? 'null') as { game: GameId; t: number } | null
    const secs = p ? Math.round((Date.now() - p.t) / 1000) : -1
    return p && GAMES[p.game] && secs >= 0 && secs < 10800 ? { game: p.game, secs } : null
  } catch {
    return null
  }
}

/**
 * Forgets the opened game once its result is logged or dismissed.
 */
export function endPlay(): void {
  try {
    localStorage.removeItem(PLAY_KEY)
    window.dispatchEvent(new Event(PLAY_CHANGED))
  } catch {}
}

/**
 * Sends a pasted share text, or a score typed by hand or reported by an own game, to the group's board.
 * A result for the game that was just opened also carries the time since it was opened.
 * Resolves to the stored result, or an error message when the player is unset or the server rejects it.
 */
export async function logResult(
  body: { text: string } | { game: GameId; score: number; n?: number },
): Promise<{ result?: Result; kept?: boolean; error?: string }> {
  const p = getPlayer()
  if (!p) return { error: 'Set your name and group first' }
  const today = localDay()
  const game = 'text' in body ? parseShare(body.text, today)?.game : body.game
  const play = getPlay()
  const secs = play && play.game === game ? play.secs : undefined
  try {
    const r = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, today, ...body, secs }),
    })
    const out = (await r.json()) as { result?: Result; kept?: boolean; error?: string }
    if (out.result && secs !== undefined) endPlay()
    return out
  } catch {
    return { error: 'Offline' }
  }
}
