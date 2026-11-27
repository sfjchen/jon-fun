import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const answer = z.object({ word: z.string(), points: z.number().int().min(0).max(1000) })
const edition = z.object({
  date: z.string(),
  pairs: z
    .array(
      z.object({
        anchors: z.array(z.string()).min(1).max(3),
        answers: z.array(answer).min(1),
        accepted: z.array(answer),
      }),
    )
    .length(5),
})
export type Edition = z.infer<typeof edition>

export async function chainleForDay(day: string) {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path.join(process.cwd(), 'data/chainle', day + '.json'), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const response = await fetch('https://chainle.io/api/archive?date=' + day, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('Unavailable')
    raw = await response.json()
  }
  const parsed = edition.parse(raw)
  if (parsed.date !== day) throw new Error('Wrong edition')
  return parsed
}
