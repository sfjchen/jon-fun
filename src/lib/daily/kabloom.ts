/**
 * Loads Kabloom by exact publisher date from a local capture or the site's published snapshot archive. A missing date is an error, never another day's climb.
 */

import { validDay } from '@/lib/daily'
import type { KabloomPuzzle } from '@/lib/kabloom'
import { validatePublisherEdition, type KabloomEdition } from '@/lib/publisher-editions/formats'
import { readPublisherEdition } from '@/lib/publisher-editions/local'

/**
 * Returns the validated edition archived for the date, without the publisher's reference runs.
 */
export async function kabloomForDay(day: string): Promise<KabloomPuzzle> {
  if (!validDay(day)) throw new Error('Invalid Kabloom date')
  const edition = await readPublisherEdition('kabloom', day).catch(async (e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e
    const url = 'https://raw.githubusercontent.com/sfjchen/jon-fun/publisher-archive/kabloom/' + day + '.json'
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('No Kabloom edition is archived for this date')
    return validatePublisherEdition('kabloom', day, await response.json())
  })
  const { category, readingMs, answerMs, answers, rounds } = edition.payload as KabloomEdition
  return { date: edition.sourceDate, editionId: edition.editionId, category, readingMs, answerMs, answers, rounds }
}
