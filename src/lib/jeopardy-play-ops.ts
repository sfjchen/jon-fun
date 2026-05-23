// Pure ops for shared Jeopardy play state (teams, scores, used tiles, last answered).
// Mirrors the board ops pattern: same apply logic on client (optimistic) + server (authoritative).

export const MAX_TEAMS = 12
export const MAX_TEAM_NAME = 24

export interface JeopardyTeam {
  name: string
  score: number
}

export interface JeopardyPlayState {
  teamCount: number
  teams: JeopardyTeam[]
  used: Record<string, boolean> // "col:row" → true
  lastAnswered: { col: number; row: number } | null
}

export type JeopardyPlayOp =
  | { kind: 'setTeamCount'; count: number }
  | { kind: 'setTeamName'; index: number; name: string }
  | { kind: 'setTeamScore'; index: number; score: number }
  | { kind: 'adjustTeamScore'; index: number; delta: number }
  | { kind: 'markUsed'; col: number; row: number; used: boolean; lastAnswered: boolean }
  | { kind: 'resetTiles' }
  | { kind: 'resetTilesAndScores' }
  | { kind: 'replaceState'; state: JeopardyPlayState }

const PLAY_OP_KINDS: ReadonlyArray<JeopardyPlayOp['kind']> = [
  'setTeamCount',
  'setTeamName',
  'setTeamScore',
  'adjustTeamScore',
  'markUsed',
  'resetTiles',
  'resetTilesAndScores',
  'replaceState',
]

export function isJeopardyPlayOp(x: unknown): x is JeopardyPlayOp {
  if (!x || typeof x !== 'object') return false
  const k = (x as { kind?: unknown }).kind
  return typeof k === 'string' && (PLAY_OP_KINDS as string[]).includes(k)
}

export function defaultPlayState(): JeopardyPlayState {
  return {
    teamCount: 2,
    teams: [
      { name: 'Team 1', score: 0 },
      { name: 'Team 2', score: 0 },
    ],
    used: {},
    lastAnswered: null,
  }
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback
  return Math.max(min, Math.min(max, v))
}

function sanitizeName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw : fallback
  return s.slice(0, MAX_TEAM_NAME)
}

function ensureTeams(teams: JeopardyTeam[] | undefined, count: number): JeopardyTeam[] {
  return Array.from({ length: count }, (_, i) => {
    const existing = teams?.[i]
    if (existing) return { name: sanitizeName(existing.name, `Team ${i + 1}`), score: Math.floor(existing.score || 0) }
    return { name: `Team ${i + 1}`, score: 0 }
  })
}

export function normalizePlayState(raw: unknown): JeopardyPlayState {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const teamCount = clampInt(obj.teamCount, 1, MAX_TEAMS, 2)
  const teamsRaw = Array.isArray(obj.teams)
    ? obj.teams.map((t) => {
        const tt = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
        return { name: sanitizeName(tt.name, 'Team'), score: typeof tt.score === 'number' ? Math.floor(tt.score) : 0 }
      })
    : []
  const teams = ensureTeams(teamsRaw, teamCount)
  const usedRaw = (obj.used && typeof obj.used === 'object' ? obj.used : {}) as Record<string, unknown>
  const used: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(usedRaw)) {
    if (typeof k === 'string' && /^\d+:\d+$/.test(k) && v) used[k] = true
  }
  const la = (obj.lastAnswered && typeof obj.lastAnswered === 'object'
    ? obj.lastAnswered
    : null) as { col?: unknown; row?: unknown } | null
  const lastAnswered =
    la && typeof la.col === 'number' && typeof la.row === 'number'
      ? { col: Math.floor(la.col), row: Math.floor(la.row) }
      : null
  return { teamCount, teams, used, lastAnswered }
}

export function applyPlayOp(state: JeopardyPlayState, op: JeopardyPlayOp): JeopardyPlayState {
  switch (op.kind) {
    case 'setTeamCount': {
      const count = clampInt(op.count, 1, MAX_TEAMS, state.teamCount)
      return { ...state, teamCount: count, teams: ensureTeams(state.teams, count) }
    }
    case 'setTeamName': {
      if (op.index < 0 || op.index >= state.teamCount) return state
      const teams = state.teams.map((t, i) => (i === op.index ? { ...t, name: sanitizeName(op.name, t.name) } : t))
      return { ...state, teams }
    }
    case 'setTeamScore': {
      if (op.index < 0 || op.index >= state.teamCount) return state
      const score = typeof op.score === 'number' && Number.isFinite(op.score) ? Math.floor(op.score) : 0
      const teams = state.teams.map((t, i) => (i === op.index ? { ...t, score } : t))
      return { ...state, teams }
    }
    case 'adjustTeamScore': {
      if (op.index < 0 || op.index >= state.teamCount) return state
      const delta = typeof op.delta === 'number' && Number.isFinite(op.delta) ? Math.floor(op.delta) : 0
      const teams = state.teams.map((t, i) => (i === op.index ? { ...t, score: t.score + delta } : t))
      return { ...state, teams }
    }
    case 'markUsed': {
      const key = `${Math.floor(op.col)}:${Math.floor(op.row)}`
      const used = { ...state.used }
      if (op.used) used[key] = true
      else delete used[key]
      const lastAnswered = op.lastAnswered ? { col: Math.floor(op.col), row: Math.floor(op.row) } : state.lastAnswered
      return { ...state, used, lastAnswered }
    }
    case 'resetTiles':
      return { ...state, used: {}, lastAnswered: null }
    case 'resetTilesAndScores':
      return {
        ...state,
        used: {},
        lastAnswered: null,
        teams: state.teams.map((t) => ({ ...t, score: 0 })),
      }
    case 'replaceState':
      return normalizePlayState(op.state)
  }
}
