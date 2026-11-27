/** Headcount archive page: every past party by date, in the daily-game header. */

import DayArchive from '@/components/daily/DayArchive'
import { firstDay, shiftDay, siteDay } from '@/lib/daily'

export const metadata = { title: 'Headcount Archive' }
export const dynamic = 'force-dynamic'

/**
 * Lists the parties from yesterday back to the first one, so the archive never spoils today's.
 */
export default function Page() {
  const days: string[] = []
  for (let day = shiftDay(siteDay(), -1); day >= firstDay('headcount'); day = shiftDay(day, -1)) days.push(day)
  return <DayArchive game="headcount" days={days} nouns={['party', 'parties']} />
}
