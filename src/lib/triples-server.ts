/**
 * Server-side room storage for Triples: loads a room row, converts it for clients (hiding the deck order) and
 * applies changes as versioned updates, so 2 players claiming at once can never both take the same cards.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { TriplesClaim, TriplesPlayer, TriplesRoom } from '@/lib/triples'

export type RoomRow = {
  pin: string
  host_id: string
  status: TriplesRoom['status']
  deck: number[]
  board: number[]
  players: TriplesPlayer[]
  last_claim: TriplesClaim | null
  version: number
  started_at: string | null
}

export type Failure = { error: string; status: number }

/**
 * Loads a room row, or null when it does not exist.
 */
export async function loadRoom(pin: string): Promise<RoomRow | null> {
  const { data } = await supabaseAdmin.from('triples_rooms').select('*').eq('pin', pin).maybeSingle()
  return (data as RoomRow | null) ?? null
}

/**
 * Converts a row for clients: the deck becomes a count so nobody can read the next cards.
 */
export function toRoom(row: RoomRow): TriplesRoom {
  return {
    pin: row.pin,
    hostId: row.host_id,
    status: row.status,
    board: row.board,
    deckCount: row.deck.length,
    players: row.players,
    lastClaim: row.last_claim,
    version: row.version,
    startedAt: row.started_at,
  }
}

/**
 * Applies `change` to the latest row and saves it only if nobody saved in between, retrying a few times.
 * `change` returns the fields to update, null to delete the room, or a failure to stop.
 */
export async function mutateRoom(
  pin: string,
  change: (row: RoomRow) => Partial<RoomRow> | null | Failure,
): Promise<{ row: RoomRow | null } | Failure> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await loadRoom(pin)
    if (!row) return { error: 'Room not found', status: 404 }
    const next = change(row)
    if (next && 'error' in next) return next
    if (next === null) {
      const deleted=await supabaseAdmin.from('triples_rooms').delete().eq('pin',pin).eq('version',row.version).select('pin').maybeSingle()
      if(deleted.error)return {error:'Could not update room',status:503}
      if(deleted.data)return {row:null}
      continue
    }
    const { data } = await supabaseAdmin
      .from('triples_rooms')
      .update({ ...next, version: row.version + 1, last_activity: new Date().toISOString() })
      .eq('pin', pin)
      .eq('version', row.version)
      .select()
      .maybeSingle()
    if (data) return { row: data as RoomRow }
  }
  return { error: 'The room is busy. Try again.', status: 409 }
}
