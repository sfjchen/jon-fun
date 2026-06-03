import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, weddingBackendReady } from '@/lib/wedding-server'

type RsvpBody = {
  guestName?: string
  attending?: boolean
  plusOneName?: string | null
  dietary?: string | null
  email?: string | null
  message?: string | null
}

export async function POST(request: NextRequest) {
  if (!weddingBackendReady()) {
    return NextResponse.json({ error: 'RSVP is temporarily unavailable. Please try again later.' }, { status: 503 })
  }

  let body: RsvpBody
  try {
    body = (await request.json()) as RsvpBody
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const guestName = body.guestName?.trim()
  if (!guestName || guestName.length > 200) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  }
  if (typeof body.attending !== 'boolean') {
    return NextResponse.json({ error: 'Please select whether you can attend.' }, { status: 400 })
  }

  const plusOne = body.plusOneName?.trim().slice(0, 200) || null
  const dietary = body.dietary?.trim().slice(0, 1000) || null
  const email = body.email?.trim().slice(0, 320) || null
  const message = body.message?.trim().slice(0, 2000) || null

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('wedding_rsvps').insert({
    guest_name: guestName,
    attending: body.attending,
    plus_one_name: plusOne,
    dietary,
    email,
    message,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
