import type { WeddingData } from '@/data/wedding/madelyn-patrick'
import { venmoPayUrl } from '@/data/wedding/madelyn-patrick'
import { WeddingSection } from '@/components/wedding/WeddingSection'

type WeddingRegistryProps = {
  wedding: WeddingData
}

export function WeddingRegistry({ wedding }: WeddingRegistryProps) {
  const { venmo } = wedding.registry
  const hasVenmo = Boolean(venmo.bride || venmo.groom)

  return (
    <WeddingSection id="registry" title="Registry">
      <div className="text-center">
        <p className="mx-auto max-w-md text-base leading-[1.75]" style={{ color: 'var(--wedding-text)' }}>
          {wedding.registry.message}
        </p>
        {hasVenmo ? (
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {venmo.bride && (
              <a href={venmoPayUrl(venmo.bride)} target="_blank" rel="noopener noreferrer" className="wedding-btn-primary min-w-[200px]">
                Venmo {wedding.couple.brideShort}
              </a>
            )}
            {venmo.groom && (
              <a href={venmoPayUrl(venmo.groom)} target="_blank" rel="noopener noreferrer" className="wedding-btn-outline min-w-[200px]">
                Venmo {wedding.couple.groomShort}
              </a>
            )}
          </div>
        ) : (
          <p className="mt-8 text-sm italic leading-relaxed" style={{ color: 'var(--wedding-muted)' }}>
            {wedding.registry.submessage}
          </p>
        )}
      </div>
    </WeddingSection>
  )
}
