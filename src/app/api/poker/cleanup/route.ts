import { NextRequest, NextResponse } from 'next/server'
import { hasBearer } from '@/lib/api-guards'
import { supabaseAdmin as supabase } from '@/lib/supabase'

interface CleanupResponse {
  deleted: number
  message: string
}

interface ErrorResponse {
  error: string
}

function unauthorized(): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function runCleanup(): Promise<NextResponse<CleanupResponse | ErrorResponse>> {
  try {
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
    const cutoff = twentyFourHoursAgo.toISOString()
    const inactiveFilter = `last_activity.is.null,last_activity.lt.${cutoff}`

    // Find inactive rooms across all game types in parallel
    const [pokerRes, game24Res, partyRes, triplesRes] = await Promise.all([
      supabase.from('poker_rooms').select('pin').or(inactiveFilter),
      supabase.from('game24_rooms').select('pin').or(inactiveFilter),
      supabase.from('party_rooms').select('pin').or(inactiveFilter),
      supabase.from('triples_rooms').select('pin').or(inactiveFilter),
    ])

    if (pokerRes.error) {
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 })
    }
    if (game24Res.error) {
      return NextResponse.json({ error: 'Failed to fetch game24 rooms' }, { status: 500 })
    }
    if (partyRes.error) {
      return NextResponse.json({ error: 'Failed to fetch party rooms' }, { status: 500 })
    }

    if(triplesRes.error)return NextResponse.json({error:'Failed to fetch SET rooms'},{status:500})
    const triplesPins=triplesRes.data?.map(r=>r.pin)??[]
    if(triplesPins.length){const removed=await supabase.from('triples_rooms').delete().in('pin',triplesPins);if(removed.error)return NextResponse.json({error:'Failed to delete SET rooms'},{status:500})}
    const pins = pokerRes.data?.map(r => r.pin) ?? []
    const game24Pins = game24Res.data?.map(r => r.pin) ?? []
    const partyPins = partyRes.data?.map(r => r.pin) ?? []

    // Delete related data first (foreign key constraints) - run in parallel
    await Promise.all([
      pins.length
        ? Promise.all([
            supabase.from('poker_actions').delete().in('room_pin', pins),
            supabase.from('poker_game_state').delete().in('room_pin', pins),
            supabase.from('poker_players').delete().in('room_pin', pins),
          ])
        : Promise.resolve(),
      game24Pins.length
        ? Promise.all([
            supabase.from('game24_submissions').delete().in('room_pin', game24Pins),
            supabase.from('game24_rounds').delete().in('room_pin', game24Pins),
            supabase.from('game24_players').delete().in('room_pin', game24Pins),
          ])
        : Promise.resolve(),
    ])

    if (partyPins.length) {
      const { error: deletePartyError } = await supabase.from('party_rooms').delete().in('pin', partyPins)
      if (deletePartyError) {
        return NextResponse.json({ error: 'Failed to delete party rooms' }, { status: 500 })
      }
    }

    if (pins.length) {
      const { error: deleteError } = await supabase.from('poker_rooms').delete().in('pin', pins)
      if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete poker rooms' }, { status: 500 })
      }
    }

    if (game24Pins.length) {
      const { error: deleteGame24Error } = await supabase.from('game24_rooms').delete().in('pin', game24Pins)
      if (deleteGame24Error) {
        return NextResponse.json({ error: 'Failed to delete game24 rooms' }, { status: 500 })
      }
    }

    const deletedCount = pins.length + game24Pins.length + partyPins.length + triplesPins.length

    return NextResponse.json({
      deleted: deletedCount,
      message: `Deleted ${deletedCount} inactive room(s)`,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Vercel cron (vercel.json) calls GET with `Authorization: Bearer ${CRON_SECRET}`.
// Fails closed: if CRON_SECRET is unset, the cron route rejects every request.
export async function GET(request: NextRequest) {
  if (!hasBearer(request, process.env.CRON_SECRET)) {
    return unauthorized()
  }
  return runCleanup()
}

// Manual trigger with `Authorization: Bearer ${CLEANUP_API_KEY}`. Fails closed like the cron route.
export async function POST(request: NextRequest) {
  if (!hasBearer(request, process.env.CLEANUP_API_KEY)) {
    return unauthorized()
  }
  return runCleanup()
}
