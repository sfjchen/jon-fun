import type { Metadata } from 'next'
import Triples from '@/components/triples/Triples'

export const metadata: Metadata = {
  title: 'SET · Full deck & friends',
  description: 'Spot 3 cards where every feature is all the same or all different. Play solo or race friends.',
}

/**
 * Renders Triples, opening a room join form when the link has `?pin=`.
 */
export default async function TriplesPage({ searchParams }: { searchParams: Promise<{ pin?: string }> }) {
  const { pin } = await searchParams
  return <Triples key={pin ?? 'saved'} initialPin={/^\d{4}$/.test(pin ?? '') ? pin! : ''} />
}
