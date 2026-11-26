/** The ranked Orbs daily. */

import DailyGame from '@/components/daily/DailyGame'

export const metadata = { title: 'Orbs · Daily Trivia' }

/** Opens the shared daily shell with the Orbs puzzle. */
export default function Page() {
  return <DailyGame game="orbs" />
}
