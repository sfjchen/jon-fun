import { NextResponse } from 'next/server'
import { readRoom, RoomError, roomAction, updateRoom } from '@/lib/puzzle-rooms/server'
import { validRoomId, type Room } from '@/lib/puzzle-rooms/types'

type Context = { params: Promise<{ room: string }> }
const headers = { 'Cache-Control': 'no-store' }

async function respond(id: string, read: () => Promise<Room>) {
  if (!validRoomId(id)) return NextResponse.json({ error: 'Invalid room link.' }, { status: 400, headers })
  try {
    return NextResponse.json(await read(), { headers })
  } catch (error) {
    if (!(error instanceof RoomError)) throw error
    return NextResponse.json({ error: error.message }, { status: error.status, headers })
  }
}

export async function GET(_request: Request, { params }: Context) {
  const { room } = await params
  return respond(room, () => readRoom(room))
}

export async function POST(request: Request, { params }: Context) {
  const { room } = await params
  const action = roomAction.safeParse(await request.json().catch(() => null))
  if (!action.success) return NextResponse.json({ error: 'Invalid room action.' }, { status: 400, headers })
  return respond(room, () => updateRoom(room, action.data))
}
