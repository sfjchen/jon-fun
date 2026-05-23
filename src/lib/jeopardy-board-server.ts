// Server-only: insert a new Supabase jeopardy_boards row, retrying on slug collision.
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { generateBoardSlug, type JeopardyBoard } from '@/lib/jeopardy'

const TITLE_MAX = 120
const EDITOR_MAX = 40
const MAX_SLUG_ATTEMPTS = 6

export interface InsertResult {
  ok: true
  slug: string
  id: string
  board: JeopardyBoard
  title: string
  now: string
}

export interface InsertFailure {
  ok: false
  status: number
  error: string
}

/** Insert a new board with a unique slug. Sanitizes title/editor; embeds id/title back into board json. */
export async function insertNewBoard(input: {
  board: JeopardyBoard
  rawTitle?: string | undefined
  editorName?: string | undefined
}): Promise<InsertResult | InsertFailure> {
  const { board, rawTitle, editorName } = input
  const title = (rawTitle?.trim() || board.title || 'Untitled').slice(0, TITLE_MAX)
  const editor = (editorName || '').trim().slice(0, EDITOR_MAX)
  const id = uuidv4()
  const now = new Date().toISOString()

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generateBoardSlug(title)
    const { error } = await supabase.from('jeopardy_boards').insert({
      id,
      slug,
      title,
      board: { ...board, id, title },
      base_value: board.baseValue,
      increment: board.increment,
      version: 0,
      last_editor: editor,
      created_at: now,
      updated_at: now,
    })
    if (!error) {
      return { ok: true, slug, id, board: { ...board, id, title }, title, now }
    }
    const code = error.code?.toString() || ''
    const isCollision = code.includes('23505') || error.message?.includes('duplicate')
    if (!isCollision) {
      return { ok: false, status: 500, error: 'Failed to create board' }
    }
  }
  return { ok: false, status: 500, error: 'Could not allocate slug' }
}
