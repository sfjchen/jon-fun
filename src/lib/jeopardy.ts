'use client'

// Core types for a Jeopardy board
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

// Helpers
export function generateShortId(title: string): string {
  const slug = slugify(title)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${slug}-${rand}`
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'board'
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
  // Ensure value depends strictly on row position (top=200 → downwards +200)
  return board.baseValue * (rowIndex + 1)
}

// JSON IO
export function downloadBoard(board: JeopardyBoard) {
  const data = JSON.stringify(board, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(board.title)}.jeopardy.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readBoardFromFile(file: File): Promise<JeopardyBoard> {
  const text = await file.text()
  const parsed = JSON.parse(text)
  // minimal validation
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file')
  if (!Array.isArray(parsed.categories)) throw new Error('Invalid board format')
  const board: JeopardyBoard = {
    id: parsed.id || generateShortId(parsed.title || 'board'),
    version: 1,
    title: parsed.title || 'Untitled',
    categories: parsed.categories.map((cat: { title?: unknown; clues?: unknown }) => ({
      title: typeof cat.title === 'string' ? cat.title : 'Category',
      clues: Array.isArray(cat.clues)
        ? cat.clues.map((cl: { question?: unknown; answer?: unknown }) => ({
            question: typeof cl?.question === 'string' ? cl.question : '',
            answer: typeof cl?.answer === 'string' ? cl.answer : '',
          }))
        : [],
    })),
    baseValue: typeof parsed.baseValue === 'number' ? parsed.baseValue : 200,
    increment: typeof parsed.increment === 'number' ? parsed.increment : 200,
  }
  // normalize columns to the same rows length
  const maxRows = Math.max(...board.categories.map((c) => c.clues.length)) || 5
  board.categories = board.categories.map((c) => ({
    ...c,
    clues: Array.from({ length: maxRows }, (_, i) => c.clues[i] || { question: '', answer: '' }),
  }))
  return board
}


