import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, session } = body as {
      userId: string
      session: { start: string; end: string; durationMinutes: number; totalCues: number; cycles: number }
    }
    if (!userId || !session?.start || !session?.end) {
      return NextResponse.json({ error: 'userId and session (start, end) required' }, { status: 400 })
    }
    const { error } = await supabase.from('tmr_sleep_sessions').insert({
      user_id: userId,
      start: session.start,
      end: session.end,
      duration_minutes: session.durationMinutes,
      total_cues: session.totalCues ?? 0,
      cycles: session.cycles ?? 0,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
