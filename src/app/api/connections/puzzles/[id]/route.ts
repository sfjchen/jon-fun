import { NextRequest, NextResponse } from 'next/server'
import { validate as uuidValidate } from 'uuid'
import {
  connectionsBackendReady,
  connectionsPayloadTooLarge,
  dbRowToPuzzle,
  parseConnectionsUpsertBody,
  puzzleToDbRow,
  type ConnectionsDbRow,
} from '@/lib/connections/server'
import { supabaseAdmin } from '@/lib/supabase'

async function fetchRowByParam(idOrSlug: string) {
  if (uuidValidate(idOrSlug)) {
    const { data, error } = await supabaseAdmin.from('connections_puzzles').select('*').eq('id', idOrSlug).maybeSingle()
    return { data, error }
  }
  const { data, error } = await supabaseAdmin.from('connections_puzzles').select('*').eq('slug', idOrSlug).maybeSingle()
  return { data, error }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }
  const { id: idOrSlug } = await ctx.params
  const { data, error } = await fetchRowByParam(idOrSlug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  try {
    return NextResponse.json(dbRowToPuzzle(data as ConnectionsDbRow))
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'parse_error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }
  const { id: idOrSlug } = await ctx.params

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (connectionsPayloadTooLarge(raw)) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw) as unknown
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: existing, error: fetchErr } = await fetchRowByParam(idOrSlug)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const row = existing as ConnectionsDbRow
  const fingerprint = typeof (body as Record<string, unknown>)?.authorFingerprint === 'string'
    ? (body as Record<string, unknown>).authorFingerprint as string
    : ''
  if (!fingerprint.trim() || fingerprint.trim() !== row.author_fingerprint) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (body && typeof body === 'object') {
    ;(body as Record<string, unknown>).id = row.id
    ;(body as Record<string, unknown>).updatedAt = new Date().toISOString()
    if (typeof (body as Record<string, unknown>).createdAt !== 'string') {
      ;(body as Record<string, unknown>).createdAt = row.created_at
    }
  }

  let puzzle
  try {
    puzzle = parseConnectionsUpsertBody(body, row.id)
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : 'Invalid puzzle'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const upd = puzzleToDbRow(puzzle)
  const { error } = await supabaseAdmin
    .from('connections_puzzles')
    .update({
      slug: upd.slug,
      title: upd.title,
      description: upd.description,
      groups: upd.groups,
      tags: upd.tags,
      author_display: upd.author_display,
      author_fingerprint: upd.author_fingerprint,
      updated_at: upd.updated_at,
    })
    .eq('id', row.id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!connectionsBackendReady()) {
    return NextResponse.json({ error: 'connections_unavailable' }, { status: 503 })
  }
  const { id: idOrSlug } = await ctx.params

  let fingerprint = ''
  try {
    const j = (await request.json()) as unknown
    if (j && typeof j === 'object' && typeof (j as Record<string, unknown>).authorFingerprint === 'string') {
      fingerprint = (j as Record<string, unknown>).authorFingerprint as string
    }
  } catch {
    // allow empty
  }

  const { data: existing, error: fetchErr } = await fetchRowByParam(idOrSlug)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const row = existing as ConnectionsDbRow
  if (!fingerprint.trim() || fingerprint.trim() !== row.author_fingerprint) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('connections_puzzles').delete().eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
