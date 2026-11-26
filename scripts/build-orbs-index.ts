/** Validates the dated Orbs bank and publishes an index containing dates only. */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { shiftDay, validDay } from '../src/lib/daily'
import { ORBS_CATEGORIES, ORBS_CATEGORY_SIZE, ORBS_FIRST_DAY, type OrbsCategoryId } from '../src/lib/orbs'

const categories = Object.keys(ORBS_CATEGORIES) as OrbsCategoryId[]
const bankSchema = z.record(
  z.string(),
  z.object({
    categories: z
      .array(
        z.object({
          id: z.enum(categories),
          title: z.string(),
          questions: z
            .array(
              z.object({
                prompt: z.string().trim().min(1),
                options: z.tuple([z.string().trim().min(1), z.string().trim().min(1), z.string().trim().min(1)]),
                answer: z.number().int().min(0).max(2),
              }),
            )
            .length(ORBS_CATEGORY_SIZE),
        }),
      )
      .length(categories.length),
  }),
)

/** Rebuilds or checks the public index after validating dates, categories and unique answer options. */
async function main() {
  const root = path.join(process.cwd(), 'data/orbs')
  const index = { trivia: [], words: [], geography: [], science: [] } as Record<OrbsCategoryId, string[]>
  let expected = ORBS_FIRST_DAY
  for (const file of (await readdir(root)).filter((name) => /^\d{4}\.json$/.test(name)).sort()) {
    const bank = bankSchema.parse(JSON.parse(await readFile(path.join(root, file), 'utf8')))
    for (const day of Object.keys(bank).sort()) {
      if (!validDay(day) || !day.startsWith(file.slice(0, 4)) || day !== expected)
        throw new Error(`${file}: expected ${expected}, found ${day}`)
      const ids = new Set<OrbsCategoryId>()
      for (const { id, title, questions } of bank[day]!.categories) {
        if (ids.has(id) || title !== ORBS_CATEGORIES[id]) throw new Error(`${day}: invalid ${id} category`)
        ids.add(id)
        for (const question of questions) {
          if (new Set(question.options).size !== question.options.length)
            throw new Error(`${day}: duplicate option for "${question.prompt}"`)
        }
        index[id].push(day)
      }
      expected = shiftDay(day, 1)
    }
  }
  if (expected === ORBS_FIRST_DAY) throw new Error('The Orbs bank is empty')
  const target = path.join(process.cwd(), 'public/orbs/categories.json')
  const content = JSON.stringify(index, null, 2) + '\n'
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')) !== content) throw new Error('Regenerate the Orbs archive index')
  } else {
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
