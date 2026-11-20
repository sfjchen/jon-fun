import DailyGame from '@/components/daily/DailyGame'
export const metadata = { title: 'Daily Wordle' }
export default function Page() {
  return <DailyGame game="fivefold" />
}
