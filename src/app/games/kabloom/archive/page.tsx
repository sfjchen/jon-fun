/** Kabloom archive page: every past climb in the local publisher archive, in the daily-game header. */

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import DayArchive from '@/components/daily/DayArchive'
import { siteDay, validDay } from '@/lib/daily'

export const metadata = { title: 'Kabloom Archive' }
export const dynamic = 'force-dynamic'

/**
 * Lists the captured editions before today, newest first, so the archive links only dates that open and never
 * spoils today's climb. A deploy without the local archive lists none.
 */
export default async function Page() {
  const files = await readdir(path.join(process.cwd(), '.publisher-editions', 'kabloom')).catch(() => [])
  const today = siteDay()
  const days = files
    .map((f) => f.replace(/\.json$/, ''))
    .filter((d) => validDay(d) && d < today)
    .sort()
    .reverse()
  return <DayArchive game="kabloom" days={days} nouns={['climb', 'climbs']} />
}
