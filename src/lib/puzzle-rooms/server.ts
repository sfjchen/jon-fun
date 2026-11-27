import { createHash } from 'node:crypto'
import { z } from 'zod'
import { siteDay, validDay } from '@/lib/daily'
import { supabaseAdmin } from '@/lib/supabase'
import { crosswordFirstDay, crosswordForDay, type CrosswordPuzzle } from './crossword'
import { cellEntry, type Room, type RoomGame } from './types'

type StoredPuzzle = { game: 'crossword'; board: CrosswordPuzzle }
type Player = { seat: string; name: string; seq: number; device?: string; late?: true }
type Row = {
  id: string
  puzzle: StoredPuzzle
  players: Player[]
  entries: Record<number, string>
  solved: boolean
  version: number
}
type Change = Partial<Pick<Row, 'players' | 'entries' | 'solved'>>

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
const device = z.uuid().optional()
/** Rooms left untouched this long are deleted by the daily cron. */
const IDLE_DAYS = 30
/** A browser keeps this many seats, so a few open tabs can all edit while repeat joins stop adding up. */
const DEVICE_SEATS = 3
export const createRoomBody = z.object({
  game: z.literal('crossword'),
  day: z.string(),
  name,
  seat,
  device,
  /** A board code opens that board's shared room for the day, in place of a room under a client-made id. */
  group: z
    .string()
    .regex(/^[a-z0-9-]{3,32}$/)
    .optional(),
  id: z.string().optional(),
  mini: z.boolean().optional(),
})
export const roomAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('join'), name, seat, device, game: z.literal('crossword') }),
  z.object({
    action: z.literal('edit'),
    seat,
    seq: z.number().int().positive().max(1_000_000_000),
    edits: z
      .array(z.object({ cell: z.number().int().min(0).max(624), value: z.string().regex(cellEntry) }))
      .min(1)
      .max(32),
  }),
])

function publicRoom(row: Row): Room {
  const { id, puzzle, entries, solved, version } = row
  // A player who rejoins from a new tab takes a new seat, so the roster lists each name once.
  const players = [...new Set(row.players.map((player) => player.name))]
  const { date, title, credit, creditUrl, width, height, blocks, clues } = puzzle.board
  return {
    id,
    puzzle: {
      game: 'crossword',
      board: { date, title, credit, ...(creditUrl && { creditUrl }), width, height, blocks, clues },
    },
    players,
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
  if (!validDay(day) || day < crosswordFirstDay(mini) || day > siteDay())
    throw new RoomError('Choose a published puzzle date.', 400)
  try {
    return { game, board: await crosswordForDay(day, mini) }
  } catch {
    throw new RoomError(`The puzzle for ${day} is unavailable. Try again or pick another date.`, 503)
  }
}

/**
 * Opens a room. With a board code it is the board's 1 shared room for that game, day and edition, which later
 * players join. Otherwise it is a new private room under the caller's id, which only its creator may reopen.
 */
export async function createRoom(input: z.infer<typeof createRoomBody>): Promise<Room> {
  const { game, day, name, seat, device, group } = input
  const mini = input.mini ?? false
  const id = group
    ? createHash('sha256').update(`${group}:${game}:${day}:${mini}`).digest('base64url').slice(0, 16)
    : (input.id ?? '')
  const join = () => updateRoom(id, { action: 'join', name, seat, device, game })
  const existing = await loadRoom(id)
  if (existing) {
    if (group) return join()
    if (existing.players[0]?.seat === seat) return publicRoom(existing)
    throw new RoomError('Could not create a room. Try again.', 409)
  }
  const puzzle = await getPuzzle(game, day, mini)
  const { data, error } = await supabaseAdmin
    .from('puzzle_rooms')
    .insert({ id, puzzle, players: [{ name, seat, seq: 0, ...(device && { device }) }] })
    .select()
    .single()
  if (!error) return publicRoom(data as Row)
  if (error.code === '23505') {
    if (group) return join()
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
    if (player) return null
    // A new tab takes a new seat, since each seat numbers its own edits. Seats are counted per browser, and a
    // browser's oldest seats are dropped, so rejoining never fills the room.
    const { device } = action
    const mine = device ? row.players.filter((p) => p.device === device) : []
    if (!mine.length && new Set(row.players.map((p) => p.device ?? p.seat)).size >= 24)
      throw new RoomError('This room already has 24 players.', 409)
    const dropped = mine.slice(0, Math.max(0, mine.length - DEVICE_SEATS + 1))
    return {
      players: [
        ...row.players.filter((p) => !dropped.includes(p)),
        // A seat taken after the solve can look at the grid but earns no daily result for it.
        { name: action.name, seat: action.seat, seq: 0, ...(device && { device }), ...(row.solved && { late: true }) },
      ],
    }
  }
  if (!player) throw new RoomError('Join this room to edit the puzzle.', 403)
  if (action.seq <= player.seq) return null
  if (row.solved) return null

  const players = row.players.map((p) => (p === player ? { ...p, seq: action.seq } : p))
  const entries = { ...row.entries }
  const { solution } = row.puzzle.board
  for (const edit of action.edits) {
    if (!solution[edit.cell]) throw new RoomError('Choose an open square.', 422)
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

/** Deletes rooms nobody has joined or edited for IDLE_DAYS and returns how many went. */
export async function pruneRooms(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('puzzle_rooms')
    .delete()
    .lt('updated_at', new Date(Date.now() - IDLE_DAYS * 86_400_000).toISOString())
    .select('id')
  if (error) throw error
  return data.length
}

/**
 * Tells whether a seat finished the day's full-size crossword in a room, for the results check. A Mini room, another
 * day's puzzle, or a seat that never joined or joined after the solve does not count.
 */
export async function solvedCrossword(id: string, seat: string, day: string): Promise<boolean> {
  const row = await loadRoom(id)
  if (!row?.solved || !row.players.some((player) => player.seat === seat && !player.late)) return false
  const { solution } = await crosswordForDay(day, false)
  return row.puzzle.board.date === day && row.puzzle.board.solution.join() === solution.join()
}
