import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const secret = process.env.TMR_ADMIN_SECRET
  const key = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-admin-key') ?? ''
  if (secret && key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const [studyRes, sleepRes] = await Promise.all([
      supabase.from('tmr_study_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('tmr_sleep_sessions').select('*').order('created_at', { ascending: false }),
    ])
    if (studyRes.error) return NextResponse.json({ error: studyRes.error.message }, { status: 500 })
    if (sleepRes.error) return NextResponse.json({ error: sleepRes.error.message }, { status: 500 })
    return NextResponse.json({
      studySessions: studyRes.data ?? [],
      sleepSessions: sleepRes.data ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
