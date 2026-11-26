/** Reads the original Orbs bank on the server, one cached file per year. */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { OrbsPuzzle } from '@/lib/orbs'

const years = new Map<string, Promise<Record<string, OrbsPuzzle>>>()

/** Loads exactly the requested day, with no fallback to another round. */
export async function orbsForDay(day: string): Promise<OrbsPuzzle> {
  const year = day.slice(0, 4)
  let pending = years.get(year)
  if (!pending) {
    pending = readFile(path.join(process.cwd(), 'data/orbs', `${year}.json`), 'utf8')
      .then((data) => JSON.parse(data) as Record<string, OrbsPuzzle>)
      .catch((error: NodeJS.ErrnoException) => {
        years.delete(year)
        if (error.code === 'ENOENT') return {}
        throw error
      })
    years.set(year, pending)
  }
  const puzzle = (await pending)[day]
  if (!puzzle) throw new Error('There is no Orbs puzzle for this date.')
  return puzzle
}
