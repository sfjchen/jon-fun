import { isNytGame } from '@/lib/daily'
import { nytPuzzle } from '@/lib/daily/nyt'
import type { GameId } from '@/lib/results'
export async function dailyPuzzle(
  game: GameId,
  day: string,
): Promise<{ day: string; sourceDate: string; puzzle: unknown }> {
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
  if (game === 'headcount') {
    const { headcountForDay } = await import('./headcount')
    const puzzle = await headcountForDay(day)
    return { day, sourceDate: puzzle.date, puzzle }
  }
  if (game === 'chainle') {
    const { chainleForDay } = await import('./chainle')
    const puzzle = await chainleForDay(day)
    return { day, sourceDate: puzzle.date, puzzle }
  }
  if (game === 'orbs') {
    const { orbsForDay } = await import('@/lib/daily/orbs')
    return { day, sourceDate: day, puzzle: await orbsForDay(day) }
  }
  if (game === 'crossword') {
    // The solution stays on the server: rooms check entries against it.
    const { crosswordForDay } = await import('@/lib/puzzle-rooms/crossword')
    const board = await crosswordForDay(day, false)
    const puzzle = Object.fromEntries(Object.entries(board).filter(([key]) => key !== 'solution'))
    return { day, sourceDate: board.date, puzzle }
  }
  if (isNytGame(game)) return { day, sourceDate: day, puzzle: await nytPuzzle(game, day) }
  throw new Error('Unknown daily game')
}
