'use client'

import {
  type BoardCoordinates,
  type JeopardyBoard,
  type JeopardyCategory,
  type JeopardyClue,
  createDefaultBoard,
  generateShortId,
  getClueValue,
  slugify,
} from '@/lib/jeopardy-core'

export type { BoardCoordinates, JeopardyBoard, JeopardyCategory, JeopardyClue }
export { createDefaultBoard, generateShortId, getClueValue, slugify, generateBoardSlug } from '@/lib/jeopardy-core'

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
  const maxRows = Math.max(...board.categories.map((c) => c.clues.length)) || 5
  board.categories = board.categories.map((c) => ({
    ...c,
    clues: Array.from({ length: maxRows }, (_, i) => c.clues[i] || { question: '', answer: '' }),
  }))
  return board
}
