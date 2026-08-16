// Shared Jeopardy types + pure helpers — safe for server API routes and client components.

export interface JeopardyClue {
  question: string
  answer: string
}

export interface JeopardyCategory {
  title: string
  clues: JeopardyClue[]
}

export interface JeopardyBoard {
  id: string
  version: 1
  title: string
  categories: JeopardyCategory[]
  baseValue: number // usually 200
  increment: number // usually 200
}

export type BoardCoordinates = { colIndex: number; rowIndex: number }

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'board'
}

export function generateShortId(title: string): string {
  const slug = slugify(title)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${slug}-${rand}`
}

/** Slug pattern shared between the API routes that create boards: `${title-slug}-${5 random chars}`. */
export function generateBoardSlug(title: string): string {
  return `${slugify(title || 'board') || 'board'}-${Math.random().toString(36).slice(2, 7)}`
}

export function createDefaultBoard(title = 'Title'): JeopardyBoard {
  const cols = 5
  const rows = 5
  const categories: JeopardyCategory[] = Array.from({ length: cols }, (_, c) => ({
    title: `category ${c + 1}`,
    clues: Array.from({ length: rows }, () => ({ question: '', answer: '' })),
  }))

  return {
    id: generateShortId(title),
    version: 1,
    title,
    categories,
    baseValue: 200,
    increment: 200,
  }
}

export function getClueValue(board: JeopardyBoard, rowIndex: number): number {
  return board.baseValue * (rowIndex + 1)
}
