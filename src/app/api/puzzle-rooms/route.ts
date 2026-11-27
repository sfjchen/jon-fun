import { NextResponse } from 'next/server'
import { rateLimited } from '@/lib/api-guards'
import { createRoom, createRoomBody, RoomError } from '@/lib/puzzle-rooms/server'
import { validRoomId } from '@/lib/puzzle-rooms/types'

export const maxDuration = 30

export async function POST(request: Request) {
  // Each new room stores a puzzle snapshot and may fetch it from its source. Opening a board's shared room also
  // comes through here.
  if (rateLimited(request, 'room-create', 30))
    return NextResponse.json({ error: 'Too many new rooms. Try again in a minute.' }, { status: 429 })
  const body = createRoomBody.safeParse(await request.json().catch(() => null))
  if (!body.success || !(body.data.group || validRoomId(body.data.id ?? '')))
    return NextResponse.json({ error: 'Enter a name and choose a puzzle date.' }, { status: 400 })
  try {
    return NextResponse.json(await createRoom(body.data))
  } catch (error) {
    if (!(error instanceof RoomError)) throw error
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
}
