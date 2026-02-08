import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, session } = body as {
      userId: string
      session: { start: string; end: string; durationMinutes: number; cuesPlayed: number; cueIntervalSeconds: number; interrupted?: boolean }
    }
    if (!userId || !session?.start || !session?.end) {
      return NextResponse.json({ error: 'userId and session (start, end) required' }, { status: 400 })
    }
    const { error } = await supabase.from('tmr_study_sessions').insert({
      user_id: userId,
      start: session.start,
      end: session.end,
      duration_minutes: session.durationMinutes,
      cues_played: session.cuesPlayed ?? 0,
      cue_interval_seconds: session.cueIntervalSeconds ?? 0,
      interrupted: session.interrupted ?? false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
