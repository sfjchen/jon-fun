export type PartyGameKind = 'quiplash' | 'fibbage' | 'eay'

export type PartyRoomRow = {
  id: string
  pin: string
  host_id: string | null
  game_kind: PartyGameKind
  phase: string
  round_index: number
  step_index: number
  deadline_at: string | null
  settings: Record<string, unknown>
  version: number
  max_players: number
  created_at: string
  updated_at: string
  last_activity: string
}

export type PartyPlayerRow = {
  id: string
  room_pin: string
  player_id: string
  name: string
  score: number
  is_connected: boolean
  joined_at: string
}

export type PartyQuiplashMatchupRow = {
  id: string
  room_pin: string
  round_index: number
  sort_order: number
  prompt_text: string
  player_a: string
  player_b: string
}
