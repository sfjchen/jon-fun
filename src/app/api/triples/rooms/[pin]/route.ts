/**
 * Reads a Triples room and applies player actions: join, start (host only), claim a triple, and leave.
 */

import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { TRIPLES_MAX_PLAYERS, isOver, isTriple, newDeal, removeTriple, validateRoomPin } from '@/lib/triples'
import { playerToken,validPlayerToken,loadRoom, mutateRoom, toRoom, type Failure, type RoomRow } from '@/lib/triples-server'

type Params = { params: Promise<{ pin: string }> }
type Body = { action?: string; playerId?: string; playerToken?:string; name?: string; cards?: unknown }

/**
 * Returns the room for clients, or 404.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { pin } = await params
  if (!validateRoomPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  let row:RoomRow|null
  try{row=await loadRoom(pin)}catch{return NextResponse.json({error:'Room storage unavailable. Try again.'},{status:503})}
  return row ? NextResponse.json({ room: toRoom(row) },{headers:{'Cache-Control':'no-store'}}) : NextResponse.json({ error: 'Room not found' }, { status: 404 })
}

/**
 * Returns a failure for the given message and status.
 */
function fail(error: string, status = 400): Failure {
  return { error, status }
}

/**
 * Applies one action and returns the updated room (or null once the last player leaves).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { pin } = await params
  if (!validateRoomPin(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  const body = ((await request.json().catch(() => null)) ?? {}) as Body
  const me = body.playerId ?? ''
  if(body.action!=='join'&&!validPlayerToken(pin,me,body.playerToken))return NextResponse.json({error:'Rejoin this room to continue.'},{status:403})
  let joinedId = ''

  const change = (row: RoomRow): Partial<RoomRow> | null | Failure => {
    const player = row.players.find((p) => p.id === me)
    switch (body.action) {
      case 'join': {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 24) : ''
        if (!name) return fail('Enter your name')
        if (row.players.length >= TRIPLES_MAX_PLAYERS) return fail(`Room is full (${TRIPLES_MAX_PLAYERS} players)`)
        joinedId ||= uuidv4()
        return { players: [...row.players, { id: joinedId, name, score: 0, misses: 0, authVersion:2 }] }
      }
      case 'start': {
        if (me !== row.host_id) return fail('Only the host can start', 403)
        if (row.status === 'active') return fail('Already playing')
        const deal = newDeal()
        return {
          ...deal,
          status: 'active',
          started_at: new Date().toISOString(),
          last_claim: null,
          players: row.players.map((p) => ({ ...p, score: 0, misses: 0 })),
        }
      }
      case 'claim': {
        if (!player) return fail('You are not in this room', 403)
        if (row.status !== 'active') return fail('The game is not running')
        const cards = Array.isArray(body.cards)&&body.cards.every(c=>Number.isInteger(c)&&c>=0&&c<81) ? body.cards as number[] : []
        if (cards.length!==3 || new Set(cards).size !== 3) return fail('Pick 3 cards')
        if (!cards.every((c) => row.board.includes(c))) return fail('Too slow, those cards are gone', 409)
        const ok = isTriple(cards[0]!, cards[1]!, cards[2]!)
        const claim = { by: me, name: player.name, cards, ok, at: new Date().toISOString() }
        const players = row.players.map((p) =>
          p.id !== me ? p : ok ? { ...p, score: p.score + 1 } : { ...p, score: Math.max(0, p.score - 1), misses: p.misses + 1 },
        )
        if (!ok) return { players, last_claim: claim }
        const deal = removeTriple({ deck: row.deck, board: row.board }, cards)
        return { ...deal, players, last_claim: claim, status: isOver(deal) ? 'finished' : 'active' }
      }
      case 'leave': {
        if (!player) return fail('You are not in this room',403)
        const rest = row.players.filter((p) => p.id !== me)
        if (!rest.length) return null
        return { players: rest, host_id: rest.some((p) => p.id === row.host_id) ? row.host_id : rest[0]!.id }
      }
      default:
        return fail('Unknown action')
    }
  }

  const result = await mutateRoom(pin, change)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ room: result.row && toRoom(result.row), ...(joinedId ? { playerId: joinedId,playerToken:playerToken(pin,joinedId) } : {}) })
}
