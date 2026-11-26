import Crossword from '@/components/puzzle-rooms/Crossword'

export const metadata = {
  title: 'Crossword Together',
  description: 'Solve the daily crossword with friends on one live grid.',
}

export default function Page() {
  return <Crossword hasDailyFeed={Boolean(process.env.CROSSWORD_DAILY_FEED_URL)} />
}
