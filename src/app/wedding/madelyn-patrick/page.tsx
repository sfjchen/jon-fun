import type { Metadata } from 'next'
import { madelynPatrickWedding } from '@/data/wedding/madelyn-patrick'
import { WeddingDetails } from '@/components/wedding/WeddingDetails'
import { WeddingGallery } from '@/components/wedding/WeddingGallery'
import { WeddingHero } from '@/components/wedding/WeddingHero'
import { WeddingLogistics } from '@/components/wedding/WeddingLogistics'
import { WeddingRegistry } from '@/components/wedding/WeddingRegistry'
import { WeddingRsvpForm } from '@/components/wedding/WeddingRsvpForm'
import { WeddingShell } from '@/components/wedding/WeddingShell'
import { WeddingStory } from '@/components/wedding/WeddingStory'

const w = madelynPatrickWedding
const title = `${w.couple.bride} & ${w.couple.groom} · November 28, 2026`
const description = `Wedding celebration in San Francisco — ${w.displayDate}. Details, RSVP, registry, and travel info.`

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'en_US',
    url: '/wedding/madelyn-patrick',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: 'index, follow',
}

export default function MadelynPatrickWeddingPage() {
  return (
    <WeddingShell wedding={w}>
      <WeddingHero wedding={w} />
      <WeddingDetails wedding={w} />
      <WeddingRsvpForm wedding={w} />
      <WeddingStory wedding={w} />
      <WeddingLogistics wedding={w} />
      <WeddingRegistry wedding={w} />
      <WeddingGallery wedding={w} />
    </WeddingShell>
  )
}
