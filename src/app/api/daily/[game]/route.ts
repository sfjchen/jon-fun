import { NextResponse } from 'next/server'
import { dailyPuzzle } from '@/lib/daily/server'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { isNytGame, NYT_FIRST_DAY } from '@/lib/daily/nyt-puzzles'
import { GAME_IDS, type GameId } from '@/lib/results'
export const maxDuration=60
export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params
  const day = new URL(req.url).searchParams.get('d') ?? siteDay()
  if (!GAME_IDS.includes(game as GameId) || !validDay(day) || day < (isNytGame(game) ? NYT_FIRST_DAY[game] : DAILY_EPOCH) || day > '2100-12-31') return NextResponse.json({ error: 'Invalid game or date' }, { status: 400 })
  try { return NextResponse.json(await dailyPuzzle(game as GameId, day), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }) }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Puzzle unavailable' }, { status: 503 }) }
}
