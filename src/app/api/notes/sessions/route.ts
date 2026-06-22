import { NextRequest, NextResponse } from 'next/server'
import { NOTE_SESSIONS_TABLE } from '@/lib/notes/db'
import { supabaseAdmin } from '@/lib/supabase'
import type { NoteSession } from '@/lib/notes/types'

function rowToSession(r: {
  session_id: string
  title: string
  notes: string
  tags?: unknown
  metadata?: unknown
  lookups: unknown
  screenshots: unknown
  started_at: string
  updated_at: string
}): NoteSession {
  const meta =
    r.metadata && typeof r.metadata === 'object' ? (r.metadata as NoteSession['metadata']) : undefined
  return {
    id: r.session_id,
    title: r.title ?? '',
    notes: r.notes ?? '',
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    ...(meta ? { metadata: meta } : {}),
    lookups: Array.isArray(r.lookups) ? (r.lookups as NoteSession['lookups']) : [],
    screenshots:
      r.screenshots && typeof r.screenshots === 'object'
        ? (r.screenshots as NoteSession['screenshots'])
        : {},
    startedAt: r.started_at,
    updatedAt: r.updated_at ?? r.started_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')?.trim()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from(NOTE_SESSIONS_TABLE)
      .select('session_id, title, notes, tags, metadata, lookups, screenshots, started_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const sessions = (data ?? []).map(rowToSession)
    return NextResponse.json({ sessions })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessions } = body as { userId?: string; sessions?: NoteSession[] }
    if (!userId?.trim()) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    const list = Array.isArray(sessions) ? sessions : []
    if (list.length === 0) return NextResponse.json({ ok: true })

    const rows = list.map((s) => ({
      user_id: userId.trim(),
      session_id: s.id,
      title: s.title ?? '',
      notes: s.notes ?? '',
      tags: s.tags ?? [],
      metadata: s.metadata ?? {},
      lookups: s.lookups ?? [],
      screenshots: s.screenshots ?? {},
      started_at: s.startedAt,
      updated_at: s.updatedAt ?? new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin.from(NOTE_SESSIONS_TABLE).upsert(rows, {
      onConflict: 'user_id,session_id',
      ignoreDuplicates: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId } = body as { userId?: string; sessionId?: string }
    if (!userId?.trim() || !sessionId?.trim()) {
      return NextResponse.json({ error: 'userId and sessionId required' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from(NOTE_SESSIONS_TABLE)
      .delete()
      .eq('user_id', userId.trim())
      .eq('session_id', sessionId.trim())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
