/**
 * Loads Kabloom by exact publisher date from the local publisher-edition archive (`.publisher-editions/kabloom`),
 * which Git and Vercel ignore. A missing date is an error, never another day's climb.
 */

import type { KabloomPuzzle } from '@/lib/kabloom'
import type { KabloomEdition } from '@/lib/publisher-editions/formats'
import { readPublisherEdition } from '@/lib/publisher-editions/local'

/**
 * Returns the validated edition archived for the date, without the publisher's reference runs.
 */
export async function kabloomForDay(day: string): Promise<KabloomPuzzle> {
  const edition = await readPublisherEdition('kabloom', day).catch((e: NodeJS.ErrnoException) => {
    throw e.code === 'ENOENT' ? new Error('No Kabloom edition is archived for this date') : e
  })
  const { category, readingMs, answerMs, answers, rounds } = edition.payload as KabloomEdition
  return { date: edition.sourceDate, editionId: edition.editionId, category, readingMs, answerMs, answers, rounds }
}
