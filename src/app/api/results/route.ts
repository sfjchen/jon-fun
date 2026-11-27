import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GAMES, GAME_IDS, GUEST, SCORING_VERSION, likeName, type GameId } from '@/lib/results'
import { score as beeScore } from '@/lib/spelling-bee'
import { firstDay, isNytGame, siteDay, validDay } from '@/lib/daily'
import { rateLimited } from '@/lib/api-guards'
import { supabaseAdmin } from '@/lib/supabase'
import { VERIFIERS } from '@/lib/daily/verify'
import { DEVICE_KINDS, tidyName } from '@/lib/syncIdentity'
const group = z.string().regex(/^[a-z0-9-]{3,32}$/)
const stats = z.object({
  n: z.number().int().min(0).max(500).optional(),
  seconds: z.number().int().min(0).max(864000).optional(),
  mistakes: z.number().int().min(0).max(100).optional(),
  solved: z.boolean().optional(),
  max: z.number().int().min(1).max(100000).optional(),
  sourceDate: z.string().refine(validDay).optional(),
  puzzleId: z.string().max(100).optional(),
  scoringVersion: z.number().int().min(1).max(2).optional(),
  hard: z.boolean().optional(),
  moves: z.unknown().optional(),
})
const schema = z.object({
  group,
  name: z.string().trim().min(1).max(24),
  deviceId: z.string().uuid().optional(),
  device: z.enum(DEVICE_KINDS).optional(),
  today: z.string().refine(validDay),
  game: z.enum(GAME_IDS as [GameId, ...GameId[]]),
  score: z.number().int().min(0),
  n: z.number().int().min(0).max(500).optional(),
  stats: stats.optional(),
})
/**
 * Serializes a value with object keys in sorted order, so moves read back from the database (which reorders keys)
 * compare equal to the same moves as sent.
 */
