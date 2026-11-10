/**
 * Shared randomness helpers: an unbiased Fisher-Yates shuffle and a 4-digit room PIN generator.
 */

/**
 * Returns a shuffled copy of the array using an unbiased Fisher-Yates pass.
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * Returns a random 4-digit PIN string from 1000 to 9999.
 */
export function randomPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}
