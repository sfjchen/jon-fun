import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { NoteSource } from '@/lib/uvimco-notes/types'

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId')?.trim()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('notes_sources')
    .select('id, title, kind, content, tags, include_in_context, created_at, updated_at, last_used_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sources: NoteSource[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    kind: (r.kind as NoteSource['kind']) ?? 'paste',
    content: r.content,
    tags: Array.isArray(r.tags) ? r.tags : [],
    includeInContext: r.include_in_context ?? true,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
    lastUsedAt: r.last_used_at ?? undefined,
  }))

  return NextResponse.json({ sources })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; sources?: NoteSource[] }
    const userId = body.userId?.trim()
    const sources = Array.isArray(body.sources) ? body.sources : []
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    if (!sources.length) return NextResponse.json({ ok: true })

    const rows = sources.map((s) => ({
      id: s.id,
      user_id: userId,
      title: s.title,
      kind: s.kind,
      content: s.content,
      tags: s.tags,
      include_in_context: s.includeInContext,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      last_used_at: s.lastUsedAt ?? null,
    }))

    const { error } = await supabaseAdmin.from('notes_sources').upsert(rows, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string; sourceId?: string }
    if (!body.userId?.trim() || !body.sourceId?.trim()) {
      return NextResponse.json({ error: 'userId and sourceId required' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('notes_sources')
      .delete()
      .eq('user_id', body.userId.trim())
      .eq('id', body.sourceId.trim())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
