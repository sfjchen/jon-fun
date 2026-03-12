import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/** Returns distinct user_ids that have entries. Requires DAILY_LEARN_ADMIN_SECRET. */
export async function GET(request: NextRequest) {
  const secret = process.env.DAILY_LEARN_ADMIN_SECRET
  const key = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-admin-key') ?? ''
  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { data, error } = await supabase
      .from('daily_learn_entries')
      .select('user_id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const userIds = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
    return NextResponse.json({ userIds })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
