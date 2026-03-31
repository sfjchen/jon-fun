import type { PartyGameKind } from './types'

/** Wall-clock cap for party API calls from the browser (prevents infinite spinners if a route hangs). */
export const PARTY_FETCH_TIMEOUT_MS = 25_000

/**
 * `fetch` with timeout; forwards `init.signal` so callers can still abort early (e.g. Playwright / navigation).
 */
export async function partyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const c = new AbortController()
  const timer = setTimeout(() => c.abort(), PARTY_FETCH_TIMEOUT_MS)
  const outer = init?.signal
  const onOuterAbort = () => c.abort()
  if (outer) {
    if (outer.aborted) {
      clearTimeout(timer)
      throw new DOMException('Aborted', 'AbortError')
    }
    outer.addEventListener('abort', onOuterAbort, { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: c.signal })
  } finally {
    clearTimeout(timer)
    if (outer) outer.removeEventListener('abort', onOuterAbort)
  }
}

export const PARTY_MAX_PLAYERS_DEFAULT = 8
export const PARTY_MIN_PLAYERS_QUIPLASH = 3
export const PARTY_MIN_PLAYERS_FIBBAGE = 2
export const PARTY_MIN_PLAYERS_EAY = 3

export const ANSWER_MAX_LEN = 280
export const PARTY_PHASE_SECONDS_DEFAULT = 120
export const PARTY_VOTE_SECONDS_DEFAULT = 90
export const PARTY_SCOREBOARD_SECONDS = 20

/** Base point pool per head-to-head matchup (round 1). Round 2 doubles. */
export const QUIPLASH_MATCHUP_POOL_R1 = 1000
export const QUIPLASH_FINAL_POOL = 3000

export function sessionKeyPrefix(kind: PartyGameKind): string {
  if (kind === 'quiplash') return 'party_quiplash'
  if (kind === 'fibbage') return 'party_fibbage'
  return 'party_eay'
}

export function sessionKeys(kind: PartyGameKind) {
  const p = sessionKeyPrefix(kind)
  return {
    pin: `${p}_pin`,
    playerId: `${p}_playerId`,
    hostId: `${p}_hostId`,
    playerName: `${p}_playerName`,
  } as const
}
