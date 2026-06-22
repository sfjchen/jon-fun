import { NextRequest, NextResponse } from 'next/server'
import { NOTE_SESSIONS_TABLE } from '@/lib/notes/db'
import { supabaseAdmin } from '@/lib/supabase'

/** Admin: list all note sessions. Requires NOTES_ADMIN_SECRET or DAILY_LEARN_ADMIN_SECRET. */
export async function GET(request: NextRequest) {
  const secret =
    process.env.NOTES_ADMIN_SECRET ??
    process.env.UVIMCO_NOTES_ADMIN_SECRET ??
    process.env.DAILY_LEARN_ADMIN_SECRET
  const key = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-admin-key') ?? ''
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const userId = request.nextUrl.searchParams.get('userId')?.trim()
    let q = supabaseAdmin
      .from(NOTE_SESSIONS_TABLE)
      .select('user_id, session_id, title, notes, lookups, started_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500)

    if (userId) q = q.eq('user_id', userId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
    return NextResponse.json({ sessions: data ?? [], userIds })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
