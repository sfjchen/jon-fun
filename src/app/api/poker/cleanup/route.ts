import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// This endpoint should be called by a cron job to clean up inactive rooms
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.CLEANUP_API_KEY
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Find inactive poker rooms
    const { data: inactiveRooms, error: fetchError } = await supabase
      .from('poker_rooms')
      .select('pin')
      .or(`last_activity.is.null,last_activity.lt.${twentyFourHoursAgo.toISOString()}`)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 })
    }

    const { data: inactiveGame24Rooms, error: fetchGame24Error } = await supabase
      .from('game24_rooms')
      .select('pin')
      .or(`last_activity.is.null,last_activity.lt.${twentyFourHoursAgo.toISOString()}`)

    if (fetchGame24Error) {
      return NextResponse.json({ error: 'Failed to fetch game24 rooms' }, { status: 500 })
    }

    const pins = inactiveRooms?.map(r => r.pin) || []
    const game24Pins = inactiveGame24Rooms?.map(r => r.pin) || []

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
    
    // Delete rooms
    if (pins.length) {
      const { error: deleteError } = await supabase
        .from('poker_rooms')
        .delete()
        .in('pin', pins)
      if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete poker rooms' }, { status: 500 })
      }
    }

    if (game24Pins.length) {
      const { error: deleteGame24Error } = await supabase
        .from('game24_rooms')
        .delete()
        .in('pin', game24Pins)
      if (deleteGame24Error) {
        return NextResponse.json({ error: 'Failed to delete game24 rooms' }, { status: 500 })
      }
    }

    const deletedCount = (inactiveRooms?.length || 0) + (inactiveGame24Rooms?.length || 0)

    return NextResponse.json({ 
      deleted: deletedCount, 
      message: `Deleted ${deletedCount} inactive room(s)` 
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Allow GET for manual testing
export async function GET() {
  return POST(new NextRequest('http://localhost', { method: 'POST' }))
}

