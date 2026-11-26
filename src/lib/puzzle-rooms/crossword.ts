import { z } from 'zod'
import { nytPuzzle } from '@/lib/daily/nyt'
import type { MiniPuzzle } from '@/lib/mini'
import { supabaseAdmin } from '@/lib/supabase'
import { cellEntry, type CrosswordBoard } from './types'

export type CrosswordPuzzle = CrosswordBoard & { solution: (string | null)[] }

const feedPuzzle = z.object({
  date: z.string(),
  title: z.string().trim().min(1).max(120),
  credit: z.string().trim().min(1).max(300),
  width: z.number().int().min(3).max(25),
  height: z.number().int().min(3).max(25),
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
  const { cells, clues, width, height, ...meta } = feedPuzzle.parse(value)
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
  return { ...meta, width, height, clues, blocks: cells.map((cell) => cell === null), solution: cells }
}

async function storedCrossword(day: string): Promise<CrosswordPuzzle | null> {
  const { data, error } = await supabaseAdmin
    .from('daily_game_content')
    .select('payload')
    .eq('game', 'crossword-feed')
    .eq('source_day', day)
    .maybeSingle()
  if (error) throw error
  return data?.payload?.format === 'crossword-feed-v1' ? normalizeCrossword(data.payload.puzzle, day) : null
}

export async function crosswordForDay(day: string, miniOnly: boolean): Promise<CrosswordPuzzle> {
  const feed = process.env.CROSSWORD_DAILY_FEED_URL
  if (!feed || miniOnly) {
    const mini = (await nytPuzzle('mini', day)) as MiniPuzzle
    return normalizeCrossword(
      {
        ...mini,
        title: 'Daily Mini Crossword',
        credit: [mini.constructors.join(', '), mini.copyright].filter(Boolean).join(' · ') || 'The New York Times',
      },
      day,
    )
  }

  const stored = await storedCrossword(day)
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
  const puzzle = feedPuzzle.parse(await response.json())
  const normalized = normalizeCrossword(puzzle, day)
  const { data, error } = await supabaseAdmin
    .from('daily_game_content')
    .upsert(
      {
        game: 'crossword-feed',
        source_day: day,
        payload: { format: 'crossword-feed-v1', puzzle },
      },
      { onConflict: 'game,source_day', ignoreDuplicates: true },
    )
    .select('source_day')
    .maybeSingle()
  if (error) throw error
  return data ? normalized : ((await storedCrossword(day)) ?? normalized)
}
