// Server-only: Supabase service-role helpers for buzzer sessions.
// All writes funnel through here so RLS denies anon writes uniformly.

import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { generateBuzzerPin, type BuzzerSession } from '@/lib/jeopardy-buzzer'

type SessionRow = {
  id: string
  board_id: string
  pin: string
  status: 'idle' | 'armed' | 'locked'
  armed_at: string | null
  locked_at: string | null
  current_round_id: string | null
  version: number
  created_at: string
  updated_at: string
}

const MAX_PIN_ATTEMPTS = 8

function rowToSession(row: SessionRow): BuzzerSession {
  return {
    id: row.id,
    boardId: row.board_id,
    pin: row.pin,
    status: row.status,
    armedAt: row.armed_at,
    lockedAt: row.locked_at,
    currentRoundId: row.current_round_id,
    version: row.version,
    updatedAt: row.updated_at,
  }
}

/** Look up an existing session by board id. */
export async function findSessionByBoardId(boardId: string): Promise<BuzzerSession | null> {
  const { data, error } = await supabase
    .from('jeopardy_buzzer_sessions')
    .select('*')
    .eq('board_id', boardId)
    .maybeSingle()
  if (error || !data) return null
  return rowToSession(data as SessionRow)
}

/** Look up an existing session by PIN. */
export async function findSessionByPin(pin: string): Promise<BuzzerSession | null> {
  const { data, error } = await supabase
    .from('jeopardy_buzzer_sessions')
    .select('*')
    .eq('pin', pin)
    .maybeSingle()
  if (error || !data) return null
  return rowToSession(data as SessionRow)
}

/** Get-or-create a session for a board, allocating a unique PIN on collision. */
export async function ensureSessionForBoard(boardId: string): Promise<{ ok: true; session: BuzzerSession } | { ok: false; error: string }> {
  const existing = await findSessionByBoardId(boardId)
  if (existing) return { ok: true, session: existing }

  for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt++) {
    const pin = generateBuzzerPin()
    const { data, error } = await supabase
      .from('jeopardy_buzzer_sessions')
      .insert({
        id: uuidv4(),
        board_id: boardId,
        pin,
        status: 'idle',
        version: 0,
      })
      .select('*')
      .maybeSingle()
    if (!error && data) return { ok: true, session: rowToSession(data as SessionRow) }
    const code = error?.code?.toString() ?? ''
    // 23505 = unique_violation. Could be pin collision OR board_id collision (race).
    if (code === '23505' || error?.message?.includes('duplicate')) {
      // If it's the board_id race, the other request succeeded — read and return that row.
      const refetch = await findSessionByBoardId(boardId)
      if (refetch) return { ok: true, session: refetch }
      // Otherwise PIN collided — retry with a fresh PIN.
      continue
    }
    return { ok: false, error: error?.message || 'Failed to create session' }
  }
  return { ok: false, error: 'Could not allocate unique PIN' }
}

export type SessionPatch =
  | { kind: 'arm' }       // begins a new round (fresh round_id), status='armed'
  | { kind: 'clear' }     // status='idle', round_id cleared (queue still in DB but considered stale)
  | { kind: 'lock' }      // status='locked', no further buzzes accepted
  | { kind: 'unlock' }    // status='armed' again on the same round

/**
 * Apply a host control op to the session row with optimistic concurrency.
 * Retries on version conflict.
 */
export async function applySessionPatch(
  pin: string,
  patch: SessionPatch,
): Promise<{ ok: true; session: BuzzerSession } | { ok: false; status: number; error: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await supabase
      .from('jeopardy_buzzer_sessions')
      .select('*')
      .eq('pin', pin)
      .maybeSingle()
    if (error || !row) return { ok: false, status: 404, error: 'Session not found' }
    const r = row as SessionRow

    const update: Partial<SessionRow> = { version: r.version + 1, updated_at: new Date().toISOString() }
    switch (patch.kind) {
      case 'arm':
        update.status = 'armed'
        update.armed_at = new Date().toISOString()
        update.locked_at = null
        update.current_round_id = uuidv4() // each arm starts a brand-new round
        break
      case 'clear':
        update.status = 'idle'
        update.armed_at = null
        update.locked_at = null
        update.current_round_id = null
        break
      case 'lock':
        update.status = 'locked'
        update.locked_at = new Date().toISOString()
        break
      case 'unlock':
        // Only unlock back into the same round (no new round_id). If no round, treat as no-op.
        if (!r.current_round_id) return { ok: true, session: rowToSession(r) }
        update.status = 'armed'
        update.locked_at = null
        break
    }

    const { data: updated, error: upErr } = await supabase
      .from('jeopardy_buzzer_sessions')
      .update(update)
      .eq('id', r.id)
      .eq('version', r.version)
      .select('*')
      .maybeSingle()
    if (upErr) return { ok: false, status: 500, error: upErr.message }
    if (updated) return { ok: true, session: rowToSession(updated as SessionRow) }
    // CAS miss — loop and retry.
  }
  return { ok: false, status: 409, error: 'Write conflict; retry' }
}

