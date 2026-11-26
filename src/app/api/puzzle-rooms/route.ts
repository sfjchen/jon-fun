import { NextResponse } from 'next/server'
import { createRoom, createRoomBody, RoomError } from '@/lib/puzzle-rooms/server'
import { validRoomId } from '@/lib/puzzle-rooms/types'

export const maxDuration = 30

export async function POST(request: Request) {
  const body = createRoomBody.safeParse(await request.json().catch(() => null))
  if (!body.success || !validRoomId(body.data.id))
    return NextResponse.json({ error: 'Enter a name and choose a puzzle date.' }, { status: 400 })
  try {
    return NextResponse.json(await createRoom(body.data))
  } catch (error) {
    if (!(error instanceof RoomError)) throw error
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
}
