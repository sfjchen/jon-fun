/**
 * Serves each NYT daily by its exact publication date: from the bundled year archive, then the stored snapshot,
 * then the NYT's own dated endpoint, saving what it fetches. Never substitutes another day's puzzle.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase'
import { includePublishedPangrams, type Puzzle } from '@/lib/spelling-bee'
import { NYT_FIRST_DAY, siteDay, validDay, type NytGame } from '@/lib/daily'
import { NYT_PATH, normalizeNytPuzzle } from './nyt-puzzles'

const pending = new Map<string, Promise<unknown>>()
const years = new Map<string, Promise<Map<string, { date: string }>>>()
const configured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

/**
 * Reads a day's puzzle from the bundled archive. Each year file is parsed once per server instance, since the results
 * API replays every posted game against it.
 */
async function exactSnapshot(game: NytGame, day: string): Promise<unknown | null> {
  const key = `${game}/${day.slice(0, 4)}`
  let year = years.get(key)
  if (!year) {
    year = readFile(path.join(process.cwd(), 'public/puzzle-archives', `${key}.json`), 'utf8')
      .then(text => new Map((JSON.parse(text) as { date: string }[]).map(p => [p.date, p])))
    years.set(key, year)
  }
  try {
    const puzzle = (await year).get(day)
    return puzzle && game === 'bee' ? includePublishedPangrams(puzzle as Puzzle & { date: string }) : puzzle ?? null
  } catch {
    // A missing file is the current year before its first sync, so the next request looks again.
    years.delete(key)
    return null
  }
}
async function load(game: NytGame, day: string): Promise<unknown> {
  const local = await exactSnapshot(game, day)
  if (local && day < siteDay()) return local
  let stored: { date: string } | null = null
  if (configured()) {
    const r = await supabaseAdmin.from('daily_game_content').select('payload').eq('game', `nyt-${game}`).eq('source_day', day).maybeSingle()
    if (r.data?.payload?.format === 'nyt-v1' && r.data.payload.puzzle?.date === day) {
      stored = game === 'bee' ? includePublishedPangrams(r.data.payload.puzzle) : r.data.payload.puzzle
      if (Date.now()-Date.parse(r.data.payload.fetchedAt) < 3600000 || day < siteDay()) return stored
    }
  }
  try {
    const url = `https://www.nytimes.com/svc/${NYT_PATH[game]}/${day}.json`
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), next: { revalidate: 300 } })
    if (!response.ok) throw Error(`NYT returned ${response.status}`)
    const puzzle = normalizeNytPuzzle(game, await response.json(), day)
    if (configured()) {
      const r = await supabaseAdmin.from('daily_game_content').upsert({ game: `nyt-${game}`, source_day: day, payload: { format: 'nyt-v1', puzzle, sourceUrl: url, fetchedAt: new Date().toISOString() } })
      if (r.error) console.warn('NYT snapshot storage unavailable', game, day)
    }
    return puzzle
  } catch {
    if (stored || local) return stored ?? local
    throw Error(`The original NYT puzzle for ${day} is unavailable. Try again later or choose another date.`)
  }
}
export function nytPuzzle(game: NytGame, day: string): Promise<unknown> {
  if (!validDay(day) || day < NYT_FIRST_DAY[game] || day > siteDay()) return Promise.reject(Error('Choose a published puzzle date. Future NYT puzzles are not available.'))
  const key = `${game}:${day}`
  let request = pending.get(key)
  if (!request) { request = load(game, day).finally(() => pending.delete(key)); pending.set(key, request) }
  return request
}
