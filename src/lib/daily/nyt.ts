import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase'
import { includePublishedPangrams, type Puzzle } from '@/lib/spelling-bee'
import { siteDay, validDay } from '@/lib/daily'
import { NYT_FIRST_DAY, NYT_PATH, normalizeNytPuzzle, type NytGame } from './nyt-puzzles'

const pending = new Map<string, Promise<unknown>>()
const configured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
async function exactSnapshot(game: NytGame, day: string): Promise<unknown | null> {
  try {
    const puzzles = JSON.parse(await readFile(path.join(process.cwd(), 'public/puzzle-archives', game, `${day.slice(0,4)}.json`), 'utf8')) as { date: string }[]
    const puzzle = puzzles.find(p => p.date === day)
    return puzzle && game === 'bee' ? includePublishedPangrams(puzzle as Puzzle & { date: string }) : puzzle ?? null
  } catch { return null }
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
export async function captureNytDaily() {
  const day = siteDay()
  return Promise.allSettled((Object.keys(NYT_FIRST_DAY) as NytGame[]).map(game => nytPuzzle(game, day)))
}
