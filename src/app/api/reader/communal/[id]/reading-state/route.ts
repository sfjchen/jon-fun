import { NextResponse } from 'next/server'
import {
  communalReaderBackendReady,
  parseReadingStatePatch,
} from '@/lib/reader/communal-server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('reader_communal_publications')
    .select('reading_state')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const rs = typeof data === 'object' && 'reading_state' in data ? (data as { reading_state?: unknown }).reading_state : null
  return NextResponse.json({ progress: rs ?? null })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let progress
  try {
    progress = parseReadingStatePatch(body)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Invalid reading state'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('reader_communal_publications').update({ reading_state: progress }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
