import { createHash } from 'node:crypto'
import { z } from 'zod'
import { siteDay, validDay } from '@/lib/daily'
import { supabaseAdmin } from '@/lib/supabase'
import { crosswordFirstDay, crosswordForDay, type CrosswordPuzzle } from './crossword'
import { cellEntry, type Room, type RoomGame } from './types'

type StoredPuzzle = { game: 'crossword'; board: CrosswordPuzzle }
/** A seat in a room. `words` lists the clues (`12 Across`) this seat was first to fill in, right or wrong. */
type Player = { seat: string; name: string; seq: number; device?: string; late?: true; words?: string[] }
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
/** A room holds this many browsers, enough for a whole board while a flood of joins cannot grow it without end. */
const ROOM_BROWSERS = 100
export const createRoomBody = z.object({
  game: z.literal('crossword'),
  day: z.string(),
  name,
  seat,
  device,
  /** The board whose shared room for the day this opens. */
  group: z.string().regex(/^[a-z0-9-]{3,32}$/),
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
  // A player who rejoins from a new tab takes a new seat, so the roster lists each name once with all its words.
  const words = new Map<string, number>()
  for (const player of row.players) words.set(player.name, (words.get(player.name) ?? 0) + (player.words?.length ?? 0))
  const players = [...words].map(([name, words]) => ({ name, words }))
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
 * Returns the id of a board's shared room for a game, day and edition.
 */
function sharedRoomId(group: string, game: RoomGame, day: string, mini: boolean): string {
  return createHash('sha256').update(`${group}:${game}:${day}:${mini}`).digest('base64url').slice(0, 16)
}

/**
 * Returns who has filled how many words in a board's full-size crossword for a day, and whether it is solved. A day
 * nobody opened has no players.
 */
export async function crosswordRoster(group: string, day: string) {
  const row = await loadRoom(sharedRoomId(group, 'crossword', day, false))
  return row ? { players: publicRoom(row).players, solved: row.solved } : { players: [], solved: false }
}

/**
 * Opens a board's 1 shared room for a game, day and edition. The first player creates it and every later player
 * joins it, so the whole board solves the same grid.
 */
export async function createRoom(input: z.infer<typeof createRoomBody>) {
  const { game, day, name, seat, device, group } = input
  const mini = input.mini ?? false
  const id = sharedRoomId(group, game, day, mini)
  const join = () => updateRoom(id, { action: 'join', name, seat, device, game })
  if (await loadRoom(id)) return join()
  const puzzle = await getPuzzle(game, day, mini)
  const { data, error } = await supabaseAdmin
    .from('puzzle_rooms')
    .insert({ id, puzzle, players: [{ name, seat, seq: 0, ...(device && { device }) }] })
    .select()
    .single()
  if (!error) return publicRoom(data as Row)
  if (error.code === '23505') return join()
  throw new RoomError('Could not open the shared grid. Try again.', 503)
}

export async function readRoom(id: string) {
  const row = await loadRoom(id)
  if (!row) throw new RoomError('Room not found.', 404)
  return publicRoom(row)
}

function apply(row: Row, action: z.infer<typeof roomAction>): Change | null {
  const player = row.players.find((player) => player.seat === action.seat)
  if (action.action === 'join') {
    // A seat that joins again only takes its new name, as when a guest adds one.
    if (player)
      return player.name === action.name
        ? null
        : { players: row.players.map((p) => (p === player ? { ...p, name: action.name } : p)) }
    // A new tab takes a new seat, since each seat numbers its own edits. Seats are counted per browser, and a
    // browser's oldest seats are dropped, so rejoining never fills the room.
    const { device } = action
    const mine = device ? row.players.filter((p) => p.device === device) : []
    if (!mine.length && new Set(row.players.map((p) => p.device ?? p.seat)).size >= ROOM_BROWSERS)
      throw new RoomError(`This grid already has ${ROOM_BROWSERS} players.`, 409)
    const dropped = mine.slice(0, Math.max(0, mine.length - DEVICE_SEATS + 1))
    return {
      players: [
        ...row.players.filter((p) => !dropped.includes(p)),
        // A seat taken after the solve can look at the grid but earns no daily result for it, unless its browser
        // was already in before the solve. It keeps the words of the seats it replaces.
        {
          name: action.name,
          seat: action.seat,
          seq: 0,
          ...(device && { device }),
          ...(row.solved && !mine.some((p) => !p.late) && { late: true }),
          ...(dropped.some((p) => p.words) && { words: dropped.flatMap((p) => p.words ?? []) }),
        },
      ],
    }
  }
  if (!player) throw new RoomError('Join this room to edit the puzzle.', 403)
  if (action.seq <= player.seq) return null
  if (row.solved) return null

  const entries = { ...row.entries }
  const { solution, clues } = row.puzzle.board
  for (const edit of action.edits) {
    if (!solution[edit.cell]) throw new RoomError('Choose an open square.', 422)
    if (edit.value) entries[edit.cell] = edit.value
    else delete entries[edit.cell]
  }
  // A word goes to the first player to fill its last open square, right or wrong, and stays theirs if erased.
  const taken = new Set(row.players.flatMap((p) => p.words ?? []))
  const words = clues
    .filter((clue) => clue.cells.every((cell) => entries[cell]) && !clue.cells.every((cell) => row.entries[cell]))
    .map((clue) => `${clue.number} ${clue.direction}`)
    .filter((word) => !taken.has(word))
  const players = row.players.map((p) =>
    p === player ? { ...p, seq: action.seq, ...(words.length && { words: [...(p.words ?? []), ...words] }) } : p,
  )
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
 * Returns how many words a seat's player filled in a room that finished the day's full-size crossword, for the
 * results check, or null when the solve does not count: a Mini room, another day's puzzle, or a seat that never
 * joined or joined after the solve.
 */
export async function solvedCrossword(id: string, seat: string, day: string): Promise<number | null> {
  const row = await loadRoom(id)
  const player = row?.players.find((p) => p.seat === seat && !p.late)
  if (!row?.solved || !player) return null
  const { solution } = await crosswordForDay(day, false)
  if (row.puzzle.board.date !== day || row.puzzle.board.solution.join() !== solution.join()) return null
  return row.players.filter((p) => p.name === player.name).reduce((sum, p) => sum + (p.words?.length ?? 0), 0)
}
