import { NextRequest, NextResponse } from 'next/server'
import {
  type CommunalDbRow,
  communalReaderBackendReady,
  dbRowToPublication,
  dbRowToSummary,
  parseCommunalPublicationBody,
  publicationPayloadTooLarge,
  publicationToDbRow,
} from '@/lib/reader/communal-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }

  const exportAll = request.nextUrl.searchParams.get('export') === '1'

  if (exportAll) {
    const { data, error } = await supabaseAdmin
      .from('reader_communal_publications')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map((row) => dbRowToPublication(row as CommunalDbRow)))
  }

  const { data, error } = await supabaseAdmin
    .from('reader_communal_publications')
    .select('id, title, source_type, chapter_count, total_words, updated_at, first_chapter_id')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((row) => dbRowToSummary(row as CommunalDbRow)))
}

export async function POST(request: NextRequest) {
  if (!communalReaderBackendReady()) {
    return NextResponse.json({ error: 'communal_unavailable' }, { status: 503 })
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (publicationPayloadTooLarge(raw)) {
    return NextResponse.json({ error: 'publication_too_large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let publication
  try {
    publication = parseCommunalPublicationBody(body)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Invalid publication'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const row = publicationToDbRow(publication)
  const { error } = await supabaseAdmin.from('reader_communal_publications').upsert(row, { onConflict: 'id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
