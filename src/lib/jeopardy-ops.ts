// Pure operations applied to a JeopardyBoard. Identical logic runs client- and
// server-side so we can apply optimistic ops locally and re-apply on the server.
import type { JeopardyBoard, JeopardyCategory, JeopardyClue } from '@/lib/jeopardy'

export type JeopardyOp =
  | { kind: 'setBoardTitle'; title: string }
  | { kind: 'setCategoryTitle'; col: number; title: string }
  | { kind: 'setClue'; col: number; row: number; question: string; answer: string }
  | { kind: 'addRow' }
  | { kind: 'removeRow' }
  | { kind: 'addCol' }
  | { kind: 'removeCol' }
  | { kind: 'reorderCols'; from: number; to: number }
  | { kind: 'setBaseValue'; value: number }
  | { kind: 'setIncrement'; value: number }
  | { kind: 'replaceBoard'; board: JeopardyBoard }

const emptyClue = (): JeopardyClue => ({ question: '', answer: '' })

function rowsCount(board: JeopardyBoard): number {
  return board.categories[0]?.clues.length ?? 0
}

export function applyOp(board: JeopardyBoard, op: JeopardyOp): JeopardyBoard {
  switch (op.kind) {
    case 'setBoardTitle':
      return { ...board, title: op.title }
    case 'setCategoryTitle': {
      const cats = [...board.categories]
      const cat = cats[op.col]
      if (!cat) return board
      cats[op.col] = { ...cat, title: op.title }
      return { ...board, categories: cats }
    }
    case 'setClue': {
      const cats = [...board.categories]
      const cat = cats[op.col]
      if (!cat) return board
      const clues = [...cat.clues]
      clues[op.row] = { question: op.question, answer: op.answer }
      cats[op.col] = { ...cat, clues }
      return { ...board, categories: cats }
    }
    case 'addRow': {
      const cats = board.categories.map((c) => ({ ...c, clues: [...c.clues, emptyClue()] }))
      return { ...board, categories: cats }
    }
    case 'removeRow': {
      if (rowsCount(board) <= 1) return board
      const cats = board.categories.map((c) => ({ ...c, clues: c.clues.slice(0, -1) }))
      return { ...board, categories: cats }
    }
    case 'addCol': {
      const rows = rowsCount(board) || 5
      const next: JeopardyCategory = {
        title: `category ${board.categories.length + 1}`,
        clues: Array.from({ length: rows }, emptyClue),
      }
      return { ...board, categories: [...board.categories, next] }
    }
    case 'removeCol': {
      if (board.categories.length <= 1) return board
      return { ...board, categories: board.categories.slice(0, -1) }
    }
    case 'reorderCols': {
      const { from, to } = op
      if (from === to) return board
      if (from < 0 || to < 0 || from >= board.categories.length || to >= board.categories.length) return board
      const cats = [...board.categories]
      const [moved] = cats.splice(from, 1)
      if (!moved) return board
      cats.splice(to, 0, moved)
      return { ...board, categories: cats }
    }
    case 'setBaseValue':
      return { ...board, baseValue: Math.max(1, Math.floor(op.value)) }
    case 'setIncrement':
      return { ...board, increment: Math.max(1, Math.floor(op.value)) }
    case 'replaceBoard':
      return { ...op.board }
  }
}

// Safely coerce arbitrary JSON into a JeopardyBoard (used when loading from DB).
export function normalizeBoard(raw: unknown, fallbackId: string): JeopardyBoard {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const categories = Array.isArray(obj.categories) ? obj.categories : []
  const baseValue = typeof obj.baseValue === 'number' ? obj.baseValue : 200
  const increment = typeof obj.increment === 'number' ? obj.increment : baseValue
  const normCats: JeopardyCategory[] = categories.map((c: unknown) => {
    const cc = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
    const clues = Array.isArray(cc.clues) ? cc.clues : []
    return {
      title: typeof cc.title === 'string' ? cc.title : 'Category',
      clues: clues.map((cl: unknown) => {
        const cll = (cl && typeof cl === 'object' ? cl : {}) as Record<string, unknown>
        return {
          question: typeof cll.question === 'string' ? cll.question : '',
          answer: typeof cll.answer === 'string' ? cll.answer : '',
        }
      }),
    }
  })
  const maxRows = Math.max(0, ...normCats.map((c) => c.clues.length)) || 5
  const filled = normCats.length > 0 ? normCats : Array.from({ length: 5 }, (_, c) => ({
    title: `category ${c + 1}`,
    clues: Array.from({ length: maxRows }, emptyClue),
  }))
  const padded = filled.map((c) => ({
    ...c,
    clues: Array.from({ length: maxRows }, (_, i) => c.clues[i] ?? emptyClue()),
  }))
  return {
    id: typeof obj.id === 'string' ? obj.id : fallbackId,
    version: 1,
    title: typeof obj.title === 'string' ? obj.title : 'Untitled',
    categories: padded,
    baseValue,
    increment,
  }
}
