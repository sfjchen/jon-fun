import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createDefaultBoard, type JeopardyBoard } from '@/lib/jeopardy'
import { normalizeBoard } from '@/lib/jeopardy-ops'
import { insertNewBoard } from '@/lib/jeopardy-board-server'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string
      board?: unknown
      editorName?: string
    }
    const initial: JeopardyBoard = body.board
      ? normalizeBoard(body.board, uuidv4())
      : createDefaultBoard(body.title?.trim() || 'Title')

    const result = await insertNewBoard({
      board: initial,
      rawTitle: body.title,
      editorName: body.editorName,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return NextResponse.json({
      slug: result.slug,
      board: result.board,
      version: 0,
      updatedAt: result.now,
      lastEditor: body.editorName ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
