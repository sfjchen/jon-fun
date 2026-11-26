/**
 * Recomputes every daily game's result on the server from the moves the browser sends, using the same rules the
 * game plays by, so the stored score never comes from the browser. Each game names the shape of its moves and a
 * check that replays them against that day's puzzle. The registry is typed by GameId, so a new daily game cannot
 * build without one. The results API keeps checked moves apart from the scores it serves, so boards never reveal answers.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { GameId, Stats } from '@/lib/results'
import { dailyPuzzle } from '@/lib/daily/server'
import { replayFivefold } from '@/lib/daily/fivefold'
import { judgeAnswer } from '@/lib/daily/krillion'
import { score as beeScore } from '@/lib/spelling-bee'
import { findMatchingGroup, wordKey, type ConnectionsPuzzle } from '@/lib/connections'
import { artifactScore, type Artifact } from '@/lib/artifact-scoring'
import { ORBS_MAX, type OrbsPuzzle } from '@/lib/orbs'
import { isOrbsMoveSet, replayOrbsDay, type OrbsMoveSet } from '@/lib/orbs-run'
import type { MiniPuzzle } from '@/lib/mini'

/** A recomputed result: the score to store and the stats it replaces, or the reason the moves are not a valid game. */
type Replayed = { score: number; stats: Stats } | string
/** The sent stats a check may read: the hard-mode claim and the solve time, neither of which the moves can show. */
type Sent = { hard?: boolean | undefined; seconds?: number | undefined }
type Verifier = { moves: z.ZodType; check: (day: string, moves: never, sent: Sent) => Promise<Replayed> }

/**
 * Pairs a moves schema with its check, so each check receives its moves already typed.
 */
function verifier<T>(moves: z.ZodType<T>, check: (day: string, moves: T, sent: Sent) => Promise<Replayed>): Verifier {
  return { moves, check: check as Verifier['check'] }
}

let words: Promise<Set<string>> | null = null

/**
 * Solve times cannot be replayed, so these floors only turn away times no person can reach, such as a posted 0:00.
 * They sit well under record pace: about 4 seconds for a 5x5 Mini and 4 seconds for a 4-guess Connections.
 */
const MIN_CELL_SECONDS = 0.15,
  MIN_GUESS_SECONDS = 1

