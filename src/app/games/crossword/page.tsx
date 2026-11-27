import { crosswordFirstDay } from '@/lib/puzzle-rooms/crossword'
import Crossword from '@/components/puzzle-rooms/Crossword'

export const metadata = {
  title: 'Crossword',
  description: 'Solve the daily crossword with friends on one live grid.',
}

export default function Page() {
  return <Crossword firstFullDay={crosswordFirstDay(false)} />
}
