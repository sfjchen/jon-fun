import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { applyOp, normalizeBoard, type JeopardyOp } from '@/lib/jeopardy-ops'
import type { JeopardyBoard } from '@/lib/jeopardy'
import { normalizePlayState } from '@/lib/jeopardy-play-ops'

function isValidSlug(s: string): boolean {
  return typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)
}

async function loadRow(slug: string) {
  return supabase
    .from('jeopardy_boards')
    .select('id, slug, title, board, base_value, increment, version, updated_at, last_editor, play_state, play_version, play_updated_at')
    .eq('slug', slug)
    .single()
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const { data, error } = await loadRow(slug)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const board: JeopardyBoard = normalizeBoard(data.board, data.id)
  return NextResponse.json({
    slug: data.slug,
    title: data.title,
    board,
    version: data.version,
    updatedAt: data.updated_at,
    lastEditor: data.last_editor,
    playState: normalizePlayState(data.play_state),
    playVersion: data.play_version ?? 0,
    playUpdatedAt: data.play_updated_at,
  })
}

const ALLOWED_OPS: JeopardyOp['kind'][] = [
  'setBoardTitle',
  'setCategoryTitle',
  'setClue',
  'addRow',
  'removeRow',
  'addCol',
  'removeCol',
  'reorderCols',
  'setBaseValue',
  'setIncrement',
  'replaceBoard',
]

function isOp(x: unknown): x is JeopardyOp {
  if (!x || typeof x !== 'object') return false
  const k = (x as { kind?: unknown }).kind
  return typeof k === 'string' && (ALLOWED_OPS as string[]).includes(k)
}

const MAX_TITLE = 120
const MAX_CATEGORY = 80
const MAX_CLUE = 2000
const MAX_COLS = 12
const MAX_ROWS = 12

function sanitizeOp(op: JeopardyOp): JeopardyOp {
  switch (op.kind) {
    case 'setBoardTitle':
      return { ...op, title: (op.title || '').toString().slice(0, MAX_TITLE) }
    case 'setCategoryTitle':
      return { ...op, title: (op.title || '').toString().slice(0, MAX_CATEGORY) }
    case 'setClue':
      return {
        ...op,
        question: (op.question || '').toString().slice(0, MAX_CLUE),
        answer: (op.answer || '').toString().slice(0, MAX_CLUE),
      }
    case 'setBaseValue':
    case 'setIncrement':
      return { ...op, value: Math.max(1, Math.min(100_000, Math.floor(op.value))) }
    default:
      return op
  }
}

function rejectIfWouldExceed(current: { categories: { clues: unknown[] }[] }, op: JeopardyOp): string | null {
  if (op.kind === 'addCol' && current.categories.length >= MAX_COLS) return `Max ${MAX_COLS} columns`
  if (op.kind === 'addRow') {
    const rows = current.categories[0]?.clues.length ?? 0
    if (rows >= MAX_ROWS) return `Max ${MAX_ROWS} rows`
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  let body: { op?: unknown; editorName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!isOp(body.op)) return NextResponse.json({ error: 'Invalid op' }, { status: 400 })
  const editor = (body.editorName || '').toString().trim().slice(0, 40)
  const op = sanitizeOp(body.op)

  // Optimistic concurrency: read version, apply, write WHERE version=oldVersion, retry on miss.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await loadRow(slug)
    if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const current = normalizeBoard(row.board, row.id)
    const limitErr = rejectIfWouldExceed(current, op)
    if (limitErr) return NextResponse.json({ error: limitErr }, { status: 400 })
    const next = applyOp(current, op)
    const nextTitle = op.kind === 'setBoardTitle' ? op.title : next.title
    const nextBaseValue = op.kind === 'setBaseValue' ? next.baseValue : row.base_value
    const nextIncrement = op.kind === 'setIncrement' ? next.increment : row.increment
    const now = new Date().toISOString()

    const { data: updated, error: upErr } = await supabase
      .from('jeopardy_boards')
      .update({
        board: { ...next, id: row.id, title: nextTitle },
        title: nextTitle.slice(0, 120),
        base_value: nextBaseValue,
        increment: nextIncrement,
        version: row.version + 1,
        last_editor: editor || row.last_editor,
        updated_at: now,
      })
      .eq('slug', slug)
      .eq('version', row.version)
      .select('slug, title, board, version, updated_at, last_editor')
      .maybeSingle()

    if (upErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    if (updated) {
      return NextResponse.json({
        slug: updated.slug,
        title: updated.title,
        board: normalizeBoard(updated.board, row.id),
        version: updated.version,
        updatedAt: updated.updated_at,
        lastEditor: updated.last_editor,
      })
    }
    // version conflict — loop
  }
  return NextResponse.json({ error: 'Write conflict; retry' }, { status: 409 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isValidSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  const { error } = await supabase.from('jeopardy_boards').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
