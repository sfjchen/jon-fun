/** Reads the original Orbs bank on the server, one cached file per year. */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validDay } from '@/lib/daily'
import { ORBS_ROTATION_START, type OrbsPuzzle } from '@/lib/orbs'

const years = new Map<string, Promise<Record<string, OrbsPuzzle>>>()

async function loadYear(year: string) {
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
  return pending
}

/** Published local editions take priority over the permanent rotation. */
export async function orbsForDay(day: string): Promise<OrbsPuzzle> {
  if (!validDay(day)) throw new Error('Invalid Orbs date.')
  const puzzle = (await loadYear(day.slice(0, 4)))[day]
  if (puzzle) return puzzle
  if (day >= ORBS_ROTATION_START) {
    const bank = await loadYear('2026')
    const start = Date.parse('2026-11-27')
    const offset = (Date.parse(day) - Date.parse(ORBS_ROTATION_START)) / 86_400_000
    // Use the ten complete mixed-format boards. Each theme advances at a different rate.
    const categories = [1, 3, 7, 9].map((stride, index) => {
      const position = (offset * stride + index + Math.floor(offset / 10 ** (index + 1))) % 10
      const date = new Date(start + position * 86_400_000).toISOString().slice(0, 10)
      const category = bank[date]!.categories[index]!
      return { ...category, note: [category.note, 'Local archive rotation'].filter(Boolean).join(' · ') }
    })
    return { categories }
  }
  throw new Error('There is no Orbs puzzle for this date.')
}
