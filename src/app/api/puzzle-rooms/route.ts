import { NextResponse } from 'next/server'
import { rateLimited } from '@/lib/api-guards'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { createRoom, createRoomBody, crosswordRoster, RoomError } from '@/lib/puzzle-rooms/server'

export const maxDuration = 30

const rosterQuery = z.object({ group: z.string().regex(/^[a-z0-9-]{3,32}$/), day: z.string().refine(validDay) })

/**
 * Returns each player's word count in a board's full-size crossword for a day, for the Daily drawer.
 */
export async function GET(request: Request) {
  const query = rosterQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!query.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  try {
    return NextResponse.json(await crosswordRoster(query.data.group, query.data.day), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (!(error instanceof RoomError)) throw error
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
}

export async function POST(request: Request) {
  // Each new room stores a puzzle snapshot and may fetch it from its source. Opening a board's shared room also
  // comes through here.
  if (rateLimited(request, 'room-create', 30))
    return NextResponse.json({ error: 'Too many new rooms. Try again in a minute.' }, { status: 429 })
  const body = createRoomBody.safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Choose a puzzle date.' }, { status: 400 })
  try {
    return NextResponse.json(await createRoom(body.data))
  } catch (error) {
    if (!(error instanceof RoomError)) throw error
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
}
