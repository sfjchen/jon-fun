import { z } from 'zod'
import type { NytGame } from '@/lib/daily'
import { score } from '@/lib/spelling-bee'

export const NYT_PATH: Record<NytGame, string> = { fivefold: 'wordle/v2', bee: 'spelling-bee/v1', mini: 'crosswords/v6/puzzle/mini', connections: 'connections/v2' }
const word = z.string().regex(/^[a-z]+$/)
const dated = z.object({ print_date: z.string() })

/** Fail closed when an upstream schema or publication date changes. */
export function normalizeNytPuzzle(game: NytGame, value: unknown, day: string) {
  if (game === 'fivefold') {
    const p = dated.extend({ id: z.number(), solution: word.length(5), days_since_launch: z.number(), editor: z.string().optional() }).parse(value)
    if (p.print_date !== day) throw Error('NYT returned a different puzzle date')
    return { date: day, answer: p.solution, id: p.id, number: p.days_since_launch, editor: p.editor ?? '' }
  }
  if (game === 'bee') {
    // The feed lists pangrams outside its answers on most days, so both lists make up the accepted words.
    const p = dated.extend({ center_letter: word.length(1), outer_letters: z.union([word.length(6), z.array(word.length(1)).length(6)]), answers: z.array(word.min(4)).nonempty(), pangrams: z.array(word).nonempty() }).parse(value)
    // The NYT sometimes publishes a pangram only in the pangrams field.
    const center = p.center_letter, outer = [...p.outer_letters], letters = new Set([center, ...outer]), answers = [...new Set([...p.answers, ...p.pangrams])].sort()
    if (p.print_date !== day || letters.size !== 7 || answers.some(w => !w.includes(center) || [...w].some(l => !letters.has(l)))) throw Error('Invalid NYT hive or date')
    const pangrams = answers.filter(w => new Set(w).size === 7)
    if (pangrams.length !== p.pangrams.length || p.pangrams.some(w => !pangrams.includes(w))) throw Error('Incomplete NYT pangrams')
    return { date: day, id: center + outer.join(''), center, outer, answers, pangrams, max: answers.reduce((n, w) => n + score(w), 0) }
  }
  if (game === 'connections') {
    const p = dated.extend({ categories: z.array(z.object({ title: z.string().min(1), cards: z.array(z.object({ content: z.string().min(1).optional(), image_url: z.string().url().optional(), image_alt_text: z.string().min(1).optional(), position: z.number().int().min(0).max(15) })).length(4) })).length(4) }).parse(value)
    const cards = p.categories.flatMap(c => c.cards)
    const label = (c: typeof cards[number]) => c.content ?? c.image_alt_text ?? ''
    if (cards.some(c => !label(c) || (c.image_url && !/^https:\/\/(?:games-assets\.storage\.googleapis\.com|games-phoenix-assets-prd\.s3\.us-east-1\.amazonaws\.com)\/images\/connections\//.test(c.image_url)))) throw Error('Unsupported Connections tile')
    if (p.print_date !== day || new Set(cards.map(label)).size !== 16 || new Set(cards.map(c => c.position)).size !== 16) throw Error('Unsupported NYT Connections puzzle or date')
    const id = `nyt-archive-${day}`
    return { date: day, id, slug: id, version: 1 as const, title: `Connections · ${day}`, description: `Original NYT puzzle for ${day}`, groups: p.categories.map((c, i) => ({ category: c.title, difficulty: (['yellow', 'green', 'blue', 'purple'] as const)[i]!, words: c.cards.map(label) as [string, string, string, string] })), startingWords: [...cards].sort((a,b) => a.position-b.position).map(label), tileImages: Object.fromEntries(cards.filter(c => c.image_url).map(c => [label(c), { url: c.image_url!, alt: label(c) }])), difficultyKnown: true, tags: ['nyt', day], authorDisplay: 'The New York Times', authorFingerprint: '', createdAt: `${day}T00:00:00Z`, updatedAt: `${day}T00:00:00Z` }
  }
  const p = z.object({ publicationDate: z.string(), id: z.number(), constructors: z.array(z.string()).optional(), editor: z.string().optional(), copyright: z.string().optional(), body: z.array(z.object({ dimensions: z.object({ width: z.number().int().min(1).max(25), height: z.number().int().min(1).max(25) }), cells: z.array(z.object({ answer: z.string().optional() })), clues: z.array(z.object({ label: z.union([z.string(),z.number()]), direction: z.enum(['Across','Down']), cells: z.array(z.number().int().nonnegative()).nonempty(), text: z.array(z.object({ plain: z.string() })) })).nonempty() })).nonempty() }).parse(value)
  const b = p.body[0]!, { width, height } = b.dimensions, cells = b.cells.map(c => c.answer || null)
  if (p.publicationDate !== day || cells.length !== width*height || b.clues.some(c => c.cells.some(i => !cells[i]))) throw Error('Invalid NYT Mini grid or date')
  return { date: day, id: p.id, constructors: p.constructors ?? [], editor: p.editor ?? '', copyright: p.copyright ?? '', width, height, cells, clues: b.clues.map(c => ({ number: String(c.label), direction: c.direction, text: c.text.map(t => t.plain).join(''), cells: c.cells, answer: c.cells.map(i => cells[i]).join('') })) }
}
