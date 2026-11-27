export type CrosswordClue = {
  number: string
  direction: 'Across' | 'Down'
  text: string
  cells: number[]
}

export type CrosswordBoard = {
  date: string
  title: string
  editionId?: string
  credit: string
  creditUrl?: string
  width: number
  height: number
  blocks: boolean[]
  circles?: number[]
  clues: CrosswordClue[]
}

export type RoomPuzzle = { game: 'crossword'; board: CrosswordBoard }

export type RoomGame = RoomPuzzle['game']
export type RoomEdit = { cell: number; value: string }
export type Room = {
  id: string
  puzzle: RoomPuzzle
  /** Each player by name, with the number of words they were first to fill in. */
  players: { name: string; words: number }[]
  entries: Record<number, string>
  solved: boolean
  version: number
}

export const roomPath: Record<RoomGame, string> = {
  crossword: '/games/crossword',
}

/** The title every Mini edition room carries, which tells it apart from the full-size daily. */
export const MINI_TITLE = 'Daily Mini Crossword'

export const roomTopic = (id: string) => `puzzle-room:${id}`
export const validRoomId = (id: string) => /^[a-zA-Z0-9_-]{16}$/.test(id)

export const cellEntry = /^[A-Z0-9&+.!?/-]{0,16}$/
export const cleanCellEntry = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9&+.!?/-]/g, '')
    .slice(0, 16)
