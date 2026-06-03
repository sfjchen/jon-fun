import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'
import { WeddingTimeline } from '@/components/wedding/WeddingTimeline'

type WeddingDetailsProps = {
  wedding: WeddingData
}

export function WeddingDetails({ wedding }: WeddingDetailsProps) {
  return (
    <WeddingSection id="details" title="Wedding Details" subtitle="Ceremony and celebration in San Francisco">
      <WeddingTimeline events={wedding.events} />
      <div className="mt-14 grid gap-10 border-t pt-12 sm:grid-cols-2" style={{ borderColor: 'var(--wedding-border)' }}>
        <div className="text-center">
          <p className="font-wedding-display text-2xl font-light tracking-tight">{wedding.couple.brideShort}</p>
          <p className="wedding-eyebrow mt-3">{wedding.bios.bride}</p>
        </div>
        <div className="text-center">
          <p className="font-wedding-display text-2xl font-light tracking-tight">{wedding.couple.groomShort}</p>
          <p className="wedding-eyebrow mt-3">{wedding.bios.groom}</p>
        </div>
      </div>
    </WeddingSection>
  )
}
