/** Imports publisher-provided editions into a local-only archive with first-writer-wins dates. */
import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { siteDay, validDay } from '@/lib/daily'
import { publisherGame, validatePublisherEdition, type PublisherGame } from './formats'

const archiveRoot = () => path.resolve(process.cwd(), '.publisher-editions')

/** Builds an archive path from validated game and date keys. */
function editionPath(game: PublisherGame, day: string) {
  if (!validDay(day)) throw new Error('Choose a real YYYY-MM-DD date')
  return path.join(archiveRoot(), publisherGame.parse(game), day + '.json')
}

/** Loads a dated fixture for offline replay alongside the requested Pacific play day. */
export async function readPublisherEdition(game: PublisherGame, sourceDate: string, playDay = sourceDate) {
  if (!validDay(playDay)) throw new Error('Choose a real Pacific play date')
  const saved = JSON.parse(await readFile(editionPath(game, sourceDate), 'utf8'))
  return { day: playDay, ...validatePublisherEdition(game, sourceDate, saved) }
}

/** Validates and archives a publisher-supplied edition without overwriting an earlier capture. */
export async function savePublisherEdition(game: PublisherGame, day: string, raw: unknown) {
  const destination = editionPath(game, day)
  const edition = validatePublisherEdition(game, day, raw)
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
  const temporary = path.join(path.dirname(destination), `.${randomUUID()}.tmp`)
  const serialized = JSON.stringify(edition, null, 2) + '\n'
  try {
    await writeFile(temporary, serialized, { mode: 0o600, flag: 'wx' })
    await link(temporary, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const previous = validatePublisherEdition(game, day, JSON.parse(await readFile(destination, 'utf8')))
    if (!isDeepStrictEqual(JSON.parse(serialized), previous))
      throw new Error('A different publisher edition is already archived for this date')
  } finally {
    await rm(temporary, { force: true })
  }
  return edition
}

/** Pulls a single edition from an explicitly configured, authorized HTTPS endpoint. */
export async function refreshPublisherEdition(game: PublisherGame, day = siteDay()) {
  editionPath(game, day)
  const key = game.toUpperCase().replaceAll('-', '_')
  const endpoint = process.env[`PUBLISHER_${key}_FEED_URL`]
  if (!endpoint) throw new Error(`Set PUBLISHER_${key}_FEED_URL to an authorized publisher export endpoint`)
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Use an HTTPS feed URL without embedded credentials')
  url.searchParams.set('date', day)
  const token = process.env[`PUBLISHER_${key}_FEED_TOKEN`]
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Publisher did not provide the ${day} edition (HTTP ${response.status})`)
  return savePublisherEdition(game, day, await response.json())
}

const nativeSources = {
  orbs: ['https://api.dailyorbs.com/api/game-day', 'date'],
  chainle: ['https://chainle.io/api/archive', 'date'],
  headcount: ['https://headcountgame.com/api/tonight', 'd'],
} as const

/** Captures the public source formats already used by the three existing local players. */
export async function capturePublisherEdition(game: PublisherGame, sourceDate: string) {
  editionPath(game, sourceDate)
  if (game !== 'orbs' && game !== 'chainle' && game !== 'headcount')
    throw new Error('This game needs an authorized export rather than a built-in public source')
  const [source, dateParameter] = nativeSources[game]
  const url = new URL(source)
  url.searchParams.set(dateParameter, sourceDate)
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Publisher did not provide the ${sourceDate} edition (HTTP ${response.status})`)
  const raw = z.record(z.string(), z.unknown()).parse(await response.json())
  const partyNumber = z.object({ number: z.number().int().positive() }).optional().parse(raw.party)?.number
  // The publishers also return countdowns and current archive bounds, which can change for the same edition.
  const payload =
    game === 'orbs'
      ? { dateKey: raw.dateKey, state: raw.state, originalDate: raw.originalDate, puzzles: raw.puzzles }
      : game === 'chainle'
        ? { date: raw.date, puzzle: raw.puzzle, pairs: raw.pairs }
        : { party: raw.party }
  return savePublisherEdition(game, sourceDate, {
    format: 'publisher-edition/v1',
    game,
    editionId: game === 'headcount' ? partyNumber : game === 'chainle' ? (raw.puzzle ?? sourceDate) : sourceDate,
    sourceDate,
    sourceUrl: url.href,
    ...(raw.originalDate != null && { originalDate: raw.originalDate }),
    payload: Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)),
  })
}
