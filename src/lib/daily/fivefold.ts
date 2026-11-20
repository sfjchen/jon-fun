/**
 * Wordle rules shared by the player and the results API: letter marks, hard-mode checks, and a replay that turns a
 * list of guesses into the score the server stores, so a result is computed from the moves rather than trusted.
 */

export type Mark = 'hit' | 'near' | 'miss'
export const FIVEFOLD_TRIES = 6
const ORD = ['1st', '2nd', '3rd', '4th', '5th']

/**
 * Marks each letter of a guess: right spot, elsewhere in the word (counting repeats), or absent.
 */
export function marks(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(5).fill('miss')
  const left = new Map<string, number>()
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) out[i] = 'hit'
    else left.set(answer[i]!, (left.get(answer[i]!) ?? 0) + 1)
  }
  for (let i = 0; i < 5; i++) {
    const n = left.get(guess[i]!) ?? 0
    if (out[i] === 'hit' || !n) continue
    out[i] = 'near'
    left.set(guess[i]!, n - 1)
  }
  return out
}

/**
 * Returns the first hard-mode violation of a draft against earlier guesses, or an empty string.
 */
export function hardError(draft: string, guesses: string[], answer: string): string {
  const need = new Map<string, number>()
  for (const g of guesses) {
    const m = marks(g, answer)
    const n = new Map<string, number>()
    for (let i = 0; i < 5; i++) {
      if (m[i] === 'hit' && draft[i] !== g[i]) return `${ORD[i]} letter must be ${g[i]!.toUpperCase()}`
      if (m[i] !== 'miss') n.set(g[i]!, (n.get(g[i]!) ?? 0) + 1)
    }
    n.forEach((c, l) => need.set(l, Math.max(need.get(l) ?? 0, c)))
  }
  for (const [l, c] of need)
    if ([...draft].filter((x) => x === l).length < c) return `Guess must contain ${l.toUpperCase()}`
  return ''
}

/**
 * Replays a finished game against the answer: every guess must be a listed word (or the answer), the game must end
 * on the answer or the 6th guess, and hard mode must hold on every guess when claimed. Returns the score (7 minus
 * guesses, 0 for a loss) or the reason the guesses are not a valid game.
 */
export function replayFivefold(
  guesses: string[],
  answer: string,
  listed: (word: string) => boolean,
  hard: boolean,
): { score: number; n: number; solved: boolean } | { error: string } {
  if (!guesses.length || guesses.length > FIVEFOLD_TRIES) return { error: 'A game has 1 to 6 guesses' }
  for (const [i, g] of guesses.entries()) {
    if (!/^[a-z]{5}$/.test(g) || (g !== answer && !listed(g)))
      return { error: `Guess ${i + 1} is not in the word list` }
    if (g === answer && i < guesses.length - 1) return { error: 'Guesses continue after the answer' }
    if (hard && hardError(g, guesses.slice(0, i), answer)) return { error: `Guess ${i + 1} breaks hard mode` }
  }
  const solved = guesses.at(-1) === answer
  if (!solved && guesses.length < FIVEFOLD_TRIES) return { error: 'The game is not finished' }
  return { score: solved ? FIVEFOLD_TRIES + 1 - guesses.length : 0, n: guesses.length, solved }
}
