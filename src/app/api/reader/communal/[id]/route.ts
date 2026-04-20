import { NextResponse } from 'next/server'
import { type CommunalDbRow, communalReaderBackendReady, dbRowToPublication } from '@/lib/reader/communal-server'
import { supabaseAdmin } from '@/lib/supabase'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('reader_communal_publications').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(dbRowToPublication(data as CommunalDbRow))
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('reader_communal_publications').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
