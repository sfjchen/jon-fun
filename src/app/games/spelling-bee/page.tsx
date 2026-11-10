import type { Metadata } from 'next'
import SpellingBee from '@/components/SpellingBee'

export const metadata: Metadata = { title: 'Spelling Bee', description: 'Make words from 7 letters. Daily puzzle, archive and unlimited practice.' }

/**
 * Renders the Spelling Bee page.
 */
export default function SpellingBeePage() {
  return <SpellingBee />
}
