import { z } from 'zod'
import { firstDay, siteDay, validDay } from '@/lib/daily'
import { nytPuzzle } from '@/lib/daily/nyt'
import { supabaseAdmin } from '@/lib/supabase'
import { check } from '@/lib/spelling-bee'
import { crosswordForDay, type CrosswordPuzzle } from './crossword'
import { cellEntry, type Room, type RoomGame, type RoomPuzzle } from './types'

type StoredPuzzle = Extract<RoomPuzzle, { game: 'bee' }> | { game: 'crossword'; board: CrosswordPuzzle }
type Player = { seat: string; name: string; seq: number }
type Row = {
  id: string
  puzzle: StoredPuzzle
  players: Player[]
  words: string[]
  entries: Record<number, string>
  solved: boolean
  version: number
}
type Change = Partial<Pick<Row, 'players' | 'words' | 'entries' | 'solved'>>

export class RoomError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const name = z.string().trim().min(1).max(32)
const seat = z.uuid()
export const createRoomBody = z.object({
  game: z.enum(['bee', 'crossword']),
  day: z.string(),
  name,
  seat,
  id: z.string(),
  mini: z.boolean().optional(),
})
export const roomAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('join'), name, seat, game: z.enum(['bee', 'crossword']) }),
  z.object({
    action: z.literal('edit'),
    seat,
    seq: z.number().int().positive().max(1_000_000_000),
    edits: z
      .array(
        z.union([
          z.object({ word: z.string().regex(/^[a-z]{4,40}$/) }),
          z.object({ cell: z.number().int().min(0).max(624), value: z.string().regex(cellEntry) }),
        ]),
      )
      .min(1)
      .max(32),
  }),
])

function publicRoom(row: Row): Room {
  const { id, puzzle, players, words, entries, solved, version } = row
  if (puzzle.game === 'bee')
    return { id, puzzle, players: players.map((player) => player.name), words, entries, solved, version }
  const { date, title, credit, width, height, blocks, clues } = puzzle.board
  return {
    id,
    puzzle: { game: 'crossword', board: { date, title, credit, width, height, blocks, clues } },
    players: players.map((player) => player.name),
    words,
    entries,
    solved,
    version,
  }
}

async function loadRoom(id: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin.from('puzzle_rooms').select().eq('id', id).maybeSingle()
  if (error) throw new RoomError('Room storage is unavailable.', 503)
  return data as Row | null
}

async function getPuzzle(game: RoomGame, day: string, mini: boolean): Promise<StoredPuzzle> {
  if (!validDay(day) || day < firstDay(game === 'bee' ? 'bee' : 'mini') || day > siteDay())
    throw new RoomError('Choose a published puzzle date.', 400)
  try {
    if (game === 'crossword') return { game, board: await crosswordForDay(day, mini) }
    return { game, board: (await nytPuzzle('bee', day)) as Extract<RoomPuzzle, { game: 'bee' }>['board'] }
  } catch {
    throw new RoomError(`The puzzle for ${day} is unavailable. Try again or pick another date.`, 503)
  }
}

export async function createRoom(input: z.infer<typeof createRoomBody>): Promise<Room> {
  const { id, game, day, name, seat } = input
  const existing = await loadRoom(id)
  if (existing) {
    if (existing.players[0]?.seat === seat) return publicRoom(existing)
    throw new RoomError('Could not create a room. Try again.', 409)
  }
  const puzzle = await getPuzzle(game, day, input.mini ?? false)
  const { data, error } = await supabaseAdmin
    .from('puzzle_rooms')
    .insert({ id, puzzle, players: [{ name, seat, seq: 0 }] })
    .select()
    .single()
  if (!error) return publicRoom(data as Row)
  if (error.code === '23505') {
    const winner = await loadRoom(id)
    if (winner?.players[0]?.seat === seat) return publicRoom(winner)
    throw new RoomError('Could not create a room. Try again.', 409)
  }
  throw new RoomError('Could not create a room. Try again.', 503)
}

export async function readRoom(id: string) {
  const row = await loadRoom(id)
  if (!row) throw new RoomError('Room not found.', 404)
  return publicRoom(row)
}

function apply(row: Row, action: z.infer<typeof roomAction>): Change | null {
  const player = row.players.find((player) => player.seat === action.seat)
  if (action.action === 'join') {
    if (row.puzzle.game !== action.game) throw new RoomError('This link is for a different game.', 400)
    if (player) return null
    if (row.players.length >= 24) throw new RoomError('This room already has 24 players.', 409)
    return { players: [...row.players, { name: action.name, seat: action.seat, seq: 0 }] }
  }
  if (!player) throw new RoomError('Join this room to edit the puzzle.', 403)
  if (action.seq <= player.seq) return null
  if (row.solved) return null

  const players = row.players.map((p) => (p === player ? { ...p, seq: action.seq } : p))
  if (row.puzzle.game === 'bee') {
    const words = [...row.words]
    for (const edit of action.edits) {
      if (!('word' in edit)) throw new RoomError('Send a word for the hive.', 400)
      if (words.includes(edit.word)) continue
      const error = check(edit.word, row.puzzle.board, words)
      if (error) throw new RoomError(error, 422)
      words.push(edit.word)
    }
    return { players, words, solved: words.length === row.puzzle.board.answers.length }
  }

  const entries = { ...row.entries }
  const { solution } = row.puzzle.board
  for (const edit of action.edits) {
    if (!('cell' in edit) || !solution[edit.cell]) throw new RoomError('Choose an open square.', 422)
    if (edit.value) entries[edit.cell] = edit.value
    else delete entries[edit.cell]
  }
  return { players, entries, solved: solution.every((answer, cell) => !answer || entries[cell] === answer) }
}

export async function updateRoom(id: string, action: z.infer<typeof roomAction>) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await loadRoom(id)
    if (!row) throw new RoomError('Room not found.', 404)
    const change = apply(row, action)
    if (!change) return publicRoom(row)
    const { data, error } = await supabaseAdmin
      .from('puzzle_rooms')
      .update({ ...change, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('version', row.version)
      .select()
      .maybeSingle()
    if (error) throw new RoomError('Room storage is unavailable.', 503)
    if (data) return publicRoom(data as Row)
  }
  throw new RoomError('The room is busy. Retrying…', 503)
}
