import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { GlossaryEntry } from '@/lib/uvimco-notes/types'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')?.trim()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('notes_glossary')
    .select('term, definition, source_note_id, source_lookup_id, use_count, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entries: GlossaryEntry[] = (data ?? []).map((r) => ({
    term: r.term,
    definition: r.definition,
    sourceNoteId: r.source_note_id ?? '',
    sourceLookupId: r.source_lookup_id ?? '',
    useCount: r.use_count ?? 0,
    updatedAt: r.updated_at ?? new Date().toISOString(),
  }))

  return NextResponse.json({ entries })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; entries?: GlossaryEntry[] }
    const userId = body.userId?.trim()
    const entries = Array.isArray(body.entries) ? body.entries : []
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    if (!entries.length) return NextResponse.json({ ok: true })

    const rows = entries.map((e) => ({
      user_id: userId,
      term: e.term,
      definition: e.definition,
      source_note_id: e.sourceNoteId,
      source_lookup_id: e.sourceLookupId,
      use_count: e.useCount,
      updated_at: e.updatedAt,
    }))

    const { error } = await supabaseAdmin.from('notes_glossary').upsert(rows, {
      onConflict: 'user_id,term',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
