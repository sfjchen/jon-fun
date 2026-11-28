import { z } from 'zod'
import schedule from '@/../data/crossword/full-size.json'
import { NYT_FIRST_DAY, validDay } from '@/lib/daily'
import { normalizeNytCrossword } from '@/lib/daily/nyt-puzzles'
import { nytPuzzle } from '@/lib/daily/nyt'
import type { MiniPuzzle } from '@/lib/mini'
import { supabaseAdmin } from '@/lib/supabase'
import { crosswordFromIpuz } from './ipuz'
import { cellEntry, MINI_TITLE, type CrosswordBoard } from './types'

export type CrosswordPuzzle = CrosswordBoard & { solution: (string | null)[] }

const feedPuzzle = z.object({
  date: z.string(),
  title: z.string().trim().min(1).max(120),
  editionId: z.string().trim().min(1).max(200).optional(),
  credit: z.string().trim().min(1).max(300),
  creditUrl: z.url({ protocol: /^https$/ }).optional(),
  width: z.number().int().min(3).max(25),
  height: z.number().int().min(3).max(25),
  circles: z.array(z.number().int().nonnegative()).max(625).optional(),
  cells: z.array(z.string().min(1).regex(cellEntry).nullable()).max(625),
  clues: z
    .array(
      z.object({
        number: z.string().regex(/^\d{1,3}$/),
        direction: z.enum(['Across', 'Down']),
        text: z.string().trim().min(1).max(1000),
        cells: z.array(z.number().int().nonnegative()).min(2).max(25),
      }),
    )
    .min(2)
    .max(625),
})

export function normalizeCrossword(value: unknown, day: string): CrosswordPuzzle {
  const { cells, clues, width, height, creditUrl, editionId, circles, ...meta } = feedPuzzle.parse(value)
  if (circles && (new Set(circles).size !== circles.length || circles.some((cell) => !cells[cell]))) {
    throw new Error('Invalid circled crossword squares')
  }
  const covered = new Set<number>()
  const labels = new Set<string>()
  if (meta.date !== day || cells.length !== width * height) throw new Error('Unexpected crossword date or dimensions')
  for (const clue of clues) {
    const label = `${clue.number} ${clue.direction}`
    if (labels.has(label)) throw new Error('Repeated crossword clue')
    labels.add(label)
    for (const [position, cell] of clue.cells.entries()) {
      const previous = clue.cells[position - 1]
      if (
        !cells[cell] ||
        (position > 0 &&
          (clue.direction === 'Across' ? cell !== previous! + 1 || cell % width === 0 : cell !== previous! + width))
      )
        throw new Error('Invalid crossword clue cells')
      covered.add(cell)
    }
  }
  if (cells.some((cell, i) => cell !== null && !covered.has(i))) throw new Error('Crossword contains unclued cells')
  return {
    ...meta,
    ...(creditUrl && { creditUrl }),
    ...(editionId && { editionId }),
    ...(circles && { circles }),
    width,
    height,
    clues,
    blocks: cells.map((cell) => cell === null),
    solution: cells,
  }
}

type CrosswordSource = 'crossword-nyt' | 'crossword-feed'

async function storedCrossword(day: string, game: CrosswordSource): Promise<CrosswordPuzzle | null> {
  const { data, error } = await supabaseAdmin
    .from('daily_game_content')
    .select('payload')
    .eq('game', game)
    .eq('source_day', day)
    .maybeSingle()
  if (error) throw error
  return data?.payload?.format === 'crossword-feed-v1' ? normalizeCrossword(data.payload.puzzle, day) : null
}

async function freezeCrossword(day: string, game: CrosswordSource, value: unknown): Promise<CrosswordPuzzle> {
  const puzzle = feedPuzzle.parse(value)
  const normalized = normalizeCrossword(puzzle, day)
  const { data, error } = await supabaseAdmin
    .from('daily_game_content')
    .upsert(
      {
        game,
        source_day: day,
        payload: { format: 'crossword-feed-v1', puzzle },
      },
      { onConflict: 'game,source_day', ignoreDuplicates: true },
    )
    .select('source_day')
    .maybeSingle()
  if (error) throw error
  if (data) return normalized

  const winner = await storedCrossword(day, game)
  if (!winner) throw new Error('Could not read the published crossword')
  return winner
}

const editions = new Map(schedule.map((puzzle) => [puzzle.date, puzzle]))
export function crosswordFirstDay(mini: boolean): string {
  if (mini) return NYT_FIRST_DAY.mini
  if (process.env.CROSSWORD_DAILY_FEED_URL) {
    const first = process.env.CROSSWORD_DAILY_FEED_FIRST_DAY
    return validDay(first) ? first : '1942-02-15'
  }
  return schedule[0]!.date
}

export async function crosswordForDay(day: string, miniOnly: boolean): Promise<CrosswordPuzzle> {
  const feed = process.env.CROSSWORD_DAILY_FEED_URL
  if (miniOnly) {
    const mini = (await nytPuzzle('mini', day)) as MiniPuzzle
    return normalizeCrossword(
      {
        ...mini,
        title: MINI_TITLE,
        credit: [mini.constructors.join(', '), mini.copyright].filter(Boolean).join(' · ') || 'The New York Times',
      },
      day,
    )
  }

  if (!validDay(day)) throw new Error('Invalid crossword date')
  if (!feed) {
    // Preserve the board identity of existing rooms through the migration day.
    const legacy = day <= '2026-11-28' ? editions.get(day) : undefined
    if (legacy) return normalizeCrossword(legacy, day)
    const saved = await storedCrossword(day, 'crossword-nyt')
    if (saved) return saved
    const url = 'https://www.nytimes.com/svc/crosswords/v6/puzzle/daily/' + day + '.json'
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
    if (!response.ok) throw new Error('NYT daily crossword unavailable')
    const raw = await response.json()
    const board = normalizeNytCrossword(raw, day)
    return freezeCrossword(day, 'crossword-nyt', {
      ...board, editionId: String(board.id), title: raw.title || 'The New York Times Crossword',
      credit: [...board.constructors, board.copyright].filter(Boolean).join(' · ') || 'The New York Times',
      creditUrl: 'https://www.nytimes.com/crosswords/game/daily/' + day.replaceAll('-', '/'),
    })
  }

  const game = 'crossword-feed'
  const stored = await storedCrossword(day, game)
  if (stored) return stored
  const url = new URL(feed)
  if (url.protocol !== 'https:') throw new Error('Crossword feed must use HTTPS')
  url.searchParams.set('date', day)
  const token = process.env.CROSSWORD_DAILY_FEED_TOKEN
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(12_000),
    redirect: 'error',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Daily crossword feed unavailable')
  const source: unknown = await response.json()
  const puzzle =
    typeof source === 'object' &&
    source !== null &&
    'version' in source &&
    typeof source.version === 'string' &&
    /^https?:\/\/ipuz\.org\/v[12]$/.test(source.version)
      ? crosswordFromIpuz(source, day)
      : source
  return freezeCrossword(day, game, puzzle)
}
