import { loadEnvConfig } from '@next/env'
import assert from 'node:assert/strict'
loadEnvConfig(process.cwd())
async function main() {
  const { dailyPuzzle } = await import('../src/lib/daily/server')
  const { NYT_FIRST_DAY, siteDay } = await import('../src/lib/daily')
  const day = process.argv[2] ?? siteDay()
  for (const game of Object.keys(NYT_FIRST_DAY) as (keyof typeof NYT_FIRST_DAY)[]) {
    const data = await dailyPuzzle(game, day)
    assert.equal(data.sourceDate, day)
    assert.equal((data.puzzle as { date: string }).date, day)
    console.log(game, day, 'exact publication date verified')
  }
}
void main()
