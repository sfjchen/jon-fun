import type { Puzzle } from '@/lib/spelling-bee'

export type CrosswordClue = {
  number: string
  direction: 'Across' | 'Down'
  text: string
  cells: number[]
}

export type CrosswordBoard = {
  date: string
  title: string
  credit: string
  creditUrl?: string
  width: number
  height: number
  blocks: boolean[]
  clues: CrosswordClue[]
}

export type RoomPuzzle =
  { game: 'bee'; board: Puzzle & { date: string } } | { game: 'crossword'; board: CrosswordBoard }

export type RoomGame = RoomPuzzle['game']
export type RoomEdit = { word: string } | { cell: number; value: string }
export type Room = {
  id: string
  puzzle: RoomPuzzle
  players: string[]
  words: string[]
  entries: Record<number, string>
  solved: boolean
  version: number
}

export const roomPath: Record<RoomGame, string> = {
  bee: '/games/spelling-bee',
  crossword: '/games/crossword',
}

export const roomTopic = (id: string) => `puzzle-room:${id}`
export const validRoomId = (id: string) => /^[a-zA-Z0-9_-]{16}$/.test(id)

export const cellEntry = /^[A-Z0-9&+.!?/-]{0,16}$/
export const cleanCellEntry = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9&+.!?/-]/g, '')
    .slice(0, 16)