const MAX_NAME = 40
const MAX_COLOR = 16

/** Upsert a player into the session. Clamps clock_offset_ms to +/- 30s for safety. */
export async function upsertPlayer(input: {
  sessionId: string
  playerId: string
  name: string
  color: string
  clockOffsetMs: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = (input.name || 'Player').trim().slice(0, MAX_NAME) || 'Player'
  const color = (input.color || '#3b82f6').trim().slice(0, MAX_COLOR) || '#3b82f6'
  const clock_offset_ms = Math.max(-30_000, Math.min(30_000, Math.round(input.clockOffsetMs || 0)))
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('jeopardy_buzzer_players')
    .upsert(
      {
        session_id: input.sessionId,
        player_id: input.playerId,
        name,
        color,
        clock_offset_ms,
        last_seen_at: now,
      },
      { onConflict: 'session_id,player_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Read the most-recent clock_offset_ms we recorded for this player. */
export async function getPlayerOffsetMs(sessionId: string, playerId: string): Promise<number> {
  const { data } = await supabase
    .from('jeopardy_buzzer_players')
    .select('clock_offset_ms')
    .eq('session_id', sessionId)
    .eq('player_id', playerId)
    .maybeSingle()
  return typeof (data?.clock_offset_ms) === 'number' ? data.clock_offset_ms : 0
}

type BuzzRow = {
  id: string
  round_id: string
  player_id: string
  name: string
  color: string
  client_press_at: string
  server_receive_at: string
  effective_server_press_at: string
  rank: number | null
  accepted: boolean
  reject_reason: string | null
}

export interface RecordBuzzResult {
  queue: BuzzRow[]
  myRow: BuzzRow | null
  rejectReason: string | null
}

/** Call the atomic RPC. Returns the round queue + the caller's row (if accepted). */
export async function recordBuzz(input: {
  sessionId: string
  playerId: string
  playerName: string
  playerColor: string
  clientPressMs: number
  serverReceiveMs: number
  clockOffsetMs: number
}): Promise<RecordBuzzResult> {
  const { data, error } = await supabase.rpc('jeopardy_record_buzz', {
    _session_id: input.sessionId,
    _player_id: input.playerId,
    _player_name: input.playerName,
    _player_color: input.playerColor,
    _client_press_ms: input.clientPressMs,
    _server_receive_ms: input.serverReceiveMs,
    _clock_offset_ms: Math.max(-30_000, Math.min(30_000, Math.round(input.clockOffsetMs || 0))),
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as BuzzRow[]
  // RPC returns either a single failure row (id null + reject_reason) or the round queue.
  if (rows.length === 1 && rows[0]?.id === null) {
    return { queue: [], myRow: null, rejectReason: rows[0].reject_reason }
  }
  const queue = rows.filter((r) => r.id != null && r.accepted)
  const myRow = queue.find((r) => r.player_id === input.playerId) ?? null
  return { queue, myRow, rejectReason: null }
}

/** Read the current queue for the session's active round (used on player join). */
export async function readCurrentQueue(session: BuzzerSession): Promise<BuzzRow[]> {
  if (!session.currentRoundId) return []
  const { data, error } = await supabase
    .from('jeopardy_buzzes')
    .select('*')
    .eq('round_id', session.currentRoundId)
    .eq('accepted', true)
    .order('effective_server_press_at', { ascending: true })
  if (error) return []
  return (data ?? []) as BuzzRow[]
}

export function rowsToBuzzes(rows: BuzzRow[]): Array<{
  id: string
  roundId: string
  playerId: string
  name: string
  color: string
  clientPressAt: string
  serverReceiveAt: string
  effectiveServerPressAt: string
  rank: number | null
  accepted: boolean
  rejectReason: string | null
}> {
  return rows.map((r) => ({
    id: r.id,
    roundId: r.round_id,
    playerId: r.player_id,
    name: r.name,
    color: r.color,
    clientPressAt: r.client_press_at,
    serverReceiveAt: r.server_receive_at,
    effectiveServerPressAt: r.effective_server_press_at,
    rank: r.rank,
    accepted: r.accepted,
    rejectReason: r.reject_reason,
  }))
}
