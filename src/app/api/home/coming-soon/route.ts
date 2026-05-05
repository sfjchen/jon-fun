import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { HOME_COMING_SOON_DEFAULTS, type HomeComingSoonCopy } from '@/data/home-coming-soon-defaults'
import { supabaseAdmin } from '@/lib/supabase'

const bodySchema = z.object({
  password: z.string().min(1),
  headline: z.string().min(1).max(200),
  intro: z.string().min(1).max(800),
  bullets: z.array(z.string().min(1).max(600)).min(1).max(20),
})

function constantTimeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function jsonCopy(row: { headline: string; intro: string; bullets: string[] }): HomeComingSoonCopy {
  return { headline: row.headline, intro: row.intro, bullets: row.bullets }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('home_coming_soon_copy')
      .select('headline, intro, bullets')
      .eq('id', 1)
      .maybeSingle()
    if (!error && data?.headline && data.intro && Array.isArray(data.bullets)) {
      return NextResponse.json(jsonCopy(data as HomeComingSoonCopy))
    }
  } catch {
    /* table missing or offline */
  }
  return NextResponse.json(HOME_COMING_SOON_DEFAULTS)
}

export async function POST(request: Request) {
  const configured = process.env.HOME_COMING_SOON_EDIT_SECRET
  if (!configured) {
    return NextResponse.json({ error: 'HOME_COMING_SOON_EDIT_SECRET is not set' }, { status: 503 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { password, ...rest } = parsed.data
  if (!constantTimeEqualStr(password, configured)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const { error } = await supabaseAdmin.from('home_coming_soon_copy').upsert(
    {
      id: 1,
      headline: rest.headline,
      intro: rest.intro,
      bullets: rest.bullets,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(jsonCopy(rest))
}
