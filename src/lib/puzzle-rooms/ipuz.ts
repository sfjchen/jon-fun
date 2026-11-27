/** Converts ordinary blocked crosswords from an authorized ipuz JSON feed. */
import { parse } from 'node-html-parser'
import { z } from 'zod'
import { validDay } from '@/lib/daily'
import { cellEntry } from './types'

const entryNumber = z.union([z.number().int().positive(), z.string().regex(/^\d{1,3}$/)]).transform(String)
const clue = z.tuple([entryNumber, z.string().min(1)])
const gridValue = z.union([z.string(), z.number(), z.null()])
const style = z.strictObject({ shapebg: z.literal('circle').optional() })
const numberedCell = z.union([
  gridValue,
  z.strictObject({ cell: gridValue.optional(), style: z.union([style, z.string()]).optional() }),
])
const ipuz = z.looseObject({
  version: z.string().regex(/^https?:\/\/ipuz\.org\/v[12]$/),
  kind: z.tuple([z.string().regex(/^https?:\/\/ipuz\.org\/crossword(?:#1)?$/)]),
  date: z.string(),
  uniqueid: z.string().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  copyright: z.string().optional(),
  url: z.url({ protocol: /^https$/ }).optional(),
  block: z.string().default('#'),
  empty: gridValue.default(0),
  styles: z.record(z.string(), style).optional(),
  dimensions: z.object({ width: z.number().int().min(3).max(25), height: z.number().int().min(3).max(25) }),
  puzzle: z.array(z.array(numberedCell)),
  solution: z.array(z.array(gridValue)),
  clues: z.object({ Across: z.array(clue), Down: z.array(clue) }),
})

/** Removes markup from text shown by the existing shared crossword renderer. */
function plain(value = '') {
  return parse(value).text.trim()
}

/** Reads the embedded publication date and resolves clue labels against the blocked grid. */
export function crosswordFromIpuz(value: unknown, day: string) {
  const puzzle = ipuz.parse(value)
  const { width, height } = puzzle.dimensions
  const date = puzzle.date.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$1-$2')
  if (!validDay(date) || date !== day) throw new Error('The ipuz publication date does not match')
  if (
    [puzzle.puzzle, puzzle.solution].some((grid) => grid.length !== height || grid.some((row) => row.length !== width))
  ) {
    throw new Error('The ipuz grid does not match its dimensions')
  }

  const circles: number[] = []
  const labelToCell = new Map<string, number>()
  const solution = puzzle.solution.flat()
  const cells = puzzle.puzzle.flat().map((item, cell) => {
    const wrapped = item && typeof item === 'object' ? item : null
    const style = typeof wrapped?.style === 'string' ? puzzle.styles?.[wrapped.style] : wrapped?.style
    if (wrapped?.style && !style) throw new Error('Unknown ipuz cell style')
    const label = wrapped ? (wrapped.cell !== undefined ? wrapped.cell : puzzle.empty) : item
    const opening = label !== null && label !== puzzle.block
    const answer = solution[cell]
    if (!opening) {
      if (answer !== null && answer !== puzzle.block) throw new Error('The ipuz block masks do not agree')
      return null
    }
    if (typeof answer !== 'string' || !answer || answer === puzzle.block || !cellEntry.test(answer)) {
      throw new Error('The ipuz solution contains an unsupported entry')
    }
    if (style?.shapebg === 'circle') circles.push(cell)
    const number = entryNumber.safeParse(label)
    if (number.success && number.data !== '0') {
      if (labelToCell.has(number.data)) throw new Error('Repeated ipuz grid label')
      labelToCell.set(number.data, cell)
    }
    return answer
  })

  const clues = (['Across', 'Down'] as const).flatMap((direction) =>
    puzzle.clues[direction].map(([number, html]) => {
      const start = labelToCell.get(number)
      if (start === undefined) throw new Error('An ipuz clue has no matching numbered square')
      const across = direction === 'Across'
      const step = across ? 1 : width
      const previous = start - step
      if ((!across || start % width !== 0) && cells[previous]) throw new Error('An ipuz clue starts inside an entry')
      const indices = []
      for (let i = start; cells[i] && (!across || Math.floor(i / width) === Math.floor(start / width)); i += step) {
        indices.push(i)
      }
      return { number, direction, text: plain(html), cells: indices }
    }),
  )

  return {
    date,
    width,
    height,
    cells,
    clues,
    ...(circles.length && { circles }),
    title: plain(puzzle.title) || 'Daily Crossword',
    credit:
      [puzzle.author, puzzle.publisher, puzzle.copyright].map(plain).filter(Boolean).join(' · ') ||
      'Publisher crossword',
    ...(puzzle.uniqueid && { editionId: puzzle.uniqueid }),
    ...(puzzle.url && { creditUrl: puzzle.url }),
  }
}
