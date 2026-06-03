import type { ReactNode } from 'react'

type WeddingSectionHeaderProps = {
  title: string
  subtitle?: string | undefined
}

export function WeddingSectionHeader({ title, subtitle }: WeddingSectionHeaderProps) {
  return (
    <header className="mb-12 text-center">
      <p className="wedding-eyebrow">Celebrate with us</p>
      <h2 className="wedding-title mt-3">{title}</h2>
      <div className="wedding-divider mx-auto mt-6" aria-hidden="true">
        <span />
        <span className="wedding-divider-mark">◆</span>
        <span />
      </div>
      {subtitle && (
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed" style={{ color: 'var(--wedding-muted)' }}>
          {subtitle}
        </p>
      )}
    </header>
  )
}

type WeddingSectionProps = {
  id: string
  title: string
  subtitle?: string | undefined
  children: ReactNode
  className?: string
  reveal?: boolean
}

export function WeddingSection({ id, title, subtitle, children, className = '', reveal = true }: WeddingSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-[4.5rem] border-t py-16 sm:py-20 ${reveal ? 'wedding-reveal' : ''} ${className}`}
      style={{ borderColor: 'var(--wedding-border)' }}
    >
      <div className="mx-auto max-w-2xl px-4">
        <WeddingSectionHeader title={title} {...(subtitle ? { subtitle } : {})} />
        {children}
      </div>
    </section>
  )
}
