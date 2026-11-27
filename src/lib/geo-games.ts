/**
 * The 4 geography dailies that sfjc.dev makes itself from Natural Earth data (`data/geo/world.json`): Outline
 * (name the country from its shape), Border hop (link 2 countries through their neighbours), Pin drop (find 5 cities
 * on the map) and Ballpark (3 estimates). Each puzzle is drawn from the date, so every player gets the same one, and
 * each run replays from its moves, so the browser and the server score it with the same code.
 */

import { distanceKm, type Pin } from '@/lib/artifact-scoring'

export type Country = {
  id: string
  name: string
  lat: number
  lon: number
  pop: number
  area: number
  nb: string[]
  path: string
}
export type City = { name: string; country: string; lat: number; lon: number; pop: number }
export type World = { countries: Country[]; cities: City[] }
export type GeoGame = 'outline' | 'hop' | 'pin' | 'ballpark'
/** A replayed run: its score so far, whether it has ended, and whether it ended in a full solve. */
export type Run = { score: number; done: boolean; solved: boolean }

export const OUTLINE_TRIES = 6
/** Extra countries a Border hop allows beyond the shortest route, and what each one costs. */
const HOP_SPARE = 5,
  HOP_COST = 15

/**
 * Returns a repeatable random source for a game and day, so a date always draws the same puzzle.
 */
function dice(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (const c of seed) {
    h = Math.imul(h ^ c.charCodeAt(0), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/**
 * Draws n different items from a list.
 */
function draw<T>(list: T[], n: number, rand: () => number): T[] {
  const pool = [...list]
  return Array.from({ length: n }, () => pool.splice(Math.floor(rand() * pool.length), 1)[0]!)
}

/**
 * Folds a typed name to plain lowercase letters, so "cote d'ivoire" and "Côte d’Ivoire" match.
 */
export function plainName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()
}

/**
 * Finds the listed place a player typed: its exact name, or the only name that starts with what was typed.
 */
export function findByName<T extends { name: string }>(list: T[], typed: string): T | undefined {
  const want = plainName(typed)
  if (!want) return undefined
  const starts = list.filter((c) => plainName(c.name).startsWith(want))
  return list.find((c) => plainName(c.name) === want) ?? (starts.length === 1 ? starts[0] : undefined)
}

/**
 * Points the way from one place to another as 1 of 8 compass arrows.
 */
export function arrow(from: Pin, to: Pin): string {
  const rad = Math.PI / 180,
    dLon = (to.lon - from.lon) * rad
  const y = Math.sin(dLon) * Math.cos(to.lat * rad)
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLon)
  return '↑↗→↘↓↙←↖'[Math.round(((Math.atan2(y, x) / rad + 360) % 360) / 45) % 8]!
}

export type OutlinePuzzle = {
  date: string
  target: string
  path: string
  countries: Pick<Country, 'id' | 'name' | 'lat' | 'lon'>[]
}

/**
 * Picks the day's country among those large enough to have a readable shape.
 */
export function outlinePuzzle(world: World, day: string): OutlinePuzzle {
  const target = draw(
    world.countries.filter((c) => c.area >= 2000 && c.path),
    1,
    dice(`outline:${day}`),
  )[0]!
  return {
    date: day,
    target: target.id,
    path: target.path,
    countries: world.countries.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })),
  }
}

/**
 * Replays Outline guesses: listed countries, none twice, ending on the answer or the 6th guess. A solve scores 7
 * minus its guesses, like Wordle, and a miss scores 0.
 */
export function outlineRun(puzzle: OutlinePuzzle, moves: string[]): Run | null {
  const ids = new Set(puzzle.countries.map((c) => c.id)),
    at = moves.indexOf(puzzle.target)
  if (moves.length > OUTLINE_TRIES || new Set(moves).size !== moves.length || moves.some((m) => !ids.has(m)))
    return null
  if (at >= 0 && at !== moves.length - 1) return null
  return {
    score: at >= 0 ? OUTLINE_TRIES + 1 - moves.length : 0,
    done: at >= 0 || moves.length === OUTLINE_TRIES,
    solved: at >= 0,
  }
}

export type HopPuzzle = {
  date: string
  from: string
  to: string
  /** The fewest countries that link the 2 ends. */
  best: number
  limit: number
  countries: Pick<Country, 'id' | 'name' | 'nb'>[]
}

/**
 * Counts the border crossings from a country to every country reachable through the allowed ones.
 */
export function hops(
  countries: Pick<Country, 'id' | 'nb'>[],
  from: string,
  allowed?: Set<string>,
): Map<string, number> {
  const nb = new Map(countries.map((c) => [c.id, c.nb])),
    seen = new Map([[from, 0]])
  for (const id of seen.keys())
    for (const next of nb.get(id) ?? [])
      if (!seen.has(next) && (!allowed || allowed.has(next))) seen.set(next, seen.get(id)! + 1)
  return seen
}

/**
 * Picks 2 countries that are 2 to 4 countries apart by land.
 */
export function hopPuzzle(world: World, day: string): HopPuzzle {
  const rand = dice(`hop:${day}`),
    countries = world.countries.map(({ id, name, nb }) => ({ id, name, nb }))
  for (;;) {
    const from = draw(
      countries.filter((c) => c.nb.length),
      1,
      rand,
    )[0]!
    const far = [...hops(countries, from.id)].filter(([, n]) => n >= 3 && n <= 5)
    if (!far.length) continue
    const [to, n] = draw(far, 1, rand)[0]!
    return { date: day, from: from.id, to, best: n - 1, limit: n - 1 + HOP_SPARE, countries }
  }
}

