/**
 * Round 1: matchups (i, i+1 mod n). Round 2: (i, i+2 mod n) so edges differ when n>=3.
 * Each player appears in exactly two matchups per round.
 */

export function buildQuiplashMatchups(
  playerIds: string[],
  promptTexts: string[],
  roundIndex: 1 | 2,
): { promptText: string; a: string; b: string }[] {
  const n = playerIds.length
  if (n < 3) return []
  const step = roundIndex === 1 ? 1 : 2
  const out: { promptText: string; a: string; b: string }[] = []
  for (let i = 0; i < n; i++) {
    const a = playerIds[i]!
    const b = playerIds[(i + step) % n]!
    const promptText = promptTexts[i % promptTexts.length] ?? `Prompt ${i + 1}`
    out.push({ promptText, a, b })
  }
  return out
}
