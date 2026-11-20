import { isNytGame } from '@/lib/daily'
import { nytPuzzle } from '@/lib/daily/nyt'
import type { GameId } from '@/lib/results'
export async function dailyPuzzle(game: GameId, day: string): Promise<{ day: string; sourceDate: string; puzzle: unknown }> {
  if (game === 'anthropeum') {
    const { anthropeumPuzzle } = await import('@/lib/daily/anthropeum')
    const puzzle = await anthropeumPuzzle(day)
    return { day, sourceDate: puzzle.date, puzzle }
  }
  if (game === 'krillion') {
    const { krillionForDay } = await import('@/lib/daily/krillion')
    const puzzle = await krillionForDay(day)
    return { day, sourceDate: puzzle.date, puzzle }
  }
  if (isNytGame(game)) return { day, sourceDate: day, puzzle: await nytPuzzle(game, day) }
  throw new Error('Unknown daily game')
}