/**
 * Replays Border hop guesses: listed countries other than the 2 ends, none twice, ending once the guessed countries
 * link the ends or the guesses run out. A shortest route scores 100 and each extra country costs 15.
 */
export function hopRun(puzzle: HopPuzzle, moves: string[]): Run | null {
  const ids = new Set(puzzle.countries.map((c) => c.id))
  if (moves.length > puzzle.limit || new Set(moves).size !== moves.length) return null
  if (moves.some((m) => !ids.has(m) || m === puzzle.from || m === puzzle.to)) return null
  const linked = (n: number) =>
    hops(puzzle.countries, puzzle.from, new Set([puzzle.to, ...moves.slice(0, n)])).has(puzzle.to)
  const solved = linked(moves.length)
  if (moves.length && linked(moves.length - 1)) return null
  return {
    score: solved ? 100 - HOP_COST * (moves.length - puzzle.best) : 0,
    done: solved || moves.length === puzzle.limit,
    solved,
  }
}

/**
 * Rates a Border hop guess by the detour it adds: 0 sits on a shortest route, and anything else is that many
 * countries longer. A country with no land link to both ends has no rating.
 */
export function hopDetour(puzzle: HopPuzzle, id: string): number | null {
  const a = hops(puzzle.countries, puzzle.from).get(id),
    b = hops(puzzle.countries, puzzle.to).get(id)
  return a === undefined || b === undefined ? null : a + b - puzzle.best - 1
}

export type PinPuzzle = { date: string; cities: Omit<City, 'pop'>[] }
export const PIN_ROUNDS = 5

/**
 * Picks the day's 5 cities.
 */
export function pinPuzzle(world: World, day: string): PinPuzzle {
  return {
    date: day,
    cities: draw(world.cities, PIN_ROUNDS, dice(`pin:${day}`)).map(({ name, country, lat, lon }) => ({
      name,
      country,
      lat,
      lon,
    })),
  }
}

/**
 * Scores a pin by its distance from the city: 1,000 on the spot, about 600 at 500 km and 135 at 2,000 km.
 */
export function pinPoints(city: Pin, pin: Pin): number {
  return Math.round(1000 * Math.exp(-distanceKm(city, pin) / 1000))
}

/**
 * Replays Pin drop: 1 pin per city, in order.
 */
export function pinRun(puzzle: PinPuzzle, moves: Pin[]): Run | null {
  if (moves.length > PIN_ROUNDS || moves.some((p) => Math.abs(p.lat) > 90 || !Number.isFinite(p.lon))) return null
  const score = moves.reduce((t, p, i) => t + pinPoints(puzzle.cities[i]!, p), 0)
  return { score, done: moves.length === PIN_ROUNDS, solved: score === 1000 * PIN_ROUNDS }
}

export type BallparkPuzzle = { date: string; questions: { text: string; unit: string; answer: number }[] }

/**
 * Asks the day's 3 estimates: a country's population, a country's area, and the distance between 2 large cities.
 */
export function ballparkPuzzle(world: World, day: string): BallparkPuzzle {
  const rand = dice(`ballpark:${day}`)
  const [people, land] = draw(
    world.countries.filter((c) => c.pop >= 1e6 && c.area >= 2000),
    2,
    rand,
  ) as [Country, Country]
  const [a, b] = draw(
    world.cities.filter((c) => c.pop >= 2e6),
    2,
    rand,
  ) as [City, City]
  return {
    date: day,
    questions: [
      { text: `How many people live in ${people.name}?`, unit: 'people', answer: people.pop },
      { text: `How large is ${land.name}?`, unit: 'km²', answer: land.area },
      {
        text: `How far is ${a.name} from ${b.name} in a straight line?`,
        unit: 'km',
        answer: Math.round(distanceKm(a, b)),
      },
    ],
  }
}

/**
 * Scores an estimate by how many times too high or too low it is: 100 when exact, 70 at double or half, 0 from 10
 * times off.
 */
export function ballparkPoints(answer: number, guess: number): number {
  if (!(guess > 0)) return 0
  return Math.max(0, Math.round(100 * (1 - Math.abs(Math.log10(guess / answer)))))
}

/**
 * Replays Ballpark: 1 positive estimate per question, in order.
 */
export function ballparkRun(puzzle: BallparkPuzzle, moves: number[]): Run | null {
  if (moves.length > puzzle.questions.length || moves.some((g) => !(g > 0) || !Number.isFinite(g))) return null
  const score = moves.reduce((t, g, i) => t + ballparkPoints(puzzle.questions[i]!.answer, g), 0)
  return { score, done: moves.length === puzzle.questions.length, solved: score === 100 * puzzle.questions.length }
}

/**
 * Reads a typed estimate such as "1,200", "3.5 million" or "2b".
 */
export function parseEstimate(typed: string): number | null {
  const m = /^([\d.]+)\s*(k|thousand|m|million|b|billion)?$/.exec(typed.trim().toLowerCase().replace(/,/g, ''))
  if (!m) return null
  const n = Number(m[1]) * { k: 1e3, t: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? ' ')[0] as 'k'] || Number(m[1])
  return n > 0 && Number.isFinite(n) ? n : null
}

/** Each game's puzzle maker and replay, for the server's daily loader and score check. */
export const GEO = {
  outline: { puzzle: outlinePuzzle, run: outlineRun },
  hop: { puzzle: hopPuzzle, run: hopRun },
  pin: { puzzle: pinPuzzle, run: pinRun },
  ballpark: { puzzle: ballparkPuzzle, run: ballparkRun },
} as const
