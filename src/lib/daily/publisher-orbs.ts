/** Fetches and preserves the first published Daily Orbs payload for each source date. */

import { z } from 'zod'
import { siteDay, validDay } from '@/lib/daily'
import { supabaseAdmin } from '@/lib/supabase'

const FIRST_DAY = '2026-04-17'
const GAME = 'publisher-orbs'
const FORMAT = 'publisher-orbs-v1'
const UPSTREAM = 'https://api.dailyorbs.com/api/game-day'

const puzzle = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
})
const editionSchema = z.looseObject({
  dateKey: z.string(),
  state: z.enum(['ready', 'deja-vu']),
  originalDate: z.string().refine(validDay).nullish(),
  puzzles: z.looseObject({ orange: puzzle, green: puzzle, blue: puzzle, purple: puzzle }),
})
const snapshotSchema = z.object({
  format: z.literal(FORMAT),
  sourceUrl: z.string(),
  fetchedAt: z.string(),
  edition: editionSchema,
})
type Snapshot = z.infer<typeof snapshotSchema>
const pending = new Map<string, Promise<Snapshot>>()

/** Restricts requests to real dates within the publisher’s archive and the site's current day. */
export function publisherOrbsDate(day: unknown): day is string {
  return validDay(day) && day >= FIRST_DAY && day <= siteDay()
}

/** Reads a retained edition and checks that its embedded date matches its storage key. */
async function readSnapshot(day: string): Promise<Snapshot | null> {
  const { data, error } = await supabaseAdmin
    .from('daily_game_content')
    .select('payload')
    .eq('game', GAME)
    .eq('source_day', day)
    .maybeSingle()
  if (error) throw new Error('Could not read the Daily Orbs snapshot.')
  if (!data) return null

  const parsed = snapshotSchema.safeParse(data.payload)
  if (!parsed.success || parsed.data.edition.dateKey !== day)
    throw new Error('Stored Daily Orbs date or format is invalid.')
  return parsed.data
}

/** Uses the saved edition first; concurrent first fetches return the same retained copy. */
async function load(day: string): Promise<Snapshot> {
  const saved = await readSnapshot(day)
  if (saved) return saved

  const sourceUrl = `${UPSTREAM}?date=${day}`
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
  if (!response.ok) throw new Error(`Daily Orbs has not served a usable edition for ${day}.`)

  const edition = editionSchema.safeParse(await response.json())
  if (!edition.success || edition.data.dateKey !== day)
    throw new Error(`Daily Orbs did not return the published edition for ${day}.`)

  const snapshot: Snapshot = { format: FORMAT, sourceUrl, fetchedAt: new Date().toISOString(), edition: edition.data }
  const { error } = await supabaseAdmin
    .from('daily_game_content')
    .upsert(
      { game: GAME, source_day: day, payload: snapshot },
      { onConflict: 'game,source_day', ignoreDuplicates: true },
    )
  if (error) throw new Error('Could not save the Daily Orbs snapshot.')

  const retained = await readSnapshot(day)
  if (!retained) throw new Error('Could not confirm the Daily Orbs snapshot.')
  return retained
}

/** Returns the exact published edition, with one pending load per date per server. */
export function publisherOrbsForDay(day: string): Promise<Snapshot> {
  if (!publisherOrbsDate(day)) return Promise.reject(new Error('Choose a published Daily Orbs date.'))
  let request = pending.get(day)
  if (!request) {
    request = load(day).finally(() => pending.delete(day))
    pending.set(day, request)
  }
  return request
}
