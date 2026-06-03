import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, weddingBackendReady } from '@/lib/wedding-server'

export type WeddingRsvpRow = {
  id: string
  guest_name: string
  attending: boolean
  plus_one_name: string | null
  dietary: string | null
  email: string | null
  message: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const secret = process.env.WEDDING_ADMIN_SECRET
  const key = request.nextUrl.searchParams.get('key') ?? request.headers.get('x-admin-key') ?? ''
  if (secret && key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!weddingBackendReady()) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('wedding_rsvps')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as WeddingRsvpRow[]
    const attending = rows.filter((r) => r.attending)
    const declined = rows.filter((r) => !r.attending)
    const headcount = attending.reduce((n, r) => n + 1 + (r.plus_one_name ? 1 : 0), 0)

    return NextResponse.json({
      rsvps: rows,
      summary: {
        totalResponses: rows.length,
        attendingCount: attending.length,
        declinedCount: declined.length,
        estimatedHeadcount: headcount,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
