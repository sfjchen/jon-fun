import { NextRequest, NextResponse } from 'next/server'
import { NOTE_SESSIONS_TABLE } from '@/lib/notes/db'
import { sanitizeSessionForSync } from '@/lib/notes/textSanitize'
import { resolveSyncUser } from '@/lib/syncAccess'
import { supabaseAdmin } from '@/lib/supabase'
import type { NoteSession } from '@/lib/notes/types'

/** Per-session notes cap; total POST body also bounded by Vercel (~4.5 MB). */
const MAX_NOTE_CHARS = 400_000
const MAX_SYNC_SESSIONS = 250

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
    const qs = request.nextUrl.searchParams
    const who = await resolveSyncUser(qs.get('userId'), qs.get('deviceUserId'))
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })

    const { data, error } = await supabaseAdmin
      .from(NOTE_SESSIONS_TABLE)
      .select('session_id, title, notes, tags, metadata, lookups, screenshots, started_at, updated_at')
      .eq('user_id', who.uid)
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
    const rawBody = await request.text()
    if (rawBody.length > 4_000_000) {
      return NextResponse.json({ error: 'Payload too large — split or trim notes' }, { status: 413 })
    }
    const body = JSON.parse(rawBody) as {
      userId?: string
      sessions?: NoteSession[]
      deviceUserId?: string
    }
    const { sessions } = body
    const who = await resolveSyncUser(body.userId, body.deviceUserId)
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })

    const list = Array.isArray(sessions) ? sessions : []
    if (list.length === 0) return NextResponse.json({ ok: true })
    if (list.length > MAX_SYNC_SESSIONS) {
      return NextResponse.json({ error: `Too many sessions (max ${MAX_SYNC_SESSIONS})` }, { status: 413 })
    }

    for (const s of list) {
      if ((s.notes?.length ?? 0) > MAX_NOTE_CHARS) {
        return NextResponse.json(
          { error: `Note "${s.title || s.id}" exceeds ${MAX_NOTE_CHARS} characters` },
          { status: 413 },
        )
      }
    }

    const rows = list.map((s) => {
      const clean = sanitizeSessionForSync(s)
      return {
        user_id: who.uid,
        session_id: clean.id,
        title: clean.title ?? '',
        notes: clean.notes ?? '',
        tags: clean.tags ?? [],
        metadata: clean.metadata ?? {},
        lookups: clean.lookups ?? [],
        screenshots: clean.screenshots ?? {},
        started_at: clean.startedAt,
        updated_at: clean.updatedAt ?? new Date().toISOString(),
      }
    })

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
    const { userId, sessionId, deviceUserId } = body as { userId?: string; sessionId?: string; deviceUserId?: string }
    if (!sessionId?.trim()) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    const who = await resolveSyncUser(userId, deviceUserId)
    if ('error' in who) return NextResponse.json({ error: who.error }, { status: who.status })

    const { error } = await supabaseAdmin
      .from(NOTE_SESSIONS_TABLE)
      .delete()
      .eq('user_id', who.uid)
      .eq('session_id', sessionId.trim())
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
