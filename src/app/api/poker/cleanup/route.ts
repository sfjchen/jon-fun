import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// This endpoint should be called by a cron job to clean up inactive rooms
export async function POST(request: NextRequest) {
  try {
    // Check for authorization (you can add API key check here)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.CLEANUP_API_KEY
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    // Find inactive rooms
    const { data: inactiveRooms, error: fetchError } = await supabase
      .from('poker_rooms')
      .select('pin')
      .or(`last_activity.is.null,last_activity.lt.${twentyFourHoursAgo.toISOString()}`)

    if (fetchError) {
      console.error('Error fetching inactive rooms:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 })
    }

    if (!inactiveRooms || inactiveRooms.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No inactive rooms to delete' })
    }

    const pins = inactiveRooms.map(r => r.pin)

    // Delete related data first (foreign key constraints)
    await supabase.from('poker_actions').delete().in('room_pin', pins)
    await supabase.from('poker_game_state').delete().in('room_pin', pins)
    await supabase.from('poker_players').delete().in('room_pin', pins)
    
    // Delete rooms
    const { error: deleteError } = await supabase
      .from('poker_rooms')
      .delete()
      .in('pin', pins)

    if (deleteError) {
      console.error('Error deleting rooms:', deleteError)
      return NextResponse.json({ error: 'Failed to delete rooms' }, { status: 500 })
    }

    return NextResponse.json({ 
      deleted: inactiveRooms.length, 
      message: `Deleted ${inactiveRooms.length} inactive room(s)` 
    })
  } catch (error) {
    console.error('Error in cleanup:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Allow GET for manual testing
export async function GET() {
  return POST(new NextRequest('http://localhost', { method: 'POST' }))
}