export const VERIFIERS: Record<GameId, Verifier> = {
  // Wordle replays each guess for its marks, word list and hard-mode rule, scoring 7 minus guesses (0 for a loss).
  fivefold: verifier(
    z
      .array(z.string().regex(/^[a-z]{5}$/))
      .min(1)
      .max(6),
    async (day, guesses, stats) => {
      words ??= readFile(path.join(process.cwd(), 'public/fivefold/words.json'), 'utf8')
        .then((t) => new Set(JSON.parse(t) as string[]))
        .catch((e) => {
          words = null
          throw e
        })
      const [{ puzzle }, list] = await Promise.all([dailyPuzzle('fivefold', day), words])
      const r = replayFivefold(guesses, (puzzle as { answer: string }).answer, (w) => list.has(w), !!stats.hard)
      return 'error' in r ? r.error : { score: r.score, stats: { n: r.n, solved: r.solved } }
    },
  ),
  // Spelling Bee sums the points of each distinct found word, every one of which must be on the day's answer list.
  bee: verifier(
    z
      .array(z.string().regex(/^[a-z]{4,20}$/))
      .min(1)
      .max(500),
    async (day, found) => {
      const pz = (await dailyPuzzle('bee', day)).puzzle as { id: string; answers: string[]; max: number }
      const answers = new Set(pz.answers),
        uniq = [...new Set(found)]
      const bad = uniq.find((w) => !answers.has(w))
      if (bad) return `"${bad}" is not an answer today`
      const pts = uniq.reduce((t, w) => t + beeScore(w), 0)
      return { score: pts, stats: { n: uniq.length, max: pz.max, solved: pts === pz.max, puzzleId: pz.id } }
    },
  ),
  // Connections replays the guesses in order until all 4 groups are found, 4 mistakes are made or the player gives
  // up. The solve time cannot be replayed, so it is kept as sent unless it is impossibly fast.
  connections: verifier(
    z.object({ guesses: z.array(z.array(z.string().max(60)).length(4)).max(7), gaveUp: z.boolean() }),
    async (day, { guesses, gaveUp }, stats) => {
      const pz = (await dailyPuzzle('connections', day)).puzzle as ConnectionsPuzzle
      const found = new Set<string>(),
        seen = new Set<string>()
      let mistakes = 0
      for (const g of guesses) {
        if (found.size === 4 || mistakes >= 4) return 'Guesses continue after the game ended'
        const key = g.map(wordKey).sort().join('|')
        if (seen.has(key)) return 'A guess is repeated'
        seen.add(key)
        const group = findMatchingGroup(pz.groups, g)
        if (group) found.add(group.category)
        else mistakes++
      }
      if (found.size < 4 && mistakes < 4 && !gaveUp) return 'The game is not finished'
      if (found.size === 4 && stats.seconds !== undefined && stats.seconds < guesses.length * MIN_GUESS_SECONDS) {
        return 'That solve time is too fast to count'
      }
      return { score: found.size, stats: { n: found.size, mistakes, solved: found.size === 4, puzzleId: pz.id } }
    },
  ),
  // The Mini's grid must match the solution. Its time cannot be replayed, so the sent unassisted time is the score.
  mini: verifier(z.array(z.string().max(10)), async (day, entries, stats) => {
    const pz = (await dailyPuzzle('mini', day)).puzzle as MiniPuzzle
    if (stats.seconds === undefined) return 'Mini needs a completed solve time'
    if (entries.length !== pz.cells.length || pz.cells.some((a, i) => a && entries[i] !== a))
      return 'The grid is not solved'
    if (stats.seconds < pz.cells.filter(Boolean).length * MIN_CELL_SECONDS)
      return 'That solve time is too fast to count'
    return { score: stats.seconds, stats: { solved: true } }
  }),
  // Anthropeum rescores every pin and period with the original formulas against the day's 10 artifacts.
  anthropeum: verifier(
    z.array(z.object({ lat: z.number().min(-90).max(90), lon: z.number(), year: z.number() })).max(10),
    async (day, pins) => {
      const { artifacts } = (await dailyPuzzle('anthropeum', day)).puzzle as { artifacts: Artifact[] }
      if (pins.length !== artifacts.length) return 'The game is not finished'
      const pts = pins.reduce((t, p, i) => t + artifactScore(artifacts[i]!, p, p.year).total, 0)
      return { score: pts, stats: { n: pins.length, solved: true, max: 100000 } }
    },
  ),
  // Orbs replays old single picks and the current per-puzzle lives.
  orbs: verifier(
    z.union([z.array(z.number().int().min(0).max(2)).length(ORBS_MAX), z.custom<OrbsMoveSet>(isOrbsMoveSet)]),
    async (day, moves) => {
      const { puzzle } = await dailyPuzzle('orbs', day)
      const states = replayOrbsDay(puzzle as OrbsPuzzle, moves)
      if (!states?.every((state) => state.done)) return 'Invalid or unfinished Orbs run'
      const score = states.reduce((sum, state) => sum + state.score, 0)
      return { score, stats: { n: score, solved: score === ORBS_MAX } }
    },
  ),
  // Krillion re-judges each round's accepted answer against the original's answer list. A round sends '' when nothing
  // was accepted, which scores 0, and the per-round clock cannot be replayed.
  krillion: verifier(z.array(z.string().max(256)).length(7), async (day, answers) => {
    const rounds = await Promise.all(answers.map((a, i) => (a.trim() ? judgeAnswer(day, i, a) : null)))
    const accepted = rounds.filter((r) => r?.accepted)
    return { score: accepted.reduce((t, r) => t + r!.score, 0), stats: { n: accepted.length, solved: true, max: 700 } }
  }),
}
