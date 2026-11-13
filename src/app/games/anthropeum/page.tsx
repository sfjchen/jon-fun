import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Anthropeum' }

const SRC = 'https://anthropeum.com/'

/** Frames the official Anthropeum game unmodified so it plays inside the home-screen app. */
export default function AnthropeumPage() {
  return (
    <>
      <iframe
        src={SRC}
        title="Anthropeum"
        allow="clipboard-write; web-share; fullscreen"
        className="min-h-0 w-full flex-1 border-0"
      />
      <p className="pb-safe flex-none px-3 py-1 text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
        Official game from{' '}
        <a href={SRC} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--ink-accent)' }}>
          anthropeum.com
        </a>
      </p>
    </>
  )
}
