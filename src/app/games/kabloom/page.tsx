/** Daily Kabloom page: the publisher's dated climb in the shared daily shell. */

import DailyGame from '@/components/daily/DailyGame'
export const metadata = { title: 'Daily Kabloom' }

/**
 * Renders the climb for the `?d=` day, or today.
 */
export default function Page() {
  return <DailyGame game="kabloom" />
}