function canonical(v: unknown): string {
  return JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  )
}
export async function POST(req: Request) {
  // Each post replays a game and may fetch its puzzle, so a burst from 1 address waits. The device queue retries a 429.
  if (rateLimited(req, 'results', 60))
    return NextResponse.json({ error: 'Too many results at once. They remain queued on your device.' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
  const b = parsed.data
  if (b.today < firstDay(b.game) || b.today > siteDay())
    return NextResponse.json({ error: 'Date out of range' }, { status: 400 })
  // The guest name only carries shared Spelling Bee words. It has no scores of its own.
  if (tidyName(b.name) === GUEST && b.game !== 'bee')
    return NextResponse.json({ error: 'Add a name to save this score' }, { status: 400 })
  if (isNytGame(b.game) && b.stats?.sourceDate && b.stats.sourceDate !== b.today)
    return NextResponse.json({ error: 'Puzzle source date does not match the result date' }, { status: 400 })
  // Every score is recomputed from the game's moves against the day's puzzle, so a hand-made score cannot be posted.
  // The checked moves are kept in a column the leaderboard never reads, so the player's other devices can show the
  // finished game (/api/results/run) while score reads never carry answers.
  const { moves, ...rest } = b.stats ?? {},
    v = VERIFIERS[b.game],
    m = v.moves.safeParse(moves)
  if (!m.success)
    return NextResponse.json({ error: `${GAMES[b.game].title} results need their moves` }, { status: 400 })
  let game
  try {
    game = await v.check(b.today, m.data as never, rest)
  } catch {
    return NextResponse.json(
      { error: 'Could not check this result. It remains queued on your device.' },
      { status: 503 },
    )
  }
  if (typeof game === 'string') return NextResponse.json({ error: game }, { status: 400 })
  if (game.score > GAMES[b.game].max) return NextResponse.json({ error: 'Score out of range' }, { status: 400 })
  const version = SCORING_VERSION,
    score = game.score
  // Names are unique per board regardless of case and spacing, so "jon" on a phone files under an existing "Jon".
  // A unique index on the lowercased name backs this when 2 devices post a new name at the same moment.
  const clean = tidyName(b.name)
  const same = await supabaseAdmin
    .from('game_results')
    .select('name')
    .eq('group_code', b.group)
    .ilike('name', likeName(clean))
    .order('created_at')
    .limit(1)
  if (same.error)
    return NextResponse.json({ error: 'Could not save score. It remains queued on your device.' }, { status: 503 })
  const name = same.data[0]?.name ?? clean
  const key = { group_code: b.group, name, game: b.game, day: b.today, scoring_version: version }
  // Spelling Bee keeps its checked words in a column the leaderboard never reads, so a player's devices share them.
  const words = b.game === 'bee' ? [...new Set(m.data as string[])] : null
  // The Spelling Bee list is shared, so a player's own share is the words they were first on the board to send.
  // A row saved before this count existed starts from the words no other player holds.
  let own: number | undefined
  if (words) {
    const board = await supabaseAdmin
      .from('game_results')
      .select('name,words,stats')
      .eq('group_code', b.group)
      .eq('game', 'bee')
      .eq('day', b.today)
      .eq('scoring_version', version)
    if (board.error)
      return NextResponse.json({ error: 'Could not save score. It remains queued on your device.' }, { status: 503 })
    const list = (r: { words: unknown }) => (r.words as string[] | null) ?? []
    const mine = board.data.find((r) => r.name === name)
    const others = new Set(board.data.filter((r) => r !== mine).flatMap(list))
    const known = new Set(mine ? list(mine) : [])
    const before =
      (mine?.stats as { own?: number } | null)?.own ?? [...known].filter((word) => !others.has(word)).length
    own = before + words.filter((word) => !known.has(word) && !others.has(word)).length
  }
  const value = {
    ...key,
    score,
    words,
    moves: words ? null : m.data,
    ...(b.deviceId ? { device_id: b.deviceId } : {}),
    ...(b.device ? { device_kind: b.device } : {}),
    stats: { ...rest, ...game.stats, scoringVersion: version, ...(own !== undefined && { own }) },
  }
  const inserted = await supabaseAdmin.from('game_results').insert(value)
  if (inserted.error && inserted.error.code !== '23505')
    return NextResponse.json({ error: 'Could not save score. It remains queued on your device.' }, { status: 503 })
  if (inserted.error?.code === '23505' && !words) {
    // A result saved before moves were kept gains them when the same game is sent again, matched by its score.
    await supabaseAdmin.from('game_results').update({ moves: m.data }).match(key).eq('score', score).is('moves', null)
    // A different finished game from another device under the same name is kept beside the first one as a
    // conflict, instead of being dropped. The first result still ranks, and only the first such game is kept.
    const first = await supabaseAdmin.from('game_results').select('device_id,score,moves,conflict').match(key)
    const kept = first.data?.[0]
    if (
      kept &&
      !kept.conflict &&
      b.deviceId &&
      kept.device_id &&
      kept.device_id !== b.deviceId &&
      (kept.score !== score || (kept.moves && canonical(kept.moves) !== canonical(m.data)))
    )
      await supabaseAdmin
        .from('game_results')
        .update({ conflict: { score, stats: value.stats, device: b.device ?? null, at: new Date().toISOString() } })
        .match(key)
        .is('conflict', null)
  }
  if (inserted.error?.code === '23505' && words) {
    // Another device already filed this day, so the saved words grow to cover both and the score follows them.
    // merge_bee_words adds the words in 1 statement, so 2 devices syncing at once cannot drop each other's.
    const merged = await supabaseAdmin.rpc('merge_bee_words', {
      p_group: b.group,
      p_name: name,
      p_day: b.today,
      p_version: version,
      p_words: words,
    })
    if (merged.error || !merged.data) return NextResponse.json({ error: 'Could not sync score' }, { status: 503 })
    const all = merged.data as string[],
      pts = all.reduce((t, w) => t + beeScore(w), 0)
    // The score only rises: a request holding a smaller merged list never overwrites a larger one's score.
    const update = await supabaseAdmin
      .from('game_results')
      .update({ score: pts, stats: { ...value.stats, n: all.length, solved: pts === value.stats.max } })
      .eq('group_code', b.group)
      .ilike('name', likeName(name))
      .eq('game', 'bee')
      .eq('day', b.today)
      .eq('scoring_version', version)
      .lt('score', pts)
    if (update.error) return NextResponse.json({ error: 'Could not sync score' }, { status: 503 })
  }
  // Every game's first finished result is immutable, so clearing a board or browser data cannot replace it. Spelling
  // Bee only grows, since its score rises as more words are found the same day.
  return NextResponse.json({ ok: true, name })
}
// History reads are large and shared, so the CDN keeps each one for 10 seconds and many open pages cost 1 database
// read. A device that just posted adds its post time to the address (boardUrl), which skips any copy saved before its
// result. The small reads of 1 day are the live poll, so they are never cached and show a new result within 1 poll.
const CACHE = 'public, max-age=0, s-maxage=10, stale-while-revalidate=20'
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams,
    g = group.safeParse(q.get('group'))
  if (!g.success) return NextResponse.json({ error: 'Invalid group' }, { status: 400 })
  const game = q.get('game'),
    day = q.get('day')
  if ((game !== null && !GAME_IDS.includes(game as GameId)) || (day !== null && !validDay(day))) {
    return NextResponse.json({ error: 'Invalid game or date' }, { status: 400 })
  }
  const days = Math.min(6000, Math.max(1, Number(q.get('days')) || 400)),
    since = new Date(Date.now() - (days + 1) * 86400000).toISOString().slice(0, 10)
  type Row = {
    name: string
    game: GameId
    day: string
    score: number
    stats: Record<string, unknown>
    scoring_version: number
    device_kind: string | null
    conflict: { score: number; stats: Record<string, unknown>; device: string | null } | null
  }
  const all: Row[] = []
  // 20 pages of 1,000 rows is far past any board's history and bounds the work of 1 read.
  for (let offset = 0; offset < 20000; offset += 1000) {
    const query = supabaseAdmin
      .from('game_results')
      .select('name,game,day,score,stats,scoring_version,device_kind,conflict')
      .eq('group_code', g.data)
      .neq('name', GUEST)
      .in('game', game ? [game] : GAME_IDS)
    const dated = day ? query.eq('day', day) : query.gte('day', since)
    const { data, error } = await dated
      .order('day', { ascending: false })
      .order('game')
      .order('name')
      .order('scoring_version')
      .range(offset, offset + 999)
    if (error) return NextResponse.json({ error: 'Could not load scores' }, { status: 503 })
    all.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const exact = (r: Row) =>
    !isNytGame(r.game) ||
    ((!r.stats.sourceDate || r.stats.sourceDate === r.day) &&
      (!(typeof r.stats.puzzleId === 'string' && r.stats.puzzleId.startsWith('nyt-archive-')) ||
        r.stats.puzzleId.slice(12) === r.day))
  const current = (r: Row) => r.scoring_version === SCORING_VERSION && exact(r)
  const out = (r: Row) => {
    const { device_kind, conflict, ...rest } = r
    return { ...rest, ...(device_kind ? { device: device_kind } : {}), ...(conflict ? { conflict } : {}) }
  }
  return NextResponse.json(
    { rows: all.filter(current).map(out), legacyRows: all.filter((r) => !current(r)).map(out) },
    { headers: { 'Cache-Control': day ? 'no-store' : CACHE } },
  )
}
