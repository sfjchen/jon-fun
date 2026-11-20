import { NextResponse } from 'next/server'
import { DAILY_EPOCH, siteDay, validDay } from '@/lib/daily'
import { anthropeumDistribution } from '@/lib/daily/anthropeum'

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get('d')
  if (!validDay(day) || day < DAILY_EPOCH || day > siteDay()) {
    return NextResponse.json({ error: 'Invalid or unpublished date' }, { status: 400 })
  }
  try {
    return NextResponse.json(await anthropeumDistribution(day), {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    })
  } catch {
    return NextResponse.json({ error: 'Original player statistics are temporarily unavailable' }, { status: 503 })
  }
}
